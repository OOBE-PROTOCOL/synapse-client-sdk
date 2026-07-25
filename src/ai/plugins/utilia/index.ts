/**
 * @module ai/plugins/utilia
 * @description Utilia Plugin — paid Solana preflight and post-transaction evidence via x402.
 *
 * The plugin always inspects and pins the live quote before it asks the
 * application to authorize payment. It never auto-pays without an
 * `authorizePayment` callback returning true for that exact quote.
 *
 * @example
 * ```ts
 * const kit = new SynapseAgentKit({ rpcUrl })
 *   .use(UtiliaPlugin, {
 *     x402Client,
 *     authorizePayment: async quote => confirmInYourUI(quote),
 *   });
 * ```
 *
 * @since 2.1.0
 */
import type { SynapsePlugin, PluginContext } from "../types";
import type { ProtocolMethod } from "../../tools/protocols/shared";
import type {
  X402Client,
  X402PaymentRequired,
  X402PaymentRequirements,
  X402SettlementResponse,
} from "../../gateway/x402";
import {
  SOLANA_MAINNET,
  USDC_SOLANA_MAINNET,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_HEADER_PAYMENT_SIGNATURE,
} from "../../gateway/x402";
import { utiliaMethods } from "./schemas";

export { utiliaMethods, utiliaMethodNames } from "./schemas";

export const UTILIA_API_URL = "https://api.utilia.ink";
export const UTILIA_SOLANA_RECEIVER =
  "AX1TzKChcrgjVW2JMtcYFLgxerfH1XfW7etuSdMSUKh5";

const EXPECTED_AMOUNTS: Record<string, string> = {
  priorityFees: "2000",
  transactionDiagnosis: "4000",
  tokenRisk: "6000",
  simulateTransaction: "8000",
};

export interface UtiliaPaymentQuote {
  tool: string;
  url: string;
  amountAtomic: string;
  amountUsdc: string;
  network: string;
  asset: string;
  payTo: string;
}

export interface UtiliaX402Client {
  interceptResponse: X402Client["interceptResponse"];
  parseSettlementResponse: X402Client["parseSettlementResponse"];
}

export interface UtiliaPluginConfig {
  /** Synapse x402 buyer client configured with a Solana USDC signer and budget cap. */
  x402Client?: UtiliaX402Client;
  /** Called for every exact live quote immediately before signing. */
  authorizePayment?: (quote: UtiliaPaymentQuote) => Promise<boolean>;
  /** Fetch implementation for tests or custom runtimes. */
  fetch?: typeof globalThis.fetch;
}

interface PreparedRequest {
  url: string;
  init?: RequestInit;
}

function readConfig(context: PluginContext): UtiliaPluginConfig {
  return context.config as UtiliaPluginConfig;
}

function buildRequest(
  method: ProtocolMethod,
  input: Record<string, unknown>,
): PreparedRequest {
  switch (method.name) {
    case "priorityFees": {
      const url = new URL(`${UTILIA_API_URL}/v1/fees/priority`);
      for (const account of (input.accounts as string[] | undefined) ?? []) {
        url.searchParams.append("account", account);
      }
      return { url: url.toString() };
    }
    case "transactionDiagnosis":
      return {
        url: `${UTILIA_API_URL}/v1/transaction/${encodeURIComponent(input.signature as string)}`,
      };
    case "tokenRisk":
      return {
        url: `${UTILIA_API_URL}/v1/token/${encodeURIComponent(input.mint as string)}`,
      };
    case "simulateTransaction":
      return {
        url: `${UTILIA_API_URL}/v1/transaction/simulate`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: input.transaction,
            encoding: input.encoding ?? "base64",
            ...(input.accountAddresses
              ? { accountAddresses: input.accountAddresses }
              : {}),
          }),
        },
      };
    default:
      throw new Error(`[UtiliaPlugin] Unknown method: ${method.name}`);
  }
}

function decodeHeader<T>(raw: string): T {
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as T;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function decimalUsdc(amountAtomic: string): string {
  return (Number(amountAtomic) / 1_000_000).toFixed(3);
}

function validateQuote(
  method: ProtocolMethod,
  url: string,
  paymentRequired: X402PaymentRequired,
): { quote: UtiliaPaymentQuote; requirements: X402PaymentRequirements } {
  if (paymentRequired.x402Version !== 2) {
    throw new Error(
      `[UtiliaPlugin] Expected x402 v2, received v${paymentRequired.x402Version}`,
    );
  }
  if (paymentRequired.resource?.url !== url) {
    throw new Error(
      "[UtiliaPlugin] Payment resource URL does not match the requested Utilia URL",
    );
  }

  const requirements = paymentRequired.accepts.find(
    (candidate) =>
      candidate.scheme === "exact" &&
      candidate.network === SOLANA_MAINNET &&
      candidate.asset === USDC_SOLANA_MAINNET,
  );
  if (!requirements) {
    throw new Error(
      "[UtiliaPlugin] Quote does not offer exact Solana mainnet USDC",
    );
  }

  const expectedAmount = EXPECTED_AMOUNTS[method.name];
  if (requirements.amount !== expectedAmount) {
    throw new Error(
      `[UtiliaPlugin] Expected ${expectedAmount} atomic USDC, received ${requirements.amount}`,
    );
  }
  if (requirements.payTo !== UTILIA_SOLANA_RECEIVER) {
    throw new Error("[UtiliaPlugin] Quote receiver does not match Utilia");
  }

  return {
    requirements,
    quote: {
      tool: method.name,
      url,
      amountAtomic: requirements.amount,
      amountUsdc: decimalUsdc(requirements.amount),
      network: requirements.network,
      asset: requirements.asset,
      payTo: requirements.payTo,
    },
  };
}

function sameRequirements(
  actual: X402PaymentRequirements | undefined,
  expected: X402PaymentRequirements,
): boolean {
  return Boolean(
    actual &&
    actual.scheme === expected.scheme &&
    actual.network === expected.network &&
    actual.asset === expected.asset &&
    actual.amount === expected.amount &&
    actual.payTo === expected.payTo,
  );
}

async function executeUtilia(
  method: ProtocolMethod,
  input: Record<string, unknown>,
  context: PluginContext,
): Promise<unknown> {
  const config = readConfig(context);
  const request = buildRequest(method, input);
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);

  const quoteResponse = await fetchImpl(request.url, request.init);
  if (quoteResponse.status !== 402) {
    if (quoteResponse.ok) return quoteResponse.json();
    throw new Error(
      `[UtiliaPlugin] Quote request failed with ${quoteResponse.status}: ` +
        (await quoteResponse.text()),
    );
  }

  const paymentRequiredHeader =
    quoteResponse.headers.get(X402_HEADER_PAYMENT_REQUIRED) ??
    quoteResponse.headers.get(X402_HEADER_PAYMENT_REQUIRED.toLowerCase());
  if (!paymentRequiredHeader) {
    throw new Error(
      "[UtiliaPlugin] 402 response did not include PAYMENT-REQUIRED",
    );
  }

  const paymentRequired = decodeHeader<X402PaymentRequired>(
    paymentRequiredHeader,
  );
  const { quote, requirements } = validateQuote(
    method,
    request.url,
    paymentRequired,
  );

  if (!config.x402Client || !config.authorizePayment) {
    return {
      status: "payment_required",
      quote,
      message:
        "Configure x402Client and authorizePayment, then obtain action-time approval for this exact quote.",
    };
  }

  if (!(await config.authorizePayment(quote))) {
    return {
      status: "payment_declined",
      quote,
    };
  }

  const intercepted = await config.x402Client.interceptResponse(
    quoteResponse.status,
    headersToRecord(quoteResponse.headers),
    paymentRequired,
  );
  if (!intercepted.shouldRetry || !intercepted.paymentSignatureHeader) {
    throw new Error(
      "[UtiliaPlugin] x402 client declined or could not sign the approved quote",
    );
  }
  if (!sameRequirements(intercepted.requirements, requirements)) {
    throw new Error(
      "[UtiliaPlugin] x402 client selected payment requirements different from the approved quote",
    );
  }

  const retryHeaders = new Headers(request.init?.headers);
  retryHeaders.set(
    X402_HEADER_PAYMENT_SIGNATURE,
    intercepted.paymentSignatureHeader,
  );
  const paidResponse = await fetchImpl(request.url, {
    ...request.init,
    headers: retryHeaders,
  });
  if (!paidResponse.ok) {
    throw new Error(
      `[UtiliaPlugin] Paid request failed with ${paidResponse.status}: ` +
        (await paidResponse.text()),
    );
  }

  const responseBody = (await paidResponse.json()) as Record<string, unknown>;
  const settlementHeaders = headersToRecord(paidResponse.headers);
  const settlement =
    config.x402Client.parseSettlementResponse(settlementHeaders) ??
    parseSettlementFallback(paidResponse.headers);

  return {
    ...responseBody,
    _payment: {
      amountAtomic: requirements.amount,
      amountUsdc: quote.amountUsdc,
      network: requirements.network,
      asset: requirements.asset,
      settlement,
    },
  };
}

function parseSettlementFallback(
  headers: Headers,
): X402SettlementResponse | null {
  const raw =
    headers.get(X402_HEADER_PAYMENT_RESPONSE) ??
    headers.get(X402_HEADER_PAYMENT_RESPONSE.toLowerCase());
  if (!raw) return null;
  try {
    return decodeHeader<X402SettlementResponse>(raw);
  } catch {
    return null;
  }
}

export const UtiliaPlugin: SynapsePlugin = {
  meta: {
    id: "utilia",
    name: "Utilia Solana Evidence",
    description:
      "Wallet-funded Solana priority fees, transaction diagnosis, token risk, and simulation via x402",
    version: "2.1.0",
    author: "Utilia",
    tags: ["solana", "x402", "preflight", "transactions", "fees", "token-risk"],
    mcpResources: [
      "solana://utilia/fees",
      "solana://utilia/transaction/{signature}",
      "solana://utilia/token/{mint}",
    ],
  },
  protocols: [
    {
      id: "utilia",
      name: "Utilia Solana Evidence",
      methods: utiliaMethods,
      baseUrl: UTILIA_API_URL,
    },
  ],
  install() {
    return {
      executor: async (
        method: ProtocolMethod,
        input: Record<string, unknown>,
        context: PluginContext,
      ) => executeUtilia(method, input, context),
    };
  },
};

export default UtiliaPlugin;
