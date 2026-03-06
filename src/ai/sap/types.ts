/**
 * @module ai/sap/types
 * @description Solana Agent Protocol (SAP) — Core type definitions.
 *
 * Defines the on-chain account layout for agent identity, capability
 * registration, pricing, and reputation stored as Solana PDAs.
 *
 * Account layout (Borsh-compatible):
 * ```
 * [0..8]    u8[8]   Anchor discriminator
 * [8]       u8      version (1)
 * [9]       u8      is_active (0 | 1)
 * [10..42]  u8[32]  wallet pubkey (raw bytes)
 * [42..50]  i64     created_at (unix ms)
 * [50..58]  i64     updated_at (unix ms)
 * [58..66]  u64     total_calls_served
 * [66..70]  u32     avg_latency_ms
 * [70]      u8      uptime_percent (0-100)
 * [71..]    Borsh   name (string), description (string),
 *                   capabilities (Vec<string>),
 *                   pricing tiers (Vec<AgentPricingOnChain>),
 *                   x402_endpoint (Option<string>)
 * ```
 *
 * @since 1.3.0
 */

import type { AgentId, AgentIdentity, PaymentToken, PricingTier } from '../gateway/types';

/* ═══════════════════════════════════════════════════════════════
 *  Program Constants
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Default SAP program ID. Replace with your own deployed program.
 * This is a placeholder — deploy the SAP Anchor program and set your ID.
 * @since 1.3.0
 */
export const SAP_DEFAULT_PROGRAM_ID = 'SAPAgnt1111111111111111111111111111111111111';

/**
 * @description PDA seed prefix used for all agent PDAs.
 * Seeds: `["synapse_agent", wallet_pubkey_bytes]`
 * @since 1.3.0
 */
export const SAP_SEED_PREFIX = 'synapse_agent';

/**
 * @description Anchor discriminator for the AgentAccount type.
 * Computed as: `sha256("account:AgentAccount")[0..8]`
 * @since 1.3.0
 */
export const SAP_ACCOUNT_DISCRIMINATOR = new Uint8Array([
  0x9b, 0x56, 0x1c, 0xa4, 0x7f, 0x3e, 0x21, 0xd8,
]);

/**
 * @description Instruction discriminators for SAP program methods.
 * Computed as: `sha256("global:<method_name>")[0..8]`
 * @since 1.3.0
 */
export const SAP_INSTRUCTION_DISCRIMINATORS = {
  register: new Uint8Array([0x18, 0xac, 0x2e, 0x6b, 0x01, 0xf9, 0x7c, 0xd4]),
  update: new Uint8Array([0x27, 0x5d, 0x4b, 0x8e, 0x03, 0xa1, 0x6f, 0xb2]),
  deactivate: new Uint8Array([0x34, 0x6e, 0x5a, 0x9f, 0x02, 0xb3, 0x5d, 0xc1]),
  updateReputation: new Uint8Array([0x41, 0x7f, 0x6b, 0xa0, 0x04, 0xc2, 0x4e, 0xd3]),
} as const;

/* ═══════════════════════════════════════════════════════════════
 *  Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for the SAP module.
 * @since 1.3.0
 */
export interface SAPConfig {
  /** SAP program ID (base58-encoded). */
  programId: string;
  /** Solana RPC commitment level. @default 'confirmed' */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Maximum accounts to fetch in a single `getProgramAccounts`. @default 100 */
  maxAccounts?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  On-Chain Account Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A single capability advertised by an on-chain agent.
 * @since 1.3.0
 */
export interface AgentCapability {
  /** Capability identifier (e.g. `"jupiter:swap"`, `"raydium:pool_create"`). */
  id: string;
  /** Human-readable description. */
  description?: string;
  /** Protocol this capability belongs to. */
  protocol?: string;
}

/**
 * @description On-chain micropayment pricing for an agent's services.
 *
 * Inspired by ERC-8004 metered-billing concepts, adapted natively for Solana:
 * - **Pay-per-call**: every invocation has a deterministic cost
 * - **Volume curves**: price drops automatically at higher usage tiers
 * - **Escrow-ready**: compatible with prepaid escrow PDA balances
 * - **Multi-token**: SOL, USDC, or any SPL token
 * - **Metered settlement**: calls are counted on-chain, settled in batches
 *
 * This is NOT a subscription model. Every call is individually priced.
 *
 * @since 1.4.0
 */
export interface AgentPricingOnChain {
  /** Tier identifier (e.g. `"base"`, `"priority"`). */
  tierId: string;

  /* ── Per-Call Pricing ── */

  /** Base price per call in smallest token unit (lamports / USDC base units). */
  pricePerCall: bigint;
  /** Minimum price floor (for dynamic pricing — price never goes below this). */
  minPricePerCall?: bigint;
  /** Maximum price ceiling (for dynamic pricing — price never exceeds this). */
  maxPricePerCall?: bigint;

  /* ── Volume Curve (ERC-8004-style metered billing) ── */

  /**
   * Volume discount breakpoints. Each entry defines a threshold and discounted price.
   * Example: `[{ afterCalls: 100, pricePerCall: 800n }, { afterCalls: 1000, pricePerCall: 500n }]`
   * → first 100 calls at `pricePerCall`, next 900 at 800, everything after 1000 at 500.
   * Empty array = flat pricing (no volume discount).
   */
  volumeCurve?: VolumeCurveBreakpoint[];

  /* ── Rate Limiting ── */

  /** Rate limit (calls per second). */
  rateLimit: number;
  /** Max calls per session (0 = unlimited). */
  maxCallsPerSession: number;
  /** Burst capacity — max calls allowed in a single second burst (≥ rateLimit). */
  burstLimit?: number;

  /* ── Payment Token ── */

  /** Payment token type. */
  tokenType: 'SOL' | 'USDC' | 'SPL';
  /** SPL token mint address (only when tokenType = 'SPL'). */
  tokenMint?: string;
  /** Token decimals (used for display — e.g. 9 for SOL, 6 for USDC). */
  tokenDecimals?: number;

  /* ── Settlement ── */

  /**
   * Settlement mode: how calls are paid for.
   * - `'instant'`  — each call triggers an immediate transfer (higher tx cost)
   * - `'escrow'`   — caller pre-funds an escrow PDA, agent draws per call
   * - `'batched'`  — calls accumulate off-chain, settled on-chain periodically
   * - `'x402'`     — payment via HTTP x402 protocol (off-chain → on-chain attestation)
   * @default 'x402'
   */
  settlementMode?: 'instant' | 'escrow' | 'batched' | 'x402';

  /** Minimum escrow deposit (only for `escrow` mode). */
  minEscrowDeposit?: bigint;

  /** Batch settlement interval in seconds (only for `batched` mode). */
  batchIntervalSec?: number;
}

/**
 * @description A breakpoint in the volume discount curve.
 * Implements ERC-8004-style metered billing for Solana agents.
 *
 * The curve is evaluated sequentially:
 *   1. Calls 0 → breakpoint[0].afterCalls: charged at base `pricePerCall`
 *   2. Calls breakpoint[0].afterCalls → breakpoint[1].afterCalls: charged at breakpoint[0].pricePerCall
 *   3. And so on...
 *
 * @since 1.4.0
 */
export interface VolumeCurveBreakpoint {
  /** After this many cumulative calls, the discounted price kicks in. */
  afterCalls: number;
  /** Discounted price per call (smallest token unit). */
  pricePerCall: bigint;
}

/**
 * @description On-chain reputation metrics for an agent.
 * Updated by the agent or by a trusted oracle/facilitator.
 * @since 1.3.0
 */
export interface AgentReputationOnChain {
  /** Total attested calls served (lifetime). */
  totalCallsServed: bigint;
  /** Average response latency in milliseconds. */
  avgLatencyMs: number;
  /** Uptime percentage (0–100). */
  uptimePercent: number;
  /** Reputation score (0–1000), computed off-chain and posted on-chain. */
  score: number;
  /** Unix timestamp of last reputation update. */
  lastUpdatedAt: number;
}

/**
 * @description Full deserialized agent PDA account data.
 * @since 1.3.0
 */
export interface AgentPDAAccount {
  /** PDA address (base58). */
  address: string;
  /** Schema version. */
  version: number;
  /** Whether this agent is currently active. */
  isActive: boolean;
  /** Agent's wallet public key (base58). */
  walletPubkey: string;
  /** Human-readable agent name. */
  name: string;
  /** Agent description. */
  description: string;
  /** DID-style agent identifier. */
  agentId?: string;
  /** Advertised capabilities. */
  capabilities: AgentCapability[];
  /** On-chain pricing tiers. */
  pricing: AgentPricingOnChain[];
  /** Reputation metrics. */
  reputation: AgentReputationOnChain;
  /** x402 endpoint for remote calls (e.g. `"https://agent.example/.well-known/x402"`). */
  x402Endpoint?: string;
  /** Unix timestamp of creation (ms). */
  createdAt: number;
  /** Unix timestamp of last update (ms). */
  updatedAt: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Instruction Parameter Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Parameters for the `register` instruction.
 * @since 1.3.0
 */
export interface RegisterAgentParams {
  /** Agent's wallet public key (base58). Must be the signer. */
  walletPubkey: string;
  /** Human-readable name (max 64 bytes UTF-8). */
  name: string;
  /** Description (max 256 bytes UTF-8). */
  description: string;
  /** Optional DID identifier. */
  agentId?: string;
  /** Initial capabilities. */
  capabilities?: AgentCapability[];
  /** Initial pricing tiers. */
  pricing?: AgentPricingOnChain[];
  /** Optional x402 endpoint. */
  x402Endpoint?: string;
}

/**
 * @description Parameters for the `update` instruction.
 * Only provided fields are updated; omitted fields are unchanged.
 * @since 1.3.0
 */
export interface UpdateAgentParams {
  /** Wallet pubkey of the agent to update (must be signer). */
  walletPubkey: string;
  /** New name (max 64 bytes). */
  name?: string;
  /** New description (max 256 bytes). */
  description?: string;
  /** Updated capabilities (replaces existing list). */
  capabilities?: AgentCapability[];
  /** Updated pricing tiers (replaces existing list). */
  pricing?: AgentPricingOnChain[];
  /** Updated x402 endpoint. */
  x402Endpoint?: string;
  /** Set active/inactive status. */
  isActive?: boolean;
}

/**
 * @description Parameters for the `updateReputation` instruction.
 * Typically called by the agent itself or a trusted oracle.
 * @since 1.3.0
 */
export interface UpdateReputationParams {
  /** Wallet pubkey of the agent. */
  walletPubkey: string;
  /** New total calls served count. */
  totalCallsServed?: bigint;
  /** New average latency (ms). */
  avgLatencyMs?: number;
  /** New uptime percentage. */
  uptimePercent?: number;
  /** Reputation score (0–1000). */
  score?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Discovery Filter Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Filters for on-chain agent discovery.
 * @since 1.3.0
 */
export interface AgentDiscoveryFilter {
  /** Only return active agents. @default true */
  activeOnly?: boolean;
  /** Filter by capability ID (e.g. `"jupiter:swap"`). */
  capability?: string;
  /** Filter by protocol (e.g. `"jupiter"`, `"raydium"`). */
  protocol?: string;
  /** Min reputation score (0–1000). */
  minReputation?: number;
  /** Max price per call (lamports). */
  maxPricePerCall?: bigint;
  /** Min uptime percentage. */
  minUptime?: number;
  /** Sort results by this field. */
  sortBy?: 'reputation' | 'price' | 'latency' | 'uptime' | 'calls';
  /** Sort direction. @default 'desc' */
  sortDirection?: 'asc' | 'desc';
  /** Max results to return. @default 50 */
  limit?: number;
}

/**
 * @description Result of an on-chain discovery query.
 * @since 1.3.0
 */
export interface DiscoveryResult {
  /** Matching agent accounts. */
  agents: AgentPDAAccount[];
  /** Total accounts scanned. */
  totalScanned: number;
  /** Total matching accounts (before limit). */
  totalMatching: number;
  /** Query latency in milliseconds. */
  queryLatencyMs: number;
}

/**
 * @description Aggregate metrics across all discovered agents.
 * @since 1.3.0
 */
export interface SAPAggregateMetrics {
  /** Total registered agents. */
  totalAgents: number;
  /** Total active agents. */
  activeAgents: number;
  /** Sum of all calls served. */
  totalCallsServed: bigint;
  /** Average reputation score across agents. */
  avgReputation: number;
  /** Average latency across agents (ms). */
  avgLatencyMs: number;
  /** Unique protocols represented. */
  protocols: string[];
  /** Unique capabilities available. */
  capabilities: string[];
}

/**
 * @description Instruction-like object returned by {@link SAPInstructionBuilder}.
 * Compatible with Solana `TransactionInstruction`.
 * @since 1.3.0
 */
export interface SAPInstruction {
  /** Program ID (base58). */
  programId: string;
  /** Account metas for the instruction. */
  keys: SAPAccountMeta[];
  /** Serialized instruction data. */
  data: Uint8Array;
}

/**
 * @description Account metadata for an instruction.
 * @since 1.3.0
 */
export interface SAPAccountMeta {
  /** Account public key (base58). */
  pubkey: string;
  /** Whether this account is a signer. */
  isSigner: boolean;
  /** Whether this account is writable. */
  isWritable: boolean;
}

/**
 * @description Conversion helpers to bridge SAP types to gateway types.
 * @since 1.3.0
 */
export function pdaToIdentity(pda: AgentPDAAccount): AgentIdentity {
  return {
    id: (pda.agentId ?? `did:sap:${pda.walletPubkey}`) as AgentId,
    name: pda.name,
    walletPubkey: pda.walletPubkey,
    description: pda.description,
    tags: pda.capabilities.map(c => c.id),
    createdAt: pda.createdAt,
  };
}

/**
 * @description Convert on-chain pricing to gateway PricingTier.
 * @param {AgentPricingOnChain} p - On-chain pricing entry
 * @returns {PricingTier} Gateway-compatible pricing tier
 * @since 1.3.0
 */
export function pricingToTier(p: AgentPricingOnChain): PricingTier {
  const token: PaymentToken =
    p.tokenType === 'SOL'  ? { type: 'SOL' } :
    p.tokenType === 'USDC' ? { type: 'USDC' } :
                              { type: 'SPL', mint: p.tokenMint ?? '', decimals: p.tokenDecimals ?? 6 };

  return {
    id: p.tierId,
    label: p.tierId,
    pricePerCall: p.pricePerCall,
    maxCallsPerSession: p.maxCallsPerSession,
    rateLimit: p.rateLimit,
    token,
    includesAttestation: true,
  };
}

/**
 * @description Compute the cost of a specific call number using volume curve pricing.
 *
 * Evaluates the agent's volume curve to determine the price for the Nth call.
 * This implements ERC-8004-style metered billing natively on Solana.
 *
 * @param {AgentPricingOnChain} pricing - The pricing tier
 * @param {number} callNumber - The call number (1-indexed, cumulative across sessions)
 * @returns {bigint} Cost of this specific call in smallest token unit
 *
 * @example
 * ```ts
 * const pricing = {
 *   tierId: 'base',
 *   pricePerCall: 1000n,       // 0.001 USDC base price
 *   volumeCurve: [
 *     { afterCalls: 100, pricePerCall: 800n },   // 20% off after 100 calls
 *     { afterCalls: 1000, pricePerCall: 500n },   // 50% off after 1000 calls
 *   ],
 *   // ...
 * };
 *
 * computeCallCost(pricing, 1);    // → 1000n (base price)
 * computeCallCost(pricing, 101);  // → 800n  (first discount tier)
 * computeCallCost(pricing, 1001); // → 500n  (second discount tier)
 * ```
 *
 * @since 1.4.0
 */
export function computeCallCost(pricing: AgentPricingOnChain, callNumber: number): bigint {
  let price = pricing.pricePerCall;

  if (pricing.volumeCurve && pricing.volumeCurve.length > 0) {
    // Sort breakpoints by afterCalls ascending
    const sorted = [...pricing.volumeCurve].sort((a, b) => a.afterCalls - b.afterCalls);

    for (const bp of sorted) {
      if (callNumber > bp.afterCalls) {
        price = bp.pricePerCall;
      } else {
        break;
      }
    }
  }

  // Enforce floor/ceiling
  if (pricing.minPricePerCall !== undefined && price < pricing.minPricePerCall) {
    price = pricing.minPricePerCall;
  }
  if (pricing.maxPricePerCall !== undefined && price > pricing.maxPricePerCall) {
    price = pricing.maxPricePerCall;
  }

  return price;
}

/**
 * @description Estimate total cost for N calls using the volume curve.
 *
 * @param {AgentPricingOnChain} pricing - The pricing tier
 * @param {number} totalCalls - Total number of calls
 * @param {number} [startingFrom=1] - Starting call number (for continuing sessions)
 * @returns {{ totalCost: bigint; avgPricePerCall: bigint; breakdown: Array<{ from: number; to: number; pricePerCall: bigint; subtotal: bigint }> }}
 *
 * @example
 * ```ts
 * const estimate = estimateTotalCost(pricing, 1500);
 * // estimate.totalCost    → 850_000n
 * // estimate.avgPricePerCall → 566n
 * // estimate.breakdown → [
 * //   { from: 1, to: 100, pricePerCall: 1000n, subtotal: 100_000n },
 * //   { from: 101, to: 1000, pricePerCall: 800n, subtotal: 720_000n },
 * //   { from: 1001, to: 1500, pricePerCall: 500n, subtotal: 250_000n },
 * // ]
 * ```
 *
 * @since 1.4.0
 */
export function estimateTotalCost(
  pricing: AgentPricingOnChain,
  totalCalls: number,
  startingFrom = 1,
): {
  totalCost: bigint;
  avgPricePerCall: bigint;
  breakdown: Array<{ from: number; to: number; pricePerCall: bigint; subtotal: bigint }>;
} {
  if (totalCalls <= 0) {
    return { totalCost: 0n, avgPricePerCall: 0n, breakdown: [] };
  }

  const curve = pricing.volumeCurve && pricing.volumeCurve.length > 0
    ? [...pricing.volumeCurve].sort((a, b) => a.afterCalls - b.afterCalls)
    : [];

  // Build segments: [0, bp1, bp2, ...] with corresponding prices
  const segments: Array<{ afterCalls: number; pricePerCall: bigint }> = [
    { afterCalls: 0, pricePerCall: pricing.pricePerCall },
    ...curve,
  ];

  const endCall = startingFrom + totalCalls - 1;
  const breakdown: Array<{ from: number; to: number; pricePerCall: bigint; subtotal: bigint }> = [];
  let totalCost = 0n;

  for (let i = 0; i < segments.length; i++) {
    const segStart = segments[i].afterCalls + 1;
    const segEnd = i + 1 < segments.length ? segments[i + 1].afterCalls : Infinity;
    let price = segments[i].pricePerCall;

    // Enforce floor/ceiling
    if (pricing.minPricePerCall !== undefined && price < pricing.minPricePerCall) price = pricing.minPricePerCall;
    if (pricing.maxPricePerCall !== undefined && price > pricing.maxPricePerCall) price = pricing.maxPricePerCall;

    const rangeStart = Math.max(segStart, startingFrom);
    const rangeEnd = Math.min(segEnd, endCall);

    if (rangeStart > rangeEnd) continue;

    const count = rangeEnd - rangeStart + 1;
    const subtotal = price * BigInt(count);
    totalCost += subtotal;

    breakdown.push({
      from: rangeStart,
      to: rangeEnd,
      pricePerCall: price,
      subtotal,
    });
  }

  const avgPricePerCall = totalCalls > 0 ? totalCost / BigInt(totalCalls) : 0n;

  return { totalCost, avgPricePerCall, breakdown };
}
