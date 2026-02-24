/**
 * Synapse SDK error hierarchy — minimal, strongly typed.
 */

export class SynapseError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32000,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'SynapseError';
  }
}

export class NetworkError extends SynapseError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, -32001);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends SynapseError {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`, -32002);
    this.name = 'TimeoutError';
  }
}

export class RpcMethodNotFoundError extends SynapseError {
  constructor(method: string) {
    super(`RPC method not found: ${method}`, -32601);
    this.name = 'RpcMethodNotFoundError';
  }
}

export class UpstreamError extends SynapseError {
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
