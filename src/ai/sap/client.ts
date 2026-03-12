/**
 * @module ai/sap/client
 * @description SynapseAnchorSap — One-line bridge from Synapse Client SDK to SAP.
 *
 * Creates a fully-initialized `SapClient` instance using Synapse's
 * network resolution, ready for agent registration, memory writes,
 * x402 escrow, discovery, and every other SAP operation.
 *
 * **Peer dependencies** (must be installed by the consumer):
 *  - `@oobe-protocol-labs/synapse-sap-sdk`
 *  - `@coral-xyz/anchor`
 *  - `@solana/web3.js`
 *
 * @example Standalone
 * ```ts
 * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const sap = SynapseAnchorSap.create({ wallet });
 * await sap.agent.register({ name: 'My Agent', ... });
 * ```
 *
 * @example Re-use SynapseClient endpoint
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const synapse = new SynapseClient({ endpoint: process.env.SYNAPSE_RPC! });
 * const sap = SynapseAnchorSap.fromSynapseClient(synapse, wallet);
 * ```
 *
 * @since 2.1.0
 */

import {
  resolveEndpoint,
  SynapseNetwork,
  SynapseRegion,
  type SynapseEndpoint,
} from '../../utils/synapse';

import type { SynapseClient } from '../../core/client';

import {
  SAP_PROGRAM_ID,
  SapDependencyError,
  type SapBridgeConfig,
  type SapWallet,
  type SapCommitment,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Lazy dependency resolution
 * ═══════════════════════════════════════════════════════════════ */

/** @internal Lazily resolved peer dependencies. */
interface PeerDeps {
  Connection: new (endpoint: string, opts?: { commitment?: string }) => unknown;
  AnchorProvider: {
    new (connection: unknown, wallet: SapWallet, opts?: Record<string, unknown>): unknown;
    defaultOptions(): Record<string, unknown>;
  };
  SapClient: {
    from(provider: unknown, programId?: unknown): unknown;
  };
  PublicKey?: new (value: string | Uint8Array) => unknown;
}

let _deps: PeerDeps | null = null;

/** @internal Resolve all peer deps once, throw clear errors on missing packages. */
function resolveDeps(): PeerDeps {
  if (_deps) return _deps;

  let Connection: PeerDeps['Connection'];
  let AnchorProvider: PeerDeps['AnchorProvider'];
  let SapClient: PeerDeps['SapClient'];
  let PublicKey: PeerDeps['PublicKey'];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const web3 = require('@solana/web3.js');
    Connection = web3.Connection;
    PublicKey = web3.PublicKey;
  } catch {
    throw new SapDependencyError('@solana/web3.js');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const anchor = require('@coral-xyz/anchor');
    AnchorProvider = anchor.AnchorProvider;
  } catch {
    throw new SapDependencyError('@coral-xyz/anchor');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sapSdk = require('@oobe-protocol-labs/synapse-sap-sdk');
    SapClient = sapSdk.SapClient;
  } catch {
    throw new SapDependencyError('@oobe-protocol-labs/synapse-sap-sdk');
  }

  _deps = { Connection, AnchorProvider, SapClient, PublicKey };
  return _deps;
}

/* ═══════════════════════════════════════════════════════════════
 *  SynapseAnchorSap
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Bridge between Synapse Client SDK and the SAP SDK.
 *
 * Resolves Synapse network endpoints automatically, creates an
 * Anchor provider, and initializes a `SapClient` — all in a single
 * synchronous factory call.
 *
 * All `SapClient` module accessors (`agent`, `builder`, `session`,
 * `escrow`, `tools`, `discovery`, `feedback`, `attestation`) are
 * proxied as first-class getters for ergonomic access.
 *
 * @example Registration flow
 * ```ts
 * const sap = SynapseAnchorSap.create({ wallet });
 *
 * // Using the fluent builder
 * await sap.builder
 *   .agent('DeFi Bot')
 *   .description('Jupiter + Raydium swap agent')
 *   .addCapability('jupiter:swap', { protocol: 'jupiter', version: '6.0' })
 *   .addPricingTier({
 *     tierId: 'standard',
 *     pricePerCall: 10_000,
 *     rateLimit: 60,
 *     tokenType: 'sol',
 *     settlementMode: 'x402',
 *   })
 *   .register();
 * ```
 *
 * @example Discovery
 * ```ts
 * const agents = await sap.discovery.findByCapability('jupiter:swap');
 * ```
 *
 * @example Memory session
 * ```ts
 * const session = await sap.session.start('conv-001');
 * await sap.session.write(session, 'User requested SOL→USDC swap');
 * const entries = await sap.session.readLatest(session);
 * await sap.session.seal(session);
 * ```
 */
export class SynapseAnchorSap {
  /**
   * The underlying `SapClient` from `@oobe-protocol-labs/synapse-sap-sdk`.
   *
   * Access any SapClient method directly when the proxy getters
   * don't cover your use case.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly sapClient: any;

  /** The resolved Synapse endpoint used for this connection. */
  readonly endpoint: SynapseEndpoint;

  /** The SAP program ID in use. */
  readonly programId: string;

  /** Wallet public key as base58 string. */
  readonly walletPubkey: string;

  /** The Anchor provider instance (for advanced use). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly provider: any;

  /** The Solana Connection instance (for advanced use). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly connection: any;

  /* ── Private constructor ─────────────────────────────────── */

  private constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sapClient: any,
    endpoint: SynapseEndpoint,
    programId: string,
    walletPubkey: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: any,
  ) {
    this.sapClient = sapClient;
    this.endpoint = endpoint;
    this.programId = programId;
    this.walletPubkey = walletPubkey;
    this.provider = provider;
    this.connection = connection;
  }

  /* ── Factory: create ─────────────────────────────────────── */

  /**
   * Create a `SynapseAnchorSap` instance.
   *
   * Resolves the Synapse endpoint for the given network/region,
   * creates an Anchor provider, and initializes a SapClient.
   *
   * @param config - Bridge configuration (wallet + optional overrides)
   * @returns Fully-initialized SAP bridge
   * @throws {@link SapDependencyError} if peer dependencies are missing
   *
   * @example
   * ```ts
   * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
   * import { SynapseNetwork } from '@oobe-protocol-labs/synapse-client-sdk/utils';
   *
   * const sap = SynapseAnchorSap.create({
   *   wallet,
   *   network: SynapseNetwork.Mainnet,
   *   commitment: 'confirmed',
   * });
   * ```
   */
  static create(config: SapBridgeConfig): SynapseAnchorSap {
    const {
      wallet,
      network = SynapseNetwork.Mainnet,
      region = SynapseRegion.US,
      rpcEndpoint,
      programId = SAP_PROGRAM_ID,
      commitment = 'confirmed',
      skipPreflight = false,
      debug = false,
    } = config;

    // ── Resolve peer dependencies ─────────────────────────
    const deps = resolveDeps();

    // ── Resolve Synapse endpoint ──────────────────────────
    const endpoint = resolveEndpoint(network, region);
    const rpc = rpcEndpoint ?? endpoint.rpc;

    if (debug) {
      console.log(
        `[SynapseAnchorSap] connecting to ${rpc} (${network}:${region})`,
      );
    }

    // ── Create Solana Connection ──────────────────────────
    const connection = new deps.Connection(rpc, { commitment });

    // ── Create Anchor Provider ────────────────────────────
    const provider = new deps.AnchorProvider(connection, wallet, {
      commitment,
      skipPreflight,
    });

    // ── Create SapClient ──────────────────────────────────
    const sapClient = deps.SapClient.from(provider, programId);

    const walletPubkey = wallet.publicKey.toBase58();

    if (debug) {
      console.log(
        `[SynapseAnchorSap] initialized — wallet: ${walletPubkey}, program: ${programId}`,
      );
    }

    return new SynapseAnchorSap(
      sapClient,
      endpoint,
      programId,
      walletPubkey,
      provider,
      connection,
    );
  }

  /* ── Factory: fromSynapseClient ──────────────────────────── */

  /**
   * Create from an existing {@link SynapseClient}.
   *
   * Extracts the RPC endpoint URL from the client's configuration
   * so you don't have to specify it twice.
   *
   * @param synapseClient - An initialized SynapseClient instance
   * @param wallet - Wallet with signing capability
   * @param opts - Optional overrides for programId, commitment, etc.
   * @returns Fully-initialized SAP bridge using the same RPC endpoint
   *
   * @example
   * ```ts
   * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
   * import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
   *
   * const synapse = new SynapseClient({ endpoint: process.env.SYNAPSE_RPC! });
   * const sap = SynapseAnchorSap.fromSynapseClient(synapse, wallet);
   *
   * // Now both synapse and sap share the same RPC endpoint
   * await sap.agent.register({ ... });
   * ```
   */
  static fromSynapseClient(
    synapseClient: SynapseClient,
    wallet: SapWallet,
    opts?: {
      programId?: string;
      commitment?: SapCommitment;
      skipPreflight?: boolean;
      debug?: boolean;
    },
  ): SynapseAnchorSap {
    // Extract endpoint from SynapseClient's internal config.
    // cfg is private, so we use a known-safe internal access pattern.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientAny = synapseClient as any;
    const rpcEndpoint: string | undefined =
      clientAny.cfg?.endpoint ??
      clientAny.config?.endpoint ??
      clientAny._config?.endpoint;

    if (!rpcEndpoint) {
      throw new Error(
        'Could not extract RPC endpoint from SynapseClient. ' +
        'Use SynapseAnchorSap.create({ wallet, rpcEndpoint: "..." }) instead.',
      );
    }

    return SynapseAnchorSap.create({
      wallet,
      rpcEndpoint,
      programId: opts?.programId,
      commitment: opts?.commitment ?? 'confirmed',
      skipPreflight: opts?.skipPreflight,
      debug: opts?.debug,
    });
  }

  /* ═══════════════════════════════════════════════════════════
   *  SapClient module accessors
   *
   *  These proxy to the underlying SapClient's lazy getters.
   *  Each module is instantiated on first access and cached
   *  by SapClient internally.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Agent lifecycle — register, update, deactivate, reactivate, close,
   * reportCalls, updateReputation, fetch, fetchStats.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get agent(): any {
    return this.sapClient.agent;
  }

  /**
   * Fluent agent builder — `.agent('Name').description('...').addCapability(...)
   * .addPricingTier(...).register()`.
   *
   * Returns a **new** builder on every access (one-shot flow).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get builder(): any {
    return this.sapClient.builder;
  }

  /**
   * Memory sessions — start, write, readLatest, seal, close.
   * Composes VaultModule + LedgerModule into a single API.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get session(): any {
    return this.sapClient.session;
  }

  /**
   * Escrow management — create, deposit, settle, withdraw, close.
   * Handles x402 micropayment flows.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get escrow(): any {
    return this.sapClient.escrow;
  }

  /**
   * Tool schema registry — publish, inscribe, update, close.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get tools(): any {
    return this.sapClient.tools;
  }

  /**
   * Discovery — find agents by capability, protocol, wallet.
   * Composes Agent + Indexing modules.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get discovery(): any {
    return this.sapClient.discovery;
  }

  /**
   * Feedback — give, update, revoke trustless on-chain reviews.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get feedback(): any {
    return this.sapClient.feedback;
  }

  /**
   * Attestation — create and revoke web-of-trust attestations.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get attestation(): any {
    return this.sapClient.attestation;
  }

  /**
   * Direct access to the underlying Anchor `Program` instance.
   * For low-level RPC calls or custom instruction building.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get program(): any {
    return this.sapClient.program;
  }

  /** Whether the bridge is fully initialized. */
  get isReady(): boolean {
    return this.sapClient != null;
  }
}
