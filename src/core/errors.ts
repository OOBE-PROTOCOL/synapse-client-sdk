/**
 * Synapse SDK error hierarchy — minimal, strongly typed.
 *
 * All SDK errors extend {@link SynapseError} so consumers can catch
 * the entire tree with a single `catch (e) { if (e instanceof SynapseError) … }`.
 *
 * @module core/errors
 * @since 1.0.0
 */

/**
 * Base error for all Synapse SDK failures.
 *
 * @since 1.0.0
 * @example
 * ```ts
 * try { await client.call('getSlot'); }
 * catch (e) { if (e instanceof SynapseError) console.error(e.code, e.message); }
 * ```
 */
export class SynapseError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param code    - JSON-RPC-style numeric error code (default `-32000`).
   * @param data    - Optional payload with extra context.
   */
  constructor(
    message: string,
    public readonly code: number = -32000,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'SynapseError';
  }
}

/**
 * Network-level failure (DNS, TCP, TLS, HTTP non-200).
 *
 * @since 1.0.0
 */
export class NetworkError extends SynapseError {
  /**
   * @param message - Description of the network failure.
   * @param cause   - Original error that triggered this (e.g. `fetch` error).
   */
  constructor(message: string, public readonly cause?: Error) {
    super(message, -32001);
    this.name = 'NetworkError';
  }
}

/**
 * Request timed out.
 *
 * @since 1.0.0
 */
export class TimeoutError extends SynapseError {
  /**
   * @param ms - Timeout threshold in milliseconds.
   */
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`, -32002);
    this.name = 'TimeoutError';
  }
}

/**
 * The requested RPC method does not exist on the upstream.
 *
 * @since 1.0.0
 */
export class RpcMethodNotFoundError extends SynapseError {
  /**
   * @param method - The method name that was not found.
   */
  constructor(method: string) {
    super(`RPC method not found: ${method}`, -32601);
    this.name = 'RpcMethodNotFoundError';
  }
}

/**
 * Error forwarded from an upstream RPC provider.
 *
 * @since 1.0.0
 */
export class UpstreamError extends SynapseError {
  /**
   * @param message      - Error message from the upstream.
   * @param code         - JSON-RPC error code.
   * @param upstreamName - Upstream provider name (if known).
   * @param upstreamUrl  - Upstream endpoint URL (if known).
   */
  constructor(
    message: string,
    code: number,
    public readonly upstreamName?: string,
    public readonly upstreamUrl?: string
  ) {
    super(message, code);
    this.name = 'UpstreamError';
  }
}
