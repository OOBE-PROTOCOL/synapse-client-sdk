/**
 * Tests for ToolMarketplace — listing, search, reputation, bundles.
 *
 * Verifies:
 * - Listing and delisting tools
 * - Search with filters (price, reputation, attestation, region, tags)
 * - Sorting and pagination
 * - Reputation tracking
 * - Bundle management
 * - Marketplace stats
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolMarketplace, type MarketplaceQuery } from '../../src/ai/gateway/marketplace';
import type { AgentId, ToolListing, ToolBundle, AgentIdentity } from '../../src/ai/gateway/types';
import { AgentId as createAgentId } from '../../src/ai/gateway/types';
import { makeIdentity, makeTier } from './_helpers';
import { DEFAULT_TIERS } from '../../src/ai/gateway/pricing';

function makeListing(
  method: string,
  seller: AgentIdentity,
  overrides: Partial<ToolListing> = {},
): ToolListing {
  return {
    method,
    description: `Solana RPC: ${method}`,
    seller,
    tiers: DEFAULT_TIERS,
    avgLatencyMs: 50,
    uptimePercent: 99.9,
    totalServed: 1000,
    reputationScore: 800,
    attestationAvailable: true,
    region: 'us-east',
    commitments: ['processed', 'confirmed', 'finalized'],
    listedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('ToolMarketplace', () => {
  let marketplace: ToolMarketplace;
  const seller1 = makeIdentity('Seller1', 'Seller1Pubkey11111111111111111111111111111');
  const seller2 = makeIdentity('Seller2', 'Seller2Pubkey22222222222222222222222222222');

  beforeEach(() => {
    marketplace = new ToolMarketplace();
  });

  /* ── Listing management ─────────────────────────────── */

  describe('Listing management', () => {
    it('lists a tool', () => {
      const listing = makeListing('getBalance', seller1);
      marketplace.listTool(listing);

      const results = marketplace.search({ method: 'getBalance' });
      expect(results.length).toBe(1);
      expect(results[0].seller.id).toBe(seller1.id);
    });

    it('overwrites listing for same seller+method', () => {
      marketplace.listTool(makeListing('getBalance', seller1, { avgLatencyMs: 50 }));
      marketplace.listTool(makeListing('getBalance', seller1, { avgLatencyMs: 10 }));

      const results = marketplace.search({ method: 'getBalance' });
      expect(results.length).toBe(1);
      expect(results[0].avgLatencyMs).toBe(10);
    });

    it('allows different sellers for same method', () => {
      marketplace.listTool(makeListing('getBalance', seller1));
      marketplace.listTool(makeListing('getBalance', seller2));

      const results = marketplace.search({ method: 'getBalance' });
      expect(results.length).toBe(2);
    });

    it('batch lists tools', () => {
      marketplace.listTools([
        makeListing('getBalance', seller1),
        makeListing('getSlot', seller1),
        makeListing('getVersion', seller1),
      ]);

      const all = marketplace.search();
      expect(all.length).toBe(3);
    });

    it('delists a specific tool', () => {
      marketplace.listTool(makeListing('getBalance', seller1));
      marketplace.listTool(makeListing('getBalance', seller2));

      const removed = marketplace.delistTool('getBalance', seller1.id);
      expect(removed).toBe(true);

      const results = marketplace.search({ method: 'getBalance' });
      expect(results.length).toBe(1);
      expect(results[0].seller.id).toBe(seller2.id);
    });

    it('delists all tools for a seller', () => {
      marketplace.listTools([
        makeListing('getBalance', seller1),
        makeListing('getSlot', seller1),
        makeListing('getVersion', seller2),
      ]);

      const count = marketplace.delistAll(seller1.id);
      expect(count).toBe(2);

      const all = marketplace.search();
      expect(all.length).toBe(1);
      expect(all[0].seller.id).toBe(seller2.id);
    });
  });

  /* ── Search ─────────────────────────────────────────── */

  describe('Search & filtering', () => {
    beforeEach(() => {
      // Populate marketplace with diverse listings
      marketplace.listTools([
        makeListing('getBalance', seller1, { reputationScore: 900, attestationAvailable: true, region: 'us-east' }),
        makeListing('getBalance', seller2, { reputationScore: 600, attestationAvailable: false, region: 'eu-west' }),
        makeListing('getSlot', seller1, { reputationScore: 850, region: 'us-east' }),
        makeListing('getVersion', seller2, { reputationScore: 700, region: 'eu-west' }),
      ]);
    });

    it('returns all listings when no filter', () => {
      const results = marketplace.search();
      expect(results.length).toBe(4);
    });

    it('filters by method', () => {
      const results = marketplace.search({ method: 'getBalance' });
      expect(results.length).toBe(2);
    });

    it('filters by seller', () => {
      const results = marketplace.search({ seller: seller1.id });
      expect(results.length).toBe(2);
    });

    it('filters by min reputation', () => {
      const results = marketplace.search({ minReputation: 800 });
      expect(results.length).toBe(2);
      expect(results.every(r => r.reputationScore >= 800)).toBe(true);
    });

    it('filters by region', () => {
      const results = marketplace.search({ region: 'eu-west' });
      expect(results.length).toBe(2);
    });

    it('filters by attestation availability', () => {
      const results = marketplace.search({ requireAttestation: true });
      // seller2's getBalance has attestationAvailable: false
      expect(results.every(r => r.attestationAvailable)).toBe(true);
    });

    it('combines multiple filters', () => {
      const results = marketplace.search({
        method: 'getBalance',
        minReputation: 800,
        requireAttestation: true,
      });
      expect(results.length).toBe(1);
      expect(results[0].seller.id).toBe(seller1.id);
    });

    it('supports substring method search', () => {
      // "Balance" should match "getBalance"
      const results = marketplace.search({ method: 'Balance' });
      expect(results.length).toBe(2);
    });

    it('sorts by reputation descending', () => {
      const results = marketplace.search({
        sortBy: 'reputation',
        sortDirection: 'desc',
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].reputationScore).toBeGreaterThanOrEqual(results[i].reputationScore);
      }
    });

    it('supports pagination with limit and offset', () => {
      const page1 = marketplace.search({ limit: 2, offset: 0 });
      const page2 = marketplace.search({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      // Pages should not overlap
      const ids1 = new Set(page1.map(r => `${r.method}:${r.seller.id}`));
      const ids2 = new Set(page2.map(r => `${r.method}:${r.seller.id}`));
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false);
      }
    });
  });

  /* ── Bundle management ──────────────────────────────── */

  describe('Bundle management', () => {
    it('registers and retrieves a bundle', () => {
      const bundle: ToolBundle = {
        id: 'defi-pack',
        name: 'DeFi Pack',
        description: '3 DeFi tools',
        methods: ['getBalance', 'getTokenAccountBalance', 'getTokenSupply'],
        seller: seller1,
        tiers: [makeTier()],
        createdAt: Date.now(),
      };

      marketplace.registerBundle(bundle);
      const retrieved = marketplace.getBundle('defi-pack');
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('DeFi Pack');
    });

    it('lists bundles by seller', () => {
      marketplace.registerBundle({
        id: 'b1', name: 'B1', description: '', methods: ['getBalance'],
        seller: seller1, tiers: [makeTier()], createdAt: Date.now(),
      });
      marketplace.registerBundle({
        id: 'b2', name: 'B2', description: '', methods: ['getSlot'],
        seller: seller2, tiers: [makeTier()], createdAt: Date.now(),
      });

      const seller1Bundles = marketplace.listBundles(seller1.id);
      expect(seller1Bundles.length).toBe(1);
      expect(seller1Bundles[0].id).toBe('b1');

      const allBundles = marketplace.listBundles();
      expect(allBundles.length).toBe(2);
    });
  });

  /* ── Reputation ─────────────────────────────────────── */

  describe('Reputation', () => {
    it('records attestation for reputation scoring', () => {
      marketplace.listTool(makeListing('getBalance', seller1));

      marketplace.reportAttestation(seller1.id, true, 50);
      marketplace.reportAttestation(seller1.id, true, 60);
      marketplace.reportAttestation(seller1.id, false, 100); // One failed

      const rep = marketplace.getReputation(seller1.id);
      expect(rep).toBeDefined();
      expect(rep!.totalCalls).toBe(3);
      expect(rep!.verificationRate).toBeCloseTo(2 / 3, 1);
    });

    it('returns null for unknown seller', () => {
      const rep = marketplace.getReputation(createAgentId('unknown'));
      expect(rep).toBeNull();
    });

    it('updates listing reputation scores after attestation reports', () => {
      marketplace.listTool(makeListing('getBalance', seller1, { reputationScore: 500 }));

      for (let i = 0; i < 50; i++) {
        marketplace.reportAttestation(seller1.id, true, 30);
      }

      const results = marketplace.search({ method: 'getBalance' });
      // Reputation should have been recalculated
      expect(results[0].reputationScore).not.toBe(500);
    });
  });

  /* ── Stats ──────────────────────────────────────────── */

  describe('Stats', () => {
    it('returns marketplace stats', () => {
      marketplace.listTools([
        makeListing('getBalance', seller1),
        makeListing('getSlot', seller1),
        makeListing('getVersion', seller2),
      ]);

      const stats = marketplace.getStats();
      expect(stats.totalListings).toBe(3);
      expect(stats.totalSellers).toBe(2);
    });
  });
});
