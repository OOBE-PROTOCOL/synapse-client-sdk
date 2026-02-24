/**
 * JSON-RPC HTTP transport — the single I/O boundary for all RPC calls.
 *
 * Handles serialization, timeout abort via `AbortController`,
 * upstream rotation on method-not-allowed, retry with configurable
 * max attempts, and optional debug logging.
 *
 * @module core/transport
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { HttpTransport } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const t = new HttpTransport({ endpoint: 'https://rpc.synapse.com', apiKey: 'sk-…' });
 * const slot = await t.request<number>('getSlot');
 * ```
 */

import type { RpcRequest, RpcResponse, Commitment } from '@/core/types';
import { NetworkError, SynapseError, TimeoutError, UpstreamError } from '@/core/errors';
import { SDK_USER_AGENT, isBrowser } from '@/utils/env';

// ── Transport config ───────────────────────────────────────────

/**
 * Configuration for {@link HttpTransport}.
 * @since 1.0.0
 */
export interface TransportConfig {
  /** RPC endpoint URL. */
  endpoint: string;
  /** Optional Bearer API key. */
  apiKey?: string;
  /** Request timeout in ms (default `30 000`). */
  timeout?: number;
  /** Max retry attempts on method-not-allowed (default `3`). */
  maxRetries?: number;
  /** Enable debug logging to `console.log`. */
  debug?: boolean;
  /** Extra HTTP headers merged into every request. */
  headers?: Record<string, string>;
}

/**
 * Per-call options that override transport-level defaults.
 * @since 1.0.0
 */
export interface CallOptions {
  /** Override timeout for this call. */
  timeout?: number;
  /** Override max retries for this call. */
  maxRetries?: number;
  /** Commitment level hint. */
  commitment?: Commitment;
  /** Upstream selection strategy. */
  routeHint?: 'rotate' | 'sticky';
  /** Explicit upstream index. */
  routeIndex?: number;
}

// ── Transport class ────────────────────────────────────────────

/**
 * Low-level JSON-RPC 2.0 HTTP transport.
 *
 * All Synapse SDK RPC calls flow through this class. It is instantiated
 * once by {@link SynapseClient} and shared by every sub-module.
 *
 * @since 1.0.0
 */
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
      // User-Agent is only settable on server-side fetch; browsers silently ignore it.
      ...(!isBrowser() ? { 'User-Agent': SDK_USER_AGENT } : {}),
      ...(cfg.headers ?? {})
    };
  }

  /**
   * Execute a single JSON-RPC 2.0 call.
   *
   * Retries transparently on `method-not-allowed` (code `-32601`) up to
   * `maxRetries` times, rotating upstreams if configured.
   *
   * @typeParam T - Expected result type.
   * @param method - RPC method name (e.g. `'getBalance'`).
   * @param params - Positional parameters array.
   * @param opts   - Per-call overrides.
   * @returns The JSON-RPC `result` payload, typed as `T`.
   * @throws {TimeoutError} If the request exceeds the timeout.
   * @throws {NetworkError} On HTTP / network failures.
   * @throws {UpstreamError} If the upstream returns an RPC error with upstream metadata.
   * @throws {SynapseError} For all other RPC errors.
   * @since 1.0.0
   */
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

  /**
   * Execute a batch of JSON-RPC 2.0 calls in a single HTTP request.
   *
   * @typeParam T - Expected result type for each call.
   * @param requests - Array of `{ method, params }` objects.
   * @param opts     - Per-call overrides (applied to the batch request).
   * @returns Array of results in the same order as `requests`.
   * @throws {TimeoutError} If the batch exceeds the timeout.
   * @throws {NetworkError} On HTTP / network failures.
   * @since 1.0.0
   */
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
