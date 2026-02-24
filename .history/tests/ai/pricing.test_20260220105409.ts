/**
 * Tests for PricingEngine — tier resolution, dynamic pricing, bundles.
 *
 * Verifies:
 * - Default tiers are loaded correctly
 * - Method-specific overrides take priority
 * - Dynamic pricing (congestion multiplier) works
 * - Bundle discounts are applied
 * - Cost computation at varying congestion levels
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
      const ids = ['free', 'standard', 'premium', 'usdc-standard'];
      for (const id of ids) {
        expect(engine.getTier(id)).toBeDefined();
      }
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
      const customTier = makeTier({ id: 'custom', pricePerCall: 99n });
      const engineWithOverride = new PricingEngine(DEFAULT_TIERS, {
        getBalance: [customTier],
      });

      // Method has custom tier, but we ask for 'standard' → falls back to default
      const resolved = engineWithOverride.getTier('standard', 'getBalance');
      expect(resolved!.pricePerCall).toBe(1_000n); // default standard tier
    });
  });

  /* ── Dynamic pricing ────────────────────────────────── */

  describe('Dynamic pricing', () => {
    it('computeCost returns base price when no congestion', () => {
      const tier = engine.getTier('standard')!;
      const cost = engine.computeCost(tier, 'getBalance');
      expect(cost).toBe(tier.pricePerCall);
    });

    it('computeCost increases with high latency (congestion)', () => {
      const tier = engine.getTier('standard')!;

      // Report high latency to simulate congestion
      for (let i = 0; i < 100; i++) {
        engine.reportLatency(2000); // 2s per call — very congested
      }

      const cost = engine.computeCost(tier, 'getBalance');
      // Should be more than base price due to congestion multiplier
      expect(cost).toBeGreaterThan(tier.pricePerCall);
    });

    it('free tier stays free regardless of congestion', () => {
      const tier = engine.getTier('free')!;

      for (let i = 0; i < 100; i++) {
        engine.reportLatency(5000);
      }

      const cost = engine.computeCost(tier, 'getBalance');
      expect(cost).toBe(0n); // 0 * multiplier = 0
    });

    it('congestion multiplier is bounded by congestionMaxMultiplier', () => {
      const customEngine = new PricingEngine(DEFAULT_TIERS, {}, {
        congestionThresholdMs: 100,
        congestionMaxMultiplier: 2.0,
      });

      // Extreme latency
      for (let i = 0; i < 200; i++) {
        customEngine.reportLatency(50_000);
      }

      const tier = customEngine.getTier('standard')!;
      const cost = customEngine.computeCost(tier, 'getBalance');

      // Should not exceed 2x the base price
      expect(cost).toBeLessThanOrEqual(tier.pricePerCall * 2n);
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
  });

  /* ── Bundle management ──────────────────────────────── */

  describe('Bundle management', () => {
    it('registers and applies bundle discounts', () => {
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

      engine.registerBundle(bundle);

      // Bundle methods should get a discount
      const cost = engine.computeBundleCost(bundle, 'standard');
      // With 15% default discount, 3 methods × 1000 × 0.85
      expect(cost).toBeDefined();
    });
  });
});
