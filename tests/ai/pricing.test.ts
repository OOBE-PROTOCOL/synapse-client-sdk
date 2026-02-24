/**
 * Tests for PricingEngine — tier resolution, dynamic pricing, bundles.
 *
 * Verifies:
 * - Default tiers are loaded correctly
 * - Method-specific overrides take priority
 * - Dynamic pricing (congestion multiplier) works
 * - Bundle discounts are applied
 * - Session cost estimation works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PricingEngine, DEFAULT_TIERS } from '../../src/ai/gateway/pricing';
import type { PricingTier, ToolBundle } from '../../src/ai/gateway/types';
import { makeTier, makeIdentity } from './_helpers';

describe('PricingEngine', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine(DEFAULT_TIERS);
  });

  /* ── Tier resolution ────────────────────────────────── */

  describe('Tier resolution', () => {
    it('resolves default tiers by id', () => {
      const free = engine.getTier('free');
      expect(free).toBeDefined();
      expect(free!.id).toBe('free');
      expect(free!.pricePerCall).toBe(0n);

      const standard = engine.getTier('standard');
      expect(standard).toBeDefined();
      expect(standard!.pricePerCall).toBe(1_000n);
    });

    it('returns all 4 default tiers', () => {
      const ids = engine.listTierIds();
      expect(ids).toEqual(expect.arrayContaining(['free', 'standard', 'premium', 'usdc-standard']));
      expect(ids.length).toBe(4);
    });

    it('listTiers returns full tier objects', () => {
      const tiers = engine.listTiers();
      expect(tiers.length).toBe(4);
      expect(tiers.every(t => t.id && t.label && t.token)).toBe(true);
    });

    it('returns undefined for unknown tier', () => {
      expect(engine.getTier('nonexistent')).toBeUndefined();
    });

    it('method-specific overrides take priority', () => {
      const customTier = makeTier({ id: 'standard', pricePerCall: 50_000n });
      const engineWithOverride = new PricingEngine(DEFAULT_TIERS, {
        getBalance: [customTier],
      });

      const resolved = engineWithOverride.getTier('standard', 'getBalance');
      expect(resolved).toBeDefined();
      expect(resolved!.pricePerCall).toBe(50_000n);

      // For other methods, default tier is returned
      const defaultResolved = engineWithOverride.getTier('standard', 'getSlot');
      expect(defaultResolved!.pricePerCall).toBe(1_000n);
    });

    it('falls back to default tier when method has no override for requested tier', () => {
      const customTier = makeTier({ id: 'custom-only', pricePerCall: 99n });
      const engineWithOverride = new PricingEngine(DEFAULT_TIERS, {
        getBalance: [customTier],
      });

      const resolved = engineWithOverride.getTier('standard', 'getBalance');
      expect(resolved!.pricePerCall).toBe(1_000n);
    });

    it('premium tier includes attestation', () => {
      const premium = engine.getTier('premium')!;
      expect(premium.includesAttestation).toBe(true);
      expect(premium.maxCallsPerSession).toBe(0); // unlimited
    });
  });

  /* ── Dynamic pricing ────────────────────────────────── */

  describe('Dynamic pricing', () => {
    it('computeCallPrice returns base price when no congestion', () => {
      const tier = engine.getTier('standard')!;
      const cost = engine.computeCallPrice(tier);
      expect(cost).toBe(tier.pricePerCall);
    });

    it('computeCallPrice increases with high latency (congestion)', () => {
      const tier = engine.getTier('standard')!;

      for (let i = 0; i < 100; i++) {
        engine.reportLatency(2000);
      }

      const cost = engine.computeCallPrice(tier);
      expect(cost).toBeGreaterThan(tier.pricePerCall);
    });

    it('free tier stays free regardless of congestion', () => {
      const tier = engine.getTier('free')!;

      for (let i = 0; i < 100; i++) {
        engine.reportLatency(5000);
      }

      const cost = engine.computeCallPrice(tier);
      expect(cost).toBe(0n);
    });

    it('congestion multiplier is bounded by congestionMaxMultiplier', () => {
      const customEngine = new PricingEngine(DEFAULT_TIERS, {}, {
        congestionThresholdMs: 100,
        congestionMaxMultiplier: 2.0,
      });

      for (let i = 0; i < 200; i++) {
        customEngine.reportLatency(50_000);
      }

      const tier = customEngine.getTier('standard')!;
      const cost = customEngine.computeCallPrice(tier);

      expect(cost).toBeLessThanOrEqual(tier.pricePerCall * 2n);
    });
  });

  /* ── Session cost estimation ─────────────────────────── */

  describe('Session cost estimation', () => {
    it('estimates session cost for a known tier', () => {
      const cost = engine.estimateSessionCost('standard', 100);
      expect(cost).toBe(1_000n * 100n);
    });

    it('estimates free tier as zero', () => {
      const cost = engine.estimateSessionCost('free', 100);
      expect(cost).toBe(0n);
    });

    it('returns null for unknown tier', () => {
      const cost = engine.estimateSessionCost('nonexistent', 100);
      expect(cost).toBeNull();
    });

    it('uses method-specific tier when method is given', () => {
      const expensiveTier = makeTier({ id: 'standard', pricePerCall: 10_000n });
      const engineWithOverride = new PricingEngine(DEFAULT_TIERS, {
        sendTransaction: [expensiveTier],
      });

      const costDefault = engineWithOverride.estimateSessionCost('standard', 10);
      const costSpecific = engineWithOverride.estimateSessionCost('standard', 10, 'sendTransaction');

      expect(costDefault).toBe(10_000n);
      expect(costSpecific).toBe(100_000n);
    });
  });

  /* ── Latency tracking ───────────────────────────────── */

  describe('Latency tracking', () => {
    it('reports and averages latency', () => {
      engine.reportLatency(100);
      engine.reportLatency(200);
      engine.reportLatency(300);

      const avg = engine.getAvgLatency();
      expect(avg).toBeGreaterThan(0);
      expect(avg).toBeLessThanOrEqual(300);
    });

    it('starts at 0ms average', () => {
      expect(engine.getAvgLatency()).toBe(0);
    });

    it('converges toward reported values', () => {
      for (let i = 0; i < 100; i++) {
        engine.reportLatency(500);
      }
      expect(engine.getAvgLatency()).toBeGreaterThan(400);
      expect(engine.getAvgLatency()).toBeLessThanOrEqual(500);
    });
  });

  /* ── Bundle management ──────────────────────────────── */

  describe('Bundle management', () => {
    const bundleTier = makeTier({ id: 'standard', pricePerCall: 1_000n });
    const bundle: ToolBundle = {
      id: 'defi-pack',
      name: 'DeFi Pack',
      description: 'DeFi tools bundle',
      methods: ['getBalance', 'getTokenAccountBalance', 'getTokenSupply'],
      seller: makeIdentity(),
      tiers: [bundleTier],
      createdAt: Date.now(),
    };

    it('registers and retrieves a bundle', () => {
      engine.registerBundle(bundle);
      const retrieved = engine.getBundle('defi-pack');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('DeFi Pack');
      expect(retrieved!.methods.length).toBe(3);
    });

    it('lists all bundles', () => {
      engine.registerBundle(bundle);
      const all = engine.listBundles();
      expect(all.length).toBeGreaterThanOrEqual(1);
    });

    it('computes bundle session cost with discount', () => {
      engine.registerBundle(bundle);
      const cost = engine.computeBundleSessionCost('defi-pack', 'standard', 100);
      expect(cost).not.toBeNull();
      // 1000 per call × 100 calls = 100_000 base, with 15% discount = 85_000
      expect(cost!).toBe(85_000n);
    });

    it('returns null for unknown bundle', () => {
      const cost = engine.computeBundleSessionCost('unknown-bundle', 'standard', 100);
      expect(cost).toBeNull();
    });

    it('returns null for unknown tier in bundle', () => {
      engine.registerBundle(bundle);
      const cost = engine.computeBundleSessionCost('defi-pack', 'premium', 100);
      expect(cost).toBeNull();
    });
  });
});
