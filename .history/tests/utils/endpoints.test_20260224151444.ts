/**
 * Tests for the refactored Endpoint module (src/utils/synapse.ts)
 * and SynapseClient.fromEndpoint() factory.
 *
 * Verifies:
 * - Enums (SynapseNetwork, SynapseRegion)
 * - Endpoint registry (resolve, list, pre-resolved constants)
 * - toClientConfig conversion
 * - probeLatency / autoSelectRegion (mocked)
 * - Legacy SYNAPSE_ENDPOINTS compat
 * - SynapseClient.fromEndpoint() integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  SynapseNetwork,
  SynapseRegion,
  resolveEndpoint,
  listEndpoints,
  listRegions,
  listNetworks,
  toClientConfig,
  probeLatency,
  autoSelectRegion,
  SYNAPSE_MAINNET_US,
  SYNAPSE_MAINNET_EU,
  SYNAPSE_DEVNET_US,
  SYNAPSE_DEVNET_EU,
  SYNAPSE_ENDPOINTS,
  type SynapseEndpoint,
} from '../../src/utils/synapse';

/* ═══════════════════════════════════════════════════════════════
 *  1. Enums
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseNetwork enum', () => {
  it('has exactly three values', () => {
    expect(SynapseNetwork.Mainnet).toBe('mainnet');
    expect(SynapseNetwork.Devnet).toBe('devnet');
    expect(SynapseNetwork.Testnet).toBe('testnet');
    expect(Object.values(SynapseNetwork)).toHaveLength(3);
  });
});

describe('SynapseRegion enum', () => {
  it('has exactly two values', () => {
    expect(SynapseRegion.US).toBe('US');
    expect(SynapseRegion.EU).toBe('EU');
    expect(Object.values(SynapseRegion)).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. resolveEndpoint()
 * ═══════════════════════════════════════════════════════════════ */

describe('resolveEndpoint', () => {
  it('resolves mainnet:us', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
    expect(ep.network).toBe('mainnet');
    expect(ep.region).toBe('US');
    expect(ep.rpc).toContain('us-1-mainnet');
    expect(ep.wss).toMatch(/^wss:\/\//);
    expect(ep.grpc).toMatch(/^https?:\/\//);
  });

  it('resolves mainnet:eu', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);
    expect(ep.network).toBe('mainnet');
    expect(ep.region).toBe('EU');
    expect(ep.rpc).toContain('staging');
  });

  it('resolves devnet:us', () => {
    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.US);
    expect(ep.network).toBe('devnet');
    expect(ep.rpc).toMatch(/^https:\/\//);
  });

  it('resolves devnet:eu', () => {
    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.EU);
    expect(ep.network).toBe('devnet');
    expect(ep.region).toBe('EU');
  });

  it('resolves testnet:us', () => {
    const ep = resolveEndpoint(SynapseNetwork.Testnet, SynapseRegion.US);
    expect(ep.network).toBe('testnet');
    expect(ep.rpc).toMatch(/^https:\/\//);
  });

  it('resolves testnet:eu', () => {
    const ep = resolveEndpoint(SynapseNetwork.Testnet, SynapseRegion.EU);
    expect(ep.network).toBe('testnet');
    expect(ep.region).toBe('EU');
  });

  it('throws for invalid network', () => {
    expect(() =>
      resolveEndpoint('fantasy' as any, SynapseRegion.US),
    ).toThrow();
  });

  it('throws for invalid region', () => {
    expect(() =>
      resolveEndpoint(SynapseNetwork.Mainnet, 'moon' as any),
    ).toThrow();
  });

  it('returned endpoint is frozen (immutable)', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
    expect(Object.isFrozen(ep)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. Endpoint shape (all valid entries)
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseEndpoint shape', () => {
  const networks = [SynapseNetwork.Mainnet, SynapseNetwork.Devnet, SynapseNetwork.Testnet];
  const regions = [SynapseRegion.US, SynapseRegion.EU];

  for (const n of networks) {
    for (const r of regions) {
      it(`${n}:${r} has all required string fields`, () => {
        const ep = resolveEndpoint(n, r);
        expect(typeof ep.rpc).toBe('string');
        expect(typeof ep.wss).toBe('string');
        expect(typeof ep.grpc).toBe('string');
        expect(ep.rpc.startsWith('https://')).toBe(true);
        expect(ep.wss.startsWith('wss://')).toBe(true);
      });
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
 *  4. listEndpoints / listRegions / listNetworks
 * ═══════════════════════════════════════════════════════════════ */

describe('listEndpoints', () => {
  it('lists all 6 endpoints when no filter', () => {
    const all = listEndpoints();
    expect(all).toHaveLength(6);
  });

  it('filters by network', () => {
    const mainnet = listEndpoints(SynapseNetwork.Mainnet);
    expect(mainnet).toHaveLength(2);
    for (const ep of mainnet) {
      expect(ep.network).toBe('mainnet');
    }
  });

  it('each endpoint is unique', () => {
    const all = listEndpoints();
    const keys = all.map((ep) => `${ep.network}:${ep.region}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('listRegions', () => {
  it('returns US and EU for mainnet', () => {
    const regions = listRegions(SynapseNetwork.Mainnet);
    expect(regions).toContain(SynapseRegion.US);
    expect(regions).toContain(SynapseRegion.EU);
    expect(regions).toHaveLength(2);
  });

  it('returns regions for devnet', () => {
    const regions = listRegions(SynapseNetwork.Devnet);
    expect(regions).toHaveLength(2);
  });
});

describe('listNetworks', () => {
  it('returns exactly 3 networks', () => {
    const networks = listNetworks();
    expect(networks).toHaveLength(3);
    expect(networks).toContain(SynapseNetwork.Mainnet);
    expect(networks).toContain(SynapseNetwork.Devnet);
    expect(networks).toContain(SynapseNetwork.Testnet);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. toClientConfig()
 * ═══════════════════════════════════════════════════════════════ */

describe('toClientConfig', () => {
  it('maps endpoint fields to client config', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
    const config = toClientConfig(ep);

    expect(config.endpoint).toBe(ep.rpc);
    expect(config.wsEndpoint).toBe(ep.wss);
    expect(config.grpcEndpoint).toBe(ep.grpc);
  });

  it('merges extra options', () => {
    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.EU);
    const config = toClientConfig(ep, { timeout: 5000 });
    expect(config.timeout).toBe(5000);
    expect(config.endpoint).toBe(ep.rpc);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. Pre-resolved constants
 * ═══════════════════════════════════════════════════════════════ */

describe('Pre-resolved constants', () => {
  it('SYNAPSE_MAINNET_US matches resolveEndpoint', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
    expect(SYNAPSE_MAINNET_US).toEqual(ep);
  });

  it('SYNAPSE_MAINNET_EU matches resolveEndpoint', () => {
    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);
    expect(SYNAPSE_MAINNET_EU).toEqual(ep);
  });

  it('SYNAPSE_DEVNET_US matches resolveEndpoint', () => {
    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.US);
    expect(SYNAPSE_DEVNET_US).toEqual(ep);
  });

  it('SYNAPSE_DEVNET_EU matches resolveEndpoint', () => {
    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.EU);
    expect(SYNAPSE_DEVNET_EU).toEqual(ep);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. Legacy SYNAPSE_ENDPOINTS
 * ═══════════════════════════════════════════════════════════════ */

describe('Legacy SYNAPSE_ENDPOINTS', () => {
  it('is defined', () => {
    expect(SYNAPSE_ENDPOINTS).toBeDefined();
  });

  it('has US and EU entries', () => {
    expect(SYNAPSE_ENDPOINTS.US).toBeDefined();
    expect(SYNAPSE_ENDPOINTS.EU).toBeDefined();
  });

  it('US endpoint has rpc, wss, and grpc fields', () => {
    const m = SYNAPSE_ENDPOINTS.US;
    expect(typeof m.rpc).toBe('string');
    expect(typeof m.wss).toBe('string');
    expect(typeof m.grpc).toBe('string');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. probeLatency (mocked global fetch)
 * ═══════════════════════════════════════════════════════════════ */

describe('probeLatency', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  it('returns latency on healthy endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    }) as any;

    const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
    const result = await probeLatency(ep, 5000);

    expect(result.endpoint).toBe(ep);
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.healthy).toBe(true);
    expect(result.error).toBeUndefined();

    globalThis.fetch = originalFetch;
  });

  it('returns error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down')) as any;

    const ep = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.EU);
    const result = await probeLatency(ep);

    expect(result.healthy).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    globalThis.fetch = originalFetch;
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. autoSelectRegion (mocked)
 * ═══════════════════════════════════════════════════════════════ */

describe('autoSelectRegion', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  it('returns sorted regions by latency', async () => {
    // Make US faster than EU
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      // Simulate US being faster
      if (typeof url === 'string' && url.includes('us-1')) {
        await new Promise((r) => setTimeout(r, 10));
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
      return { ok: true, json: () => Promise.resolve({ result: 'ok' }) };
    }) as any;

    const results = await autoSelectRegion(SynapseNetwork.Mainnet);

    expect(results).toHaveLength(2);
    // Results are sorted by latency
    expect(results[0].latencyMs).toBeLessThanOrEqual(results[1].latencyMs);
    // Both should be healthy
    expect(results[0].healthy).toBe(true);
    expect(results[1].healthy).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it('handles partial failure (one region down)', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('us-1')) {
        return { ok: true, json: () => Promise.resolve({ result: 'ok' }) };
      }
      throw new Error('EU down');
    }) as any;

    const results = await autoSelectRegion(SynapseNetwork.Mainnet);

    expect(results).toHaveLength(2);
    // At least one should be healthy
    const healthy = results.filter((r) => r.healthy);
    expect(healthy.length).toBeGreaterThanOrEqual(1);
    // Healthy one should sort first
    expect(results[0].healthy).toBe(true);

    globalThis.fetch = originalFetch;
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  10. SynapseClient.fromEndpoint() integration
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseClient.fromEndpoint', () => {
  // Lazy import to match how it's actually used
  it('is a static method on SynapseClient', async () => {
    const { SynapseClient } = await import('../../src/core/client');
    expect(typeof SynapseClient.fromEndpoint).toBe('function');
  });

  it('creates a client from network + region', async () => {
    const { SynapseClient } = await import('../../src/core/client');

    const client = SynapseClient.fromEndpoint({
      network: SynapseNetwork.Mainnet,
      region: SynapseRegion.US,
    });

    expect(client).toBeInstanceOf(SynapseClient);
  });

  it('creates a client from devnet:eu', async () => {
    const { SynapseClient } = await import('../../src/core/client');

    const client = SynapseClient.fromEndpoint({
      network: SynapseNetwork.Devnet,
      region: SynapseRegion.EU,
    });

    expect(client).toBeInstanceOf(SynapseClient);
  });

  it('throws for invalid network/region combo', async () => {
    const { SynapseClient } = await import('../../src/core/client');

    expect(() =>
      SynapseClient.fromEndpoint({
        network: 'invalid' as any,
        region: SynapseRegion.US,
      }),
    ).toThrow();
  });
});
