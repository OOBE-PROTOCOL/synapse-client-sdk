/**
 * PricingEngine — Dynamic pricing, tier management, and cost calculation.
 *
 * Supports:
 * - Static per-method pricing
 * - Dynamic pricing based on network congestion (slot-aware)
 * - Bundle discounts
 * - Free-tier with call limits
 */

import type { PricingTier, PaymentToken, ToolBundle } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Pre-built pricing tiers
 * ═══════════════════════════════════════════════════════════════ */

const SOL: PaymentToken = { type: 'SOL' };
const USDC: PaymentToken = { type: 'USDC' };

/** Sensible defaults — providers override via GatewayConfig */
export const DEFAULT_TIERS: PricingTier[] = [
  {
    id: 'free',
    label: 'Free Tier',
    pricePerCall: 0n,
    maxCallsPerSession: 100,
    rateLimit: 5,
    token: SOL,
    includesAttestation: false,
  },
  {
    id: 'standard',
    label: 'Standard',
    pricePerCall: 1_000n,    // 0.000001 SOL per call
    maxCallsPerSession: 10_000,
    rateLimit: 50,
    token: SOL,
    includesAttestation: false,
  },
  {
    id: 'premium',
    label: 'Premium (Attested)',
    pricePerCall: 5_000n,    // 0.000005 SOL per call
    maxCallsPerSession: 0,   // unlimited
    rateLimit: 200,
    token: SOL,
    includesAttestation: true,
  },
  {
    id: 'usdc-standard',
    label: 'USDC Standard',
    pricePerCall: 1n,         // 0.000001 USDC per call
    maxCallsPerSession: 50_000,
    rateLimit: 100,
    token: USDC,
    includesAttestation: false,
  },
];

/* ═══════════════════════════════════════════════════════════════
 *  PricingEngine
 * ═══════════════════════════════════════════════════════════════ */

export interface DynamicPricingConfig {
  /** Base multiplier (1.0 = no change) */
  baseMultiplier: number;
  /** Increase price when recent slot latency exceeds this (ms) */
  congestionThresholdMs: number;
  /** Max multiplier during congestion */
  congestionMaxMultiplier: number;
  /** Discount factor for bundle purchases (0-1, e.g. 0.15 = 15% off) */
  bundleDiscount: number;
}

const DEFAULT_DYNAMIC_CONFIG: DynamicPricingConfig = {
  baseMultiplier: 1.0,
  congestionThresholdMs: 500,
  congestionMaxMultiplier: 3.0,
  bundleDiscount: 0.15,
};

export class PricingEngine {
  private readonly tiers: Map<string, PricingTier> = new Map();
  private readonly methodOverrides: Map<string, Map<string, PricingTier>> = new Map();
  private readonly bundles: Map<string, ToolBundle> = new Map();
  private readonly dynamicConfig: DynamicPricingConfig;

  /** Rolling average latency (updated externally via reportLatency) */
  private avgLatencyMs = 0;
  private latencySamples = 0;

  constructor(
    defaultTiers: PricingTier[] = DEFAULT_TIERS,
    methodTiers: Record<string, PricingTier[]> = {},
    dynamicConfig: Partial<DynamicPricingConfig> = {},
  ) {
    this.dynamicConfig = { ...DEFAULT_DYNAMIC_CONFIG, ...dynamicConfig };

    for (const tier of defaultTiers) {
      this.tiers.set(tier.id, tier);
    }

    for (const [method, tiers] of Object.entries(methodTiers)) {
      const m = new Map<string, PricingTier>();
      for (const t of tiers) m.set(t.id, t);
      this.methodOverrides.set(method, m);
    }
  }

  /* ── Tier resolution ─────────────────────────────────────── */

  /** Get the effective pricing tier for a method + tier ID. */
  getTier(tierId: string, method?: string): PricingTier | undefined {
    // Method-specific override first
    if (method) {
      const override = this.methodOverrides.get(method)?.get(tierId);
      if (override) return override;
    }
    return this.tiers.get(tierId);
  }

  /** List all available tier IDs */
  listTierIds(): string[] {
    return [...this.tiers.keys()];
  }

  /** List all tiers as array */
  listTiers(): PricingTier[] {
    return [...this.tiers.values()];
  }

  /* ── Dynamic price computation ──────────────────────────── */

  /**
   * Compute the effective price for a single call.
   * Applies congestion multiplier if latency is above threshold.
   */
  computeCallPrice(tier: PricingTier): bigint {
    if (tier.pricePerCall === 0n) return 0n; // Free tier is always free

    let multiplier = this.dynamicConfig.baseMultiplier;

    // Congestion-based surge pricing
    if (this.avgLatencyMs > this.dynamicConfig.congestionThresholdMs) {
      const congestionRatio = Math.min(
        this.avgLatencyMs / this.dynamicConfig.congestionThresholdMs,
        this.dynamicConfig.congestionMaxMultiplier,
      );
      multiplier *= congestionRatio;
    }

    if (multiplier === 1.0) return tier.pricePerCall;
    return BigInt(Math.ceil(Number(tier.pricePerCall) * multiplier));
  }

  /**
   * Estimate total cost for a session with a given number of calls.
   * Useful for buyers to budget ahead of time.
   */
  estimateSessionCost(tierId: string, estimatedCalls: number, method?: string): bigint | null {
    const tier = this.getTier(tierId, method);
    if (!tier) return null;
    const perCall = this.computeCallPrice(tier);
    return perCall * BigInt(estimatedCalls);
  }

  /* ── Bundles ─────────────────────────────────────────────── */

  /** Register a tool bundle */
  registerBundle(bundle: ToolBundle): void {
    this.bundles.set(bundle.id, bundle);
  }

  /** Get a registered bundle */
  getBundle(id: string): ToolBundle | undefined {
    return this.bundles.get(id);
  }

  /** List all registered bundles */
  listBundles(): ToolBundle[] {
    return [...this.bundles.values()];
  }

  /**
   * Compute bundle price for a session.
   * Applies the bundle discount from the dynamic config.
   */
  computeBundleSessionCost(bundleId: string, tierId: string, estimatedCalls: number): bigint | null {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return null;
    const tier = bundle.tiers.find(t => t.id === tierId);
    if (!tier) return null;
    const baseCost = this.computeCallPrice(tier) * BigInt(estimatedCalls);
    const discount = this.dynamicConfig.bundleDiscount;
    return BigInt(Math.ceil(Number(baseCost) * (1 - discount)));
  }

  /* ── Latency tracking (for dynamic pricing) ─────────────── */

  /** Report a latency sample to update the rolling average */
  reportLatency(ms: number): void {
    this.latencySamples++;
    // Exponential moving average with warmup
    const alpha = Math.min(0.1, 2 / (this.latencySamples + 1));
    this.avgLatencyMs = this.avgLatencyMs === 0
      ? ms
      : this.avgLatencyMs * (1 - alpha) + ms * alpha;
  }

  /** Get the current average latency */
  getAvgLatency(): number {
    return Math.round(this.avgLatencyMs);
  }
}
