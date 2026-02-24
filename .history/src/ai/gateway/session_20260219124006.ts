/**
 * AgentSession — Metered, budget-tracked sessions for agent-to-agent RPC commerce.
 *
 * A session is opened when a buyer agent presents a PaymentIntent.
 * Every RPC call deducts from the budget and increments counters.
 * Rate limiting, TTL expiry, and budget exhaustion are enforced in real-time.
 */

import { randomUUID } from 'crypto';
import type {
  AgentId, SessionState, SessionStatus, PricingTier,
  PaymentIntent, GatewayEvent, GatewayEventHandler,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Session errors
 * ═══════════════════════════════════════════════════════════════ */

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

export class BudgetExhaustedError extends SessionError {
  constructor(sessionId: string) {
    super('Session budget exhausted', 'BUDGET_EXHAUSTED', sessionId);
  }
}

export class RateLimitExceededError extends SessionError {
  constructor(sessionId: string, retryAfterMs: number) {
    super(`Rate limit exceeded, retry after ${retryAfterMs}ms`, 'RATE_LIMIT_EXCEEDED', sessionId);
    this.retryAfterMs = retryAfterMs;
  }
  readonly retryAfterMs: number;
}

export class SessionExpiredError extends SessionError {
  constructor(sessionId: string) {
    super('Session expired', 'SESSION_EXPIRED', sessionId);
  }
}

export class CallLimitExceededError extends SessionError {
  constructor(sessionId: string) {
    super('Session call limit exceeded', 'CALL_LIMIT_EXCEEDED', sessionId);
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  AgentSession
 * ═══════════════════════════════════════════════════════════════ */

export class AgentSession {
  private state: SessionState;
  private readonly listeners: Map<string, Set<GatewayEventHandler>> = new Map();

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

  /** Get the session ID */
  get id(): string { return this.state.id; }

  /** Get current session status */
  get status(): SessionStatus { return this.state.status; }

  /** Get a frozen snapshot of the full session state */
  snapshot(): Readonly<SessionState> { return { ...this.state }; }

  /** Activate the session (after payment verification) */
  activate(): void {
    if (this.state.status !== 'pending') {
      throw new SessionError(`Cannot activate session in '${this.state.status}' state`, 'INVALID_STATE', this.state.id);
    }
    this.state.status = 'active';
    this.emit('session:activated', { sessionId: this.state.id });
  }

  /** Pause the session (preserves budget) */
  pause(): void {
    if (this.state.status !== 'active') return;
    this.state.status = 'paused';
    this.emit('session:paused', { sessionId: this.state.id });
  }

  /** Resume a paused session */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state.status = 'active';
    this.emit('session:activated', { sessionId: this.state.id, resumed: true });
  }

  /**
   * Pre-flight check: validates that a call can proceed.
   * Throws a typed error if the call should be rejected.
   *
   * @param method — the RPC method about to be called
   * @returns the deducted cost in smallest token unit
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
   * Post-call: deduct budget, increment counters, update timestamps.
   * Call this after a successful RPC execution.
   *
   * @param method — the RPC method that was called
   * @param cost — the cost returned by preCall()
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
   * Settle the session — mark as complete and return usage summary.
   * Should be called when the buyer is done or the session expires.
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

  /** Attach custom metadata to the session */
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
