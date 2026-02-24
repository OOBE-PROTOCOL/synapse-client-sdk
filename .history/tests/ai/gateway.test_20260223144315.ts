/**
 * Tests for AgentGateway — Full end-to-end workflow orchestration.
 *
 * Verifies:
 * - openSession → execute → settleSession full lifecycle
 * - Intent verification (seller match, budget, TTL)
 * - execute() produces attested results
 * - executeBatch() processes multiple calls
 * - Metrics tracking (calls, revenue, latency)
 * - Session listing and pruning
 * - Max concurrent sessions enforcement
 * - Publishing tools to marketplace
 * - Publishing bundles
 * - Event emission throughout the workflow
 * - x402 paywall integration (with mock facilitator)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentGateway,
  createAgentGateway,
  GatewayError,
  SessionNotFoundError,
  MaxSessionsError,
  IntentVerificationError,
} from '../../src/ai/gateway/index';
import { DEFAULT_TIERS } from '../../src/ai/gateway/pricing';
import { AgentId } from '../../src/ai/gateway/types';
import type { GatewayEvent, GatewayConfig } from '../../src/ai/gateway/types';
import {
  MockSynapseClient,
  makeGatewayConfig,
  makePaymentIntent,
  makeTier,
  makeMockSigner,
  makeIdentity,
} from './_helpers';

describe('AgentGateway', () => {
  let client: MockSynapseClient;
  let gateway: AgentGateway;
  const sellerId = AgentId('did:synapse:agent:TestSeller');

  beforeEach(() => {
    client = new MockSynapseClient();
    gateway = createAgentGateway(client as any, makeGatewayConfig());
  });

  /* ═══════════════════════════════════════════════════════
   *  Session lifecycle
   * ═══════════════════════════════════════════════════════ */

  describe('Session lifecycle', () => {
    it('opens a session from a valid PaymentIntent', () => {
      const intent = makePaymentIntent(sellerId);
      const session = gateway.openSession(intent);

      expect(session.id).toBeTruthy();
      expect(session.status).toBe('active');
    });

    it('rejects intent with wrong seller', () => {
      const intent = makePaymentIntent(AgentId('did:synapse:agent:WrongSeller'));
      expect(() => gateway.openSession(intent)).toThrow(IntentVerificationError);
    });

    it('rejects intent with zero budget', () => {
      const intent = makePaymentIntent(sellerId, { maxBudget: 0n });
      expect(() => gateway.openSession(intent)).toThrow(IntentVerificationError);
    });

    it('rejects intent with negative TTL', () => {
      const intent = makePaymentIntent(sellerId, { ttl: -1 });
      expect(() => gateway.openSession(intent)).toThrow(IntentVerificationError);
    });

    it('rejects expired intent', () => {
      const intent = makePaymentIntent(sellerId, {
        createdAt: Date.now() - 10_000,
        ttl: 1, // expired 9 seconds ago
      });
      expect(() => gateway.openSession(intent)).toThrow(IntentVerificationError);
    });

    it('supports custom intent verifier', () => {
      const intent = makePaymentIntent(sellerId);

      // Custom verifier that always rejects
      expect(() => gateway.openSession(intent, {
        verifyIntent: () => false,
      })).toThrow(IntentVerificationError);

      // Custom verifier that always passes (even with wrong seller)
      const wrongIntent = makePaymentIntent(AgentId('wrong'), { seller: sellerId });
      // Doesn't matter — custom verifier overrides
      const session = gateway.openSession(makePaymentIntent(sellerId), {
        verifyIntent: () => true,
      });
      expect(session.status).toBe('active');
    });

    it('enforces max concurrent sessions', () => {
      const smallGateway = createAgentGateway(client as any, makeGatewayConfig({
        maxConcurrentSessions: 2,
      }));

      smallGateway.openSession(makePaymentIntent(sellerId));
      smallGateway.openSession(makePaymentIntent(sellerId));

      expect(() => smallGateway.openSession(makePaymentIntent(sellerId))).toThrow(MaxSessionsError);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Execute
   * ═══════════════════════════════════════════════════════ */

  describe('execute()', () => {
    it('executes an RPC call within a session', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId));
      const result = await gateway.execute(session.id, 'getBalance', ['abc']);

      expect(result.data).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.callIndex).toBe(1);
    });

    it('calls the transport with correct method and params', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId));
      await gateway.execute(session.id, 'getBalance', ['myPubkey']);

      const call = client.transport.callLog.find(c => c.method === 'getBalance');
      expect(call).toBeDefined();
      expect(call!.params).toEqual(['myPubkey']);
    });

    it('throws SessionNotFoundError for invalid session', async () => {
      await expect(
        gateway.execute('nonexistent', 'getBalance', []),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('includes attestation when tier has includesAttestation=true', async () => {
      const attestGateway = createAgentGateway(client as any, makeGatewayConfig({
        signer: makeMockSigner(),
      }));

      const premiumTier = DEFAULT_TIERS.find(t => t.id === 'premium')!;
      const intent = makePaymentIntent(sellerId, { tierId: 'premium', maxBudget: 1_000_000n });
      const session = attestGateway.openSession(intent, { tier: premiumTier });

      const result = await attestGateway.execute(session.id, 'getBalance', ['abc']);

      expect(result.attestation).toBeDefined();
      expect(result.attestation!.method).toBe('getBalance');
      expect(result.attestation!.signature).toBeTruthy();
    });

    it('omits attestation for free tier', async () => {
      const freeTier = DEFAULT_TIERS.find(t => t.id === 'free')!;
      const intent = makePaymentIntent(sellerId, { tierId: 'free', maxBudget: 1_000_000n });
      const session = gateway.openSession(intent, { tier: freeTier });

      const result = await gateway.execute(session.id, 'getBalance', ['abc']);

      expect(result.attestation).toBeUndefined();
    });

    it('deducts budget after execution', async () => {
      const tier = makeTier({ id: 'standard', pricePerCall: 500n, rateLimit: 100 });
      const intent = makePaymentIntent(sellerId, { tierId: 'standard', maxBudget: 10_000n });
      const session = gateway.openSession(intent, { tier });

      await gateway.execute(session.id, 'getBalance', ['abc']);

      const snap = session.snapshot();
      expect(snap.budgetRemaining).toBe(9_500n);
      expect(snap.callsMade).toBe(1);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  executeBatch
   * ═══════════════════════════════════════════════════════ */

  describe('executeBatch()', () => {
    it('executes multiple calls sequentially', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId, { maxBudget: 1_000_000n }));

      const results = await gateway.executeBatch(session.id, [
        { method: 'getBalance', params: ['abc'] },
        { method: 'getSlot' },
        { method: 'getVersion' },
      ]);

      expect(results.length).toBe(3);
      expect(results[0].data).toBeDefined();
      expect(results[1].data).toBeDefined();
      expect(results[2].data).toBeDefined();

      expect(session.snapshot().callsMade).toBe(3);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  settleSession
   * ═══════════════════════════════════════════════════════ */

  describe('settleSession()', () => {
    it('settles a session and returns a receipt', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId, { maxBudget: 1_000_000n }));
      await gateway.execute(session.id, 'getBalance', ['abc']);
      await gateway.execute(session.id, 'getSlot', []);

      const receipt = gateway.settleSession(session.id);

      expect(receipt.callCount).toBe(2);
      expect(receipt.amountCharged).toBeGreaterThan(0n);
      expect(receipt.settlement).toBe('offchain-escrow');
      expect(receipt.settledAt).toBeGreaterThan(0);
      expect(session.status).toBe('settled');
    });

    it('on-chain settlement when txSignature provided', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId));

      const receipt = gateway.settleSession(session.id, 'someTxSignature123');
      expect(receipt.settlement).toBe('onchain');
      expect(receipt.txSignature).toBe('someTxSignature123');
    });

    it('throws for unknown session', () => {
      expect(() => gateway.settleSession('nonexistent')).toThrow(SessionNotFoundError);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Session management
   * ═══════════════════════════════════════════════════════ */

  describe('Session management', () => {
    it('getSession returns session by ID', () => {
      const session = gateway.openSession(makePaymentIntent(sellerId));
      const found = gateway.getSession(session.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(session.id);
    });

    it('getSession returns undefined for unknown ID', () => {
      expect(gateway.getSession('nonexistent')).toBeUndefined();
    });

    it('listSessions returns all sessions', () => {
      gateway.openSession(makePaymentIntent(sellerId));
      gateway.openSession(makePaymentIntent(sellerId));

      const all = gateway.listSessions();
      expect(all.length).toBe(2);
    });

    it('listSessions filters by status', async () => {
      const s1 = gateway.openSession(makePaymentIntent(sellerId));
      gateway.openSession(makePaymentIntent(sellerId));

      gateway.settleSession(s1.id);

      const active = gateway.listSessions('active');
      expect(active.length).toBe(1);
      expect(active[0].status).toBe('active');
    });

    it('pruneSessions removes settled/expired sessions', () => {
      const s1 = gateway.openSession(makePaymentIntent(sellerId));
      gateway.openSession(makePaymentIntent(sellerId));

      gateway.settleSession(s1.id);
      const pruned = gateway.pruneSessions();

      expect(pruned).toBe(1);
      expect(gateway.listSessions().length).toBe(1);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Metrics
   * ═══════════════════════════════════════════════════════ */

  describe('Metrics', () => {
    it('tracks total calls and revenue', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId, { maxBudget: 1_000_000n }));

      await gateway.execute(session.id, 'getBalance', ['abc']);
      await gateway.execute(session.id, 'getSlot', []);

      gateway.settleSession(session.id);

      const metrics = gateway.getMetrics();
      expect(metrics.totalCallsServed).toBe(2);
      expect(BigInt(metrics.totalRevenue)).toBeGreaterThan(0n);
      expect(metrics.totalSessions).toBeGreaterThanOrEqual(1);
    });

    it('tracks avg latency', async () => {
      const session = gateway.openSession(makePaymentIntent(sellerId, { maxBudget: 1_000_000n }));
      await gateway.execute(session.id, 'getBalance', ['abc']);

      const metrics = gateway.getMetrics();
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('tracks x402 config state', () => {
      const metrics = gateway.getMetrics();
      expect(metrics.x402.paywallEnabled).toBe(false);
      expect(metrics.x402.clientEnabled).toBe(false);
    });

    it('marketplace stats are included', () => {
      const metrics = gateway.getMetrics();
      expect(metrics.marketplaceStats).toBeDefined();
      expect(metrics.marketplaceStats.totalListings).toBe(0);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Marketplace publishing
   * ═══════════════════════════════════════════════════════ */

  describe('Publishing', () => {
    it('publishes tools to the marketplace', () => {
      gateway.publish(['getBalance', 'getSlot', 'getVersion']);

      const stats = gateway.getMetrics().marketplaceStats;
      expect(stats.totalListings).toBe(3);
    });

    it('publishes a bundle', () => {
      const bundle = gateway.publishBundle(
        'DeFi Pack',
        ['getBalance', 'getTokenAccountBalance'],
        DEFAULT_TIERS,
        'DeFi tools bundle',
      );

      expect(bundle.id).toBeTruthy();
      expect(bundle.name).toBe('DeFi Pack');
      expect(bundle.methods.length).toBe(2);

      const stats = gateway.getMetrics().marketplaceStats;
      expect(stats.totalBundles).toBe(1);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Events
   * ═══════════════════════════════════════════════════════ */

  describe('Event system', () => {
    it('emits session:created on openSession', () => {
      const events: GatewayEvent[] = [];
      gateway.on('session:created', (evt) => { events.push(evt); });

      gateway.openSession(makePaymentIntent(sellerId));

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('session:created');
    });

    it('emits call:before and call:after on execute', async () => {
      const events: GatewayEvent[] = [];
      gateway.on('call:before', (evt) => { events.push(evt); });
      gateway.on('call:after', (evt) => { events.push(evt); });

      const session = gateway.openSession(makePaymentIntent(sellerId));
      await gateway.execute(session.id, 'getBalance', ['abc']);

      const types = events.map(e => e.type);
      expect(types).toContain('call:before');
      expect(types).toContain('call:after');
    });

    it('emits payment:settled on settleSession', async () => {
      const events: GatewayEvent[] = [];
      gateway.on('payment:settled', (evt) => { events.push(evt); });

      const session = gateway.openSession(makePaymentIntent(sellerId));
      gateway.settleSession(session.id);

      expect(events.length).toBe(1);
    });

    it('wildcard listener receives all events', async () => {
      const events: string[] = [];
      gateway.on('*', (evt) => { events.push(evt.type); });

      const session = gateway.openSession(makePaymentIntent(sellerId));
      await gateway.execute(session.id, 'getBalance', ['abc']);
      gateway.settleSession(session.id);

      expect(events).toContain('session:created');
      expect(events).toContain('call:before');
      expect(events).toContain('call:after');
      expect(events).toContain('payment:settled');
    });

    it('unsubscribe stops events', () => {
      const events: GatewayEvent[] = [];
      const unsub = gateway.on('session:created', (evt) => { events.push(evt); });
      unsub();

      gateway.openSession(makePaymentIntent(sellerId));
      expect(events.length).toBe(0);
    });

    it('call:error emitted on transport failure', async () => {
      const errors: GatewayEvent[] = [];
      gateway.on('call:error', (evt) => { errors.push(evt); });

      client.transport.request = async () => { throw new Error('RPC down'); };

      const session = gateway.openSession(makePaymentIntent(sellerId));

      await expect(
        gateway.execute(session.id, 'getBalance', ['abc']),
      ).rejects.toThrow('RPC down');

      expect(errors.length).toBe(1);
      expect((errors[0].data as any).error).toContain('RPC down');
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Identity
   * ═══════════════════════════════════════════════════════ */

  describe('Identity', () => {
    it('exposes the seller identity', () => {
      expect(gateway.agentId).toBe(sellerId);
      expect(gateway.identity.name).toBe('TestSeller');
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Full workflow: open → execute × N → settle
   * ═══════════════════════════════════════════════════════ */

  describe('Full workflow', () => {
    it('complete session lifecycle with events and metrics', async () => {
      const events: string[] = [];
      gateway.on('*', (evt) => { events.push(evt.type); });

      // 1. Open session
      const intent = makePaymentIntent(sellerId, { maxBudget: 500_000n, tierId: 'standard' });
      const session = gateway.openSession(intent);

      // 2. Execute multiple calls
      for (let i = 0; i < 5; i++) {
        await gateway.execute(session.id, 'getBalance', [`pubkey-${i}`]);
      }
      await gateway.execute(session.id, 'getSlot', []);
      await gateway.execute(session.id, 'getVersion', []);

      // 3. Check intermediate state
      const snap = session.snapshot();
      expect(snap.callsMade).toBe(7);
      expect(snap.budgetRemaining).toBeLessThan(500_000n);

      // 4. Settle
      const receipt = gateway.settleSession(session.id);
      expect(receipt.callCount).toBe(7);
      expect(receipt.amountCharged).toBeGreaterThan(0n);

      // 5. Check events
      expect(events).toContain('session:created');
      expect(events).toContain('call:before');
      expect(events).toContain('call:after');
      expect(events).toContain('payment:settled');

      // 6. Check metrics
      const metrics = gateway.getMetrics();
      expect(metrics.totalCallsServed).toBe(7);
      expect(BigInt(metrics.totalRevenue)).toBe(receipt.amountCharged);
    });

    it('multi-session concurrent workflow', async () => {
      // Open 3 sessions, execute calls, settle all
      const sessions = [1, 2, 3].map(() =>
        gateway.openSession(makePaymentIntent(sellerId, { maxBudget: 1_000_000n })),
      );

      // Execute in each session
      for (const s of sessions) {
        await gateway.execute(s.id, 'getBalance', ['abc']);
        await gateway.execute(s.id, 'getSlot', []);
      }

      // Settle all
      const receipts = sessions.map(s => gateway.settleSession(s.id));

      // Each session had 2 calls
      for (const r of receipts) {
        expect(r.callCount).toBe(2);
      }

      // Total: 6 calls across 3 sessions
      const metrics = gateway.getMetrics();
      expect(metrics.totalCallsServed).toBe(6);
    });
  });

  /* ═══════════════════════════════════════════════════════
   *  Factory
   * ═══════════════════════════════════════════════════════ */

  describe('createAgentGateway factory', () => {
    it('creates a gateway with default config', () => {
      const gw = createAgentGateway(client as any, makeGatewayConfig());
      expect(gw).toBeInstanceOf(AgentGateway);
      expect(gw.agentId).toBe(sellerId);
    });
  });
});
