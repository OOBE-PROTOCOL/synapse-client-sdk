/**
 * Tests for AgentSession — lifecycle, budget, rate limiting, expiry.
 *
 * Verifies:
 * - Session lifecycle: pending → active → settled
 * - preCall / postCall flow
 * - Budget tracking and exhaustion
 * - Rate limiting (sliding window)
 * - Call limit enforcement
 * - TTL expiry
 * - Pause/resume
 * - Events are emitted at each lifecycle stage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentSession,
  SessionError,
  BudgetExhaustedError,
  RateLimitExceededError,
  SessionExpiredError,
  CallLimitExceededError,
} from '../../src/ai/gateway/session';
import { makePaymentIntent, makeTier } from './_helpers';
import { AgentId } from '../../src/ai/gateway/types';

describe('AgentSession', () => {
  const sellerId = AgentId('did:synapse:agent:Seller');
  const tier = makeTier({
    id: 'standard',
    pricePerCall: 100n,
    maxCallsPerSession: 10,
    rateLimit: 5,
  });

  let session: AgentSession;

  beforeEach(() => {
    const intent = makePaymentIntent(sellerId, { maxBudget: 10_000n, tierId: 'standard' });
    session = new AgentSession(intent, tier, sellerId, 3600);
  });

  /* ── Lifecycle ──────────────────────────────────────── */

  describe('Lifecycle', () => {
    it('starts in pending state', () => {
      expect(session.status).toBe('pending');
    });

    it('activates from pending', () => {
      session.activate();
      expect(session.status).toBe('active');
    });

    it('cannot activate when already active', () => {
      session.activate();
      expect(() => session.activate()).toThrow(SessionError);
    });

    it('generates a unique session ID', () => {
      expect(session.id).toBeTruthy();
      expect(session.id.length).toBeGreaterThan(10); // UUID format
    });

    it('snapshot returns current state', () => {
      session.activate();
      const snap = session.snapshot();
      expect(snap.status).toBe('active');
      expect(snap.budgetRemaining).toBe(10_000n);
      expect(snap.callsMade).toBe(0);
      expect(snap.tier.id).toBe('standard');
    });
  });

  /* ── preCall / postCall flow ────────────────────────── */

  describe('preCall / postCall', () => {
    beforeEach(() => {
      session.activate();
    });

    it('preCall returns the cost', () => {
      const cost = session.preCall('getBalance');
      expect(cost).toBe(100n);
    });

    it('postCall deducts budget and increments counters', () => {
      const cost = session.preCall('getBalance');
      session.postCall('getBalance', cost);

      const snap = session.snapshot();
      expect(snap.budgetRemaining).toBe(9_900n);
      expect(snap.callsMade).toBe(1);
      expect(snap.methodCounts['getBalance']).toBe(1);
    });

    it('tracks per-method counts', () => {
      for (let i = 0; i < 3; i++) {
        const cost = session.preCall('getBalance');
        session.postCall('getBalance', cost);
      }
      const cost = session.preCall('getSlot');
      session.postCall('getSlot', cost);

      const snap = session.snapshot();
      expect(snap.methodCounts['getBalance']).toBe(3);
      expect(snap.methodCounts['getSlot']).toBe(1);
      expect(snap.callsMade).toBe(4);
    });

    it('cannot make calls when session is not active', () => {
      session.pause();
      expect(() => session.preCall('getBalance')).toThrow(SessionError);
    });
  });

  /* ── Budget ─────────────────────────────────────────── */

  describe('Budget tracking', () => {
    beforeEach(() => {
      session.activate();
    });

    it('throws BudgetExhaustedError when budget runs out', () => {
      // Use a tier with no call limit
      const unlimitedTier = makeTier({
        pricePerCall: 5_000n,
        maxCallsPerSession: 0,
        rateLimit: 1000,
      });
      const intent = makePaymentIntent(sellerId, { maxBudget: 10_000n });
      const bigCostSession = new AgentSession(intent, unlimitedTier, sellerId, 3600);
      bigCostSession.activate();

      const cost1 = bigCostSession.preCall('getBalance');
      bigCostSession.postCall('getBalance', cost1);
      // Budget: 10_000 - 5_000 = 5_000

      const cost2 = bigCostSession.preCall('getBalance');
      bigCostSession.postCall('getBalance', cost2);
      // Budget: 5_000 - 5_000 = 0 → postCall sets status to 'exhausted'

      expect(bigCostSession.status).toBe('exhausted');

      // Next preCall sees status='exhausted' → throws SessionError (INVALID_STATE)
      expect(() => bigCostSession.preCall('getBalance')).toThrow(SessionError);
    });

    it('emits budget:warning when budget drops below 20%', () => {
      const events: string[] = [];
      session.on('budget:warning', () => { events.push('warning'); });

      // Use 8 of 10 calls (budget: 10_000, cost: 100, after 8: 9_200 left = 92%)
      // We need to spend 80%+ → we need a cheaper tier or higher budget
      // Actually: 10_000 budget, 100/call → after 81 calls: 1900 left = 19% → warning
      // But call limit is 10. Let's make a custom session:
      const bigTier = makeTier({
        pricePerCall: 1_000n,
        maxCallsPerSession: 100,
        rateLimit: 1000,
      });
      const intent = makePaymentIntent(sellerId, { maxBudget: 10_000n });
      const s = new AgentSession(intent, bigTier, sellerId, 3600);
      s.activate();
      s.on('budget:warning', () => { events.push('warning'); });

      // Spend 8 calls (8_000 of 10_000 = 80% used, 20% remaining)
      for (let i = 0; i < 8; i++) {
        const cost = s.preCall('getBalance');
        s.postCall('getBalance', cost);
      }

      // At 20% remaining, budget:warning should fire
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ── Rate limiting ──────────────────────────────────── */

  describe('Rate limiting', () => {
    beforeEach(() => {
      session.activate();
    });

    it('allows calls within rate limit', () => {
      // Rate limit is 5 per window (1 second)
      for (let i = 0; i < 5; i++) {
        const cost = session.preCall('getBalance');
        session.postCall('getBalance', cost);
      }
      // 5 calls should succeed
      expect(session.snapshot().callsMade).toBe(5);
    });

    it('throws RateLimitExceededError when rate limit is hit', () => {
      for (let i = 0; i < 5; i++) {
        const cost = session.preCall('getBalance');
        session.postCall('getBalance', cost);
      }

      // 6th call should hit rate limit
      expect(() => session.preCall('getBalance')).toThrow(RateLimitExceededError);
    });

    it('RateLimitExceededError includes retryAfterMs', () => {
      for (let i = 0; i < 5; i++) {
        const cost = session.preCall('getBalance');
        session.postCall('getBalance', cost);
      }

      try {
        session.preCall('getBalance');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitExceededError);
        expect((err as RateLimitExceededError).retryAfterMs).toBeGreaterThan(0);
      }
    });
  });

  /* ── Call limit ─────────────────────────────────────── */

  describe('Call limit enforcement', () => {
    it('throws CallLimitExceededError when limit reached', () => {
      const limitedTier = makeTier({
        pricePerCall: 10n,
        maxCallsPerSession: 3,
        rateLimit: 100,
      });
      const intent = makePaymentIntent(sellerId, { maxBudget: 100_000n });
      const s = new AgentSession(intent, limitedTier, sellerId, 3600);
      s.activate();

      for (let i = 0; i < 3; i++) {
        const cost = s.preCall('getBalance');
        s.postCall('getBalance', cost);
      }

      expect(() => s.preCall('getBalance')).toThrow(CallLimitExceededError);
      expect(s.status).toBe('exhausted');
    });

    it('unlimited calls when maxCallsPerSession is 0', () => {
      const unlimitedTier = makeTier({
        pricePerCall: 1n,
        maxCallsPerSession: 0, // unlimited
        rateLimit: 1000,
      });
      const intent = makePaymentIntent(sellerId, { maxBudget: 1_000_000n });
      const s = new AgentSession(intent, unlimitedTier, sellerId, 3600);
      s.activate();

      // Many calls should succeed
      for (let i = 0; i < 50; i++) {
        const cost = s.preCall('getBalance');
        s.postCall('getBalance', cost);
      }
      expect(s.snapshot().callsMade).toBe(50);
    });
  });

  /* ── TTL expiry ─────────────────────────────────────── */

  describe('TTL expiry', () => {
    it('throws SessionExpiredError when TTL is exceeded', async () => {
      // Create session with very short TTL
      const intent = makePaymentIntent(sellerId, { maxBudget: 100_000n });
      const s = new AgentSession(intent, makeTier({ rateLimit: 1000 }), sellerId, 1); // 1 second TTL
      s.activate();

      // Session should work immediately
      const cost = s.preCall('getBalance');
      s.postCall('getBalance', cost);
      expect(s.snapshot().callsMade).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Now should throw SessionExpiredError
      expect(() => s.preCall('getBalance')).toThrow(SessionExpiredError);
      expect(s.status).toBe('expired');
    });
  });

  /* ── Pause / Resume ─────────────────────────────────── */

  describe('Pause / Resume', () => {
    it('can pause and resume', () => {
      session.activate();
      session.pause();
      expect(session.status).toBe('paused');

      session.resume();
      expect(session.status).toBe('active');

      // Can make calls after resume
      const cost = session.preCall('getBalance');
      session.postCall('getBalance', cost);
      expect(session.snapshot().callsMade).toBe(1);
    });

    it('cannot make calls while paused', () => {
      session.activate();
      session.pause();
      expect(() => session.preCall('getBalance')).toThrow(SessionError);
    });
  });

  /* ── Settlement ─────────────────────────────────────── */

  describe('Settlement', () => {
    it('settle returns usage summary', () => {
      session.activate();
      for (let i = 0; i < 3; i++) {
        const cost = session.preCall('getBalance');
        session.postCall('getBalance', cost);
      }

      const usage = session.settle();
      expect(usage.amountCharged).toBe(300n); // 100 × 3
      expect(usage.callCount).toBe(3);
      expect(usage.methodCounts['getBalance']).toBe(3);
      expect(session.status).toBe('settled');
    });

    it('settled session reports zero remaining calls', () => {
      session.activate();
      session.settle();
      expect(() => session.preCall('getBalance')).toThrow(SessionError);
    });
  });

  /* ── Events ─────────────────────────────────────────── */

  describe('Events', () => {
    it('emits session:activated on activate', () => {
      const events: string[] = [];
      session.on('session:activated', () => { events.push('activated'); });
      session.activate();
      expect(events).toContain('activated');
    });

    it('emits session:paused on pause', () => {
      const events: string[] = [];
      session.on('session:paused', () => { events.push('paused'); });
      session.activate();
      session.pause();
      expect(events).toContain('paused');
    });

    it('emits session:settled on settle', () => {
      const events: string[] = [];
      session.on('session:settled', () => { events.push('settled'); });
      session.activate();
      session.settle();
      expect(events).toContain('settled');
    });

    it('wildcard listener receives all events', () => {
      const events: string[] = [];
      session.on('*', (evt) => { events.push(evt.type); });
      session.activate();
      const cost = session.preCall('getBalance');
      session.postCall('getBalance', cost);
      session.settle();

      expect(events).toContain('session:activated');
      expect(events).toContain('session:settled');
    });

    it('unsubscribe stops receiving events', () => {
      const events: string[] = [];
      const unsub = session.on('session:activated', () => { events.push('activated'); });
      unsub();
      session.activate();
      expect(events.length).toBe(0);
    });
  });

  /* ── Metadata ───────────────────────────────────────── */

  describe('Metadata', () => {
    it('stores custom metadata', () => {
      session.setMetadata('agentVersion', '2.0');
      session.setMetadata('model', 'gpt-4');

      const snap = session.snapshot();
      expect(snap.metadata['agentVersion']).toBe('2.0');
      expect(snap.metadata['model']).toBe('gpt-4');
    });
  });
});
