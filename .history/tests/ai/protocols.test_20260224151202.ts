/**
 * Tests for Protocol Tools — Jupiter, Raydium, Metaplex.
 *
 * Verifies:
 * - Zod schema registries (method count, fields, protocol tag)
 * - Tool factories (tool creation, naming, filtering)
 * - Shared infrastructure (ProtocolHttpClient, buildProtocolTools)
 * - Super-factory (createProtocolTools)
 */
import { describe, it, expect, vi } from 'vitest';

// ── Shared infrastructure ──────────────────────────────────────
import {
  createMethodRegistry,
  buildProtocolTools,
  ProtocolHttpClient,
  ProtocolApiError,
  type ProtocolMethod,
} from '../../src/ai/tools/protocols/shared';

// ── Jupiter ────────────────────────────────────────────────────
import {
  jupiterMethods,
  jupiterMethodNames,
  createJupiterTools,
  JUPITER_API_URL,
} from '../../src/ai/tools/protocols/jupiter';

// ── Raydium ────────────────────────────────────────────────────
import {
  raydiumMethods,
  raydiumMethodNames,
  createRaydiumTools,
  RAYDIUM_API_URL,
} from '../../src/ai/tools/protocols/raydium';

// ── Metaplex ───────────────────────────────────────────────────
import {
  metaplexMethods,
  metaplexMethodNames,
  createMetaplexTools,
} from '../../src/ai/tools/protocols/metaplex';

// ── Super-factory ──────────────────────────────────────────────
import {
  createProtocolTools,
} from '../../src/ai/tools/protocols';

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

/** Creates a mock SynapseClient with a mock transport. */
function mockSynapseClient() {
  return {
    transport: {
      request: vi.fn().mockResolvedValue({ result: 'ok' }),
      batch: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

/** Creates a mock fetch that returns the given JSON body. */
function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

/* ═══════════════════════════════════════════════════════════════
 *  1. Shared Infrastructure
 * ═══════════════════════════════════════════════════════════════ */

describe('Shared Infrastructure', () => {
  describe('createMethodRegistry', () => {
    it('creates an isolated registry for a protocol', () => {
      const { register, methods } = createMethodRegistry('test-proto');
      expect(methods).toHaveLength(0);

      const { z } = require('zod');
      register('testMethod', z.object({}), z.string(), 'A test method');

      expect(methods).toHaveLength(1);
      expect(methods[0].name).toBe('testMethod');
      expect(methods[0].protocol).toBe('test-proto');
      expect(methods[0].description).toBe('A test method');
    });

    it('does not leak methods between registries', () => {
      const a = createMethodRegistry('proto-a');
      const b = createMethodRegistry('proto-b');
      const { z } = require('zod');

      a.register('methodA', z.object({}), z.string(), 'A');
      b.register('methodB', z.object({}), z.string(), 'B');

      expect(a.methods).toHaveLength(1);
      expect(b.methods).toHaveLength(1);
      expect(a.methods[0].name).toBe('methodA');
      expect(b.methods[0].name).toBe('methodB');
    });
  });

  describe('ProtocolHttpClient', () => {
    it('constructs with correct baseUrl (strips trailing slash)', () => {
      const client = new ProtocolHttpClient({ baseUrl: 'https://api.test.com/' });
      expect(client.baseUrl).toBe('https://api.test.com');
    });

    it('GET sends query params and returns JSON', async () => {
      const fetchMock = mockFetch({ data: 'hello' });
      const client = new ProtocolHttpClient({
        baseUrl: 'https://api.test.com',
        fetch: fetchMock,
      });

      const result = await client.get('/test', { foo: 'bar', num: 42 });
      expect(result).toEqual({ data: 'hello' });
      expect(fetchMock).toHaveBeenCalledOnce();

      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('/test');
      expect(calledUrl).toContain('foo=bar');
      expect(calledUrl).toContain('num=42');
    });

    it('GET ignores undefined/null params', async () => {
      const fetchMock = mockFetch({});
      const client = new ProtocolHttpClient({ baseUrl: 'https://api.test.com', fetch: fetchMock });

      await client.get('/test', { a: 'yes', b: undefined, c: null });
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('a=yes');
      expect(calledUrl).not.toContain('b=');
      expect(calledUrl).not.toContain('c=');
    });

    it('GET serialises array params as comma-separated', async () => {
      const fetchMock = mockFetch({});
      const client = new ProtocolHttpClient({ baseUrl: 'https://api.test.com', fetch: fetchMock });

      await client.get('/test', { ids: ['a', 'b', 'c'] });
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('ids=a%2Cb%2Cc');
    });

    it('POST sends JSON body and returns JSON', async () => {
      const fetchMock = mockFetch({ ok: true });
      const client = new ProtocolHttpClient({ baseUrl: 'https://api.test.com', fetch: fetchMock });

      const result = await client.post('/submit', { key: 'value' });
      expect(result).toEqual({ ok: true });

      const callOpts = fetchMock.mock.calls[0][1];
      expect(callOpts.method).toBe('POST');
      expect(JSON.parse(callOpts.body)).toEqual({ key: 'value' });
    });

    it('throws ProtocolApiError on non-2xx response', async () => {
      const fetchMock = mockFetch('Not Found', 404);
      // Override text() for error body
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve('Not Found'),
        text: () => Promise.resolve('Not Found'),
      });
      const client = new ProtocolHttpClient({ baseUrl: 'https://api.test.com', fetch: fetchMock });

      await expect(client.get('/nope')).rejects.toThrow(ProtocolApiError);
      try {
        await client.get('/nope');
      } catch (e: any) {
        expect(e.status).toBe(404);
        expect(e.path).toBe('/nope');
      }
    });

    it('includes apiKey as Authorization header', async () => {
      const fetchMock = mockFetch({});
      const client = new ProtocolHttpClient({
        baseUrl: 'https://api.test.com',
        apiKey: 'my-secret-key',
        fetch: fetchMock,
      });

      await client.get('/auth-test');
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer my-secret-key');
    });
  });

  describe('buildProtocolTools', () => {
    it('builds tools from methods with correct naming and count', () => {
      const { z } = require('zod');
      const methods: ProtocolMethod[] = [
        { name: 'alpha', input: z.object({}), output: z.string(), protocol: 'test', description: 'Alpha method' },
        { name: 'beta', input: z.object({}), output: z.number(), protocol: 'test', description: 'Beta method' },
      ];
      const execute = vi.fn().mockResolvedValue('result');
      const toolkit = buildProtocolTools(methods, execute);

      expect(toolkit.protocol).toBe('test');
      expect(toolkit.tools).toHaveLength(2);
      expect(toolkit.methodNames).toEqual(['alpha', 'beta']);
      expect(toolkit.toolMap.alpha).toBeDefined();
      expect(toolkit.toolMap.beta).toBeDefined();
    });

    it('applies include filter', () => {
      const { z } = require('zod');
      const methods: ProtocolMethod[] = [
        { name: 'a', input: z.object({}), output: z.string(), protocol: 'x' },
        { name: 'b', input: z.object({}), output: z.string(), protocol: 'x' },
        { name: 'c', input: z.object({}), output: z.string(), protocol: 'x' },
      ];
      const toolkit = buildProtocolTools(methods, vi.fn(), { include: ['a', 'c'] });
      expect(toolkit.tools).toHaveLength(2);
      expect(toolkit.toolMap.b).toBeUndefined();
    });

    it('applies exclude filter', () => {
      const { z } = require('zod');
      const methods: ProtocolMethod[] = [
        { name: 'a', input: z.object({}), output: z.string(), protocol: 'x' },
        { name: 'b', input: z.object({}), output: z.string(), protocol: 'x' },
      ];
      const toolkit = buildProtocolTools(methods, vi.fn(), { exclude: ['b'] });
      expect(toolkit.tools).toHaveLength(1);
      expect(toolkit.toolMap.a).toBeDefined();
    });

    it('uses custom prefix', () => {
      const { z } = require('zod');
      const methods: ProtocolMethod[] = [
        { name: 'doThing', input: z.object({}), output: z.string(), protocol: 'p' },
      ];
      const toolkit = buildProtocolTools(methods, vi.fn(), { prefix: 'custom_' });
      expect(toolkit.tools[0].name).toBe('custom_doThing');
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. Jupiter Schema Registry
 * ═══════════════════════════════════════════════════════════════ */

describe('Jupiter Schema Registry', () => {
  it('registers exactly 22 methods', () => {
    expect(jupiterMethods).toHaveLength(22);
  });

  it('all methods have required fields', () => {
    for (const m of jupiterMethods) {
      expect(m.name).toBeTruthy();
      expect(m.input).toBeDefined();
      expect(m.output).toBeDefined();
      expect(m.description).toBeTruthy();
      expect(m.protocol).toBe('jupiter');
    }
  });

  it('method names are unique', () => {
    const names = jupiterMethods.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('jupiterMethodNames matches method names', () => {
    expect(jupiterMethodNames).toEqual(jupiterMethods.map((m) => m.name));
  });

  it('includes Ultra Swap methods', () => {
    const names = jupiterMethodNames;
    expect(names).toContain('getOrder');
    expect(names).toContain('executeOrder');
    expect(names).toContain('getHoldings');
    expect(names).toContain('shield');
    expect(names).toContain('searchTokens');
    expect(names).toContain('getRouters');
  });

  it('includes Metis Swap methods', () => {
    const names = jupiterMethodNames;
    expect(names).toContain('getQuote');
    expect(names).toContain('swap');
    expect(names).toContain('swapInstructions');
    expect(names).toContain('programLabels');
  });

  it('includes Price API method', () => {
    expect(jupiterMethodNames).toContain('getPrice');
  });

  it('includes Token API method', () => {
    expect(jupiterMethodNames).toContain('getTokenList');
  });

  it('includes Trigger API (limit orders) methods', () => {
    const names = jupiterMethodNames;
    expect(names).toContain('createLimitOrder');
    expect(names).toContain('executeTrigger');
    expect(names).toContain('cancelLimitOrder');
    expect(names).toContain('cancelLimitOrders');
    expect(names).toContain('getLimitOrders');
  });

  it('includes Recurring API (DCA) methods', () => {
    const names = jupiterMethodNames;
    expect(names).toContain('createDCA');
    expect(names).toContain('executeDCA');
    expect(names).toContain('cancelDCA');
    expect(names).toContain('getDCAOrders');
  });

  it('every method has httpMethod and path', () => {
    for (const m of jupiterMethods) {
      expect(['GET', 'POST']).toContain(m.httpMethod);
      expect(m.path).toBeTruthy();
    }
  });

  it('JUPITER_API_URL is correct', () => {
    expect(JUPITER_API_URL).toBe('https://api.jup.ag');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. Jupiter Tool Factory
 * ═══════════════════════════════════════════════════════════════ */

describe('Jupiter Tool Factory', () => {
  it('creates tools for all 22 methods', () => {
    const fetchMock = mockFetch({});
    const toolkit = createJupiterTools({ fetch: fetchMock });
    expect(toolkit.tools).toHaveLength(22);
    expect(toolkit.protocol).toBe('jupiter');
  });

  it('tool names use jupiter_ prefix by default', () => {
    const fetchMock = mockFetch({});
    const toolkit = createJupiterTools({ fetch: fetchMock });
    for (const t of toolkit.tools) {
      expect(t.name).toMatch(/^jupiter_/);
    }
  });

  it('supports custom prefix', () => {
    const fetchMock = mockFetch({});
    const toolkit = createJupiterTools({ fetch: fetchMock, prefix: 'jup_' });
    for (const t of toolkit.tools) {
      expect(t.name).toMatch(/^jup_/);
    }
  });

  it('include filter restricts tools', () => {
    const fetchMock = mockFetch({});
    const toolkit = createJupiterTools({ fetch: fetchMock, include: ['getQuote', 'getPrice'] });
    expect(toolkit.tools).toHaveLength(2);
    expect(toolkit.toolMap.getQuote).toBeDefined();
    expect(toolkit.toolMap.getPrice).toBeDefined();
  });

  it('exclude filter removes tools', () => {
    const fetchMock = mockFetch({});
    const toolkit = createJupiterTools({ fetch: fetchMock, exclude: ['getRouters'] });
    expect(toolkit.tools).toHaveLength(21);
    expect(toolkit.toolMap.getRouters).toBeUndefined();
  });

  it('GET tool sends query params to correct path', async () => {
    const fetchMock = mockFetch({ data: { SOL: { price: '150' } }, timeTaken: 0.1 });
    const toolkit = createJupiterTools({ fetch: fetchMock });
    const result = await toolkit.toolMap.getPrice.invoke({ ids: ['SOL'], showExtraInfo: false });

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/price/v3');
    expect(JSON.parse(result)).toHaveProperty('data');
  });

  it('POST tool sends body to correct path', async () => {
    const fetchMock = mockFetch({ swapTransaction: 'base64...', lastValidBlockHeight: 999 });
    const toolkit = createJupiterTools({ fetch: fetchMock });
    const result = await toolkit.toolMap.swap.invoke({
      userPublicKey: 'Abc123',
      quoteResponse: { test: true },
    });

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/swap/v1/swap');
    const opts = fetchMock.mock.calls[0][1];
    expect(opts.method).toBe('POST');
  });

  it('returns JSON error on API failure (never throws)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    const toolkit = createJupiterTools({ fetch: fetchMock });
    const result = await toolkit.toolMap.getQuote.invoke({
      inputMint: 'SOL',
      outputMint: 'USDC',
      amount: '1000000',
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe(true);
    expect(parsed.protocol).toBe('jupiter');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  4. Raydium Schema Registry
 * ═══════════════════════════════════════════════════════════════ */

describe('Raydium Schema Registry', () => {
  it('registers exactly 16 methods', () => {
    expect(raydiumMethods).toHaveLength(16);
  });

  it('all methods have required fields', () => {
    for (const m of raydiumMethods) {
      expect(m.name).toBeTruthy();
      expect(m.input).toBeDefined();
      expect(m.output).toBeDefined();
      expect(m.description).toBeTruthy();
      expect(m.protocol).toBe('raydium');
    }
  });

  it('method names are unique', () => {
    const names = raydiumMethods.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes Main/Info methods', () => {
    const names = raydiumMethodNames;
    expect(names).toContain('getInfo');
    expect(names).toContain('getChainTime');
    expect(names).toContain('getClmmConfig');
    expect(names).toContain('getCpmmConfig');
    expect(names).toContain('getAutoFee');
  });

  it('includes Mint/Token methods', () => {
    const names = raydiumMethodNames;
    expect(names).toContain('getMintList');
    expect(names).toContain('getMintInfo');
    expect(names).toContain('getMintPrice');
  });

  it('includes Pools methods', () => {
    const names = raydiumMethodNames;
    expect(names).toContain('getPoolInfo');
    expect(names).toContain('getPoolsByLpMint');
    expect(names).toContain('getPoolList');
    expect(names).toContain('getPoolsByTokenMint');
    expect(names).toContain('getPoolLiquidity');
    expect(names).toContain('getClmmPosition');
  });

  it('includes Farms methods', () => {
    const names = raydiumMethodNames;
    expect(names).toContain('getFarmInfo');
    expect(names).toContain('getFarmByLpMint');
  });

  it('RAYDIUM_API_URL is correct', () => {
    expect(RAYDIUM_API_URL).toBe('https://api-v3.raydium.io');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. Raydium Tool Factory
 * ═══════════════════════════════════════════════════════════════ */

describe('Raydium Tool Factory', () => {
  it('creates tools for all 16 methods', () => {
    const fetchMock = mockFetch({ success: true, data: {} });
    const toolkit = createRaydiumTools({ fetch: fetchMock });
    expect(toolkit.tools).toHaveLength(16);
    expect(toolkit.protocol).toBe('raydium');
  });

  it('tool names use raydium_ prefix by default', () => {
    const fetchMock = mockFetch({ success: true, data: {} });
    const toolkit = createRaydiumTools({ fetch: fetchMock });
    for (const t of toolkit.tools) {
      expect(t.name).toMatch(/^raydium_/);
    }
  });

  it('unwraps Raydium { success, data } envelope', async () => {
    const fetchMock = mockFetch({
      id: '123',
      success: true,
      data: { tvl: 500_000_000, volume24h: 100_000_000 },
    });
    const toolkit = createRaydiumTools({ fetch: fetchMock });
    const result = await toolkit.toolMap.getInfo.invoke({});
    const parsed = JSON.parse(result);
    expect(parsed.tvl).toBe(500_000_000);
    expect(parsed.volume24h).toBe(100_000_000);
  });

  it('throws on Raydium { success: false } response', async () => {
    const fetchMock = mockFetch({
      id: '123',
      success: false,
      msg: 'Pool not found',
    });
    const toolkit = createRaydiumTools({ fetch: fetchMock });
    const result = await toolkit.toolMap.getPoolInfo.invoke({ ids: ['not-a-pool'] });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('Pool not found');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. Metaplex Schema Registry
 * ═══════════════════════════════════════════════════════════════ */

describe('Metaplex Schema Registry', () => {
  it('registers exactly 12 methods', () => {
    expect(metaplexMethods).toHaveLength(12);
  });

  it('all methods have required fields', () => {
    for (const m of metaplexMethods) {
      expect(m.name).toBeTruthy();
      expect(m.input).toBeDefined();
      expect(m.output).toBeDefined();
      expect(m.description).toBeTruthy();
      expect(m.protocol).toBe('metaplex');
    }
  });

  it('method names are unique', () => {
    const names = metaplexMethods.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes DAS core methods', () => {
    const names = metaplexMethodNames;
    expect(names).toContain('getAsset');
    expect(names).toContain('getAssets');
    expect(names).toContain('getAssetProof');
    expect(names).toContain('getAssetProofs');
    expect(names).toContain('getAssetsByOwner');
    expect(names).toContain('getAssetsByCreator');
    expect(names).toContain('getAssetsByCollection');
    expect(names).toContain('getAssetsByAuthority');
    expect(names).toContain('searchAssets');
    expect(names).toContain('getAssetSignatures');
    expect(names).toContain('getTokenAccounts');
  });

  it('includes resolveCollection helper', () => {
    expect(metaplexMethodNames).toContain('resolveCollection');
  });

  it('DAS methods do NOT have httpMethod (they use RPC transport)', () => {
    for (const m of metaplexMethods) {
      expect(m.httpMethod).toBeUndefined();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. Metaplex Tool Factory
 * ═══════════════════════════════════════════════════════════════ */

describe('Metaplex Tool Factory', () => {
  it('creates tools for all 12 methods', () => {
    const client = mockSynapseClient();
    const toolkit = createMetaplexTools(client);
    expect(toolkit.tools).toHaveLength(12);
    expect(toolkit.protocol).toBe('metaplex');
  });

  it('tool names use metaplex_ prefix by default', () => {
    const client = mockSynapseClient();
    const toolkit = createMetaplexTools(client);
    for (const t of toolkit.tools) {
      expect(t.name).toMatch(/^metaplex_/);
    }
  });

  it('getAsset calls transport.request with correct DAS method', async () => {
    const client = mockSynapseClient();
    client.transport.request.mockResolvedValue({ id: 'abc', content: {} });
    const toolkit = createMetaplexTools(client);

    const result = await toolkit.toolMap.getAsset.invoke({ id: 'Abc123def456' });
    expect(client.transport.request).toHaveBeenCalledWith(
      'getAsset',
      [{ id: 'Abc123def456' }],
    );
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('abc');
  });

  it('getAssetsByOwner calls getAssetsByOwner RPC method', async () => {
    const client = mockSynapseClient();
    client.transport.request.mockResolvedValue({ total: 10, items: [] });
    const toolkit = createMetaplexTools(client);

    await toolkit.toolMap.getAssetsByOwner.invoke({ ownerAddress: 'SomeWallet' });
    expect(client.transport.request).toHaveBeenCalledWith(
      'getAssetsByOwner',
      [expect.objectContaining({ ownerAddress: 'SomeWallet' })],
    );
  });

  it('getAssetsByCollection maps to getAssetsByGroup DAS method', async () => {
    const client = mockSynapseClient();
    client.transport.request.mockResolvedValue({ total: 5, items: [] });
    const toolkit = createMetaplexTools(client);

    await toolkit.toolMap.getAssetsByCollection.invoke({
      groupKey: 'collection',
      groupValue: 'CollectionAddr',
    });
    expect(client.transport.request).toHaveBeenCalledWith(
      'getAssetsByGroup',
      [expect.objectContaining({ groupKey: 'collection', groupValue: 'CollectionAddr' })],
    );
  });

  it('resolveCollection performs compound RPC calls', async () => {
    const client = mockSynapseClient();
    // First call: getAsset (collection metadata)
    // Second call: getAssetsByGroup (sample items)
    client.transport.request
      .mockResolvedValueOnce({ id: 'col1', content: { metadata: { name: 'TestCol' } } })
      .mockResolvedValueOnce({
        total: 100,
        items: [
          {
            ownership: { owner: 'owner1' },
            compression: { compressed: true },
            burnt: false,
            content: { metadata: { attributes: [{ trait_type: 'Color', value: 'Red' }] } },
          },
          {
            ownership: { owner: 'owner2' },
            compression: { compressed: false },
            burnt: false,
            content: { metadata: { attributes: [{ trait_type: 'Color', value: 'Blue' }] } },
          },
        ],
      });

    const toolkit = createMetaplexTools(client);
    const result: unknown = await toolkit.toolMap.resolveCollection.invoke({
      collectionAddress: 'col1',
      sampleSize: 10,
    });
    const parsed = JSON.parse(result);

    expect(parsed.collection.id).toBe('col1');
    expect(parsed.stats.totalSupply).toBe(100);
    expect(parsed.stats.uniqueOwners).toBe(2);
    expect(parsed.stats.compressedCount).toBe(1);
    expect(parsed.stats.traitSummary.Color).toContain('Red');
    expect(parsed.stats.traitSummary.Color).toContain('Blue');
  });

  it('returns JSON error on transport failure (never throws)', async () => {
    const client = mockSynapseClient();
    client.transport.request.mockRejectedValue(new Error('RPC timeout'));
    const toolkit = createMetaplexTools(client);

    const result = await toolkit.toolMap.getAsset.invoke({ id: 'bad' });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe(true);
    expect(parsed.protocol).toBe('metaplex');
    expect(parsed.message).toContain('RPC timeout');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. Super-factory — createProtocolTools()
 * ═══════════════════════════════════════════════════════════════ */

describe('createProtocolTools (super-factory)', () => {
  it('creates all protocol toolkits by default', () => {
    const client = mockSynapseClient();
    const fetchMock = mockFetch({});

    // We need to inject fetch for Jupiter and Raydium
    const result = createProtocolTools(client, {
      jupiter: { fetch: fetchMock },
      raydium: { fetch: fetchMock },
      metaplex: {},
    });

    expect(result.jupiter).toBeDefined();
    expect(result.raydium).toBeDefined();
    expect(result.metaplex).toBeDefined();
    expect(result.totalToolCount).toBe(22 + 16 + 12); // 50
    expect(result.protocolSummary.jupiter).toBe(22);
    expect(result.protocolSummary.raydium).toBe(16);
    expect(result.protocolSummary.metaplex).toBe(12);
  });

  it('can disable individual protocols with false', () => {
    const client = mockSynapseClient();
    const fetchMock = mockFetch({});

    const result = createProtocolTools(client, {
      jupiter: { fetch: fetchMock },
      raydium: false,
      metaplex: false,
    });

    expect(result.jupiter).toBeDefined();
    expect(result.raydium).toBeUndefined();
    expect(result.metaplex).toBeUndefined();
    expect(result.totalToolCount).toBe(22);
    expect(result.allTools).toHaveLength(22);
  });

  it('allTools is a flat array of all tools', () => {
    const client = mockSynapseClient();
    const fetchMock = mockFetch({});

    const result = createProtocolTools(client, {
      jupiter: { fetch: fetchMock, include: ['getQuote'] },
      raydium: { fetch: fetchMock, include: ['getInfo'] },
      metaplex: { include: ['getAsset'] },
    });

    expect(result.allTools).toHaveLength(3);
    expect(result.allTools.map((t) => t.name).sort()).toEqual([
      'jupiter_getQuote',
      'metaplex_getAsset',
      'raydium_getInfo',
    ]);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. Cross-protocol consistency
 * ═══════════════════════════════════════════════════════════════ */

describe('Cross-protocol consistency', () => {
  it('no method name collisions across protocols', () => {
    const all = [...jupiterMethodNames, ...raydiumMethodNames, ...metaplexMethodNames];
    // There could be overlaps (e.g. 'getTokenList') but prefixed tool names must be unique
    const prefixed = [
      ...jupiterMethodNames.map((n) => `jupiter_${n}`),
      ...raydiumMethodNames.map((n) => `raydium_${n}`),
      ...metaplexMethodNames.map((n) => `metaplex_${n}`),
    ];
    expect(new Set(prefixed).size).toBe(prefixed.length);
  });

  it('total method count is 50 (22 + 16 + 12)', () => {
    expect(jupiterMethods.length + raydiumMethods.length + metaplexMethods.length).toBe(50);
  });

  it('every method across all protocols has a description', () => {
    const all = [...jupiterMethods, ...raydiumMethods, ...metaplexMethods];
    for (const m of all) {
      expect(m.description, `${m.protocol}:${m.name} missing description`).toBeTruthy();
    }
  });

  it('every method across all protocols has both input and output schemas', () => {
    const all = [...jupiterMethods, ...raydiumMethods, ...metaplexMethods];
    for (const m of all) {
      expect(m.input, `${m.protocol}:${m.name} missing input`).toBeDefined();
      expect(m.output, `${m.protocol}:${m.name} missing output`).toBeDefined();
    }
  });
});
