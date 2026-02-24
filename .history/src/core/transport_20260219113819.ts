/**
 * JSON-RPC HTTP transport — the single I/O boundary for all RPC calls.
 * Handles: serialization, timeout abort, upstream rotation, debug logging.
 */

import type { RpcRequest, RpcResponse, Commitment } from '@/core/types';
import { NetworkError, SynapseError, TimeoutError, UpstreamError } from '@/core/errors';

// ── Transport config ───────────────────────────────────────────
export interface TransportConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  debug?: boolean;
  headers?: Record<string, string>;
}

export interface CallOptions {
  timeout?: number;
  maxRetries?: number;
  commitment?: Commitment;
  routeHint?: 'rotate' | 'sticky';
  routeIndex?: number;
}

// ── Transport class ────────────────────────────────────────────
export class HttpTransport {
  private id = 0;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly debug: boolean;
  private readonly headers: Record<string, string>;

  constructor(private cfg: TransportConfig) {
    this.timeout = cfg.timeout ?? 30_000;
    this.maxRetries = cfg.maxRetries ?? 3;
    this.debug = cfg.debug ?? false;
    this.headers = {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...(cfg.headers ?? {})
    };
  }

  /** Single RPC call with rotation on method-not-allowed */
  async request<T = unknown>(method: string, params: unknown[] = [], opts: CallOptions = {}): Promise<T> {
    const maxAttempts = Math.max(1, opts.maxRetries ?? this.maxRetries);
    let lastErr: RpcResponse | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const req: RpcRequest = { jsonrpc: '2.0', id: ++this.id, method, params };
      const t0 = this.debug ? performance.now() : 0;

      if (this.debug) console.log(`→ [${req.id}] ${method}`, params.length ? params : '');

      const res = await this.send<T>(req, opts.timeout);

      if (!res.error) {
        if (this.debug) console.log(`← [${req.id}] ✅ ${Math.round(performance.now() - t0)}ms`);
        return res.result as T;
      }

      // Method-not-allowed → try next upstream
      const msg = (res.error.message ?? '').toLowerCase();
      if (res.error.code === -32601 || msg.includes('method not allowed')) {
        lastErr = res as RpcResponse;
        continue;
      }

      // Build typed error
      this.throwRpcError(res.error, method);
    }

    if (lastErr?.error) this.throwRpcError(lastErr.error, method);
    throw new SynapseError('Unknown RPC error', -32000);
  }

  /** Batch RPC call */
  async batch<T = unknown>(requests: { method: string; params?: unknown[] }[], opts: CallOptions = {}): Promise<T[]> {
    const reqs: RpcRequest[] = requests.map(r => ({
      jsonrpc: '2.0' as const,
      id: ++this.id,
      method: r.method,
      params: r.params ?? []
    }));

    const timeout = opts.timeout ?? this.timeout;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(reqs),
        signal: ctrl.signal
      });

      if (!res.ok) throw new NetworkError(`HTTP ${res.status}: ${res.statusText}`);

      const body = await res.json() as RpcResponse<T>[];
      return body.map(r => {
        if (r.error) this.throwRpcError(r.error, 'batch');
        return r.result as T;
      });
    } catch (e: any) {
      if (e instanceof SynapseError) throw e;
      if (e.name === 'AbortError') throw new TimeoutError(timeout);
      throw new NetworkError(`Batch failed: ${e.message}`, e);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Private ────────────────────────────────────────────────────
  private async send<T>(req: RpcRequest, timeoutMs?: number): Promise<RpcResponse<T>> {
    const timeout = timeoutMs ?? this.timeout;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(req),
        signal: ctrl.signal
      });

      if (!res.ok) throw new NetworkError(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json() as RpcResponse<T>;
    } catch (e: any) {
      if (e instanceof SynapseError) throw e;
      if (e.name === 'AbortError') throw new TimeoutError(timeout);
      throw new NetworkError(`Request failed: ${e.message}`, e);
    } finally {
      clearTimeout(timer);
    }
  }

  private throwRpcError(err: NonNullable<RpcResponse['error']>, method: string): never {
    const data = err.data as Record<string, unknown> | undefined;
    if (data?.upstreamName || data?.upstreamUrl) {
      throw new UpstreamError(err.message, err.code, data.upstreamName as string, data.upstreamUrl as string);
    }
    throw new SynapseError(`[${method}] ${err.message}`, err.code, err.data);
  }
}
