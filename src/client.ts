import { EventEmitter } from 'eventemitter3';
import { 
  SynapseConfig, 
  RpcRequest, 
  RpcResponse, 
  RequestOptions,
  SynapseError,
  NetworkError,
  ClientStats
} from './types';
import { SignatureInfo } from './ai';

/**
 * @name SynapseClient
 * @description The core client for interacting with the Synapse RPC Gateway. This class handles all low-level communication with the gateway, including request serialization, response deserialization, and error handling.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @constructor SynapseConfig
 */

export class SynapseClient extends EventEmitter {
  private config: SynapseConfig & { timeout: number; debug: boolean };
  private requestId = 0;
  private stats: ClientStats;

  constructor(config: SynapseConfig) {
    super();
    
    this.config = {
      timeout: 30000,
      debug: false,
      ...config
    };

    this.stats = {
      requestCount: 0,
      errorCount: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      uptime: Date.now(),
      activeConnections: 0,
      pendingRequests: 0
    };

    if (this.config.debug) {
      console.log('🚀 Synapse Client initialized:', this.config.endpoint);
    }
  }

  /**
   * Get endpoint URL
   */
  get endpoint(): string {
    return this.config.endpoint;
  }

  /**
   * Get API key
   */
  get apiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * Make a single RPC call 
   * Uses zero-copy operations, early returns, and minimal branching
   */
  async call<T = any>(
    method: string, 
    params: any = [], 
    options: RequestOptions = {}
  ): Promise<T> {
    // Fast path: increment stats inline (avoid function calls)
    const id = ++this.requestId;
    ++this.stats.pendingRequests;
    ++this.stats.requestCount;
    
    // Conditional debug only when needed
    const startTime = this.config.debug ? performance.now() : 0;
    
    if (this.config.debug) {
      console.log(`${id} ${method}`, params.length > 0 ? params : '');
    }

    try {
      // Single RPC call with rotation
      const response = await this.sendRpcWithRotation(method, params, options);

      // Fast path: check for error first (most common case is success)
      if (!response.error) {
        // Update stats inline for hot path
        if (this.config.debug) {
          const latency = performance.now() - startTime;
          this.updateLatencyStats(latency);
          console.log(`📥 [${id}] ✅ ${Math.round(latency)}ms`);
        }
        
        --this.stats.pendingRequests;
        return response.result;
      }

      // Error path: build detailed error
      ++this.stats.errorCount;
      --this.stats.pendingRequests;
      
      const err = new SynapseError(
        response.error.message,
        response.error.code,
        undefined
      ) as any;
      
      // Attach upstream data if present
      const data = (response.error as any).data;
      if (data && typeof data === 'object') {
        err.data = data;
        if (data.upstreamName) err.upstreamName = data.upstreamName;
        if (data.upstreamUrl) err.upstreamUrl = data.upstreamUrl;
      }
      
      throw err;

    } catch (error: any) {
      // Catch path: handle exceptions
      ++this.stats.errorCount;
      --this.stats.pendingRequests;

      if (this.config.debug) {
        const latency = performance.now() - startTime;
        console.error(`[${id}] ${Math.round(latency)}ms`, error.message);
      }

      // Re-throw SynapseError as-is (avoid wrapping)
      if (error instanceof SynapseError) {
        throw error;
      }

      throw new NetworkError(`Request failed: ${error.message}`, error);
    }
  }

  /**
   * Send an RPC request with automatic upstream rotation on "method not allowed" errors.
   */
  private async sendRpcWithRotation(
    method: string,
    params: any[],
    options: RequestOptions
  ): Promise<RpcResponse> {
    const maxAttempts = Math.max(1, (options.maxRetries ?? 3));

    let lastResponse: RpcResponse | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const req: RpcRequest = {
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params
      };

      const routeOptions: RequestOptions = {
        ...options,
        routeHint: 'rotate',
        routeIndex: attempt
      };

      const res = await this.makeHttpRequest(req, routeOptions);

      // If batch somehow returned, surface error
      if (Array.isArray(res)) {
        throw new SynapseError('Expected single response but received batch', -32000);
      }

      // If result present, return immediately
      if (!res.error) return res;

      // If method not allowed, try next attempt (rotate)
      const msg = res.error.message?.toLowerCase?.() || '';
      if (res.error.code === -32601 || msg.includes('method not allowed')) {
        lastResponse = res;
        continue;
      }

      // Other errors: return as-is
      return res;
    }

    // Exhausted attempts; return last response (likely method not allowed)
    if (lastResponse) return lastResponse;
    // Fallback: generic error
    return { jsonrpc: '2.0', id: ++this.requestId, error: { code: -32000, message: 'Unknown error' } };
  }

  /**
   * Make multiple RPC calls in batch
   */
  async batch<T = any>(
    requests: Array<{ method: string; params?: any[] }>,
    options: RequestOptions = {}
  ): Promise<T[]> {
    const batchRequest = requests.map((req, index) => ({
      jsonrpc: '2.0' as const,
      id: ++this.requestId,
      method: req.method,
      params: req.params || []
    }));

    if (this.config.debug) {
      console.log(`📦 Batch request: ${requests.length} methods`);
    }

    const response = await this.makeHttpRequest(batchRequest, options);

    if (!Array.isArray(response)) {
      throw new SynapseError('Invalid batch response format', -32000);
    }

    return response.map((res: RpcResponse<T>) => {
      if (res.error) {
        throw new SynapseError(res.error.message, res.error.code, res.error.data);
      }
      if (typeof res.result === 'undefined') {
        throw new SynapseError('Batch response missing result', -32000);
      }
      return res.result;
    });
  }

  /**
   * Internal HTTP request handler
   */
  private async makeHttpRequest(
    request: RpcRequest | RpcRequest[], 
    options: RequestOptions
  ): Promise<RpcResponse | RpcResponse[]> {
    const timeout = options.timeout || this.config.timeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.config.endpoint + '/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'User-Agent': 'synapse-client-sdk/1.0.0'
          , ...(options.routeHint ? { 'X-Route-Hint': String(options.routeHint) } : {}),
          ...(typeof options.routeIndex === 'number' ? { 'X-Route-Index': String(options.routeIndex) } : {})
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check for cache hit header
      const cacheHit = response.headers.get('x-cache-status') === 'hit';
      if (cacheHit) {
        this.stats.cacheHitRate = (this.stats.cacheHitRate + 1) / 2; // Simple moving average
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get a signature for a given address and message.
   * @param address The base-58 encoded account address (required).
   * @param options Optional configuration object:
   *   - commitment: string
   *   - minContextSlot: number
   *   - limit: number
   *   - before: string
   *   - until: string
   * @returns The signature info array.
   */
  async getSignatureForAddress(
    address: string,
    options?: {
      commitment?: string;
      minContextSlot?: number;
      limit?: number;
      before?: string;
      until?: string;
    }
  ): Promise<SignatureInfo[]> {
    const params = address;
    return await this.call('getSignatureForAddress', params, );
  }

  /**
   * Update latency statistics
   */
  private updateLatencyStats(latency: number) {
    // Exponential moving average
    const alpha = 0.1;
    this.stats.averageLatency = this.stats.averageLatency * (1 - alpha) + latency * alpha;
  }

  /**
   * Get client statistics
   */
  getStats(): ClientStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      requestCount: 0,
      errorCount: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      uptime: Date.now(),
      activeConnections: 0,
      pendingRequests: 0
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.config.endpoint + '/health', {
        headers: { 'X-API-Key': this.config.apiKey }
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Get gateway performance metrics
   */
  async getGatewayMetrics(): Promise<any> {
    const response = await fetch(this.config.endpoint + '/performance', {
      headers: { 'X-API-Key': this.config.apiKey }
    });
    
    if (!response.ok) {
      throw new NetworkError(`Failed to get metrics: HTTP ${response.status}`);
    }
    
    return await response.json();
  }
}
