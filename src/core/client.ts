/**
 * SynapseClient -- top-level orchestrator that binds transport to typed RPC modules.
 *
 * Lazy-initializes sub-clients (`.rpc`, `.das`, `.ws`, `.grpc`) on first
 * access -- zero cost if a module is never used. This is the main entry
 * point for most consumers of the SDK.
 *
 * Since v1.1.0, exposes `@solana/kit` native RPC and subscription clients
 * via `.kitRpc` and `.kitSubscriptions` for full Kit interop.
 *
 * @module core/client
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const client = new SynapseClient({ endpoint: 'https://rpc.synapse.com', apiKey: 'sk-...' });
 * const slot = await client.rpc.getSlot();
 * const balance = await client.rpc.getBalance(Pubkey('...'));
 * client.destroy();
 * ```
 *
 * @example Kit-native RPC
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { address } from '@oobe-protocol-labs/synapse-client-sdk/kit';
 *
 * const client = new SynapseClient({ endpoint: 'https://rpc.synapse.com' });
 * const { value: balance } = await client.kitRpc
 *   .getBalance(address('So11111111111111111111111111111111111111112'))
 *   .send();
 * ```
 */

import { HttpTransport, type TransportConfig, type CallOptions } from './transport';
import { isBrowser } from '../utils/env';

// @solana/kit lazy imports (resolved on first access)
import type { Rpc, SolanaRpcApi, RpcSubscriptions, SolanaRpcSubscriptionsApi } from '@solana/kit';

// Forward-declare lazy modules (resolved on first access)
import type { SolanaRpc } from '../rpc/solana-rpc';
import type { DasClient } from '../das/client';
import type { WsClient } from '../websocket/client';
import type { GrpcTransport } from '../grpc/transport';
import type { EndpointConnectConfig } from '../utils/synapse';
import { resolveEndpoint as _resolveEndpoint, toClientConfig as _toClientConfig } from '../utils/synapse';

/**
 * Configuration for {@link SynapseClient}.
 *
 * Extends {@link TransportConfig} with optional WebSocket and gRPC endpoints.
 * @since 1.0.0
 */
export interface SynapseClientConfig extends TransportConfig {
  /** WebSocket endpoint for subscriptions (defaults to the HTTP endpoint with `ws://`). */
  wsEndpoint?: string;
  /** gRPC endpoint for Yellowstone/Geyser streaming (defaults to the HTTP endpoint). */
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

  // Kit-native lazy singletons
  private _kitRpc?: Rpc<SolanaRpcApi>;
  private _kitSubs?: RpcSubscriptions<SolanaRpcSubscriptionsApi>;

  constructor(config: SynapseClientConfig) {
    this.cfg = config;
    this.transport = new HttpTransport(config);
    if (config.debug) console.log('[Synapse SDK] initialized:', config.endpoint, `(${isBrowser() ? 'browser' : 'server'})`);
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

  /**
   * Raw RPC call pass-through to the underlying transport.
   *
   * @typeParam T - Expected result type.
   * @param method - RPC method name.
   * @param params - Positional parameters.
   * @param opts   - Per-call overrides.
   * @returns The result payload.
   * @since 1.0.0
   */
  call<T = unknown>(method: string, params: unknown[] = [], opts: CallOptions = {}): Promise<T> {
    return this.transport.request<T>(method, params, opts);
  }

  /**
   * Batch multiple RPC calls in a single HTTP request.
   *
   * @typeParam T - Expected result type per call.
   * @param requests - Array of `{ method, params }` objects.
   * @param opts     - Per-call overrides applied to the batch.
   * @returns Array of results.
   * @since 1.0.0
   */
  batch<T = unknown>(requests: { method: string; params?: unknown[] }[], opts: CallOptions = {}): Promise<T[]> {
    return this.transport.batch<T>(requests, opts);
  }

  // ── Lazy sub-clients (tree-shakeable, zero cost if unused) ────

  /**
   * Typed Solana JSON-RPC facade — 53 methods.
   * Lazy-loaded on first access.
   * @since 1.0.0
   */
  get rpc(): SolanaRpc {
    if (!this._rpc) {
      const { SolanaRpc: Ctor } = require('../rpc/solana-rpc') as typeof import('../rpc/solana-rpc');
      this._rpc = new Ctor(this.transport);
    }
    return this._rpc;
  }

  /**
   * Digital Asset Standard (DAS) client — Metaplex Read API / cNFT queries.
   * Lazy-loaded on first access.
   * @since 1.0.0
   */
  get das(): DasClient {
    if (!this._das) {
      const { DasClient: Ctor } = require('../das/client') as typeof import('../das/client');
      this._das = new Ctor(this.transport);
    }
    return this._das;
  }

  /**
   * WebSocket subscription client — real-time account, program, logs, slot changes.
   * Lazy-loaded on first access.
   * @since 1.0.0
   */
  get ws(): WsClient {
    if (!this._ws) {
      const { WsClient: Ctor } = require('../websocket/client') as typeof import('../websocket/client');
      this._ws = new Ctor({ endpoint: this.cfg.wsEndpoint ?? this.cfg.endpoint.replace('http', 'ws') });
    }
    return this._ws;
  }

  /**
   * gRPC transport for Yellowstone/Geyser streaming.
   * Lazy-loaded on first access.
   *
   * **Node.js only** — throws a descriptive error in browser environments.
   * Use RPC or WebSocket for browser/Next.js client components.
   *
   * @since 1.0.0
   */
  get grpc(): GrpcTransport {
    if (isBrowser()) {
      throw new Error(
        'GrpcTransport is not available in browser environments. ' +
        'gRPC requires native Node.js bindings (@grpc/grpc-js). ' +
        'Use client.rpc or client.ws for browser/Next.js client components.'
      );
    }
    if (!this._grpc) {
      const { GrpcTransport: Ctor } = require('../grpc/transport') as typeof import('../grpc/transport');
      this._grpc = new Ctor({ endpoint: this.cfg.grpcEndpoint ?? this.cfg.endpoint });
    }
    return this._grpc;
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  /**
   * Gracefully shut down all active connections (WebSocket, gRPC).
   * @since 1.0.0
   */
  destroy(): void {
    this._ws?.close();
  }

  // ── @solana/kit native accessors ─────────────────────────────

  /**
   * Kit-native fully-typed Solana RPC client.
   *
   * Uses the same endpoint as the Synapse transport but returns a
   * `Rpc<SolanaRpcApi>` instance from `@solana/kit`, giving you
   * access to Kit's type-safe `.send()` pattern with all 53+ methods.
   *
   * Lazy-loaded on first access.
   *
   * @since 1.1.0
   *
   * @example
   * ```ts
   * import { address } from '@oobe-protocol-labs/synapse-client-sdk/kit';
   *
   * const { value: balance } = await client.kitRpc
   *   .getBalance(address('So11111111111111111111111111111111111111112'))
   *   .send();
   * ```
   */
  get kitRpc(): Rpc<SolanaRpcApi> {
    if (!this._kitRpc) {
      const {
        createRpc,
        createSolanaRpcApi,
        createDefaultRpcTransport,
        DEFAULT_RPC_CONFIG,
      } = require('@solana/kit') as typeof import('@solana/kit');
      this._kitRpc = createRpc({
        api: createSolanaRpcApi(DEFAULT_RPC_CONFIG),
        transport: createDefaultRpcTransport({ url: this.cfg.endpoint }),
      }) as Rpc<SolanaRpcApi>;
    }
    return this._kitRpc;
  }

  /**
   * Kit-native fully-typed Solana RPC Subscriptions client.
   *
   * Returns a `RpcSubscriptions<SolanaRpcSubscriptionsApi>` from `@solana/kit`
   * for real-time WebSocket subscriptions (account, slot, logs, signature, etc.)
   * with the Kit `.subscribe()` pattern.
   *
   * Uses the WebSocket endpoint derived from the HTTP endpoint.
   * Lazy-loaded on first access.
   *
   * @since 1.1.0
   *
   * @example
   * ```ts
   * const subs = client.kitSubscriptions;
   * const notifications = await subs
   *   .slotNotifications()
   *   .subscribe({ abortSignal: AbortSignal.timeout(30_000) });
   *
   * for await (const slot of notifications) {
   *   console.log('New slot:', slot.slot);
   * }
   * ```
   */
  get kitSubscriptions(): RpcSubscriptions<SolanaRpcSubscriptionsApi> {
    if (!this._kitSubs) {
      const {
        createSubscriptionRpc,
        createSolanaRpcSubscriptionsApi,
        createDefaultRpcSubscriptionsTransport,
        createDefaultSolanaRpcSubscriptionsChannelCreator,
        DEFAULT_RPC_SUBSCRIPTIONS_CONFIG,
      } = require('@solana/kit') as typeof import('@solana/kit');
      const wsUrl = this.cfg.wsEndpoint ?? this.cfg.endpoint.replace('http', 'ws');
      this._kitSubs = createSubscriptionRpc({
        api: createSolanaRpcSubscriptionsApi(DEFAULT_RPC_SUBSCRIPTIONS_CONFIG),
        transport: createDefaultRpcSubscriptionsTransport({
          createChannel: createDefaultSolanaRpcSubscriptionsChannelCreator({ url: wsUrl }),
        }),
      }) as RpcSubscriptions<SolanaRpcSubscriptionsApi>;
    }
    return this._kitSubs;
  }
}
