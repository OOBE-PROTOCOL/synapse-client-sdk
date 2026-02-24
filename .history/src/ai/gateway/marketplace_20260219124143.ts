/**
 * ToolMarketplace — Decentralized registry for agent tool discovery & listing.
 *
 * Agents register their available RPC tools with pricing, uptime, and
 * reputation data. Buyers can search, compare, and purchase tool access.
 *
 * The marketplace is designed to be:
 * - In-memory for now (single-node)
 * - Extensible to on-chain registry (Solana program) or DHT
 * - Composable: agents can list individual tools or bundles
 */

import type {
  AgentId, AgentIdentity, ToolListing, ToolBundle,
  PricingTier, ResponseAttestation,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Search & Filter
 * ═══════════════════════════════════════════════════════════════ */

export interface MarketplaceQuery {
  /** Filter by method name (exact match or substring) */
  method?: string;
  /** Filter by seller agent ID */
  seller?: AgentId;
  /** Filter: max price per call (lamports) */
  maxPrice?: bigint;
  /** Filter: minimum reputation score (0-1000) */
  minReputation?: number;
  /** Filter: minimum uptime (0-100) */
  minUptime?: number;
  /** Filter: must include attestation */
  requireAttestation?: boolean;
  /** Filter: region (e.g. 'us-east') */
  region?: string;
  /** Filter: by tags on seller identity */
  tags?: string[];
  /** Sort by field */
  sortBy?: 'price' | 'reputation' | 'latency' | 'uptime' | 'totalServed';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

export interface MarketplaceStats {
  totalListings: number;
  totalSellers: number;
  totalBundles: number;
  avgPricePerCall: bigint;
  avgReputation: number;
  avgUptime: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  ToolMarketplace
 * ═══════════════════════════════════════════════════════════════ */

export class ToolMarketplace {
  /** method → seller → listing */
  private readonly listings: Map<string, Map<AgentId, ToolListing>> = new Map();
  /** bundleId → bundle */
  private readonly bundles: Map<string, ToolBundle> = new Map();
  /** sellerId → reputation data */
  private readonly reputationData: Map<AgentId, {
    totalAttestations: number;
    verifiedAttestations: number;
    totalCalls: number;
    avgLatencyMs: number;
    lastUpdated: number;
  }> = new Map();

  /* ── Listing management ──────────────────────────────────── */

  /**
   * Register a tool listing.
   * A seller can list the same method only once (updates overwrite).
   */
  listTool(listing: ToolListing): void {
    if (!this.listings.has(listing.method)) {
      this.listings.set(listing.method, new Map());
    }
    this.listings.get(listing.method)!.set(listing.seller.id, listing);
  }

  /**
   * Register multiple tool listings at once (batch from a gateway).
   */
  listTools(listings: ToolListing[]): void {
    for (const l of listings) this.listTool(l);
  }

  /**
   * Remove a listing.
   */
  delistTool(method: string, sellerId: AgentId): boolean {
    return this.listings.get(method)?.delete(sellerId) ?? false;
  }

  /**
   * Remove all listings for a seller.
   */
  delistAll(sellerId: AgentId): number {
    let count = 0;
    for (const [, sellers] of this.listings) {
      if (sellers.delete(sellerId)) count++;
    }
    return count;
  }

  /* ── Bundle management ───────────────────────────────────── */

  registerBundle(bundle: ToolBundle): void {
    this.bundles.set(bundle.id, bundle);
  }

  getBundle(id: string): ToolBundle | undefined {
    return this.bundles.get(id);
  }

  listBundles(sellerId?: AgentId): ToolBundle[] {
    const all = [...this.bundles.values()];
    if (sellerId) return all.filter(b => b.seller.id === sellerId);
    return all;
  }

  /* ── Search & Discovery ──────────────────────────────────── */

  /**
   * Search the marketplace with filters, sorting, and pagination.
   */
  search(query: MarketplaceQuery = {}): ToolListing[] {
    let results: ToolListing[] = [];

    // Collect all listings or filter by method
    if (query.method) {
      const methodListings = this.listings.get(query.method);
      if (methodListings) {
        results = [...methodListings.values()];
      }
      // Also try substring match
      if (results.length === 0) {
        for (const [method, sellers] of this.listings) {
          if (method.toLowerCase().includes(query.method.toLowerCase())) {
            results.push(...sellers.values());
          }
        }
      }
    } else {
      for (const sellers of this.listings.values()) {
        results.push(...sellers.values());
      }
    }

    // Apply filters
    if (query.seller) {
      results = results.filter(l => l.seller.id === query.seller);
    }
    if (query.maxPrice != null) {
      results = results.filter(l => l.tiers.some(t => t.pricePerCall <= query.maxPrice!));
    }
    if (query.minReputation != null) {
      results = results.filter(l => l.reputationScore >= query.minReputation!);
    }
    if (query.minUptime != null) {
      results = results.filter(l => l.uptimePercent >= query.minUptime!);
    }
    if (query.requireAttestation) {
      results = results.filter(l => l.attestationAvailable);
    }
    if (query.region) {
      results = results.filter(l => l.region === query.region);
    }
    if (query.tags?.length) {
      results = results.filter(l =>
        query.tags!.some(tag =>
          l.seller.tags?.includes(tag),
        ),
      );
    }

    // Sort
    if (query.sortBy) {
      const dir = query.sortDirection === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        switch (query.sortBy) {
          case 'price': {
            const ap = Math.min(...a.tiers.map(t => Number(t.pricePerCall)));
            const bp = Math.min(...b.tiers.map(t => Number(t.pricePerCall)));
            return (ap - bp) * dir;
          }
          case 'reputation': return (a.reputationScore - b.reputationScore) * dir;
          case 'latency': return (a.avgLatencyMs - b.avgLatencyMs) * dir;
          case 'uptime': return (a.uptimePercent - b.uptimePercent) * dir;
          case 'totalServed': return (a.totalServed - b.totalServed) * dir;
          default: return 0;
        }
      });
    }

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  /**
   * Find the cheapest listing for a given method.
   */
  findCheapest(method: string): ToolListing | null {
    const results = this.search({ method, sortBy: 'price', sortDirection: 'asc', limit: 1 });
    return results[0] ?? null;
  }

  /**
   * Find the highest-reputation listing for a given method.
   */
  findMostReputable(method: string): ToolListing | null {
    const results = this.search({ method, sortBy: 'reputation', sortDirection: 'desc', limit: 1 });
    return results[0] ?? null;
  }

  /**
   * Find the fastest (lowest latency) listing for a given method.
   */
  findFastest(method: string): ToolListing | null {
    const results = this.search({ method, sortBy: 'latency', sortDirection: 'asc', limit: 1 });
    return results[0] ?? null;
  }

  /* ── Reputation ──────────────────────────────────────────── */

  /**
   * Report attestation data for reputation scoring.
   * Called by buyers after verifying an attestation.
   */
  reportAttestation(sellerId: AgentId, verified: boolean, latencyMs: number): void {
    const existing = this.reputationData.get(sellerId) ?? {
      totalAttestations: 0,
      verifiedAttestations: 0,
      totalCalls: 0,
      avgLatencyMs: 0,
      lastUpdated: 0,
    };

    existing.totalAttestations++;
    if (verified) existing.verifiedAttestations++;
    existing.totalCalls++;

    // EMA for latency
    const alpha = 0.1;
    existing.avgLatencyMs = existing.avgLatencyMs === 0
      ? latencyMs
      : existing.avgLatencyMs * (1 - alpha) + latencyMs * alpha;

    existing.lastUpdated = Date.now();
    this.reputationData.set(sellerId, existing);

    // Update listings with new reputation score
    this.recalculateReputation(sellerId);
  }

  /**
   * Get reputation data for a seller.
   */
  getReputation(sellerId: AgentId): { score: number; totalCalls: number; verificationRate: number } | null {
    const data = this.reputationData.get(sellerId);
    if (!data) return null;
    return {
      score: this.computeReputationScore(data),
      totalCalls: data.totalCalls,
      verificationRate: data.totalAttestations > 0
        ? data.verifiedAttestations / data.totalAttestations
        : 0,
    };
  }

  private computeReputationScore(data: {
    totalAttestations: number;
    verifiedAttestations: number;
    totalCalls: number;
    avgLatencyMs: number;
  }): number {
    // Score formula:
    // 40% verification rate + 30% volume (logarithmic) + 30% latency (inverse)
    const verificationRate = data.totalAttestations > 0
      ? data.verifiedAttestations / data.totalAttestations
      : 0;
    const volumeScore = Math.min(Math.log10(data.totalCalls + 1) / 6, 1); // max at ~1M calls
    const latencyScore = Math.max(0, 1 - (data.avgLatencyMs / 2000)); // 0 at 2s+

    return Math.round(
      (verificationRate * 400) + (volumeScore * 300) + (latencyScore * 300),
    );
  }

  private recalculateReputation(sellerId: AgentId): void {
    const data = this.reputationData.get(sellerId);
    if (!data) return;
    const score = this.computeReputationScore(data);

    for (const sellers of this.listings.values()) {
      const listing = sellers.get(sellerId);
      if (listing) {
        listing.reputationScore = score;
        listing.avgLatencyMs = Math.round(data.avgLatencyMs);
        listing.totalServed = data.totalCalls;
        listing.updatedAt = Date.now();
      }
    }
  }

  /* ── Stats ───────────────────────────────────────────────── */

  /**
   * Get aggregate marketplace statistics.
   */
  getStats(): MarketplaceStats {
    let totalListings = 0;
    const sellers = new Set<AgentId>();
    let totalPrice = 0n;
    let totalReputation = 0;
    let totalUptime = 0;

    for (const methodListings of this.listings.values()) {
      for (const listing of methodListings.values()) {
        totalListings++;
        sellers.add(listing.seller.id);
        if (listing.tiers.length > 0) {
          totalPrice += listing.tiers[0]!.pricePerCall;
        }
        totalReputation += listing.reputationScore;
        totalUptime += listing.uptimePercent;
      }
    }

    return {
      totalListings,
      totalSellers: sellers.size,
      totalBundles: this.bundles.size,
      avgPricePerCall: totalListings > 0 ? totalPrice / BigInt(totalListings) : 0n,
      avgReputation: totalListings > 0 ? Math.round(totalReputation / totalListings) : 0,
      avgUptime: totalListings > 0 ? Math.round(totalUptime / totalListings) : 0,
    };
  }

  /**
   * List all methods available in the marketplace.
   */
  listMethods(): string[] {
    return [...this.listings.keys()];
  }

  /**
   * Count listings for a specific method.
   */
  countListings(method: string): number {
    return this.listings.get(method)?.size ?? 0;
  }
}
