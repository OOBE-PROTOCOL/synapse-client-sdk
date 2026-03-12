/**
 * @module ai/sap
 * @description Solana Agent Protocol (SAP) — Integration bridge for `@oobe-protocol-labs/synapse-sap-sdk`.
 *
 * This module provides a **thin integration layer** that connects the
 * Synapse Client SDK's infrastructure (network resolution, endpoint
 * registry, HMR-safe singletons) with the standalone SAP SDK for
 * on-chain agent operations.
 *
 * ## What moved
 *
 * The full SAP protocol implementation (PDA derivation, Borsh
 * serialization, instruction builders, discovery, validation,
 * subnetworks, scoring) now lives in:
 *
 *  - **Protocol (Anchor/Rust)**: https://github.com/OOBE-PROTOCOL/synapse-sap
 *  - **SAP SDK (TypeScript)**: https://github.com/OOBE-PROTOCOL/synapse-sap-sdk
 *    → `@oobe-protocol-labs/synapse-sap-sdk`
 *
 * ## What this module provides
 *
 *  - {@link SynapseAnchorSap} — Bridge class: resolves Synapse endpoints,
 *    creates an Anchor provider, and initializes a `SapClient` in one call.
 *    Exposes all SapClient modules as getters (`agent`, `builder`, `session`,
 *    `escrow`, `tools`, `discovery`, `feedback`, `attestation`).
 *
 *  - {@link createSapProvider} — HMR-safe singleton factory for Next.js
 *    server-side routes (same pattern as `createSynapseProvider`).
 *
 *  - {@link createSapContextBlueprint} — React integration blueprint with
 *    typed context value, state manager, and subscription support — all
 *    without a React dependency.
 *
 * ## Quick start
 *
 * @example Standalone (Node.js / scripts)
 * ```ts
 * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const sap = SynapseAnchorSap.create({ wallet });
 * await sap.builder
 *   .agent('TradeBot')
 *   .description('Jupiter swap agent')
 *   .addCapability('jupiter:swap', { protocol: 'jupiter', version: '6.0' })
 *   .register();
 * ```
 *
 * @example From existing SynapseClient
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const client = new SynapseClient({ endpoint: process.env.SYNAPSE_RPC! });
 * const sap = SynapseAnchorSap.fromSynapseClient(client, wallet);
 * ```
 *
 * @example Next.js server-side (HMR-safe)
 * ```ts
 * import { createSapProvider } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 * const getSap = createSapProvider(serverWallet, { network: SynapseNetwork.Mainnet });
 * const sap = getSap();
 * ```
 *
 * @example Next.js client-side (React context)
 * ```tsx
 * import { createSapContextBlueprint } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 * const blueprint = createSapContextBlueprint({ network: SynapseNetwork.Mainnet });
 * // Wire into your React provider — see provider.ts JSDoc for full example
 * ```
 *
 * @since 2.1.0
 */

/* ── Types ── */
export type {
  SapWallet,
  SapCommitment,
  SapBridgeConfig,
  SapProviderConfig,
  SapContextValue,
} from './types';

export {
  SAP_PROGRAM_ID,
  SapDependencyError,
} from './types';

/* ── Client bridge ── */
export { SynapseAnchorSap } from './client';

/* ── Provider & React blueprint ── */
export type {
  SapContextBlueprint,
  SapStateManager,
} from './provider';

export {
  createSapProvider,
  createSapContextBlueprint,
} from './provider';
