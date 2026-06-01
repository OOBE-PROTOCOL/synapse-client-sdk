/**
 * Tests for EarnFi Plugin — schemas + @earn-fi/agent-client integration (mocked fetch).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EARNFI_DEFAULT_API_BASE,
  X402_COMPUTE_UNIT_LIMIT,
} from '@earn-fi/agent-client';
import { earnfiMethods, earnfiMethodNames, EARNFI_SAP_CAPABILITIES } from '../../src/ai/plugins/earnfi/schemas';
import { EarnFiHttpClient } from '../../src/ai/plugins/earnfi/client';
import { createEarnFiPlugin } from '../../src/ai/plugins/earnfi/index';
import { SynapseAgentKit } from '../../src/ai/plugins/registry';

const CREATOR_METHODS = [
  'listPendingVerifications',
  'approveVerification',
  'rejectVerification',
  'listContestSubmissions',
  'markContestWinner',
  'getCreatorJobDetail',
  'listJobParticipants',
  'listJobPayments',
];

describe('@earn-fi/agent-client package', () => {
  it('exports production API base', () => {
    expect(EARNFI_DEFAULT_API_BASE).toBe('https://app.earnfi.fun/api/ai-agent/v1');
  });

  it('uses x402 facilitator compute budget limits', () => {
    expect(X402_COMPUTE_UNIT_LIMIT).toBe(40_000);
  });
});

describe('EarnFi schemas', () => {
  it('registers expected method names', () => {
    expect(earnfiMethodNames).toContain('getCatalog');
    expect(earnfiMethodNames).toContain('createSocialJob');
    expect(earnfiMethodNames).toContain('createInterrupt');
    expect(earnfiMethods.every((m) => m.protocol === 'earnfi-agent')).toBe(true);
  });

  it('registers all creator OpenAPI methods', () => {
    for (const name of CREATOR_METHODS) {
      expect(earnfiMethodNames).toContain(name);
    }
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
    const res = await client.getCatalog();
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

    const client = new EarnFiHttpClient({ agentToken: 'tok', preferAgentTokenHeader: false });
    await expect(
      client.x402Get('/jobs/social', { agent_token: 'tok', task_type: 'like', slots: '1', reward_per_user: '0.05' }),
    ).rejects.toThrow(/wallet \+ connection/);
  });

  it('pauseJob uses POST with agent_token body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ success: true }),
    }) as unknown as typeof fetch;

    const client = new EarnFiHttpClient({ agentToken: 'tok', preferAgentTokenHeader: false });
    await client.pauseJob('EF123A', 'tok');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/jobs/EF123A/pause');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({ agent_token: 'tok' });
  });
});

describe('createEarnFiPlugin + SynapseAgentKit', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: true }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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

  it('executor routes getCatalog through client', async () => {
    const plugin = createEarnFiPlugin({ agentToken: 'test-token' });
    const ctx = { rpcUrl: 'https://api.mainnet-beta.solana.com' };
    const installed = plugin.install!(ctx as never);
    const method = earnfiMethods.find((m) => m.name === 'getCatalog')!;
    const result = (await installed!.executor!(method, {})) as { json: { ok: boolean } };
    expect(result.json).toMatchObject({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalled();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('/catalog');
  });

  it('executor routes listJobPayments through client', async () => {
    const plugin = createEarnFiPlugin({ agentToken: 'test-token' });
    const ctx = { rpcUrl: 'https://api.mainnet-beta.solana.com' };
    const installed = plugin.install!(ctx as never);
    const method = earnfiMethods.find((m) => m.name === 'listJobPayments')!;
    await installed!.executor!(method, { jobId: 'EF123A' });
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/jobs/EF123A/payments');
    expect(init?.method).toBe('GET');
  });
});
