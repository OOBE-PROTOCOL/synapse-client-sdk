/**
 * @module @oobe-protocol-labs/synapse-client-sdk
 *
 * Enterprise Solana RPC Gateway SDK — Modular, typed, minimal.
 *
 * Provides typed access to 53 Solana JSON-RPC methods, WebSocket PubSub
 * subscriptions, gRPC/Geyser streaming with parser, DAS (Digital Asset Standard)
 * queries, AI agent tools with LangChain integration, and the x402 payment
 * protocol. All modules are lazy-loaded and tree-shakeable.
 *
 * @since 1.0.0
 * @see https://github.com/oobe-protocol-labs/synapse-client-sdk
 *
 * @example
 * ```ts
 * import { SynapseClient, Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const client = new SynapseClient({ endpoint: 'https://rpc.synapse.com' });
 * const balance = await client.rpc.getBalance(Pubkey('So111…'));
 * ```
 */

// ── Solana-branded primitive types ──────────────────────────────
export * from './core/types';

// ── Core transport & client ────────────────────────────────────
export * from './core/transport';
export * from './core/client';
export * from './core/errors';

// ── JSON-RPC method modules (per-method files) ────────────────
export * from './rpc/index';

// ── gRPC transport ─────────────────────────────────────────────
export * from './grpc/index';

// ── DAS (Digital Asset Standard) NFT / cNFT module ─────────────
export * from './das/index';

// ── WebSocket real-time subscriptions ──────────────────────────
export * from './websocket/index';

// ── Utility helpers ────────────────────────────────────────────
export * from './utils/index';

// ── @solana/kit bridge (native types, signers, RPC) ────────────
export * from './kit/index';

// ── Convenience factory ────────────────────────────────────────
import { SynapseClient, type SynapseClientConfig } from './core/client';
/**
 * Convenience factory to create a {@link SynapseClient} instance.
 *
 * @param config - Client configuration (endpoint, API key, etc.).
 * @returns A configured `SynapseClient` instance.
 * @since 1.0.0
 *
 * @example
 * ```ts
 * const client = createSynapse({ endpoint: 'https://rpc.synapse.com', apiKey: 'sk-…' });
 * ```
 */export function createSynapse(config: SynapseClientConfig): SynapseClient {
  return new SynapseClient(config);
}

export default SynapseClient;