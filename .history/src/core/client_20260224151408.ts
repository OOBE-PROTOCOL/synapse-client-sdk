/**
 * SynapseClient — orchestrator that binds transport to typed RPC modules.
 * Lazy-initializes sub-clients on first access (zero cost if unused).
 */

import { HttpTransport, type TransportConfig, type CallOptions } from './transport';

// Forward-declare lazy modules (resolved on first access)
import type { SolanaRpc } from '@/rpc/solana-rpc';
import type { DasClient } from '@/das/client';
import type { WsClient } from '@/websocket/client';
import type { GrpcTransport } from '@/grpc/transport';
import type { EndpointConnectConfig } from '@/utils/synapse';
import { resolveEndpoint as _resolveEndpoint, toClientConfig as _toClientConfig } from '@/utils/synapse';

export interface SynapseClientConfig extends TransportConfig {
  wsEndpoint?: string;
  grpcEndpoint?: string;
}

export class SynapseClient {
  readonly transport: HttpTransport;
  private readonly cfg: SynapseClientConfig;

  // Lazy singletons
  private _rpc?: SolanaRpc;
  private _das?: DasClient;
  private _ws?: WsClient;
  private _grpc?: GrpcTransport;

  constructor(config: SynapseClientConfig) {
    this.cfg = config;
    this.transport = new HttpTransport(config);
    if (config.debug) console.log('🚀 Synapse SDK initialized:', config.endpoint);
  }

  /* ═══════════════════════════════════════════════════════════════
   *  Static factories
   * ═══════════════════════════════════════════════════════════════ */

  /**
   * Create a SynapseClient from a network + region specification.
   * Resolves the endpoint from the built-in registry and configures
   * RPC, WebSocket, and gRPC transports automatically.
   *
   * @example
   * ```ts
   * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
   * import { SynapseNetwork, SynapseRegion } from '@oobe-protocol-labs/synapse-client-sdk/utils';
   *
   * const client = SynapseClient.fromEndpoint({
   *   network: SynapseNetwork.Mainnet,
   *   region: SynapseRegion.US,
   *   apiKey: 'sk-...',
   * });
   * ```
   */
  static fromEndpoint(config: EndpointConnectConfig): SynapseClient {
    const endpoint = _resolveEndpoint(config.network, config.region);
    const clientCfg = _toClientConfig(endpoint, {
      apiKey: config.apiKey,
      timeout: config.timeout,
      debug: config.debug,
      headers: config.headers,
    });
    return new SynapseClient(clientCfg);
  }

  // ── Convenience pass-through ──────────────────────────────────
  call<T = unknown>(method: string, params: unknown[] = [], opts: CallOptions = {}): Promise<T> {
    return this.transport.request<T>(method, params, opts);
  }

  batch<T = unknown>(requests: { method: string; params?: unknown[] }[], opts: CallOptions = {}): Promise<T[]> {
    return this.transport.batch<T>(requests, opts);
  }

  // ── Lazy sub-clients (tree-shakeable, zero cost if unused) ────
  get rpc(): SolanaRpc {
    if (!this._rpc) {
      const { SolanaRpc: Ctor } = require('../rpc/solana-rpc') as typeof import('@/rpc/solana-rpc');
      this._rpc = new Ctor(this.transport);
    }
    return this._rpc;
  }

  get das(): DasClient {
    if (!this._das) {
      const { DasClient: Ctor } = require('../das/client') as typeof import('@/das/client');
      this._das = new Ctor(this.transport);
    }
    return this._das;
  }

  get ws(): WsClient {
    if (!this._ws) {
      const { WsClient: Ctor } = require('../websocket/client') as typeof import('@/websocket/client');
      this._ws = new Ctor({ endpoint: this.cfg.wsEndpoint ?? this.cfg.endpoint.replace('http', 'ws') });
    }
    return this._ws;
  }

  get grpc(): GrpcTransport {
    if (!this._grpc) {
      const { GrpcTransport: Ctor } = require('../grpc/transport') as typeof import('@/grpc/transport');
      this._grpc = new Ctor({ endpoint: this.cfg.grpcEndpoint ?? this.cfg.endpoint });
    }
    return this._grpc;
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  destroy(): void {
    this._ws?.close();
  }
}
