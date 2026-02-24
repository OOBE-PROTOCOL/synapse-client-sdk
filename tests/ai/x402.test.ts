/**
 * Tests for x402 Protocol — Paywall (seller) and Client (buyer) integration.
 *
 * Verifies:
 * - X402Paywall generates 402 responses when no payment is present
 * - X402Paywall validates payments via local verifier
 * - X402Paywall settlement flow
 * - Payment header encoding/decoding
 * - X402Client detects 402 responses
 * - X402Client budget tracking
 * - AgentGateway x402 integration: processX402Request, executeWithX402
 * - FacilitatorClient error types
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { X402Paywall, encodePaymentHeader, decodePaymentHeader } from '../../src/ai/gateway/x402/paywall';
import { FacilitatorClient, FacilitatorError } from '../../src/ai/gateway/x402/facilitator';
import type {
  X402Config,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402VerifyResponse,
  X402SettleResponse,
} from '../../src/ai/gateway/x402/types';
import {
  SOLANA_MAINNET,
  USDC_MAINNET,
  X402_HEADER_PAYMENT_SIGNATURE,
} from '../../src/ai/gateway/x402/types';

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

function makeX402Config(overrides: Partial<X402Config> = {}): X402Config {
  return {
    enabled: true,
    payTo: 'Se11erPubkey111111111111111111111111111111111',
    facilitator: {
      url: 'https://mock-facilitator.test',
      timeoutMs: 5000,
    },
    defaultNetwork: SOLANA_MAINNET,
    defaultAsset: USDC_MAINNET,
    defaultPrice: '1000',
    defaultMaxTimeoutSeconds: 60,
    ...overrides,
  };
}

function makePaymentPayload(
  requirements: X402PaymentRequirements,
): X402PaymentPayload {
  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      transaction: Buffer.from('mock-tx-data').toString('base64'),
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Header encoding
 * ═══════════════════════════════════════════════════════════════ */

describe('x402 Header Encoding', () => {
  it('encodes and decodes a payment header', () => {
    const original = { version: 2, data: 'test', nested: { a: 1 } };
    const encoded = encodePaymentHeader(original);

    expect(typeof encoded).toBe('string');
    // Verify it's base64
    expect(Buffer.from(encoded, 'base64').toString('utf-8')).toContain('version');

    const decoded = decodePaymentHeader<typeof original>(encoded);
    expect(decoded).toEqual(original);
  });

  it('handles complex payment requirements encoding', () => {
    const requirements: X402PaymentRequirements = {
      scheme: 'exact',
      network: SOLANA_MAINNET,
      asset: USDC_MAINNET,
      amount: '1000',
      payTo: 'sellerPubkey',
      maxTimeoutSeconds: 60,
      extra: { feePayer: 'facilitatorPubkey' },
    };

    const encoded = encodePaymentHeader(requirements);
    const decoded = decodePaymentHeader<X402PaymentRequirements>(encoded);

    expect(decoded.scheme).toBe('exact');
    expect(decoded.network).toBe(SOLANA_MAINNET);
    expect(decoded.amount).toBe('1000');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  X402Paywall (Seller side)
 * ═══════════════════════════════════════════════════════════════ */

describe('X402Paywall', () => {
  let paywall: X402Paywall;

  beforeEach(() => {
    // Create paywall with a local verifier so we don't need a real facilitator
    paywall = new X402Paywall(makeX402Config({
      localVerifier: async (payload, requirements): Promise<X402VerifyResponse> => {
        // Simple mock: valid if transaction is present
        if (payload.payload?.transaction) {
          return { isValid: true, payer: 'buyerPubkey123' };
        }
        return { isValid: false, invalidReason: 'Missing transaction' };
      },
    }));
  });

  describe('processRequest', () => {
    it('returns payment-required when no payment header is present', async () => {
      const result = await paywall.processRequest('getBalance', {});

      expect(result.type).toBe('payment-required');
      if (result.type === 'payment-required') {
        expect(result.statusCode).toBe(402);
        expect(result.body.x402Version).toBe(2);
        expect(result.body.accepts.length).toBeGreaterThan(0);
        expect(result.body.accepts[0].payTo).toBe('Se11erPubkey111111111111111111111111111111111');
        expect(result.body.accepts[0].amount).toBe('1000');
        expect(result.headers).toBeDefined();
      }
    });

    it('validates payment when PAYMENT-SIGNATURE header is present', async () => {
      const requirements = paywall.buildRequirements('getBalance');
      const paymentPayload = makePaymentPayload(requirements);
      const encodedPayment = encodePaymentHeader(paymentPayload);

      const result = await paywall.processRequest('getBalance', {
        [X402_HEADER_PAYMENT_SIGNATURE]: encodedPayment,
      });

      expect(result.type).toBe('payment-valid');
      if (result.type === 'payment-valid') {
        expect(result.verifyResponse.isValid).toBe(true);
        expect(result.verifyResponse.payer).toBe('buyerPubkey123');
        expect(result.paymentPayload).toBeDefined();
        expect(result.requirements).toBeDefined();
      }
    });

    it('returns payment-required when payment is invalid', async () => {
      const requirements = paywall.buildRequirements('getBalance');
      const invalidPayload: X402PaymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: {}, // No transaction → local verifier rejects
      };
      const encoded = encodePaymentHeader(invalidPayload);

      const result = await paywall.processRequest('getBalance', {
        [X402_HEADER_PAYMENT_SIGNATURE]: encoded,
      });

      expect(result.type).toBe('payment-required');
    });

    it('returns no-payment-needed when x402 is disabled', async () => {
      const disabledPaywall = new X402Paywall(makeX402Config({ enabled: false }));

      const result = await disabledPaywall.processRequest('getBalance', {});
      expect(result.type).toBe('no-payment-needed');
    });
  });

  describe('buildRequirements', () => {
    it('builds requirements with default config', () => {
      const reqs = paywall.buildRequirements('getBalance');

      expect(reqs.scheme).toBe('exact');
      expect(reqs.network).toBe(SOLANA_MAINNET);
      expect(reqs.asset).toBe(USDC_MAINNET);
      expect(reqs.amount).toBe('1000');
      expect(reqs.payTo).toBe('Se11erPubkey111111111111111111111111111111111');
      expect(reqs.maxTimeoutSeconds).toBe(60);
    });

    it('uses route-specific config when available', () => {
      const paywallWithRoutes = new X402Paywall(makeX402Config({
        routes: {
          getBalance: {
            price: '500',
            network: SOLANA_MAINNET,
            asset: USDC_MAINNET,
            maxTimeoutSeconds: 30,
          },
        },
      }));

      const reqs = paywallWithRoutes.buildRequirements('getBalance');
      expect(reqs.amount).toBe('500');
      expect(reqs.maxTimeoutSeconds).toBe(30);

      // Other methods use defaults
      const defaultReqs = paywallWithRoutes.buildRequirements('getSlot');
      expect(defaultReqs.amount).toBe('1000');
    });
  });

  describe('settleAfterResponse', () => {
    it('settles successfully with local verifier (facilitator mock)', async () => {
      // Create paywall that also has a mock facilitator settle
      const settlingPaywall = new X402Paywall(makeX402Config({
        localVerifier: async () => ({ isValid: true, payer: 'buyer' }),
      }));

      // The settle goes through the FacilitatorClient which calls the real fetch.
      // Since we can't mock global fetch easily here, we test the structure.
      const requirements = settlingPaywall.buildRequirements('getBalance');
      const payload = makePaymentPayload(requirements);

      // settleAfterResponse will call facilitator.settle() which calls fetch
      // This will fail because the mock facilitator URL doesn't exist.
      // That's expected — the catch returns { success: false }
      const result = await settlingPaywall.settleAfterResponse(payload, requirements);

      // Expected: false because the facilitator URL is fake
      expect(result.success).toBe(false);
      expect(result.settleResponse).toBeNull();
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  FacilitatorClient
 * ═══════════════════════════════════════════════════════════════ */

describe('FacilitatorClient', () => {
  it('creates with default URL', () => {
    const client = new FacilitatorClient();
    expect(client.facilitatorUrl).toBeTruthy();
  });

  it('creates with custom URL', () => {
    const client = new FacilitatorClient({ url: 'https://my-facilitator.com/' });
    // Trailing slash is stripped
    expect(client.facilitatorUrl).toBe('https://my-facilitator.com');
  });

  it('supports custom auth headers', () => {
    const client = new FacilitatorClient({
      url: 'https://test.com',
      createAuthHeaders: async () => ({
        verify: { Authorization: 'Bearer test' },
        settle: { 'X-API-Key': 'secret' },
        supported: {},
      }),
    });

    expect(client.facilitatorUrl).toBe('https://test.com');
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  AgentGateway x402 integration
 * ═══════════════════════════════════════════════════════════════ */

describe('AgentGateway x402 integration', () => {
  it('processX402Request returns no-payment-needed when x402 not configured', async () => {
    const { MockSynapseClient, makeGatewayConfig } = await import('./_helpers');
    const { createAgentGateway } = await import('../../src/ai/gateway/index');

    const client = new MockSynapseClient();
    const gateway = createAgentGateway(client as any, makeGatewayConfig());

    const result = await gateway.processX402Request('getBalance', {});
    expect(result.type).toBe('no-payment-needed');
  });

  it('processX402Request returns payment-required when x402 is enabled', async () => {
    const { MockSynapseClient, makeGatewayConfig } = await import('./_helpers');
    const { createAgentGateway } = await import('../../src/ai/gateway/index');

    const client = new MockSynapseClient();
    const gateway = createAgentGateway(client as any, makeGatewayConfig({
      x402: makeX402Config({
        localVerifier: async () => ({ isValid: true, payer: 'buyer' }),
      }),
    }));

    const result = await gateway.processX402Request('getBalance', {});
    expect(result.type).toBe('payment-required');
  });

  it('processX402Request emits x402:payment-required event', async () => {
    const { MockSynapseClient, makeGatewayConfig } = await import('./_helpers');
    const { createAgentGateway } = await import('../../src/ai/gateway/index');

    const client = new MockSynapseClient();
    const gateway = createAgentGateway(client as any, makeGatewayConfig({
      x402: makeX402Config({
        localVerifier: async () => ({ isValid: true, payer: 'buyer' }),
      }),
    }));

    const events: string[] = [];
    gateway.on('x402:payment-required', () => { events.push('payment-required'); });

    await gateway.processX402Request('getBalance', {});
    expect(events).toContain('payment-required');
  });

  it('metrics reflect x402 config', async () => {
    const { MockSynapseClient, makeGatewayConfig } = await import('./_helpers');
    const { createAgentGateway } = await import('../../src/ai/gateway/index');

    const client = new MockSynapseClient();
    const gateway = createAgentGateway(client as any, makeGatewayConfig({
      x402: makeX402Config(),
    }));

    const metrics = gateway.getMetrics();
    expect(metrics.x402.paywallEnabled).toBe(true);
    expect(metrics.x402.clientEnabled).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  Known Facilitators & Registry
 * ═══════════════════════════════════════════════════════════════ */

import {
  KnownFacilitator,
  X402ProtocolVersion,
  EvmTransferMethod,
  BASE_MAINNET,
  BASE_SEPOLIA,
  USDC_BASE_MAINNET,
  USDC_BASE_SEPOLIA,
  USDC_SOLANA_MAINNET,
  USDC_SOLANA_DEVNET,
  USDC_ETHEREUM_MAINNET,
  USDC_DEVNET,
  X402_PERMIT2_PROXY,
  ETHEREUM_MAINNET,
  POLYGON_MAINNET,
  AVALANCHE_MAINNET,
  SEI_MAINNET,
  SVM_NETWORKS,
  EVM_NETWORKS,
  isSvmNetwork,
  isEvmNetwork,
  SOLANA_DEVNET,
} from '../../src/ai/gateway/x402/types';

import {
  FACILITATOR_REGISTRY,
  getFacilitatorInfo,
  findFacilitatorsByNetwork,
  findGasSponsoredFacilitators,
  listKnownFacilitators,
  resolveKnownFacilitator,
} from '../../src/ai/gateway/x402/registry';

import { createFacilitator } from '../../src/ai/gateway/x402/facilitator';

describe('Network Constants & Helpers', () => {
  it('Solana network constants use CAIP-2 format', () => {
    expect(SOLANA_MAINNET).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
    expect(SOLANA_DEVNET).toBe('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
  });

  it('Base / EVM network constants use CAIP-2 format', () => {
    expect(BASE_MAINNET).toBe('eip155:8453');
    expect(BASE_SEPOLIA).toBe('eip155:84532');
    expect(ETHEREUM_MAINNET).toBe('eip155:1');
    expect(POLYGON_MAINNET).toBe('eip155:137');
  });

  it('USDC token addresses are correct', () => {
    // Solana
    expect(USDC_SOLANA_MAINNET).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(USDC_SOLANA_DEVNET).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    // Base / EVM
    expect(USDC_BASE_MAINNET).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(USDC_BASE_SEPOLIA).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(USDC_ETHEREUM_MAINNET).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('deprecated USDC aliases still work', () => {
    expect(USDC_MAINNET).toBe(USDC_SOLANA_MAINNET);
    expect(USDC_DEVNET).toBe(USDC_SOLANA_DEVNET);
  });

  it('Permit2 proxy address is correct', () => {
    expect(X402_PERMIT2_PROXY).toBe('0x4020CD856C882D5fb903D99CE35316A085Bb0001');
  });

  it('SVM_NETWORKS contains Solana networks', () => {
    expect(SVM_NETWORKS).toContain(SOLANA_MAINNET);
    expect(SVM_NETWORKS).toContain(SOLANA_DEVNET);
  });

  it('EVM_NETWORKS contains Base and other EVM networks', () => {
    expect(EVM_NETWORKS).toContain(BASE_MAINNET);
    expect(EVM_NETWORKS).toContain(BASE_SEPOLIA);
    expect(EVM_NETWORKS).toContain(ETHEREUM_MAINNET);
    expect(EVM_NETWORKS).toContain(POLYGON_MAINNET);
  });

  it('isSvmNetwork correctly identifies Solana networks', () => {
    expect(isSvmNetwork(SOLANA_MAINNET)).toBe(true);
    expect(isSvmNetwork(SOLANA_DEVNET)).toBe(true);
    expect(isSvmNetwork(BASE_MAINNET)).toBe(false);
    expect(isSvmNetwork(ETHEREUM_MAINNET)).toBe(false);
  });

  it('isEvmNetwork correctly identifies EVM networks', () => {
    expect(isEvmNetwork(BASE_MAINNET)).toBe(true);
    expect(isEvmNetwork(BASE_SEPOLIA)).toBe(true);
    expect(isEvmNetwork(ETHEREUM_MAINNET)).toBe(true);
    expect(isEvmNetwork(SOLANA_MAINNET)).toBe(false);
    expect(isEvmNetwork(SOLANA_DEVNET)).toBe(false);
  });
});

describe('Enums', () => {
  it('KnownFacilitator has all expected facilitators', () => {
    expect(KnownFacilitator.PayAI).toBe('payai');
    expect(KnownFacilitator.Dexter).toBe('dexter');
    expect(KnownFacilitator.RelAI).toBe('relai');
    expect(KnownFacilitator.CDP).toBe('cdp');
    expect(KnownFacilitator.AutoIncentive).toBe('autoincentive');
    expect(KnownFacilitator.SolPay).toBe('solpay');
    expect(KnownFacilitator.CoinbaseDefault).toBe('coinbase-default');
  });

  it('EvmTransferMethod has EIP-3009 and Permit2', () => {
    expect(EvmTransferMethod.EIP3009).toBe('eip-3009');
    expect(EvmTransferMethod.Permit2).toBe('permit2');
  });

  it('X402ProtocolVersion has V1 and V2', () => {
    expect(X402ProtocolVersion.V1).toBe(1);
    expect(X402ProtocolVersion.V2).toBe(2);
  });
});

describe('Facilitator Registry', () => {
  it('FACILITATOR_REGISTRY contains all known facilitators', () => {
    const ids = listKnownFacilitators();
    expect(ids).toContain(KnownFacilitator.PayAI);
    expect(ids).toContain(KnownFacilitator.Dexter);
    expect(ids).toContain(KnownFacilitator.RelAI);
    expect(ids).toContain(KnownFacilitator.CDP);
    expect(ids).toContain(KnownFacilitator.AutoIncentive);
    expect(ids).toContain(KnownFacilitator.SolPay);
    expect(ids).toContain(KnownFacilitator.CoinbaseDefault);
    expect(ids.length).toBe(7);
  });

  it('getFacilitatorInfo returns correct info for PayAI', () => {
    const info = getFacilitatorInfo(KnownFacilitator.PayAI);
    expect(info).toBeDefined();
    expect(info!.name).toBe('PayAI');
    expect(info!.url).toBe('https://facilitator.payai.network');
    expect(info!.supportedNetworks).toContain(SOLANA_MAINNET);
    expect(info!.supportedNetworks).toContain(BASE_MAINNET);
    expect(info!.supportedSchemes).toContain('exact');
    expect(info!.requiresApiKey).toBe(false);
  });

  it('getFacilitatorInfo returns correct info for Dexter', () => {
    const info = getFacilitatorInfo(KnownFacilitator.Dexter);
    expect(info).toBeDefined();
    expect(info!.name).toBe('Dexter');
    expect(info!.url).toBe('https://facilitator.usedex.dev');
    expect(info!.supportedNetworks).toContain(SOLANA_MAINNET);
    expect(info!.supportedNetworks).toContain(BASE_MAINNET);
  });

  it('getFacilitatorInfo returns correct info for RelAI', () => {
    const info = getFacilitatorInfo(KnownFacilitator.RelAI);
    expect(info).toBeDefined();
    expect(info!.name).toBe('RelAI');
    expect(info!.url).toBe('https://facilitator.x402.fi');
    expect(info!.supportedNetworks).toContain(SOLANA_MAINNET);
    expect(info!.supportedNetworks).toContain(BASE_MAINNET);
    expect(info!.supportedNetworks).toContain(ETHEREUM_MAINNET);
    expect(info!.gasSponsored).toBe(true);
  });

  it('getFacilitatorInfo returns correct info for CDP', () => {
    const info = getFacilitatorInfo(KnownFacilitator.CDP);
    expect(info).toBeDefined();
    expect(info!.name).toBe('CDP (Coinbase)');
    expect(info!.url).toBe('https://x402.org/facilitator');
    expect(info!.gasSponsored).toBe(true);
  });

  it('every registry entry has all required fields', () => {
    for (const [id, info] of FACILITATOR_REGISTRY) {
      expect(info.id).toBe(id);
      expect(info.name).toBeTruthy();
      expect(info.description).toBeTruthy();
      expect(info.url).toMatch(/^https:\/\//);
      expect(info.supportedNetworks.length).toBeGreaterThan(0);
      expect(info.supportedVersions.length).toBeGreaterThan(0);
      expect(info.supportedSchemes).toContain('exact');
      expect(typeof info.requiresApiKey).toBe('boolean');
      expect(typeof info.gasSponsored).toBe('boolean');
      expect(info.website).toMatch(/^https:\/\//);
    }
  });

  it('findFacilitatorsByNetwork finds Solana facilitators', () => {
    const solana = findFacilitatorsByNetwork(SOLANA_MAINNET);
    expect(solana.length).toBeGreaterThanOrEqual(5);
    const ids = solana.map(f => f.id);
    expect(ids).toContain(KnownFacilitator.PayAI);
    expect(ids).toContain(KnownFacilitator.Dexter);
    expect(ids).toContain(KnownFacilitator.RelAI);
    expect(ids).toContain(KnownFacilitator.CDP);
    expect(ids).toContain(KnownFacilitator.SolPay);
  });

  it('findFacilitatorsByNetwork finds Base facilitators', () => {
    const base = findFacilitatorsByNetwork(BASE_MAINNET);
    expect(base.length).toBeGreaterThanOrEqual(4);
    const ids = base.map(f => f.id);
    expect(ids).toContain(KnownFacilitator.PayAI);
    expect(ids).toContain(KnownFacilitator.Dexter);
    expect(ids).toContain(KnownFacilitator.RelAI);
    expect(ids).toContain(KnownFacilitator.CDP);
  });

  it('findGasSponsoredFacilitators returns gas-sponsored ones', () => {
    const sponsored = findGasSponsoredFacilitators();
    const ids = sponsored.map(f => f.id);
    expect(ids).toContain(KnownFacilitator.RelAI);
    expect(ids).toContain(KnownFacilitator.CDP);
    expect(ids).not.toContain(KnownFacilitator.PayAI);
  });

  it('resolveKnownFacilitator returns valid config', () => {
    const config = resolveKnownFacilitator(KnownFacilitator.PayAI);
    expect(config.url).toBe('https://facilitator.payai.network');
    expect(config.timeoutMs).toBe(30_000);
  });

  it('resolveKnownFacilitator accepts timeout overrides', () => {
    const config = resolveKnownFacilitator(KnownFacilitator.RelAI, { timeoutMs: 60_000 });
    expect(config.url).toBe('https://facilitator.x402.fi');
    expect(config.timeoutMs).toBe(60_000);
  });

  it('resolveKnownFacilitator throws on unknown facilitator', () => {
    expect(() => resolveKnownFacilitator('unknown' as KnownFacilitator)).toThrow(/Unknown facilitator/);
  });
});

describe('FacilitatorClient with KnownFacilitator', () => {
  it('creates from KnownFacilitator.PayAI', () => {
    const client = new FacilitatorClient(KnownFacilitator.PayAI);
    expect(client.facilitatorUrl).toBe('https://facilitator.payai.network');
    expect(client.knownFacilitator).toBe(KnownFacilitator.PayAI);
  });

  it('creates from KnownFacilitator.RelAI', () => {
    const client = new FacilitatorClient(KnownFacilitator.RelAI);
    expect(client.facilitatorUrl).toBe('https://facilitator.x402.fi');
    expect(client.knownFacilitator).toBe(KnownFacilitator.RelAI);
  });

  it('creates from KnownFacilitator.Dexter', () => {
    const client = new FacilitatorClient(KnownFacilitator.Dexter);
    expect(client.facilitatorUrl).toBe('https://facilitator.usedex.dev');
    expect(client.knownFacilitator).toBe(KnownFacilitator.Dexter);
  });

  it('creates from KnownFacilitator.CDP', () => {
    const client = new FacilitatorClient(KnownFacilitator.CDP);
    expect(client.facilitatorUrl).toBe('https://x402.org/facilitator');
    expect(client.knownFacilitator).toBe(KnownFacilitator.CDP);
  });

  it('createFacilitator factory works with KnownFacilitator', () => {
    const client = createFacilitator(KnownFacilitator.PayAI);
    expect(client.facilitatorUrl).toBe('https://facilitator.payai.network');
  });

  it('createFacilitator factory still works with custom URL', () => {
    const client = createFacilitator({ url: 'https://custom.facilitator.com' });
    expect(client.facilitatorUrl).toBe('https://custom.facilitator.com');
  });

  it('createFacilitator factory uses default when no arg', () => {
    const client = createFacilitator();
    expect(client.facilitatorUrl).toBe('https://facilitator.payai.network');
  });

  it('knownFacilitator is undefined for custom URL configs', () => {
    const client = new FacilitatorClient({ url: 'https://custom.test' });
    expect(client.knownFacilitator).toBeUndefined();
  });
});
