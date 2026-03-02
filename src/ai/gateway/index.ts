/**
 * @module ai/gateway
 * @description AgentGateway — Main orchestrator for agent-to-agent RPC commerce.
 *
 * Composes:
 * - {@link PricingEngine}      → dynamic pricing, tiers, bundles
 * - {@link AgentSession}       → metered sessions, budget, rate limiting
 * - {@link ResponseValidator}  → Proof-of-Computation attestations
 * - {@link ToolMarketplace}    → discovery, reputation, listing
 *
 * Exposes:
 * - `openSession()`           → accept a buyer's PaymentIntent, return a session
 * - `execute()`               → metered + attested RPC call within a session
 * - `settleSession()`         → finalize billing, generate receipt
 * - `publish()`               → list tools on the marketplace
 * - `createGatewayTools()`    → LangChain tools wrapped with metering/attestation
 *
 * This is the x402-ready entry point for selling RPC access to other agents.
 *
 * @since 1.0.0
 */

import { randomUUID } from 'crypto';
import type { SynapseClientLike } from '../../core/client';
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
  RetryConfig,
  SnapshotDepth,
  GatewaySnapshot,
  X402PipelineStep,
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

/**
 * @description Base error class for all gateway-related errors.
 * @since 1.0.0
 */
export class GatewayError extends Error {
  /**
   * @description Create a new GatewayError.
   * @param {string} message - Human-readable error message
   * @param {string} code - Machine-readable error code
   * @since 1.0.0
   */
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GatewayError';
  }
}

/**
 * @description Error thrown when a session ID cannot be found in the gateway.
 * @since 1.0.0
 */
export class SessionNotFoundError extends GatewayError {
  /**
   * @description Create a new SessionNotFoundError.
   * @param {string} sessionId - The session ID that was not found
   * @since 1.0.0
   */
  constructor(sessionId: string) {
    super(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
  }
}

/**
 * @description Error thrown when the maximum number of concurrent sessions is reached.
 * @since 1.0.0
 */
export class MaxSessionsError extends GatewayError {
  /**
   * @description Create a new MaxSessionsError.
   * @param {number} limit - The concurrent session limit that was exceeded
   * @since 1.0.0
   */
  constructor(limit: number) {
    super(`Maximum concurrent sessions (${limit}) reached`, 'MAX_SESSIONS');
  }
}

/**
 * @description Error thrown when a buyer's payment intent fails verification.
 * @since 1.0.0
 */
export class IntentVerificationError extends GatewayError {
  /**
   * @description Create a new IntentVerificationError.
   * @param {string} reason - The reason the payment intent verification failed
   * @since 1.0.0
   */
  constructor(reason: string) {
    super(`Payment intent verification failed: ${reason}`, 'INTENT_INVALID');
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  AgentGateway
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Main orchestrator for agent-to-agent RPC commerce on Solana.
 *
 * The AgentGateway composes pricing, sessions, attestation, and marketplace
 * into a single entry point for selling (or buying) metered RPC access.
 *
 * @example
 * ```ts
 * const gateway = createAgentGateway(client, {
 *   identity: { id: AgentId('did:synapse:agent:MyAgent'), name: 'My Agent', walletPubkey: '...', createdAt: Date.now() },
 *   defaultTiers: DEFAULT_TIERS,
 * });
 *
 * const session = gateway.openSession(intent);
 * const result = await gateway.execute(session.id, 'getBalance', ['...']);
 * ```
 *
 * @since 1.0.0
 */
export class AgentGateway {
  /** The Synapse RPC client powering the upstream calls */
  private readonly client: SynapseClientLike;
  /** The raw transport (shortcut for tools) */
  private readonly transport: HttpTransport;
  /** Gateway configuration */
  private readonly config: GatewayConfig;

  /** Sub-systems */
  readonly pricing: PricingEngine;
  readonly validator: ResponseValidator;
  readonly marketplace: ToolMarketplace;

  /** x402 sub-systems (initialized only when config provides x402) */
  readonly paywall: X402Paywall | null;
  readonly x402Client: X402Client | null;

  /** Active sessions by ID */
  private readonly sessions: Map<string, AgentSession> = new Map();

  /** Global event bus */
  private readonly listeners: Map<string, Set<GatewayEventHandler>> = new Map();

  /** Gateway-wide call counter (for metrics) */
  private totalCallsServed = 0;
  private totalRevenue = 0n;

  /**
   * @description Create a new AgentGateway instance.
   * @param {SynapseClientLike} client - Object providing an HttpTransport (e.g. SynapseClient)
   * @param {GatewayConfig} config - Gateway configuration including identity, tiers, and x402 settings
   * @since 1.0.0
   */
  constructor(client: SynapseClientLike, config: GatewayConfig) {
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

    // Initialize x402 paywall (seller side) if configured
    this.paywall = config.x402
      ? new X402Paywall(config.x402)
      : null;

    // Initialize x402 client (buyer side) if configured
    this.x402Client = config.x402Client
      ? new X402Client(config.x402Client)
      : null;
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
   * @description A buyer agent sends a PaymentIntent; the gateway validates it,
   * resolves the pricing tier, and returns an activated session.
   *
   * @param {PaymentIntent} intent - The buyer's signed payment intent
   * @param {object} [opts] - Optional overrides
   * @param {PricingTier} [opts.tier] - Override the pricing tier (default: resolved from intent.tierId)
   * @param {number} [opts.ttl] - Override TTL (default: config.sessionTtl)
   * @param {Function} [opts.verifyIntent] - Custom intent verifier (default: basic checks)
   * @returns {AgentSession} The activated AgentSession
   * @since 1.0.0
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
   * @description Settle a session and return a PaymentReceipt.
   *
   * @param {string} sessionId - The session to settle
   * @param {string | null} [txSignature=null] - Optional on-chain settlement tx signature
   * @returns {PaymentReceipt} The payment receipt with charged amount and settlement info
   * @since 1.0.0
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
   * @description Get a session by ID.
   * @param {string} sessionId - The session ID to look up
   * @returns {AgentSession | undefined} The session, or undefined if not found
   * @since 1.0.0
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * @description List all sessions, optionally filtered by status.
   * @param {SessionState['status']} [status] - Optional status filter
   * @returns {{ id: string; status: string; buyer: AgentId }[]} Array of session summaries
   * @since 1.0.0
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
   * @description Close and remove expired/settled sessions (garbage collection).
   * @returns {number} The number of sessions pruned
   * @since 1.0.0
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
   * @description Execute an RPC method within a metered session.
   *
   * Flow:
   *  1. `session.preCall()`      — check budget, rate limit, etc.
   *  2. `transport.request()`    — execute the actual RPC call
   *  3. `validator.wrapResult()` — hash & sign (if tier includes attestation)
   *  4. `session.postCall()`     — deduct budget, increment counters
   *  5. `pricing.reportLatency()`— feed latency into dynamic pricing
   *
   * If `config.retry` is set, transient errors are retried with exponential
   * backoff. Pass per-call `opts.retry` to override.
   *
   * @param {string} sessionId - The session to charge
   * @param {string} method - Solana JSON-RPC method name
   * @param {unknown[]} [params=[]] - Method parameters
   * @param {{ retry?: RetryConfig }} [opts] - Per-call overrides
   * @returns {Promise<AttestedResult<T>>} The attested result
   * @since 1.0.0
   */
  async execute<T = unknown>(
    sessionId: string,
    method: string,
    params: unknown[] = [],
    opts: { retry?: RetryConfig } = {},
  ): Promise<AttestedResult<T>> {
    const session = this.getSessionOrThrow(sessionId);
    const snap = session.snapshot();

    // ── Pre-flight
    this.emit('call:before', { method, params }, sessionId);
    const cost = session.preCall(method);

    // ── Retry config (per-call > gateway-level > none)
    const retryCfg = opts.retry ?? this.config.retry;
    const maxAttempts = retryCfg?.maxAttempts ?? 1;
    const backoffMs = retryCfg?.backoffMs ?? 500;
    const backoffMul = retryCfg?.backoffMultiplier ?? 2;
    const retryableErrors = retryCfg?.retryableErrors ?? [
      'fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'socket hang up',
    ];
    const fallback = retryCfg?.fallbackToDirectRpc ?? false;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = performance.now();
      try {
        const result = await this.transport.request<T>(method, params);
        const latencyMs = Math.round(performance.now() - start);

        // ── Attest
        const shouldAttest = snap.tier.includesAttestation ||
          (this.config.attestByDefault ?? false);
        const slot = typeof result === 'object' && result !== null && 'context' in result
          ? ((result as Record<string, unknown>).context as { slot?: number })?.slot ?? 0
          : 0;

        const attested = await this.validator.wrapResult<T>(
          result, sessionId, method, params, slot, latencyMs,
          snap.callsMade + 1, shouldAttest,
        );

        // ── Post-call
        session.postCall(method, cost);
        this.totalCallsServed++;
        this.pricing.reportLatency(latencyMs);

        this.emit('call:after', {
          method, latencyMs, cost: cost.toString(), attested: shouldAttest, attempt,
        }, sessionId);

        if (shouldAttest && attested.attestation) {
          this.emit('call:attested', { attestation: attested.attestation }, sessionId);
        }

        return attested;
      } catch (err) {
        lastErr = err;
        const errMsg = String(err);
        const isRetryable = retryableErrors.some(s => errMsg.includes(s));

        if (attempt < maxAttempts && isRetryable) {
          const delay = backoffMs * (backoffMul ** (attempt - 1));
          this.emit('call:retry', {
            method, attempt, maxAttempts, error: errMsg, delayMs: delay,
          }, sessionId);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // ── Fallback to raw RPC on last attempt
        if (fallback && attempt === maxAttempts) {
          try {
            const fbStart = performance.now();
            const fbResult = await this.transport.request<T>(method, params);
            const fbLatency = Math.round(performance.now() - fbStart);
            const attested = await this.validator.wrapResult<T>(
              fbResult, sessionId, method, params, 0, fbLatency,
              snap.callsMade + 1, false,
            );
            session.postCall(method, cost);
            this.totalCallsServed++;
            this.pricing.reportLatency(fbLatency);
            return attested;
          } catch {
            // fallback also failed — throw original error
          }
        }
      }
    }

    this.emit('call:error', { method, error: String(lastErr) }, sessionId);
    throw lastErr;
  }

  /**
   * @description Execute a batch of methods within a metered session.
   * Each method is individually metered.
   *
   * @param {string} sessionId - The session to charge
   * @param {{ method: string; params?: unknown[] }[]} calls - Array of method calls
   * @returns {Promise<AttestedResult<T>[]>} Array of attested results
   * @since 1.0.0
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
   *  x402 Protocol — Seller Side (Paywall)
   *
   *  When this gateway is SELLING RPC access, the paywall
   *  generates 402 responses and settles payments.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Process an incoming request through the x402 paywall.
   *
   * Returns a PaywallResult that indicates:
   *  - `'payment-required'`  → respond with 402 + headers
   *  - `'payment-valid'`     → proceed with execute(), then settle
   *  - `'no-payment-needed'` → x402 is disabled, proceed normally
   *
   * @param {string} method - RPC method name
   * @param {Record<string, string | undefined>} headers - Incoming HTTP headers
   * @returns {Promise<PaywallResult>} The paywall result indicating next steps
   * @since 1.0.0
   */
  async processX402Request(
    method: string,
    headers: Record<string, string | undefined>,
  ): Promise<PaywallResult> {
    if (!this.paywall) {
      return { type: 'no-payment-needed' };
    }

    const result = await this.paywall.processRequest(method, headers);

    if (result.type === 'payment-required') {
      this.emit('x402:payment-required', { method }, '');
    } else if (result.type === 'payment-valid') {
      this.emit('x402:payment-verified', {
        method,
        payer: result.verifyResponse.payer,
      }, '');
    }

    return result;
  }

  /**
   * @description Settle an x402 payment after the resource was served.
   * Call this after a successful execute() when x402 is active.
   *
   * @param {X402PaymentPayload} paymentPayload - The verified payment payload
   * @param {X402PaymentRequirements} requirements - The requirements that were fulfilled
   * @returns {Promise<SettleResult>} Settlement result with PAYMENT-RESPONSE header
   * @since 1.0.0
   */
  async settleX402Payment(
    paymentPayload: X402PaymentPayload,
    requirements: X402PaymentRequirements,
  ): Promise<SettleResult> {
    if (!this.paywall) {
      return { success: false, settleResponse: null, responseHeader: null };
    }

    const result = await this.paywall.settleAfterResponse(paymentPayload, requirements);

    if (result.success) {
      this.emit('x402:payment-settled', {
        transaction: result.settleResponse?.transaction,
        network: result.settleResponse?.network,
      }, '');
    }

    return result;
  }

  /**
   * @description Full x402 execute pipeline: verify → execute → settle.
   *
   * This combines processX402Request + execute + settleX402Payment
   * into a single call for convenience.
   *
   * Emits granular `x402:pipeline:*` events for each step so consumers
   * can build step-by-step UI animations, logging, or monitoring without
   * reconstructing the pipeline manually.
   *
   * @param {string | null} sessionId - Session to charge (or null for x402-only billing)
   * @param {string} method - RPC method
   * @param {unknown[]} [params=[]] - Method params
   * @param {Record<string, string | undefined>} [incomingHeaders={}] - HTTP headers with PAYMENT-SIGNATURE
   * @param {{ onStep?: (step: X402PipelineStep) => void }} [opts] - Pipeline callbacks
   * @returns {Promise<{ result: AttestedResult<T> | null; x402: PaywallResult; settlement: SettleResult | null; responseHeaders: Record<string, string>; pipeline: { steps: X402PipelineStep[]; totalDurationMs: number } }>}
   * @since 1.0.0
   */
  async executeWithX402<T = unknown>(
    sessionId: string | null,
    method: string,
    params: unknown[] = [],
    incomingHeaders: Record<string, string | undefined> = {},
    opts: {
      /** Callback invoked after each pipeline step completes. */
      onStep?: (step: X402PipelineStep) => void;
    } = {},
  ): Promise<{
    result: AttestedResult<T> | null;
    x402: PaywallResult;
    settlement: SettleResult | null;
    responseHeaders: Record<string, string>;
    /** Pipeline execution trace — always populated since v1.2.2. */
    pipeline: {
      steps: X402PipelineStep[];
      totalDurationMs: number;
    };
  }> {
    const pipelineStart = performance.now();
    const steps: X402PipelineStep[] = [];
    let stepId = 0;

    const pushStep = (step: Omit<X402PipelineStep, 'id' | 'totalSteps'>): void => {
      const s: X402PipelineStep = { ...step, id: ++stepId, totalSteps: 0 };
      steps.push(s);
      this.emit(`x402:pipeline:${step.actor === 'facilitator' ? 'verify' : step.action.toLowerCase().includes('paywall') ? 'paywall' : step.action.toLowerCase().includes('settle') ? 'settle' : 'execute'}` as GatewayEventType, s, sessionId ?? '');
      opts.onStep?.(s);
    };

    // ── Step 1: x402 paywall check
    let t = performance.now();
    const x402Result = await this.processX402Request(method, incomingHeaders);
    pushStep({
      actor: 'seller',
      action: `Paywall → ${x402Result.type}`,
      detail: x402Result.type === 'payment-required'
        ? 'Payment required — returning 402'
        : x402Result.type === 'payment-valid'
          ? 'Payment verified — proceeding'
          : 'No payment needed',
      data: { type: x402Result.type, method },
      durationMs: Math.round(performance.now() - t),
      status: 'real',
    });

    if (x402Result.type === 'payment-required') {
      // Finalize totalSteps
      for (const s of steps) s.totalSteps = stepId;
      return {
        result: null,
        x402: x402Result,
        settlement: null,
        responseHeaders: x402Result.headers,
        pipeline: { steps, totalDurationMs: Math.round(performance.now() - pipelineStart) },
      };
    }

    // ── Step 2: Execute the RPC call
    t = performance.now();
    let attested: AttestedResult<T>;

    if (sessionId) {
      attested = await this.execute<T>(sessionId, method, params);
    } else {
      const start = performance.now();
      const result = await this.transport.request<T>(method, params);
      const latencyMs = Math.round(performance.now() - start);
      attested = await this.validator.wrapResult<T>(
        result, '', method, params, 0, latencyMs, 0, false,
      );
      this.totalCallsServed++;
      this.pricing.reportLatency(latencyMs);
    }

    pushStep({
      actor: 'seller',
      action: `Execute ${method}`,
      detail: `RPC call completed in ${attested.latencyMs}ms`,
      data: { method, latencyMs: attested.latencyMs, hasAttestation: !!attested.attestation },
      durationMs: Math.round(performance.now() - t),
      status: 'real',
    });

    // ── Step 3: Settle (if x402 payment was provided)
    let settlement: SettleResult | null = null;
    const responseHeaders: Record<string, string> = {};

    if (x402Result.type === 'payment-valid') {
      t = performance.now();
      settlement = await this.settleX402Payment(
        x402Result.paymentPayload,
        x402Result.requirements,
      );
      if (settlement.responseHeader) {
        responseHeaders['PAYMENT-RESPONSE'] = settlement.responseHeader;
      }

      pushStep({
        actor: 'facilitator',
        action: 'Settle payment',
        detail: settlement.success ? 'Payment settled on-chain' : 'Settlement failed',
        data: {
          success: settlement.success,
          transaction: settlement.settleResponse?.transaction,
        },
        durationMs: Math.round(performance.now() - t),
        status: 'real',
      });
    }

    // Finalize totalSteps
    for (const s of steps) s.totalSteps = stepId;

    const totalDurationMs = Math.round(performance.now() - pipelineStart);
    this.emit('x402:pipeline:complete' as GatewayEventType, {
      steps, totalDurationMs, method, sessionId,
    }, sessionId ?? '');

    return { result: attested, x402: x402Result, settlement, responseHeaders, pipeline: { steps, totalDurationMs } };
  }

  /* ═══════════════════════════════════════════════════════════
   *  x402 Protocol — Buyer Side (Client)
   *
   *  When this gateway is BUYING RPC access from another
   *  x402-enabled server, the client handles payment flow.
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Execute an RPC call on a remote x402-enabled server.
   * Automatically handles 402 → pay → retry flow.
   *
   * @param {string} url - The remote RPC endpoint
   * @param {string} method - JSON-RPC method
   * @param {unknown[]} [params=[]] - Method params
   * @returns {Promise<{ result: T; payment: X402PaymentOutcome | null }>} The response body + payment outcome
   * @since 1.0.0
   */
  async executeRemoteX402<T = unknown>(
    url: string,
    method: string,
    params: unknown[] = [],
  ): Promise<{ result: T; payment: X402PaymentOutcome | null }> {
    if (!this.x402Client) {
      throw new GatewayError('x402 client not configured', 'X402_NOT_CONFIGURED');
    }

    const body = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: randomUUID(),
    });

    const { response, payment } = await this.x402Client.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok && response.status !== 402) {
      throw new GatewayError(
        `Remote RPC failed: ${response.status} ${response.statusText}`,
        'REMOTE_RPC_ERROR',
      );
    }

    const json = await response.json() as { result?: T; error?: unknown };

    if (json.error) {
      throw new GatewayError(
        `Remote RPC error: ${JSON.stringify(json.error)}`,
        'REMOTE_RPC_ERROR',
      );
    }

    if (payment) {
      this.emit('x402:payment-sent', {
        url,
        method,
        amount: payment.amountPaid,
        transaction: payment.settlement?.transaction,
      }, '');
    }

    return { result: json.result as T, payment };
  }

  /**
   * @description Get x402 buyer payment statistics.
   * @returns {{ payments: number; totalPaid: ReadonlyMap<string, bigint> } | null} Payment stats or null if x402 client is not configured
   * @since 1.0.0
   */
  getX402ClientStats(): { payments: number; totalPaid: ReadonlyMap<string, bigint> } | null {
    if (!this.x402Client) return null;
    return {
      payments: this.x402Client.payments,
      totalPaid: this.x402Client.totalAmountPaid,
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Marketplace publishing
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Publish all available tools to the marketplace.
   * Generates ToolListings from the configured tiers.
   *
   * @param {string[]} methods - Method names to publish
   * @param {object} [opts] - Listing metadata overrides
   * @param {string} [opts.region] - Geographic region hint
   * @param {Array} [opts.commitments] - Supported commitment levels
   * @param {Function} [opts.description] - Custom description factory per method
   * @returns {void}
   * @since 1.0.0
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
   * @description Publish a bundle of tools.
   *
   * @param {string} name - Human-readable bundle name
   * @param {string[]} methods - Method names included in the bundle
   * @param {PricingTier[]} tiers - Pricing tiers for the bundle
   * @param {string} [description] - Optional description override
   * @returns {ToolBundle} The created tool bundle
   * @since 1.0.0
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
   * @description Create metered LangChain tools for a specific session.
   * Every call goes through the gateway's execute() pipeline.
   *
   * @param {string} sessionId - The session to bind the tools to
   * @returns {Promise<Array>} Array of LangChain-compatible tool instances
   * @since 1.0.0
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
   * @description Subscribe to gateway events.
   *
   * @param {GatewayEventType | '*'} event - Event type or '*' for all events
   * @param {GatewayEventHandler} handler - Callback invoked on event
   * @returns {() => void} Unsubscribe function
   * @since 1.0.0
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
   * @description Get gateway-wide metrics including calls served, revenue, sessions, and x402 stats.
   * @returns {object} Comprehensive metrics object
   * @since 1.0.0
   */
  getMetrics(): {
    totalCallsServed: number;
    totalRevenue: string;
    activeSessions: number;
    totalSessions: number;
    avgLatencyMs: number;
    totalAttestations: number;
    marketplaceStats: MarketplaceStats;
    x402: {
      paywallEnabled: boolean;
      clientEnabled: boolean;
      clientPayments: number;
    };
  } {
    return {
      totalCallsServed: this.totalCallsServed,
      totalRevenue: this.totalRevenue.toString(),
      activeSessions: [...this.sessions.values()].filter(s => s.status === 'active').length,
      totalSessions: this.sessions.size,
      avgLatencyMs: this.pricing.getAvgLatency(),
      totalAttestations: this.validator.totalAttestations,
      marketplaceStats: this.marketplace.getStats(),
      x402: {
        paywallEnabled: this.paywall !== null,
        clientEnabled: this.x402Client !== null,
        clientPayments: this.x402Client?.payments ?? 0,
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Snapshot — JSON-safe serialization
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Return a JSON-safe snapshot of the entire gateway state.
   *
   * All `BigInt` values are converted to strings. The result can be passed
   * directly to `JSON.stringify()` or `NextResponse.json()` without any
   * manual serialization.
   *
   * @param {{ depth?: SnapshotDepth }} [opts] - Control how much data is included.
   *   - `'minimal'`  — identity + metrics only (for lists)
   *   - `'standard'` — identity + metrics + sessions + tiers + marketplace (default)
   *   - `'full'`     — everything including full session snapshots
   * @returns {GatewaySnapshot} A plain object safe for JSON serialization.
   * @since 1.2.2
   *
   * @example
   * ```ts
   * const snap = gateway.snapshot();
   * return NextResponse.json(snap); // no bigIntToString() needed
   * ```
   */
  snapshot(opts: { depth?: SnapshotDepth } = {}): GatewaySnapshot {
    const depth = opts.depth ?? 'standard';
    const identity = this.config.identity;

    const result: GatewaySnapshot = {
      agentId: this.agentId as string,
      identity: {
        name: identity.name,
        walletPubkey: identity.walletPubkey,
        description: identity.description,
        tags: identity.tags,
        createdAt: identity.createdAt,
      },
      metrics: {
        totalCallsServed: this.totalCallsServed,
        totalRevenue: this.totalRevenue.toString(),
        activeSessions: [...this.sessions.values()].filter(s => s.status === 'active').length,
        totalSessions: this.sessions.size,
        avgLatencyMs: this.pricing.getAvgLatency(),
        totalAttestations: this.validator.totalAttestations,
      },
      sessions: [],
      tiers: [],
      marketplace: { totalListings: 0, totalBundles: 0 },
      x402: {
        paywallEnabled: this.paywall !== null,
        clientEnabled: this.x402Client !== null,
        clientPayments: this.x402Client?.payments ?? 0,
      },
    };

    if (depth === 'minimal') return result;

    // Sessions
    for (const session of this.sessions.values()) {
      const snap = session.snapshot();
      const entry: GatewaySnapshot['sessions'][number] = {
        id: snap.id,
        status: snap.status,
        buyer: snap.buyer as string,
      };
      if (depth === 'full') {
        entry.budgetRemaining = snap.budgetRemaining.toString();
        entry.callsMade = snap.callsMade;
        entry.createdAt = snap.createdAt;
      }
      result.sessions.push(entry);
    }

    // Tiers
    for (const tier of this.config.defaultTiers) {
      result.tiers.push({
        id: tier.id,
        label: tier.label,
        pricePerCall: tier.pricePerCall.toString(),
        maxCallsPerSession: tier.maxCallsPerSession,
        rateLimit: tier.rateLimit,
        includesAttestation: tier.includesAttestation,
      });
    }

    // Marketplace
    const mpStats = this.marketplace.getStats();
    result.marketplace = {
      totalListings: mpStats.totalListings,
      totalBundles: mpStats.totalBundles,
    };

    return result;
  }

  /**
   * Alias for `snapshot()` — enables `JSON.stringify(gateway)`.
   * @since 1.2.2
   */
  toJSON(): GatewaySnapshot {
    return this.snapshot({ depth: 'standard' });
  }

  /* ═══════════════════════════════════════════════════════════
   *  PaymentIntent builder
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Build a {@link PaymentIntent} with sensible defaults.
   *
   * Generates `nonce`, `createdAt`, and `token` automatically. Accepts
   * `budget` as a string or number that is converted to `BigInt` internally.
   *
   * @param {object} opts - Intent parameters
   * @param {AgentId | string | AgentGateway} opts.buyer - Buyer agent ID, DID string, or gateway instance
   * @param {string} [opts.tier='standard'] - Pricing tier ID
   * @param {string | number | bigint} opts.budget - Max budget (converted to BigInt)
   * @param {number} [opts.ttl] - TTL in seconds (default: config.sessionTtl or 3600)
   * @param {string} [opts.signature='sdk-generated'] - Payment signature
   * @returns {PaymentIntent} A ready-to-use PaymentIntent
   * @since 1.2.2
   *
   * @example
   * ```ts
   * const intent = gateway.createPaymentIntent({
   *   buyer: buyerGateway,
   *   tier: 'standard',
   *   budget: '100000',
   * });
   * const session = gateway.openSession(intent);
   * ```
   */
  createPaymentIntent(opts: {
    buyer: AgentId | string | AgentGateway;
    tier?: string;
    budget: string | number | bigint;
    ttl?: number;
    signature?: string;
    token?: PricingTier['token'];
  }): PaymentIntent {
    const buyerId: AgentId =
      opts.buyer instanceof AgentGateway
        ? opts.buyer.agentId
        : (opts.buyer as AgentId);

    const tierId = opts.tier ?? 'standard';
    const tier = this.pricing.getTier(tierId);

    return {
      nonce: randomUUID(),
      buyer: buyerId,
      seller: this.agentId,
      tierId,
      maxBudget: BigInt(opts.budget),
      token: opts.token ?? tier?.token ?? { type: 'USDC' as const },
      signature: opts.signature ?? 'sdk-generated',
      createdAt: Date.now(),
      ttl: opts.ttl ?? this.config.sessionTtl ?? 3600,
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
 * @description Create an AgentGateway with sensible defaults.
 *
 * @param {SynapseClientLike} client - Object providing an HttpTransport (e.g. SynapseClient)
 * @param {GatewayConfig} config - Gateway configuration
 * @returns {AgentGateway} A fully configured AgentGateway instance
 *
 * @example
 * ```ts
 * const gateway = createAgentGateway(client, {
 *   identity: { id: AgentId('did:synapse:agent:MyAgent'), name: 'My Agent', walletPubkey: '...', createdAt: Date.now() },
 *   defaultTiers: DEFAULT_TIERS,
 * });
 * ```
 *
 * @since 1.0.0
 */
export function createAgentGateway(
  client: SynapseClientLike,
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
  RetryConfig,
  SnapshotDepth,
  GatewaySnapshot,
  X402PipelineStep,
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

/* ── Agent Registry ────────────────────────────────────────── */
export {
  AgentRegistry,
  MemoryAdapter,
  type PersistenceAdapter,
  type AgentRegistryConfig,
} from './registry';

/* ── x402 Protocol ─────────────────────────────────────────── */
export * from './x402';
