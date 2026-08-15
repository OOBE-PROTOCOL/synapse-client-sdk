import { describe, expect, it, vi } from 'vitest';
import {
  decodePaymentHeader,
  SOLANA_MAINNET,
  USDC_SOLANA_MAINNET,
  X402Client,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_HEADER_PAYMENT_SIGNATURE,
  type X402PaymentPayload,
  type X402PaymentRequired,
  type X402PaymentRequirements,
} from '../../src/ai/gateway/x402';
import { SynapseAgentKit } from '../../src/ai/plugins';
import {
  UTILIA_SOLANA_RECEIVER,
  UtiliaPlugin,
  type UtiliaPaymentQuote,
} from '../../src/ai/plugins/utilia';

const signature =
  '5VERv8NMgSpEE6EgRuxv7CgMAodgsZiECWdKeEeKMw6ZF3fWBWq2nczYfuZEQU5FQbZLx8ZnYPyBZQrrYUxXWesZ';

function encodeHeader(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

function makeRequirements(
  url: string,
  amount = '4000',
  payTo = UTILIA_SOLANA_RECEIVER,
): X402PaymentRequirements {
  return {
    scheme: 'exact',
    network: SOLANA_MAINNET,
    amount,
    asset: USDC_SOLANA_MAINNET,
    payTo,
    maxTimeoutSeconds: 300,
    extra: { feePayer: 'Facilitator1111111111111111111111111111111' },
  };
}

function makeChallenge(
  url: string,
  requirements = makeRequirements(url),
): X402PaymentRequired {
  return {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url,
      description: 'Analyze a confirmed Solana transaction',
      mimeType: 'application/json',
    },
    accepts: [requirements],
  };
}

function responseWithChallenge(challenge: X402PaymentRequired): Response {
  return new Response(JSON.stringify(challenge), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      [X402_HEADER_PAYMENT_REQUIRED]: encodeHeader(challenge),
    },
  });
}

function makeKit(config: Record<string, unknown>) {
  return new SynapseAgentKit({
    rpcUrl: 'https://rpc.example',
  }).use(UtiliaPlugin, config);
}

describe('UtiliaPlugin', () => {
  it('registers four x402 evidence tools', () => {
    const kit = makeKit({});
    const tools = kit.getPluginTools('utilia')!;
    expect(tools).toHaveLength(4);
    expect(tools.map((tool) => tool.name)).toEqual([
      'utilia_priorityFees',
      'utilia_transactionDiagnosis',
      'utilia_tokenRisk',
      'utilia_simulateTransaction',
    ]);
  });

  it('returns a pinned quote without paying when authorization is not configured', async () => {
    const url = `https://api.utilia.ink/v1/transaction/${signature}`;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(responseWithChallenge(makeChallenge(url)));
    const kit = makeKit({ fetch: fetchMock });

    const result = await kit
      .getToolMap()
      .utilia_transactionDiagnosis.invoke({ signature });
    const parsed = JSON.parse(result as string);

    expect(parsed.status).toBe('payment_required');
    expect(parsed.quote.amountAtomic).toBe('4000');
    expect(parsed.quote.amountUsdc).toBe('0.004');
    expect(parsed.quote.payTo).toBe(UTILIA_SOLANA_RECEIVER);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('settles only after the exact quote is authorized', async () => {
    const url = `https://api.utilia.ink/v1/transaction/${signature}`;
    const requirements = makeRequirements(url);
    const challenge = makeChallenge(url, requirements);
    const settlement = {
      success: true,
      transaction: 'settlement-signature',
      network: SOLANA_MAINNET,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseWithChallenge(challenge))
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const paymentHeader = new Headers(init?.headers).get(
          X402_HEADER_PAYMENT_SIGNATURE,
        );
        expect(paymentHeader).not.toBeNull();
        const paymentPayload = decodePaymentHeader<X402PaymentPayload>(
          paymentHeader!,
        );
        expect(paymentPayload.accepted).toEqual(requirements);
        expect(paymentPayload.payload).toEqual({
          transaction: 'signed-payload',
        });
        return new Response(
          JSON.stringify({
            signature,
            slot: 123,
            succeeded: false,
            classification: {
              category: 'slippage',
              summary: 'Slippage tolerance exceeded',
              suggestedAction: 'Request a fresh quote.',
            },
            solBalanceChanges: [],
            tokenBalanceChanges: [],
            logs: [],
            confirmation: {},
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              [X402_HEADER_PAYMENT_RESPONSE]: encodeHeader(settlement),
            },
          },
        );
      });

    const authorizePayment = vi.fn(async (_quote: UtiliaPaymentQuote) => true);
    const signer = vi.fn(async () => ({
      x402Version: 2,
      accepted: requirements,
      resource: challenge.resource,
      payload: { transaction: 'signed-payload' },
    }));
    const x402Client = new X402Client({
      enabled: true,
      signer,
      preferredNetwork: SOLANA_MAINNET,
      preferredAsset: USDC_SOLANA_MAINNET,
      maxAmountPerCall: '8000',
    });
    const interceptResponse = vi.spyOn(x402Client, 'interceptResponse');
    const parseSettlementResponse = vi.spyOn(
      x402Client,
      'parseSettlementResponse',
    );
    const kit = makeKit({ fetch: fetchMock, authorizePayment, x402Client });

    const result = await kit
      .getToolMap()
      .utilia_transactionDiagnosis.invoke({ signature });
    const parsed = JSON.parse(result as string);

    expect(authorizePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        url,
        amountAtomic: '4000',
        amountUsdc: '0.004',
      }),
    );
    expect(interceptResponse).toHaveBeenCalledOnce();
    expect(interceptResponse).toHaveBeenCalledWith(402, expect.any(Object));
    expect(signer).toHaveBeenCalledOnce();
    expect(parseSettlementResponse).toHaveBeenCalledOnce();
    expect(parsed.classification.category).toBe('slippage');
    expect(parsed._payment.amountUsdc).toBe('0.004');
    expect(parsed._payment.settlement.transaction).toBe('settlement-signature');
  });

  it('rejects a changed receiver before asking for authorization', async () => {
    const url = `https://api.utilia.ink/v1/transaction/${signature}`;
    const challenge = makeChallenge(
      url,
      makeRequirements(
        url,
        '4000',
        'Attacker11111111111111111111111111111111111',
      ),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(responseWithChallenge(challenge));
    const authorizePayment = vi.fn(async () => true);
    const kit = makeKit({ fetch: fetchMock, authorizePayment });

    const result = await kit
      .getToolMap()
      .utilia_transactionDiagnosis.invoke({ signature });
    const parsed = JSON.parse(result as string);

    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('receiver does not match Utilia');
    expect(authorizePayment).not.toHaveBeenCalled();
  });

  it('rejects a price change before asking for authorization', async () => {
    const url = `https://api.utilia.ink/v1/transaction/${signature}`;
    const challenge = makeChallenge(url, makeRequirements(url, '5000'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(responseWithChallenge(challenge));
    const authorizePayment = vi.fn(async () => true);
    const kit = makeKit({ fetch: fetchMock, authorizePayment });

    const result = await kit
      .getToolMap()
      .utilia_transactionDiagnosis.invoke({ signature });
    const parsed = JSON.parse(result as string);

    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain(
      'Expected 4000 atomic USDC, received 5000',
    );
    expect(authorizePayment).not.toHaveBeenCalled();
  });

  it('rejects a partial x402 client at runtime', async () => {
    const partialClient = {
      interceptResponse: vi.fn(),
      parseSettlementResponse: vi.fn(),
    };
    const kit = makeKit({ x402Client: partialClient });

    const result = await kit
      .getToolMap()
      .utilia_transactionDiagnosis.invoke({ signature });
    const parsed = JSON.parse(result as string);

    expect(parsed.error).toBe(true);
    expect(parsed.message).toContain('complete X402Client instance');
  });
});
