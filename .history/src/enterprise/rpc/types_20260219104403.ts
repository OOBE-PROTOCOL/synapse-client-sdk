import type { Commitment } from '../solana/types';

export interface RpcErrorShape {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcResponseShape<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: RpcErrorShape;
}

export interface RpcCallOptions {
  timeout?: number;
  maxRetries?: number;
  commitment?: Commitment;
  routeHint?: 'rotate' | 'sticky';
  routeIndex?: number;
}

export interface RpcTransport {
  request<T = unknown>(method: string, params?: unknown[], options?: RpcCallOptions): Promise<T>;
}

export interface RpcGatewayConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  debug?: boolean;
}
