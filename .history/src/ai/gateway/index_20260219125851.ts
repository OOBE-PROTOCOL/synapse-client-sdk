/**
 * AgentGateway — Main orchestrator for agent-to-agent RPC commerce.
 *
 * Composes:
 * - PricingEngine   → dynamic pricing, tiers, bundles
 * - AgentSession    → metered sessions, budget, rate limiting
 * - ResponseValidator → Proof-of-Computation attestations
 * - ToolMarketplace → discovery, reputation, listing
 *
 * Exposes:
 * - openSession()   → accept a buyer's PaymentIntent, return a session
 * - execute()       → metered + attested RPC call within a session
 * - settleSession() → finalize billing, generate receipt
 * - publish()       → list tools on the marketplace
 * - createGatewayTools() → LangChain tools wrapped with metering/attestation
 *
 * This is the x402-ready entry point for selling RPC access to other agents.
 */

import { randomUUID } from 'crypto';
import type { SynapseClient } from '../../core/client';
import type { HttpTransport } from '../../core/transport';
import type {
  AgentId,
  AgentIdentity,
  GatewayConfig,
  GatewayEvent,
  GatewayEventHandler,
  GatewayEventType,
  PaymentIntent,
  PaymentReceipt,
  PricingTier,
  AttestedResult,
  ToolListing,
  ToolBundle,
  SessionState,
} from './types';

import { AgentSession, SessionError } from './session';
import { PricingEngine, DEFAULT_TIERS } from './pricing';
import { ResponseValidator } from './validator';
import { ToolMarketplace, type MarketplaceQuery, type MarketplaceStats } from './marketplace';

/* ── x402 imports (lazy-loaded for modularity) ────────────── */
import type { X402Config, X402PaymentPayload, X402PaymentRequirements, X402SettlementResponse, X402ClientConfig } from './x402';
import { X402Paywall, type PaywallResult, type SettleResult } from './x402/paywall';
import { X402Client, type X402PaymentOutcome } from './x402/client';

/* ═══════════════════════════════════════════════════════════════
 *  Gateway errors
 * ═══════════════════════════════════════════════════════════════ */

export class GatewayError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class SessionNotFoundError extends GatewayError {
  constructor(sessionId: string) {
    super(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
  }
}

export class MaxSessionsError extends GatewayError {
  constructor(limit: number) {
    super(`Maximum concurrent sessions (${limit}) reached`, 'MAX_SESSIONS');
  }
}

export class IntentVerificationError extends GatewayError {
  constructor(reason: string) {
    super(`Payment intent verification failed: ${reason}`, 'INTENT_INVALID');
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  AgentGateway
 * ═══════════════════════════════════════════════════════════════ */

export class AgentGateway {
  /** The Synapse RPC client powering the upstream calls */
  private readonly client: SynapseClient;
  /** The raw transport (shortcut for tools) */
  private readonly transport: HttpTransport;
  /** Gateway configuration */
  private readonly config: GatewayConfig;

  /** Sub-systems */
  readonly pricing: PricingEngine;
  readonly validator: ResponseValidator;
  readonly marketplace: ToolMarketplace;

  /** Active sessions by ID */
  private readonly sessions: Map<string, AgentSession> = new Map();

  /** Global event bus */
  private readonly listeners: Map<string, Set<GatewayEventHandler>> = new Map();

  /** Gateway-wide call counter (for metrics) */
  private totalCallsServed = 0;
  private totalRevenue = 0n;

  constructor(client: SynapseClient, config: GatewayConfig) {
    this.client = client;
    this.transport = client.transport;
    this.config = config;

    // Initialize sub-systems
    this.pricing = new PricingEngine(
      config.defaultTiers,
      config.methodTiers,
    );
    this.validator = new ResponseValidator(config);
    this.marketplace = new ToolMarketplace();
  }

  /* ═══════════════════════════════════════════════════════════
   *  Identity
   * ═══════════════════════════════════════════════════════════ */

  /** Get the seller's agent identity */
  get identity(): AgentIdentity {
    return this.config.identity;
  }

  /** Get the seller's agent ID */
  get agentId(): AgentId {
    return this.config.identity.id;
  }

  /* ═══════════════════════════════════════════════════════════
   *  Session lifecycle
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Open a new metered session.
   *
   * A buyer agent sends a PaymentIntent; the gateway validates it,
   * resolves the pricing tier, and returns an activated session.
   *
   * @param intent — the buyer's signed payment intent
   * @param opts — optional overrides
   * @returns the activated AgentSession
   */
  openSession(
    intent: PaymentIntent,
    opts: {
      /** Override the pricing tier (default: resolved from intent.tierId) */
      tier?: PricingTier;
      /** Override TTL (default: config.sessionTtl) */
      ttl?: number;
      /** Custom intent verifier (default: basic checks) */
      verifyIntent?: (intent: PaymentIntent) => boolean;
    } = {},
  ): AgentSession {
    // ── Concurrency limit
    const maxSessions = this.config.maxConcurrentSessions ?? 100;
    const activeSessions = [...this.sessions.values()].filter(
      s => s.status === 'active' || s.status === 'pending' || s.status === 'paused',
    ).length;
    if (activeSessions >= maxSessions) {
      throw new MaxSessionsError(maxSessions);
    }

    // ── Intent verification
    if (opts.verifyIntent) {
      if (!opts.verifyIntent(intent)) {
        throw new IntentVerificationError('custom verifier returned false');
      }
    } else {
      this.verifyIntentBasic(intent);
    }

    // ── Resolve tier
    const tier = opts.tier ?? this.pricing.getTier(intent.tierId);
    if (!tier) {
      throw new IntentVerificationError(`Unknown pricing tier '${intent.tierId}'`);
    }

    // ── Create & activate session
    const ttl = opts.ttl ?? this.config.sessionTtl ?? 3600;
    const session = new AgentSession(intent, tier, this.agentId, ttl);

    // Forward session events to the gateway bus
    session.on('*', (evt) => { this.emit(evt.type, evt.data, evt.sessionId); });

    session.activate();
    this.sessions.set(session.id, session);

    this.emit('session:created', {
      sessionId: session.id,
      buyer: intent.buyer,
      tier: tier.id,
      budget: intent.maxBudget.toString(),
    }, session.id);

    return session;
  }

  /**
   * Settle a session and return a PaymentReceipt.
   *
   * @param sessionId — the session to settle
   * @param txSignature — optional on-chain settlement tx signature
   */
  settleSession(
    sessionId: string,
    txSignature: string | null = null,
  ): PaymentReceipt {
    const session = this.getSessionOrThrow(sessionId);
    const usage = session.settle();

    this.totalRevenue += usage.amountCharged;

    const receipt: PaymentReceipt = {
      intentNonce: session.snapshot().intentNonce,
      amountCharged: usage.amountCharged,
      callCount: usage.callCount,
      txSignature,
      settlement: txSignature ? 'onchain' : 'offchain-escrow',
      settledAt: Date.now(),
    };

    this.emit('payment:settled', {
      sessionId,
      receipt,
    }, sessionId);

    return receipt;
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions (optionally filter by status).
   */
  listSessions(status?: SessionState['status']): { id: string; status: string; buyer: AgentId }[] {
    const results: { id: string; status: string; buyer: AgentId }[] = [];
    for (const session of this.sessions.values()) {
      const snap = session.snapshot();
      if (!status || snap.status === status) {
        results.push({ id: snap.id, status: snap.status, buyer: snap.buyer });
      }
    }
    return results;
  }

  /**
   * Close and remove expired/settled sessions (garbage collection).
   */
  pruneSessions(): number {
    let pruned = 0;
    for (const [id, session] of this.sessions) {
      const s = session.status;
      if (s === 'settled' || s === 'expired') {
        this.sessions.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  /* ═══════════════════════════════════════════════════════════
   *  Execute (metered + attested RPC call)
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Execute an RPC method within a metered session.
   *
   * Flow:
   *  1. session.preCall()  — check budget, rate limit, etc.
   *  2. transport.request() — execute the actual RPC call
   *  3. validator.wrapResult() — hash & sign (if tier includes attestation)
   *  4. session.postCall() — deduct budget, increment counters
   *  5. pricing.reportLatency() — feed latency into dynamic pricing
   *
   * @param sessionId — the session to charge
   * @param method — Solana JSON-RPC method name
   * @param params — method parameters
   * @returns attested result
   */
  async execute<T = unknown>(
    sessionId: string,
    method: string,
    params: unknown[] = [],
  ): Promise<AttestedResult<T>> {
    const session = this.getSessionOrThrow(sessionId);
    const snap = session.snapshot();

    // ── Pre-flight
    this.emit('call:before', { method, params }, sessionId);
    const cost = session.preCall(method);

    // ── Execute
    const start = performance.now();
    let result: T;
    try {
      result = await this.transport.request<T>(method, params);
    } catch (err) {
      this.emit('call:error', { method, error: String(err) }, sessionId);
      throw err;
    }
    const latencyMs = Math.round(performance.now() - start);

    // ── Attest
    const shouldAttest = snap.tier.includesAttestation ||
      (this.config.attestByDefault ?? false);

    // Get slot from the response context if available, otherwise 0
    const slot = typeof result === 'object' && result !== null && 'context' in result
      ? ((result as Record<string, unknown>).context as { slot?: number })?.slot ?? 0
      : 0;

    const attested = await this.validator.wrapResult<T>(
      result,
      sessionId,
      method,
      params,
      slot,
      latencyMs,
      snap.callsMade + 1,
      shouldAttest,
    );

    // ── Post-call
    session.postCall(method, cost);
    this.totalCallsServed++;

    // ── Feed latency into pricing engine
    this.pricing.reportLatency(latencyMs);

    this.emit('call:after', {
      method,
      latencyMs,
      cost: cost.toString(),
      attested: shouldAttest,
    }, sessionId);

    if (shouldAttest && attested.attestation) {
      this.emit('call:attested', { attestation: attested.attestation }, sessionId);
    }

    return attested;
  }

  /**
   * Execute a batch of methods within a metered session.
   * Each method is individually metered.
   *
   * @param sessionId — the session to charge
   * @param calls — array of { method, params }
   * @returns array of attested results
   */
  async executeBatch<T = unknown>(
    sessionId: string,
    calls: { method: string; params?: unknown[] }[],
  ): Promise<AttestedResult<T>[]> {
    const results: AttestedResult<T>[] = [];
    for (const call of calls) {
      results.push(await this.execute<T>(sessionId, call.method, call.params));
    }
    return results;
  }

  /* ═══════════════════════════════════════════════════════════
   *  Marketplace publishing
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Publish all available tools to the marketplace.
   * Generates ToolListings from the configured tiers.
   *
   * @param methods — method names to publish (default: all standard Solana RPC)
   * @param opts — listing metadata overrides
   */
  publish(
    methods: string[],
    opts: {
      region?: string;
      commitments?: ('processed' | 'confirmed' | 'finalized')[];
      description?: (method: string) => string;
    } = {},
  ): void {
    const now = Date.now();

    for (const method of methods) {
      const listing: ToolListing = {
        method,
        description: opts.description?.(method) ?? `Solana RPC: ${method}`,
        seller: this.config.identity,
        tiers: this.config.defaultTiers,
        avgLatencyMs: this.pricing.getAvgLatency(),
        uptimePercent: 100,
        totalServed: this.totalCallsServed,
        reputationScore: 500, // neutral start
        attestationAvailable: this.config.signer != null,
        region: opts.region,
        commitments: opts.commitments ?? ['processed', 'confirmed', 'finalized'],
        listedAt: now,
        updatedAt: now,
      };
      this.marketplace.listTool(listing);
    }
  }

  /**
   * Publish a bundle of tools.
   */
  publishBundle(
    name: string,
    methods: string[],
    tiers: PricingTier[],
    description?: string,
  ): ToolBundle {
    const bundle: ToolBundle = {
      id: randomUUID(),
      name,
      description: description ?? `${name} — ${methods.length} methods`,
      methods,
      seller: this.config.identity,
      tiers,
      createdAt: Date.now(),
    };
    this.marketplace.registerBundle(bundle);
    this.pricing.registerBundle(bundle);
    return bundle;
  }

  /* ═══════════════════════════════════════════════════════════
   *  Gateway-level LangChain tools (metered wrappers)
   *
   *  These wrap the base executable tools with session metering.
   *  When an agent calls a metered tool, it auto-deducts from
   *  the session budget and produces attestations.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Create metered LangChain tools for a specific session.
   * Every call goes through the gateway's execute() pipeline.
   *
   * @param sessionId — the session to bind the tools to
   * @returns array of LangChain-compatible tool instances
   */
  async createGatewayTools(sessionId: string): Promise<Array<ReturnType<typeof import('@langchain/core/tools').tool>>> {
    this.getSessionOrThrow(sessionId);

    // Lazy import to keep gateway usable without langchain installed
    const { tool: lcTool } = await import('@langchain/core/tools');
    const { agentRpcMethods } = await import('../tools/zod');

    const tools: Array<ReturnType<typeof lcTool>> = [];

    for (const method of agentRpcMethods) {
      const gateway = this;
      const sid = sessionId;

      const t = lcTool(
        async (input) => {
          try {
            const params = Object.values(input as Record<string, unknown>);
            const result = await gateway.execute(sid, method.name, params);
            return JSON.stringify(result);
          } catch (err) {
            return JSON.stringify({ error: String(err) });
          }
        },
        {
          name: `metered_${method.name}`,
          description: `[Metered] ${method.description}. Session: ${sid.slice(0, 8)}…`,
          schema: method.input as import('zod').ZodObject<any>,
        },
      );
      tools.push(t);
    }

    return tools;
  }

  /* ═══════════════════════════════════════════════════════════
   *  Event system
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Subscribe to gateway events.
   *
   * @param event — event type or '*' for all
   * @param handler — callback
   * @returns unsubscribe function
   */
  on(event: GatewayEventType | '*', handler: GatewayEventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => { this.listeners.get(event)?.delete(handler); };
  }

  private emit(type: GatewayEventType, data: unknown, sessionId = ''): void {
    const event: GatewayEvent = {
      type,
      sessionId,
      timestamp: Date.now(),
      data,
    };
    this.listeners.get(type)?.forEach(fn => fn(event));
    this.listeners.get('*')?.forEach(fn => fn(event));
  }

  /* ═══════════════════════════════════════════════════════════
   *  Metrics
   * ═══════════════════════════════════════════════════════════ */

  /**
   * Get gateway-wide metrics.
   */
  getMetrics(): {
    totalCallsServed: number;
    totalRevenue: string;
    activeSessions: number;
    totalSessions: number;
    avgLatencyMs: number;
    totalAttestations: number;
    marketplaceStats: MarketplaceStats;
  } {
    return {
      totalCallsServed: this.totalCallsServed,
      totalRevenue: this.totalRevenue.toString(),
      activeSessions: [...this.sessions.values()].filter(s => s.status === 'active').length,
      totalSessions: this.sessions.size,
      avgLatencyMs: this.pricing.getAvgLatency(),
      totalAttestations: this.validator.totalAttestations,
      marketplaceStats: this.marketplace.getStats(),
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Internals
   * ═══════════════════════════════════════════════════════════ */

  private getSessionOrThrow(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  /**
   * Basic intent verification (signature is deferred to wallet integration).
   */
  private verifyIntentBasic(intent: PaymentIntent): void {
    if (intent.seller !== this.agentId) {
      throw new IntentVerificationError('Intent seller does not match gateway identity');
    }
    if (intent.maxBudget <= 0n) {
      throw new IntentVerificationError('Budget must be positive');
    }
    if (intent.ttl <= 0) {
      throw new IntentVerificationError('TTL must be positive');
    }
    const age = (Date.now() - intent.createdAt) / 1000;
    if (age > intent.ttl) {
      throw new IntentVerificationError('Intent has expired');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Factory helper
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Create an AgentGateway with sensible defaults.
 *
 * ```ts
 * const gateway = createAgentGateway(client, {
 *   identity: { id: AgentId('did:synapse:agent:MyAgent'), name: 'My Agent', walletPubkey: '...', createdAt: Date.now() },
 *   defaultTiers: DEFAULT_TIERS,
 * });
 * ```
 */
export function createAgentGateway(
  client: SynapseClient,
  config: GatewayConfig,
): AgentGateway {
  return new AgentGateway(client, config);
}

/* ═══════════════════════════════════════════════════════════════
 *  Re-exports (barrel)
 * ═══════════════════════════════════════════════════════════════ */

export type {
  AgentId,
  AgentIdentity,
  AgentCredential,
  PaymentToken,
  PricingTier,
  PaymentIntent,
  PaymentReceipt,
  SessionState,
  SessionStatus,
  ResponseAttestation,
  AttestedResult,
  ToolListing,
  ToolBundle,
  GatewayEventType,
  GatewayEvent,
  GatewayEventHandler,
  GatewayConfig,
} from './types';
export { AgentId as createAgentId } from './types';

export {
  AgentSession,
  SessionError,
  BudgetExhaustedError,
  RateLimitExceededError,
  SessionExpiredError,
  CallLimitExceededError,
} from './session';

export { PricingEngine, DEFAULT_TIERS, type DynamicPricingConfig } from './pricing';
export { ResponseValidator } from './validator';
export { ToolMarketplace, type MarketplaceQuery, type MarketplaceStats } from './marketplace';
