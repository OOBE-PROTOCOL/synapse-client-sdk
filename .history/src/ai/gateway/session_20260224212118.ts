/**
 * @module ai/gateway/session
 * @description AgentSession — Metered, budget-tracked sessions for agent-to-agent RPC commerce.
 *
 * A session is opened when a buyer agent presents a PaymentIntent.
 * Every RPC call deducts from the budget and increments counters.
 * Rate limiting, TTL expiry, and budget exhaustion are enforced in real-time.
 *
 * @since 1.0.0
 */

import { randomUUID } from 'crypto';
import type {
  AgentId, SessionState, SessionStatus, PricingTier,
  PaymentIntent, GatewayEvent, GatewayEventHandler,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Session errors
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Base error class for session-related errors.
 * @since 1.0.0
 */
export class SessionError extends Error {
  /**
   * @description Create a new SessionError.
   * @param {string} message - Human-readable error message
   * @param {string} code - Machine-readable error code
   * @param {string} [sessionId] - The session ID associated with the error
   * @since 1.0.0
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * @description Error thrown when a session's budget has been fully consumed.
 * @since 1.0.0
 */
export class BudgetExhaustedError extends SessionError {
  /**
   * @description Create a new BudgetExhaustedError.
   * @param {string} sessionId - The exhausted session ID
   * @since 1.0.0
   */
  constructor(sessionId: string) {
    super('Session budget exhausted', 'BUDGET_EXHAUSTED', sessionId);
  }
}

/**
 * @description Error thrown when a session exceeds its configured rate limit.
 * @since 1.0.0
 */
export class RateLimitExceededError extends SessionError {
  /**
   * @description Create a new RateLimitExceededError.
   * @param {string} sessionId - The rate-limited session ID
   * @param {number} retryAfterMs - Milliseconds to wait before retrying
   * @since 1.0.0
   */
  constructor(sessionId: string, retryAfterMs: number) {
    super(`Rate limit exceeded, retry after ${retryAfterMs}ms`, 'RATE_LIMIT_EXCEEDED', sessionId);
    this.retryAfterMs = retryAfterMs;
  }
  readonly retryAfterMs: number;
}

/**
 * @description Error thrown when a session has exceeded its TTL.
 * @since 1.0.0
 */
export class SessionExpiredError extends SessionError {
  /**
   * @description Create a new SessionExpiredError.
   * @param {string} sessionId - The expired session ID
   * @since 1.0.0
   */
  constructor(sessionId: string) {
    super('Session expired', 'SESSION_EXPIRED', sessionId);
  }
}

/**
 * @description Error thrown when a session has exhausted its maximum call count.
 * @since 1.0.0
 */
export class CallLimitExceededError extends SessionError {
  /**
   * @description Create a new CallLimitExceededError.
   * @param {string} sessionId - The session ID that exceeded its call limit
   * @since 1.0.0
   */
  constructor(sessionId: string) {
    super('Session call limit exceeded', 'CALL_LIMIT_EXCEEDED', sessionId);
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  AgentSession
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Metered, budget-tracked session for agent-to-agent RPC commerce.
 *
 * Tracks usage counters, budget remaining, rate limits, and TTL expiry.
 * Emits events for lifecycle transitions and budget warnings.
 *
 * @example
 * ```ts
 * const session = new AgentSession(intent, tier, sellerId, 3600);
 * session.activate();
 * const cost = session.preCall('getBalance');
 * // ... execute RPC ...
 * session.postCall('getBalance', cost);
 * ```
 *
 * @since 1.0.0
 */
export class AgentSession {
  private state: SessionState;
  private readonly listeners: Map<string, Set<GatewayEventHandler>> = new Map();

  /**
   * @description Create a new AgentSession.
   * @param {PaymentIntent} intent - The buyer's payment intent
   * @param {PricingTier} tier - The pricing tier for this session
   * @param {AgentId} sellerId - The seller's agent ID
   * @param {number} [ttl=3600] - Session time-to-live in seconds
   * @since 1.0.0
   */
  constructor(
    intent: PaymentIntent,
    tier: PricingTier,
    sellerId: AgentId,
    ttl = 3600,
  ) {
    const now = Date.now();
    this.state = {
      id: randomUUID(),
      status: 'pending',
      buyer: intent.buyer,
      seller: sellerId,
      tier,
      intentNonce: intent.nonce,
      budgetRemaining: intent.maxBudget,
      budgetTotal: intent.maxBudget,
      callsMade: 0,
      callsRemaining: tier.maxCallsPerSession || -1,
      methodCounts: {},
      rateLimiter: {
        windowMs: 1000,
        maxPerWindow: tier.rateLimit,
        timestamps: [],
      },
      metadata: {},
      createdAt: now,
      lastActivityAt: now,
      ttl,
    };
  }

  /* ── Public API ──────────────────────────────────────────── */

  /**
   * @description Get the session ID.
   * @returns {string} The unique session identifier
   * @since 1.0.0
   */
  get id(): string { return this.state.id; }

  /**
   * @description Get the current session status.
   * @returns {SessionStatus} The current lifecycle status
   * @since 1.0.0
   */
  get status(): SessionStatus { return this.state.status; }

  /**
   * @description Get a frozen snapshot of the full session state.
   * @returns {Readonly<SessionState>} Immutable copy of the session state
   * @since 1.0.0
   */
  snapshot(): Readonly<SessionState> { return { ...this.state }; }

  /**
   * @description Activate the session (after payment verification).
   * @throws {SessionError} If session is not in 'pending' state
   * @returns {void}
   * @since 1.0.0
   */
  activate(): void {
    if (this.state.status !== 'pending') {
      throw new SessionError(`Cannot activate session in '${this.state.status}' state`, 'INVALID_STATE', this.state.id);
    }
    this.state.status = 'active';
    this.emit('session:activated', { sessionId: this.state.id });
  }

  /**
   * @description Pause the session (preserves budget). No-op if not active.
   * @returns {void}
   * @since 1.0.0
   */
  pause(): void {
    if (this.state.status !== 'active') return;
    this.state.status = 'paused';
    this.emit('session:paused', { sessionId: this.state.id });
  }

  /**
   * @description Resume a paused session. No-op if not paused.
   * @returns {void}
   * @since 1.0.0
   */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state.status = 'active';
    this.emit('session:activated', { sessionId: this.state.id, resumed: true });
  }

  /**
   * @description Pre-flight check: validates that a call can proceed.
   * Throws a typed error if the call should be rejected.
   *
   * @param {string} method - The RPC method about to be called
   * @returns {bigint} The deducted cost in smallest token unit
   * @throws {SessionError} If session is not active
   * @throws {SessionExpiredError} If session TTL has elapsed
   * @throws {RateLimitExceededError} If rate limit window is full
   * @throws {CallLimitExceededError} If max calls reached
   * @throws {BudgetExhaustedError} If insufficient budget
   * @since 1.0.0
   */
  preCall(method: string): bigint {
    // ── Status check
    if (this.state.status !== 'active') {
      throw new SessionError(
        `Session is '${this.state.status}', cannot make calls`,
        'INVALID_STATE',
        this.state.id,
      );
    }

    // ── TTL check
    if (this.state.ttl > 0) {
      const elapsed = (Date.now() - this.state.createdAt) / 1000;
      if (elapsed >= this.state.ttl) {
        this.state.status = 'expired';
        this.emit('session:expired', { sessionId: this.state.id });
        throw new SessionExpiredError(this.state.id);
      }
    }

    // ── Rate limit check (sliding window)
    const now = Date.now();
    const rl = this.state.rateLimiter;
    rl.timestamps = rl.timestamps.filter(ts => now - ts < rl.windowMs);
    if (rl.timestamps.length >= rl.maxPerWindow) {
      const oldestInWindow = rl.timestamps[0]!;
      const retryAfter = rl.windowMs - (now - oldestInWindow);
      this.emit('ratelimit:exceeded', { method, retryAfterMs: retryAfter });
      throw new RateLimitExceededError(this.state.id, retryAfter);
    }

    // ── Call limit check
    if (this.state.callsRemaining !== -1 && this.state.callsRemaining <= 0) {
      this.state.status = 'exhausted';
      this.emit('session:exhausted', { sessionId: this.state.id, reason: 'call_limit' });
      throw new CallLimitExceededError(this.state.id);
    }

    // ── Budget check
    const cost = this.state.tier.pricePerCall;
    if (this.state.budgetRemaining < cost) {
      this.state.status = 'exhausted';
      this.emit('budget:exhausted', { sessionId: this.state.id, budgetRemaining: this.state.budgetRemaining.toString() });
      throw new BudgetExhaustedError(this.state.id);
    }

    return cost;
  }

  /**
   * @description Post-call: deduct budget, increment counters, update timestamps.
   * Call this after a successful RPC execution.
   *
   * @param {string} method - The RPC method that was called
   * @param {bigint} cost - The cost returned by preCall()
   * @returns {void}
   * @since 1.0.0
   */
  postCall(method: string, cost: bigint): void {
    const now = Date.now();

    // Deduct
    this.state.budgetRemaining -= cost;
    this.state.callsMade += 1;
    if (this.state.callsRemaining !== -1) this.state.callsRemaining -= 1;
    this.state.methodCounts[method] = (this.state.methodCounts[method] ?? 0) + 1;
    this.state.lastActivityAt = now;

    // Rate limiter window update
    this.state.rateLimiter.timestamps.push(now);

    // Budget warning
    const budgetFraction = Number(this.state.budgetRemaining) / Number(this.state.budgetTotal);
    if (budgetFraction <= 0.2 && budgetFraction > 0) {
      this.emit('budget:warning', {
        sessionId: this.state.id,
        budgetRemaining: this.state.budgetRemaining.toString(),
        budgetPercent: Math.round(budgetFraction * 100),
      });
    }

    // Check if budget is now exhausted
    if (this.state.budgetRemaining <= 0n) {
      this.state.status = 'exhausted';
      this.emit('budget:exhausted', { sessionId: this.state.id });
    }
  }

  /**
   * @description Settle the session — mark as complete and return usage summary.
   * Should be called when the buyer is done or the session expires.
   *
   * @returns {{ amountCharged: bigint; callCount: number; methodCounts: Record<string, number> }} Usage summary
   * @since 1.0.0
   */
  settle(): { amountCharged: bigint; callCount: number; methodCounts: Record<string, number> } {
    const amountCharged = this.state.budgetTotal - this.state.budgetRemaining;
    this.state.status = 'settled';
    this.emit('session:settled', {
      sessionId: this.state.id,
      amountCharged: amountCharged.toString(),
      callCount: this.state.callsMade,
    });
    return {
      amountCharged,
      callCount: this.state.callsMade,
      methodCounts: { ...this.state.methodCounts },
    };
  }

  /**
   * @description Attach custom metadata to the session.
   * @param {string} key - Metadata key
   * @param {unknown} value - Metadata value
   * @returns {void}
   * @since 1.0.0
   */
  setMetadata(key: string, value: unknown): void {
    this.state.metadata[key] = value;
  }

  /* ── Events ──────────────────────────────────────────────── */

  on(event: string, handler: GatewayEventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => { this.listeners.get(event)?.delete(handler); };
  }

  private emit(type: string, data: unknown): void {
    const event: GatewayEvent = {
      type: type as GatewayEvent['type'],
      sessionId: this.state.id,
      timestamp: Date.now(),
      data,
    };

    // Fire specific listeners
    this.listeners.get(type)?.forEach(fn => fn(event));
    // Fire wildcard listeners
    this.listeners.get('*')?.forEach(fn => fn(event));
  }
}
