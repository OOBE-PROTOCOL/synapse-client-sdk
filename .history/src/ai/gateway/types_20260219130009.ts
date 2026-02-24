/**
 * Synapse Agent Gateway — Core type definitions.
 *
 * This module defines the primitives for agent-to-agent commerce:
 * metered sessions, payment channels, response attestations,
 * and tool marketplace listings.
 */

/* ═══════════════════════════════════════════════════════════════
 *  Identity & Credentials
 * ═══════════════════════════════════════════════════════════════ */

/** Unique identifier for an agent within the Synapse network. */
export type AgentId = string & { readonly __brand: 'AgentId' };
export const AgentId = (v: string): AgentId => v as AgentId;

/** DID-style agent identity with optional verification. */
export interface AgentIdentity {
  /** Agent unique identifier (e.g. did:synapse:agent:<pubkey>) */
  id: AgentId;
  /** Human-readable display name */
  name: string;
  /** Agent's Solana wallet pubkey — used for payments & signing */
  walletPubkey: string;
  /** Optional description of the agent's capabilities */
  description?: string;
  /** Capabilities tags for marketplace discovery */
  tags?: string[];
  /** Unix timestamp of identity creation */
  createdAt: number;
}

/** Signed credential proving an agent's identity ownership. */
export interface AgentCredential {
  identity: AgentIdentity;
  /** Ed25519 signature of JSON.stringify(identity) by walletPubkey */
  signature: string;
  /** Expiration timestamp (0 = no expiry) */
  expiresAt: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Payment & Billing
 * ═══════════════════════════════════════════════════════════════ */

/** Supported payment tokens for x402 settlements. */
export type PaymentToken =
  | { type: 'SOL' }
  | { type: 'SPL'; mint: string; decimals: number }
  | { type: 'USDC' };

/** A single pricing tier for a tool or bundle. */
export interface PricingTier {
  /** Tier identifier (e.g. 'free', 'standard', 'premium') */
  id: string;
  /** Human-readable label */
  label: string;
  /** Price per call in the smallest token unit (lamports, USDC micro-units) */
  pricePerCall: bigint;
  /** Max calls per session (0 = unlimited) */
  maxCallsPerSession: number;
  /** Max calls per second (rate limit) */
  rateLimit: number;
  /** Token used for payment */
  token: PaymentToken;
  /** Whether response attestation is included */
  includesAttestation: boolean;
}

/** x402 payment intent — what the buyer sends before a session starts. */
export interface PaymentIntent {
  /** Unique nonce to prevent replay */
  nonce: string;
  /** Buyer agent identity */
  buyer: AgentId;
  /** Seller agent identity */
  seller: AgentId;
  /** The pricing tier being purchased */
  tierId: string;
  /** Max budget for this session (smallest token unit) */
  maxBudget: bigint;
  /** Token for this payment */
  token: PaymentToken;
  /** Buyer's signature of the intent (Ed25519) */
  signature: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** TTL in seconds for this intent */
  ttl: number;
}

/** Receipt of a settled payment (on-chain or off-chain). */
export interface PaymentReceipt {
  /** Payment intent that originated this receipt */
  intentNonce: string;
  /** Total amount actually charged */
  amountCharged: bigint;
  /** Total calls made in the session */
  callCount: number;
  /** Transaction signature if settled on-chain, null if off-chain */
  txSignature: string | null;
  /** Settlement method */
  settlement: 'onchain' | 'offchain-escrow' | 'streaming';
  /** Unix timestamp of settlement */
  settledAt: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Session & Metering
 * ═══════════════════════════════════════════════════════════════ */

export type SessionStatus = 'pending' | 'active' | 'paused' | 'exhausted' | 'settled' | 'expired';

/** A metered agent session — tracks usage, budget, rate limits. */
export interface SessionState {
  /** Unique session id */
  id: string;
  /** Current lifecycle status */
  status: SessionStatus;
  /** Buyer agent */
  buyer: AgentId;
  /** Seller agent (the gateway owner) */
  seller: AgentId;
  /** Active pricing tier */
  tier: PricingTier;
  /** Payment intent that opened this session */
  intentNonce: string;
  /** Budget remaining (smallest token unit) */
  budgetRemaining: bigint;
  /** Total budget allocated at session start */
  budgetTotal: bigint;
  /** Calls made in this session */
  callsMade: number;
  /** Calls remaining in this session (Infinity stored as -1) */
  callsRemaining: number;
  /** Per-method call counts for granular metering */
  methodCounts: Record<string, number>;
  /** Sliding window rate limiter state */
  rateLimiter: {
    windowMs: number;
    maxPerWindow: number;
    /** Timestamps of calls in the current window */
    timestamps: number[];
  };
  /** Session-level metadata (can store custom agent data) */
  metadata: Record<string, unknown>;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last activity */
  lastActivityAt: number;
  /** TTL in seconds (0 = no expiry) */
  ttl: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Response Attestation (Proof of Computation)
 * ═══════════════════════════════════════════════════════════════ */

/** Cryptographic attestation of an RPC response. */
export interface ResponseAttestation {
  /** The session this attestation belongs to */
  sessionId: string;
  /** RPC method name */
  method: string;
  /** SHA-256 hash of the request params (for binding) */
  requestHash: string;
  /** SHA-256 hash of the response body (for integrity) */
  responseHash: string;
  /** The upstream RPC slot at the time of response (chain timestamp anchor) */
  slot: number;
  /** Attester's agent identity */
  attesterId: AgentId;
  /** Ed25519 signature over (method + requestHash + responseHash + slot) */
  signature: string;
  /** Unix timestamp of attestation */
  timestamp: number;
}

/** Result wrapper that includes optional attestation. */
export interface AttestedResult<T = unknown> {
  /** The actual RPC result */
  data: T;
  /** Attestation, present if the pricing tier includes it */
  attestation?: ResponseAttestation;
  /** Latency in milliseconds for the RPC call */
  latencyMs: number;
  /** Session call number (sequential) */
  callIndex: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Marketplace
 * ═══════════════════════════════════════════════════════════════ */

/** A tool listing in the agent marketplace. */
export interface ToolListing {
  /** RPC method name (e.g. 'getBalance') */
  method: string;
  /** Human-readable description */
  description: string;
  /** Seller agent */
  seller: AgentIdentity;
  /** Available pricing tiers */
  tiers: PricingTier[];
  /** Average response latency (ms) — self-reported or verified */
  avgLatencyMs: number;
  /** Uptime percentage (0-100) */
  uptimePercent: number;
  /** Number of attested calls served */
  totalServed: number;
  /** Reputation score (0-1000) computed from attestations */
  reputationScore: number;
  /** Whether the seller provides response attestation */
  attestationAvailable: boolean;
  /** Geographic region hint (e.g. 'us-east', 'eu-west') */
  region?: string;
  /** Supported commitment levels */
  commitments: ('processed' | 'confirmed' | 'finalized')[];
  /** Unix timestamp of listing creation */
  listedAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
}

/** A bundle of tools sold together (e.g. "DeFi Pack", "NFT Read-Only"). */
export interface ToolBundle {
  /** Unique bundle identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the bundle */
  description: string;
  /** Method names included */
  methods: string[];
  /** Seller agent */
  seller: AgentIdentity;
  /** Bundle pricing tiers (overrides per-method pricing) */
  tiers: PricingTier[];
  /** Unix timestamp of creation */
  createdAt: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Gateway Events (observable by consumers)
 * ═══════════════════════════════════════════════════════════════ */

export type GatewayEventType =
  | 'session:created'
  | 'session:activated'
  | 'session:paused'
  | 'session:exhausted'
  | 'session:settled'
  | 'session:expired'
  | 'call:before'
  | 'call:after'
  | 'call:error'
  | 'call:attested'
  | 'payment:intent'
  | 'payment:settled'
  | 'ratelimit:exceeded'
  | 'budget:warning'
  | 'budget:exhausted'
  | 'x402:payment-required'
  | 'x402:payment-verified'
  | 'x402:payment-settled'
  | 'x402:payment-sent';

export interface GatewayEvent<T = unknown> {
  type: GatewayEventType;
  sessionId: string;
  timestamp: number;
  data: T;
}

export type GatewayEventHandler<T = unknown> = (event: GatewayEvent<T>) => void | Promise<void>;

/* ═══════════════════════════════════════════════════════════════
 *  Configuration
 * ═══════════════════════════════════════════════════════════════ */

import type { X402Config } from './x402/types';
import type { X402ClientConfig } from './x402/client';

export interface GatewayConfig {
  /** The seller's agent identity */
  identity: AgentIdentity;
  /** Default pricing tiers for all methods */
  defaultTiers: PricingTier[];
  /** Per-method pricing overrides (method name → tiers) */
  methodTiers?: Record<string, PricingTier[]>;
  /** Session TTL in seconds (default: 3600) */
  sessionTtl?: number;
  /** Budget warning threshold (0-1, fraction of total budget, default: 0.2) */
  budgetWarningThreshold?: number;
  /** Maximum concurrent sessions (default: 100) */
  maxConcurrentSessions?: number;
  /** Whether to produce response attestations by default */
  attestByDefault?: boolean;
  /** Custom signer function for attestations (default: no-op, integrate with wallet) */
  signer?: (message: Uint8Array) => Promise<Uint8Array>;

  /* ── x402 Protocol ─────────────────────────────────────── */

  /**
   * x402 Paywall configuration (SELLER side).
   * When set, the gateway generates 402 responses and settles
   * payments via the configured facilitator.
   */
  x402?: X402Config;

  /**
   * x402 Client configuration (BUYER side).
   * When set, the gateway can pay for RPC access on remote
   * x402-enabled servers.
   */
  x402Client?: X402ClientConfig;
}
