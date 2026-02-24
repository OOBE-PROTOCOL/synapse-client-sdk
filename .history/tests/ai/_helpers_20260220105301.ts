/**
 * Test helpers — Shared mocks & factories for AI module tests.
 *
 * Provides:
 * - MockTransport: fake HTTP transport that returns stub data
 * - MockSynapseClient: minimal SynapseClient that uses MockTransport
 * - Factory functions for PaymentIntent, GatewayConfig, identity, tiers
 */

import { vi } from 'vitest';
import type { AgentId, AgentIdentity, GatewayConfig, PaymentIntent, PricingTier, PaymentToken } from '../../src/ai/gateway/types';
import { AgentId as createAgentId } from '../../src/ai/gateway/types';
import { DEFAULT_TIERS } from '../../src/ai/gateway/pricing';

/* ═══════════════════════════════════════════════════════════════
 *  Mock Transport
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Minimalist mock of HttpTransport.
 * Returns stub data keyed by RPC method name.
 */
export class MockTransport {
  public callLog: { method: string; params: unknown[] }[] = [];
  private stubs: Record<string, unknown> = {};

  /** Register a stub response for a given RPC method */
  stub(method: string, response: unknown): void {
    this.stubs[method] = response;
  }

  /** Simulates transport.request() */
  async request<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    this.callLog.push({ method, params });
    if (method in this.stubs) {
      return this.stubs[method] as T;
    }
    // Default: return a generic response per method type
    return MockTransport.defaultResponse(method) as T;
  }

  /** Batch request mock */
  async batch<T = unknown>(requests: { method: string; params?: unknown[] }[]): Promise<T[]> {
    const results: T[] = [];
    for (const r of requests) {
      results.push(await this.request<T>(r.method, r.params));
    }
    return results;
  }

  /** Default response stubs per method */
  static defaultResponse(method: string): unknown {
    const defaults: Record<string, unknown> = {
      getBalance: { context: { slot: 100 }, value: 1_500_000_000 },
      getSlot: 123_456,
      getBlockHeight: 200_000,
      getVersion: { 'solana-core': '1.18.0', 'feature-set': 12345 },
      getHealth: 'ok',
      getEpochInfo: { epoch: 500, slotIndex: 1000, slotsInEpoch: 432000, absoluteSlot: 123456, blockHeight: 200000, transactionCount: 999999 },
      getGenesisHash: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      getTransactionCount: 555_555,
      getIdentity: { identity: '11111111111111111111111111111111' },
      getLatestBlockhash: { context: { slot: 100 }, value: { blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi', lastValidBlockHeight: 250_000 } },
      getAccountInfo: { context: { slot: 100 }, value: { lamports: 1_000_000, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 0 } },
      getInflationRate: { total: 0.05, validator: 0.04, foundation: 0.01, epoch: 500 },
      getClusterNodes: [{ pubkey: '11111111111111111111111111111111', gossip: '127.0.0.1:8000', tpu: '127.0.0.1:8001', rpc: '127.0.0.1:8899', version: '1.18.0' }],
      getSupply: { context: { slot: 100 }, value: { total: 500_000_000_000_000_000, circulating: 400_000_000_000_000_000, nonCirculating: 100_000_000_000_000_000, nonCirculatingAccounts: [] } },
    };
    return defaults[method] ?? { result: `mock-${method}` };
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Mock SynapseClient
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Minimal mock that satisfies the SynapseClient interface used by
 * createExecutableSolanaTools() and AgentGateway.
 */
export class MockSynapseClient {
  readonly transport: MockTransport;

  constructor() {
    this.transport = new MockTransport();
  }

  /** Convenience: stub a method response */
  stub(method: string, response: unknown): this {
    this.transport.stub(method, response);
    return this;
  }

  call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    return this.transport.request<T>(method, params);
  }

  batch<T = unknown>(requests: { method: string; params?: unknown[] }[]): Promise<T[]> {
    return this.transport.batch<T>(requests);
  }

  destroy(): void { /* noop */ }
}

/* ═══════════════════════════════════════════════════════════════
 *  Identity & Config factories
 * ═══════════════════════════════════════════════════════════════ */

const SOL_TOKEN: PaymentToken = { type: 'SOL' };

/** Create a test AgentIdentity */
export function makeIdentity(name: string = 'TestSeller', pubkey: string = 'Se11erPubkey111111111111111111111111111111111'): AgentIdentity {
  return {
    id: createAgentId(`did:synapse:agent:${name}`),
    name,
    walletPubkey: pubkey,
    tags: ['test'],
    createdAt: Date.now(),
  };
}

/** Create a test GatewayConfig */
export function makeGatewayConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    identity: makeIdentity(),
    defaultTiers: DEFAULT_TIERS,
    sessionTtl: 3600,
    maxConcurrentSessions: 100,
    attestByDefault: false,
    ...overrides,
  };
}

/** Create a mock Ed25519 signer (returns 64 bytes of zeros + method id) */
export function makeMockSigner(): (message: Uint8Array) => Promise<Uint8Array> {
  return async (message: Uint8Array): Promise<Uint8Array> => {
    const sig = new Uint8Array(64);
    // Put first 8 bytes of message into signature for test identification
    sig.set(message.slice(0, Math.min(8, message.length)));
    return sig;
  };
}

/** Create a test PaymentIntent */
export function makePaymentIntent(
  sellerId: AgentId = createAgentId('did:synapse:agent:TestSeller'),
  opts: Partial<PaymentIntent> = {},
): PaymentIntent {
  return {
    nonce: opts.nonce ?? `nonce-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    buyer: opts.buyer ?? createAgentId('did:synapse:agent:TestBuyer'),
    seller: sellerId,
    tierId: opts.tierId ?? 'standard',
    maxBudget: opts.maxBudget ?? 1_000_000n,
    token: opts.token ?? SOL_TOKEN,
    signature: opts.signature ?? 'mock-signature-base64',
    createdAt: opts.createdAt ?? Date.now(),
    ttl: opts.ttl ?? 3600,
  };
}

/** Create a custom PricingTier */
export function makeTier(overrides: Partial<PricingTier> = {}): PricingTier {
  return {
    id: 'test-tier',
    label: 'Test Tier',
    pricePerCall: 100n,
    maxCallsPerSession: 1000,
    rateLimit: 50,
    token: SOL_TOKEN,
    includesAttestation: false,
    ...overrides,
  };
}

/** Wait for a specified number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
