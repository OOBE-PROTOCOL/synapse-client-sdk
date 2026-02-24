/**
 * @module @oobe-protocol-labs/synapse-client-sdk
 * Enterprise Solana RPC Gateway SDK — Modular, typed, minimal.
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

// ── Convenience factory ────────────────────────────────────────
import { SynapseClient, type SynapseClientConfig } from './core/client';
export function createSynapse(config: SynapseClientConfig): SynapseClient {
  return new SynapseClient(config);
}

export default SynapseClient;