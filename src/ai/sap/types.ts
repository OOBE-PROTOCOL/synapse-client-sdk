/**
 * @module ai/sap/types
 * @description Integration types for the SAP bridge layer.
 *
 * Defines the configuration, wallet interface, and context shapes
 * used by {@link SynapseAnchorSap} to connect the Synapse Client SDK
 * with the standalone SAP SDK (`@oobe-protocol-labs/synapse-sap-sdk`).
 *
 * @since 2.1.0
 */

import type {
  SynapseNetwork,
  SynapseRegion,
} from '../../utils/synapse';

/* ═══════════════════════════════════════════════════════════════
 *  Constants
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Canonical SAP program ID (mainnet deployment).
 *
 * This is the default used when no `programId` is specified.
 * It matches `SAP_PROGRAM_ID` from `@oobe-protocol-labs/synapse-sap-sdk`.
 */
export const SAP_PROGRAM_ID = 'SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL';

/* ═══════════════════════════════════════════════════════════════
 *  Wallet
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Minimal wallet interface compatible with:
 *
 * - `@coral-xyz/anchor` `Wallet`
 * - `@solana/wallet-adapter-react` `useWallet()` (when `connected`)
 * - Any `Keypair`-based signer adapted to this shape
 *
 * @example Keypair adapter
 * ```ts
 * import { Keypair } from '@solana/web3.js';
 *
 * const kp = Keypair.generate();
 * const wallet: SapWallet = {
 *   publicKey: kp.publicKey,
 *   signTransaction: (tx) => { tx.partialSign(kp); return Promise.resolve(tx); },
 *   signAllTransactions: (txs) => { txs.forEach(t => t.partialSign(kp)); return Promise.resolve(txs); },
 * };
 * ```
 */
export interface SapWallet {
  /** Wallet public key — must have `.toBase58()`. */
  readonly publicKey: { toBase58(): string; toBytes(): Uint8Array };
  /** Sign a single transaction. */
  signTransaction<T>(tx: T): Promise<T>;
  /** Sign multiple transactions. */
  signAllTransactions<T>(txs: T[]): Promise<T[]>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Commitment level for Anchor / Solana transactions.
 */
export type SapCommitment = 'processed' | 'confirmed' | 'finalized';

/**
 * Configuration for {@link SynapseAnchorSap}.
 *
 * At minimum, provide a `wallet`. The bridge resolves the RPC endpoint
 * from Synapse's network registry unless `rpcEndpoint` is set.
 *
 * @example Minimal
 * ```ts
 * { wallet }
 * ```
 *
 * @example Full
 * ```ts
 * {
 *   wallet,
 *   network: SynapseNetwork.Mainnet,
 *   region: SynapseRegion.US,
 *   programId: 'SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL',
 *   commitment: 'confirmed',
 * }
 * ```
 */
export interface SapBridgeConfig {
  /** Wallet with signing capability (required). */
  wallet: SapWallet;

  /**
   * Synapse network to connect to.
   * @default SynapseNetwork.Mainnet
   */
  network?: SynapseNetwork;

  /**
   * Geographic region for endpoint selection.
   * @default SynapseRegion.US
   */
  region?: SynapseRegion;

  /**
   * Override RPC endpoint URL.
   * When set, bypasses Synapse endpoint resolution entirely.
   */
  rpcEndpoint?: string;

  /**
   * SAP program ID.
   * @default SAP_PROGRAM_ID ('SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL')
   */
  programId?: string;

  /** Transaction commitment level. @default 'confirmed' */
  commitment?: SapCommitment;

  /** Skip preflight simulation for transactions. @default false */
  skipPreflight?: boolean;

  /** Enable debug logging. @default false */
  debug?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
 *  React / Context types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Shape of the React context value for SAP integration.
 *
 * Use this interface to type your own React context:
 *
 * ```tsx
 * // app/providers/sap.tsx
 * 'use client';
 * import { createContext, useContext } from 'react';
 * import type { SapContextValue } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const SapContext = createContext<SapContextValue>({
 *   client: null,
 *   loading: false,
 *   error: null,
 *   connect: async () => {},
 *   disconnect: () => {},
 * });
 *
 * export const useSap = () => useContext(SapContext);
 * ```
 */
export interface SapContextValue<TClient = unknown> {
  /** The SAP bridge client — `null` until connected. */
  client: TClient | null;
  /** Whether the client is currently initializing. */
  loading: boolean;
  /** Initialization error, if any. */
  error: Error | null;
  /** Connect to SAP with the given wallet. */
  connect: (wallet: SapWallet) => Promise<void>;
  /** Disconnect and clear the client. */
  disconnect: () => void;
}

/**
 * Configuration for {@link createSapProvider}.
 */
export interface SapProviderConfig extends Omit<SapBridgeConfig, 'wallet'> {
  /** Singleton cache key version — change to bust the cache. */
  version?: string;
}

/**
 * Error thrown when a required peer dependency is missing.
 */
export class SapDependencyError extends Error {
  override readonly name = 'SapDependencyError';
  readonly packageName: string;

  constructor(packageName: string) {
    super(
      `Missing peer dependency: ${packageName} is required for SAP integration. ` +
      `Install it: pnpm add ${packageName}`,
    );
    this.packageName = packageName;
  }
}
