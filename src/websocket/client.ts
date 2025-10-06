import { EventEmitter } from 'eventemitter3';
import WebSocket from 'ws';
import { SmartCaching } from '../advanced/smart-caching';
import { CircuitBreaker } from '../advanced/circuit-breaker';

interface WebSocketMessage {
  id: number;
  method: string;
  params?: any[];
  result?: any;
  error?: any;
  subscription?: number;
}

export interface SubscriptionOptions {
  commitment?: 'processed' | 'confirmed' | 'finalized';
  enableCache?: boolean;
  enableFiltering?: boolean;
  customFilters?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  resilient?: boolean;
}

export interface WebSocketConfig {
  endpoint: string;
  apiKey?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  enableCompression?: boolean;
  enableSmartCaching?: boolean;
  enableCircuitBreaker?: boolean;
  maxSubscriptions?: number;
  bufferSize?: number;
}

interface RequiredWebSocketConfig {
  endpoint: string;
  apiKey: string;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  enableCompression: boolean;
  enableSmartCaching: boolean;
  enableCircuitBreaker: boolean;
  maxSubscriptions: number;
  bufferSize: number;
}

export class WebSocketClient extends EventEmitter {
  private config: RequiredWebSocketConfig;
  private ws?: WebSocket;
  private nextId = 1;
  private subscriptions = new Map<number, {
    method: string;
    params: any[];
    options: SubscriptionOptions;
    lastUpdate: number;
    callback: (data: any) => void;
  }>();
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }>();
  
  private smartCache?: SmartCaching;
  private circuitBreaker?: CircuitBreaker;
  
  private reconnectAttempts = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private isDestroyed = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  
  // Metrics
  private metrics = {
    messagesReceived: 0,
    messagesSent: 0,
    subscriptionsActive: 0,
    reconnectCount: 0,
    lastLatency: 0,
    averageLatency: 0
  };

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 5000,
      heartbeatInterval: 30000,
      enableCompression: true,
      enableSmartCaching: true,
      enableCircuitBreaker: true,
      maxSubscriptions: 1000,
      bufferSize: 16 * 1024 * 1024, // 16MB
      apiKey: config.apiKey || '',
      ...config
    };

    this.initializeAdvancedFeatures();
  }

  /**
   * 🔌 Connect with enterprise features
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      return;
    }

    return new Promise((resolve, reject) => {
      this.connectionState = 'connecting';
      
      try {
        const wsUrl = this.config.endpoint.replace(/^http/, 'ws');
        const headers: Record<string, string> = {};
        
        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        this.ws = new WebSocket(wsUrl, {
          headers,
          perMessageDeflate: this.config.enableCompression,
          maxPayload: this.config.bufferSize
        });

        this.ws.on('open', () => {
          console.log('[Synapse]: Advanced WebSocket connected');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: any) => {
          this.handleMessage(Buffer.from(data));
        });

        this.ws.on('close', (code, reason) => {
          this.handleDisconnect(code, reason.toString());
          this.emit('disconnected', { code, reason: reason.toString() });
        });

        this.ws.on('error', (error) => {
          console.error('[Synapse]: WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });

        // Timeout handler
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            reject(new Error('[Synapse]: WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * 📡 Enhanced subscription with AI optimizations
   */
  async accountSubscribe(
    publicKey: string,
    callback: (accountInfo: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<number> {
    const method = 'accountSubscribe';
    const params = [
      publicKey,
      {
        commitment: options.commitment || 'confirmed',
        encoding: 'jsonParsed'
      }
    ];

    return this.subscribe(method, params, callback, options);
  }

  /**
   *  Signature subscription with filtering
   */
  async signatureSubscribe(
    signature: string,
    callback: (signatureInfo: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<number> {
    const method = 'signatureSubscribe';
    const params = [signature, { commitment: options.commitment || 'confirmed' }];

    return this.subscribe(method, params, callback, options);
  }

  /**
   *  Slot subscription with caching
   */
  async slotSubscribe(
    callback: (slotInfo: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<number> {
    const method = 'slotSubscribe';
    return this.subscribe(method, [], callback, options);
  }

  /**
   *  Root subscription
   */
  async rootSubscribe(
    callback: (rootInfo: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<number> {
    const method = 'rootSubscribe';
    return this.subscribe(method, [], callback, options);
  }

  /**
   *  Program subscription with filtering
   */
  async programSubscribe(
    programId: string,
    callback: (accountInfo: any) => void,
    options: SubscriptionOptions & {
      filters?: any[];
      encoding?: 'base58' | 'base64' | 'jsonParsed';
    } = {}
  ): Promise<number> {
    const method = 'programSubscribe';
    const params = [
      programId,
      {
        commitment: options.commitment || 'confirmed',
        encoding: options.encoding || 'jsonParsed',
        filters: options.filters || []
      }
    ];

    return this.subscribe(method, params, callback, options);
  }

  /**
   *  Enhanced unsubscribe
   */
  async unsubscribe(subscriptionId: number): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    await this.request(`${subscription.method.replace('Subscribe', 'Unsubscribe')}`, [subscriptionId]);
    this.subscriptions.delete(subscriptionId);
    this.metrics.subscriptionsActive--;
  }

  /**
   *  Generic subscription handler
   */
  private async subscribe(
    method: string,
    params: any[],
    callback: (data: any) => void,
    options: SubscriptionOptions
  ): Promise<number> {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscriptions reached');
    }

    const subscriptionId = await this.request(method, params);
    
    // Enhanced callback with caching and filtering
    const enhancedCallback = (data: any) => {
      try {
        // Apply custom filters
        if (options.enableFiltering && options.customFilters) {
          if (!this.matchesFilters(data, options.customFilters)) {
            return; // Skip filtered data
          }
        }

        // Cache recent data
        if (options.enableCache && this.smartCache) {
          const cacheKey = `ws:${method}:${subscriptionId}:latest`;
          this.smartCache.set(cacheKey, data, 10000); // 10s TTL
        }

        callback(data);
      } catch (error) {
        console.error('❌ Subscription callback error:', error);
      }
    };

    this.subscriptions.set(subscriptionId, {
      method,
      params,
      options,
      lastUpdate: Date.now(),
      callback: enhancedCallback
    });

    this.metrics.subscriptionsActive++;
    return subscriptionId;
  }

  /**
   *  Enhanced request with circuit breaker
   */
  private async request<T = any>(method: string, params: any[] = []): Promise<T> {
    const executeRequest = async (): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const id = this.nextId++;
        const message: WebSocketMessage = { id, method, params };

        this.pendingRequests.set(id, {
          resolve,
          reject,
          timestamp: Date.now()
        });

        this.ws.send(JSON.stringify(message));
        this.metrics.messagesSent++;

        // Timeout handler
        setTimeout(() => {
          const request = this.pendingRequests.get(id);
          if (request) {
            this.pendingRequests.delete(id);
            request.reject(new Error(`Request ${id} timeout`));
          }
        }, 30000);
      });
    };

    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(executeRequest, () => 
        Promise.reject(new Error('Circuit breaker fallback'))
      );
    }

    return executeRequest();
  }

  /**
   *  Message handler
   */
  private handleMessage(data: Buffer | string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      this.metrics.messagesReceived++;

      // Handle subscription updates
      if (message.subscription !== undefined) {
        const subscription = this.subscriptions.get(message.subscription);
        if (subscription) {
          subscription.lastUpdate = Date.now();
          subscription.callback(message.result);
        }
        return;
      }

      // Handle request responses
      if (message.id !== undefined) {
        const request = this.pendingRequests.get(message.id);
        if (request) {
          this.pendingRequests.delete(message.id);
          
          // Calculate latency
          const latency = Date.now() - request.timestamp;
          this.metrics.lastLatency = latency;
          this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;

          if (message.error) {
            request.reject(new Error(message.error.message || 'WebSocket request failed'));
          } else {
            request.resolve(message.result);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse WebSocket message:', error);
    }
  }

  /**
   *  Auto-reconnect with exponential backoff
   */
  private handleDisconnect(code: number, reason: string): void {
    this.connectionState = 'disconnected';
    this.stopHeartbeat();

    if (this.isDestroyed) return;

    console.log(`🔌 WebSocket disconnected: ${code} - ${reason}`);
    
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.connectionState = 'reconnecting';
      const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      console.log(` Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.metrics.reconnectCount++;
        this.connect()
          .then(() => this.resubscribeAll())
          .catch((error) => {
            console.error('❌ Reconnection failed:', error);
          });
      }, delay);
    }
  }

  /**
   *  Resubscribe all subscriptions
   */
  private async resubscribeAll(): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.entries());
    
    for (const [oldId, subscription] of subscriptions) {
      try {
        const newId = await this.request(subscription.method, subscription.params);
        
        // Update subscription ID
        this.subscriptions.delete(oldId);
        this.subscriptions.set(newId, subscription);
        
        console.log(`✅ Resubscribed: ${subscription.method} (${oldId} → ${newId})`);
      } catch (error) {
        console.error(`❌ Failed to resubscribe ${subscription.method}:`, error);
        this.subscriptions.delete(oldId);
      }
    }
  }

  /**
   *  Heartbeat system
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          await this.request('ping');
        } catch (error) {
          console.warn(' Heartbeat failed:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   *  Filter matching logic
   */
  private matchesFilters(data: any, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (!this.matchesFilter(data, key, value)) {
        return false;
      }
    }
    return true;
  }

  private matchesFilter(data: any, key: string, value: any): boolean {
    const keys = key.split('.');
    let current = data;
    
    for (const k of keys) {
      if (current == null || typeof current !== 'object') {
        return false;
      }
      current = current[k];
    }
    
    if (Array.isArray(value)) {
      return value.includes(current);
    }
    
    return current === value;
  }

  /**
   * 🔧 Initialize advanced features
   */
  private initializeAdvancedFeatures(): void {
    if (this.config.enableSmartCaching) {
      this.smartCache = new SmartCaching({
        strategy: 'balanced',
        maxSize: 5000,
        enablePredictive: false,
        enableDistributed: false,
        compressionLevel: 'low'
      });
    }

    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        timeout: 30000,
        retryInterval: 15000,
        monitorWindow: 60000,
        enableFallback: true
      });
    }
  }

  /**
   *  Get real-time metrics
   */
  getMetrics() {
    return {
      connection: {
        state: this.connectionState,
        reconnectAttempts: this.reconnectAttempts,
        reconnectCount: this.metrics.reconnectCount
      },
      performance: {
        latency: {
          last: this.metrics.lastLatency,
          average: this.metrics.averageLatency
        },
        throughput: {
          messagesReceived: this.metrics.messagesReceived,
          messagesSent: this.metrics.messagesSent
        }
      },
      subscriptions: {
        active: this.metrics.subscriptionsActive,
        total: this.subscriptions.size
      },
      cache: this.smartCache?.getAdvancedStats() || null,
      circuitBreaker: this.circuitBreaker?.getAdvancedMetrics() || null
    };
  }

  /**
   *  Advanced configuration methods
   */
  setFilter(subscriptionId: number, filters: Record<string, any>): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.options.customFilters = filters;
    }
  }

  enableCacheForSubscription(subscriptionId: number, enable: boolean): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.options.enableCache = enable;
    }
  }

  /**
   *  Health monitoring
   */
  isHealthy(): boolean {
    const isConnected = this.connectionState === 'connected';
    const hasActiveSubscriptions = this.subscriptions.size > 0;
    const lowLatency = this.metrics.averageLatency < 1000;
    const circuitBreakerOk = !this.circuitBreaker || 
      this.circuitBreaker.getAdvancedMetrics().state !== 'open';
    
    return isConnected && (!hasActiveSubscriptions || lowLatency) && circuitBreakerOk;
  }

  /**
   *  Cleanup
   */
  async disconnect(): Promise<void> {
    this.isDestroyed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
    }
    
    this.subscriptions.clear();
    this.pendingRequests.clear();
    this.smartCache?.clear();
  }

  /**
   *  Manual reconnect
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    this.isDestroyed = false;
    this.reconnectAttempts = 0;
    await this.connect();
  }
}
