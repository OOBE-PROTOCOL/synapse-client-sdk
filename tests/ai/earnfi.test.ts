/**
 * Tests for EarnFi Plugin — schemas + HTTP client (mocked fetch).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { earnfiMethods, earnfiMethodNames, EARNFI_SAP_CAPABILITIES } from '../../src/ai/plugins/earnfi/schemas';
import { EarnFiHttpClient, EARNFI_DEFAULT_API_BASE } from '../../src/ai/plugins/earnfi/client';
import { createEarnFiPlugin } from '../../src/ai/plugins/earnfi/index';
import { SynapseAgentKit } from '../../src/ai/plugins/registry';

describe('EarnFi schemas', () => {
  it('registers expected method names', () => {
    expect(earnfiMethodNames).toContain('getCatalog');
    expect(earnfiMethodNames).toContain('createSocialJob');
    expect(earnfiMethodNames).toContain('createInterrupt');
    expect(earnfiMethods.every((m) => m.protocol === 'earnfi-agent')).toBe(true);
  });

  it('maps SAP capability strings', () => {
    expect(EARNFI_SAP_CAPABILITIES['human.social.engagement']).toBe('createSocialJob');
    expect(EARNFI_SAP_CAPABILITIES['human.interrupt.qa']).toBe('createInterrupt');
  });
});

describe('EarnFiHttpClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GET /catalog returns JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ success: true, job_types: [] }),
    }) as unknown as typeof fetch;

    const client = new EarnFiHttpClient({ baseUrl: EARNFI_DEFAULT_API_BASE });
    const res = await client.get('/catalog');
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ success: true });
  });

  it('x402Get without wallet throws on 402', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'https://app.earnfi.fun/api/ai-agent/v1/jobs/social' },
      accepts: [{ scheme: 'exact', network: 'solana:x', amount: '1000', payTo: 'x', asset: 'USDC' }],
    };
    const b64 = Buffer.from(JSON.stringify(challenge)).toString('base64');

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 402,
      headers: new Headers({ 'payment-required': b64 }),
      text: async () => JSON.stringify({ payment_required: true }),
    }) as unknown as typeof fetch;

    const client = new EarnFiHttpClient({ agentToken: 'tok' });
    await expect(
      client.x402Get('/jobs/social', { agent_token: 'tok', task_type: 'like', slots: '1', reward_per_user: '0.05' }),
    ).rejects.toThrow(/wallet \+ connection/);
  });
});

describe('createEarnFiPlugin + SynapseAgentKit', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: true }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs tools into agent kit', () => {
    const kit = new SynapseAgentKit({ rpcUrl: 'https://api.mainnet-beta.solana.com' }).use(
      createEarnFiPlugin({ agentToken: 'test-token' }),
    );
    const tools = kit.getTools();
    const names = tools.map((t) => t.name);
    expect(names.some((n) => n.includes('getCatalog') || n.includes('earnfi'))).toBe(true);
    expect(kit.summary().plugins.some((p) => p.id === 'earnfi')).toBe(true);
  });
});
