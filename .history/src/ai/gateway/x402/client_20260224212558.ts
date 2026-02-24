/**
 * @module ai/gateway/x402/client
 * @description x402 Client — Buyer-side x402 payment handler.
 *
 * When an agent acts as a BUYER and receives a 402 Payment Required
 * response, this module handles:
 *  1. Detecting 402 responses and extracting PaymentRequired headers
 *  2. Selecting the best matching PaymentRequirements from accepts[]
 *  3. Calling the developer-provided signer to create a PaymentPayload
 *  4. Retrying the request with the PAYMENT-SIGNATURE header
 *  5. Decoding the PAYMENT-RESPONSE header from the final 200 response
 *
 * The module is transport-agnostic: works as a fetch wrapper, a middleware,
 * or integrated into the AgentGateway's execute() pipeline.
 *
 * @since 1.0.0
 */

import type {
  X402PaymentRequired,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402ResourceInfo,
  X402SettlementResponse,
  X402Config,
  X402Network,
} from './types';
import {
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_STATUS_CODE,
  X402_VERSION,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Encoding helpers (re-export from paywall, keep self-contained)
 * ═══════════════════════════════════════════════════════════════ */

function encodePaymentHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function decodePaymentHeader<T>(base64: string): T {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as T;
}

/* ═══════════════════════════════════════════════════════════════
 *  Errors
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Base error class for x402 client-side errors.
 * @since 1.0.0
 */
export class X402ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'X402ClientError';
  }
}

/**
 * @description Error thrown when no acceptable payment method is found in the 402 response.
 * @since 1.0.0
 */
export class NoAcceptablePaymentError extends X402ClientError {
  /**
   * @description Create a NoAcceptablePaymentError.
   * @param {X402PaymentRequired} paymentRequired - The full 402 response
   * @param {string} reason - Why no payment method was acceptable
   * @since 1.0.0
   */
  constructor(
    public readonly paymentRequired: X402PaymentRequired,
    public readonly reason: string,
  ) {
    super(`No acceptable payment method found: ${reason}`);
    this.name = 'NoAcceptablePaymentError';
  }
}

/**
 * @description Error thrown when signing a payment payload fails.
 * @since 1.0.0
 */
export class PaymentSigningError extends X402ClientError {
  /**
   * @description Create a PaymentSigningError.
   * @param {X402PaymentRequirements} requirements - The requirements being signed
   * @param {unknown} cause - The underlying error
   * @since 1.0.0
   */
  constructor(
    public readonly requirements: X402PaymentRequirements,
    public readonly cause: unknown,
  ) {
    super(`Failed to sign payment: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'PaymentSigningError';
  }
}

/**
 * @description Error thrown when the payment retry request fails with a non-402 status.
 * @since 1.0.0
 */
export class PaymentRetryError extends X402ClientError {
  /**
   * @description Create a PaymentRetryError.
   * @param {number} statusCode - The HTTP status code of the failed retry
   * @param {unknown} body - The response body
   * @since 1.0.0
   */
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(`Payment retry failed with status ${statusCode}`);
    this.name = 'PaymentRetryError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Types for the client
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Signer function that takes payment requirements and resource info
 * and returns a fully-signed PaymentPayload.
 *
 * The developer provides this. For Solana exact scheme,
 * the signer should:
 *  1. Deserialize the transaction from requirements.extra.feePayer
 *  2. Build a TransferChecked instruction to payTo
 *  3. Partially sign with the agent's keypair
 *  4. Set payload.transaction = base64-encoded tx
 *
 * @since 1.0.0
 */
export type X402PayloadSigner = (
  requirements: X402PaymentRequirements,
  resource: X402ResourceInfo,
) => Promise<X402PaymentPayload>;

/**
 * @description Selector function that picks the best payment requirements
 * from the accepts array. The developer can customize this
 * to prefer specific networks, assets, or schemes.
 *
 * Default: picks the first requirements matching the configured network + asset.
 * @since 1.0.0
 */
export type X402RequirementsSelector = (
  accepts: X402PaymentRequirements[],
  config: X402ClientConfig,
) => X402PaymentRequirements | undefined;

/**
 * @description Budget tracker callback — called before paying to check
 * if the agent has sufficient budget remaining.
 * @since 1.0.0
 */
export type X402BudgetCheck = (
  amount: string,
  asset: string,
  network: X402Network,
) => Promise<boolean>;

/**
 * @description Configuration for the buyer-side x402 client.
 * @since 1.0.0
 */
export interface X402ClientConfig {
  /** Whether x402 auto-pay is enabled */
  enabled: boolean;

  /** The signer that creates signed PaymentPayloads */
  signer: X402PayloadSigner;

  /** Preferred network (used for selecting from accepts[]) */
  preferredNetwork?: X402Network;

  /** Preferred asset mint (used for selecting from accepts[]) */
  preferredAsset?: string;

  /** Maximum amount willing to pay per call (in atomic units) */
  maxAmountPerCall?: string;

  /** Custom requirements selector (overrides default selection logic) */
  requirementsSelector?: X402RequirementsSelector;

  /** Budget check callback (called before signing a payment) */
  budgetCheck?: X402BudgetCheck;

  /** Max number of 402 retries before giving up (default: 1) */
  maxRetries?: number;

  /** Whether to automatically detect and handle 402 responses (default: true) */
  autoDetect?: boolean;
}

/**
 * @description The outcome of a successful x402 payment flow.
 * @since 1.0.0
 */
export interface X402PaymentOutcome {
  /** The settlement response from the resource server */
  settlement: X402SettlementResponse | null;
  /** The payment payload that was sent */
  paymentPayload: X402PaymentPayload;
  /** The requirements that were fulfilled */
  requirements: X402PaymentRequirements;
  /** Amount paid in atomic units */
  amountPaid: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Default requirements selector
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Default selection logic:
 * 1. Filter by preferred network (if set)
 * 2. Filter by preferred asset (if set)
 * 3. Filter by maxAmountPerCall (if set)
 * 4. Pick the cheapest remaining option
 *
 * @param {X402PaymentRequirements[]} accepts - Available payment options from the 402 response
 * @param {X402ClientConfig} config - Client configuration with preferences
 * @returns {X402PaymentRequirements | undefined} The selected requirements, or undefined if none match
 * @since 1.0.0
 */
export function defaultRequirementsSelector(
  accepts: X402PaymentRequirements[],
  config: X402ClientConfig,
): X402PaymentRequirements | undefined {
  let candidates = [...accepts];

  // Filter by network
  if (config.preferredNetwork) {
    const networkFiltered = candidates.filter(r => r.network === config.preferredNetwork);
    if (networkFiltered.length > 0) candidates = networkFiltered;
  }

  // Filter by asset
  if (config.preferredAsset) {
    const assetFiltered = candidates.filter(r => r.asset === config.preferredAsset);
    if (assetFiltered.length > 0) candidates = assetFiltered;
  }

  // Filter by max amount
  if (config.maxAmountPerCall) {
    const maxAmount = BigInt(config.maxAmountPerCall);
    candidates = candidates.filter(r => BigInt(r.amount) <= maxAmount);
  }

  if (candidates.length === 0) return undefined;

  // Pick cheapest
  candidates.sort((a, b) => {
    const diff = BigInt(a.amount) - BigInt(b.amount);
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  });

  return candidates[0];
}

/* ═══════════════════════════════════════════════════════════════
 *  X402Client
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Buyer-side x402 client.
 *
 * Wraps outgoing HTTP requests to automatically handle 402 Payment Required
 * responses by signing a payment and retrying.
 *
 * @example
 * ```ts
 * const x402Client = new X402Client({
 *   enabled: true,
 *   signer: async (requirements, resource) => {
 *     // Build and sign a Solana transaction
 *     return { x402Version: 2, accepted: requirements, resource, payload: { transaction: '...' } };
 *   },
 *   preferredNetwork: SOLANA_MAINNET,
 *   preferredAsset: USDC_MAINNET,
 *   maxAmountPerCall: '100000', // 0.1 USDC max
 * });
 *
 * // Wrap a fetch call
 * const result = await x402Client.fetch('https://rpc-gateway.example/rpc', {
 *   method: 'POST',
 *   body: JSON.stringify({ jsonrpc: '2.0', method: 'getBalance', params: ['...'], id: 1 }),
 * });
 * ```
 *
 * @since 1.0.0
 */
export class X402Client {
  private readonly config: X402ClientConfig;
  private readonly selector: X402RequirementsSelector;

  /** Running tally of total amount paid (in atomic units, per-asset) */
  private readonly totalPaid = new Map<string, bigint>(); // asset → total
  private paymentCount = 0;

  /**
   * @description Create a new X402Client.
   * @param {X402ClientConfig} config - Client configuration including signer, preferences, and budget
   * @since 1.0.0
   */
  constructor(config: X402ClientConfig) {
    this.config = config;
    this.selector = config.requirementsSelector ?? defaultRequirementsSelector;
  }

  /* ── Main fetch wrapper ──────────────────────────────────── */

  /**
   * @description Perform an HTTP request with automatic x402 payment handling.
   *
   * If the server responds with 402, the client:
   * 1. Decodes PaymentRequired from the header
   * 2. Selects requirements
   * 3. Calls the signer
   * 4. Retries with PAYMENT-SIGNATURE header
   *
   * @param {string} url - Target URL
   * @param {RequestInit} [init] - Fetch options
   * @returns {Promise<{ response: Response; payment: X402PaymentOutcome | null }>} Response + optional PaymentOutcome
   * @throws {PaymentRetryError} If the retry response is not 402 but still not OK
   * @throws {X402ClientError} If max retries are exceeded
   * @since 1.0.0
   */
  async fetch(
    url: string,
    init?: RequestInit,
  ): Promise<{ response: Response; payment: X402PaymentOutcome | null }> {
    if (!this.config.enabled || this.config.autoDetect === false) {
      const response = await globalThis.fetch(url, init);
      return { response, payment: null };
    }

    const maxRetries = this.config.maxRetries ?? 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await globalThis.fetch(url, init);

      // Not a 402 → return as-is
      if (response.status !== X402_STATUS_CODE) {
        // Check for PAYMENT-RESPONSE header (from a previous payment in this session)
        const paymentResponseHeader = response.headers.get(X402_HEADER_PAYMENT_RESPONSE)
          ?? response.headers.get(X402_HEADER_PAYMENT_RESPONSE.toLowerCase());

        return { response, payment: null };
      }

      // 402 → attempt payment
      if (attempt >= maxRetries) {
        return { response, payment: null };
      }

      const paymentResult = await this.handlePaymentRequired(response, url);

      if (!paymentResult) {
        return { response, payment: null };
      }

      // Retry with payment
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set(
        X402_HEADER_PAYMENT_SIGNATURE,
        encodePaymentHeader(paymentResult.paymentPayload),
      );

      const retryResponse = await globalThis.fetch(url, {
        ...init,
        headers: retryHeaders,
      });

      // Parse settlement from response
      let settlement: X402SettlementResponse | null = null;
      const paymentResponseRaw = retryResponse.headers.get(X402_HEADER_PAYMENT_RESPONSE)
        ?? retryResponse.headers.get(X402_HEADER_PAYMENT_RESPONSE.toLowerCase());

      if (paymentResponseRaw) {
        try {
          settlement = decodePaymentHeader<X402SettlementResponse>(paymentResponseRaw);
        } catch {
          // Ignore decode errors for the settlement header
        }
      }

      if (retryResponse.ok) {
        // Track payment
        this.trackPayment(paymentResult.requirements);

        return {
          response: retryResponse,
          payment: {
            settlement,
            paymentPayload: paymentResult.paymentPayload,
            requirements: paymentResult.requirements,
            amountPaid: paymentResult.requirements.amount,
          },
        };
      }

      // If still 402 after payment, continue loop
      if (retryResponse.status !== X402_STATUS_CODE) {
        throw new PaymentRetryError(retryResponse.status, await retryResponse.text().catch(() => ''));
      }
    }

    // Should not reach here, but just in case
    throw new X402ClientError('Max x402 payment retries exceeded');
  }

  /* ── Transport-level interceptor ─────────────────────────── */

  /**
   * @description Process a raw 402 response (for integration with custom transports).
   *
   * Use this when you have a custom HTTP transport (like SynapseClient's
   * HttpTransport) and want to intercept 402 responses.
   *
   * @param {number} statusCode - HTTP status code
   * @param {Record<string, string>} headers - Response headers (key-value)
   * @param {unknown} [body] - Response body (parsed JSON or raw string)
   * @returns {Promise<{ shouldRetry: boolean; paymentSignatureHeader?: string; paymentPayload?: X402PaymentPayload; requirements?: X402PaymentRequirements }>} Whether to retry and the payment header to attach
   * @throws {PaymentSigningError} If the signer fails
   * @since 1.0.0
   */
  async interceptResponse(
    statusCode: number,
    headers: Record<string, string>,
    body?: unknown,
  ): Promise<{
    shouldRetry: boolean;
    paymentSignatureHeader?: string;
    paymentPayload?: X402PaymentPayload;
    requirements?: X402PaymentRequirements;
  }> {
    if (!this.config.enabled || statusCode !== X402_STATUS_CODE) {
      return { shouldRetry: false };
    }

    // Extract payment required
    const paymentRequiredRaw = headers[X402_HEADER_PAYMENT_REQUIRED]
      ?? headers[X402_HEADER_PAYMENT_REQUIRED.toLowerCase()]
      ?? headers['payment-required'];

    if (!paymentRequiredRaw) {
      return { shouldRetry: false };
    }

    const paymentRequired = decodePaymentHeader<X402PaymentRequired>(paymentRequiredRaw);

    // Select requirements
    const requirements = this.selector(paymentRequired.accepts, this.config);

    if (!requirements) {
      return { shouldRetry: false };
    }

    // Budget check
    if (this.config.budgetCheck) {
      const canPay = await this.config.budgetCheck(requirements.amount, requirements.asset, requirements.network);
      if (!canPay) {
        return { shouldRetry: false };
      }
    }

    // Amount check
    if (this.config.maxAmountPerCall) {
      if (BigInt(requirements.amount) > BigInt(this.config.maxAmountPerCall)) {
        return { shouldRetry: false };
      }
    }

    // Sign
    const resource: X402ResourceInfo = paymentRequired.resource ?? {
      url: '',
      description: '',
      mimeType: 'application/json',
    };

    try {
      const paymentPayload = await this.config.signer(requirements, resource);

      this.trackPayment(requirements);

      return {
        shouldRetry: true,
        paymentSignatureHeader: encodePaymentHeader(paymentPayload),
        paymentPayload,
        requirements,
      };
    } catch (err) {
      throw new PaymentSigningError(requirements, err);
    }
  }

  /**
   * @description Parse a PAYMENT-RESPONSE header from a successful response.
   * @param {Record<string, string>} headers - Response headers containing the payment response
   * @returns {X402SettlementResponse | null} The parsed settlement response, or null if not present
   * @since 1.0.0
   */
  parseSettlementResponse(headers: Record<string, string>): X402SettlementResponse | null {
    const raw = headers[X402_HEADER_PAYMENT_RESPONSE]
      ?? headers[X402_HEADER_PAYMENT_RESPONSE.toLowerCase()]
      ?? headers['payment-response'];

    if (!raw) return null;

    try {
      return decodePaymentHeader<X402SettlementResponse>(raw);
    } catch {
      return null;
    }
  }

  /* ── Internal helpers ────────────────────────────────────── */

  private async handlePaymentRequired(
    response: Response,
    _url: string,
  ): Promise<{ paymentPayload: X402PaymentPayload; requirements: X402PaymentRequirements } | null> {
    // Extract PaymentRequired from header
    const paymentRequiredRaw = response.headers.get(X402_HEADER_PAYMENT_REQUIRED)
      ?? response.headers.get(X402_HEADER_PAYMENT_REQUIRED.toLowerCase());

    if (!paymentRequiredRaw) {
      // Fallback: try to parse from body
      try {
        const body = await response.clone().json();
        if (body?.accepts?.length > 0) {
          return this.selectAndSign(body as X402PaymentRequired);
        }
      } catch {
        // Not a valid x402 response
      }
      return null;
    }

    const paymentRequired = decodePaymentHeader<X402PaymentRequired>(paymentRequiredRaw);
    return this.selectAndSign(paymentRequired);
  }

  private async selectAndSign(
    paymentRequired: X402PaymentRequired,
  ): Promise<{ paymentPayload: X402PaymentPayload; requirements: X402PaymentRequirements } | null> {
    // Select requirements
    const requirements = this.selector(paymentRequired.accepts, this.config);

    if (!requirements) {
      return null;
    }

    // Budget check
    if (this.config.budgetCheck) {
      const canPay = await this.config.budgetCheck(requirements.amount, requirements.asset, requirements.network);
      if (!canPay) return null;
    }

    // Amount check
    if (this.config.maxAmountPerCall) {
      if (BigInt(requirements.amount) > BigInt(this.config.maxAmountPerCall)) {
        return null;
      }
    }

    // Sign
    const resource: X402ResourceInfo = paymentRequired.resource ?? {
      url: '',
      description: '',
      mimeType: 'application/json',
    };

    try {
      const paymentPayload = await this.config.signer(requirements, resource);
      return { paymentPayload, requirements };
    } catch (err) {
      throw new PaymentSigningError(requirements, err);
    }
  }

  private trackPayment(requirements: X402PaymentRequirements): void {
    const key = `${requirements.network}:${requirements.asset}`;
    const current = this.totalPaid.get(key) ?? 0n;
    this.totalPaid.set(key, current + BigInt(requirements.amount));
    this.paymentCount++;
  }

  /* ── Public stats ────────────────────────────────────────── */

  /**
   * @description Total payments made in this client instance.
   * @returns {number} Number of completed payments
   * @since 1.0.0
   */
  get payments(): number {
    return this.paymentCount;
  }

  /**
   * @description Total amount paid per asset (network:asset → bigint).
   * @returns {ReadonlyMap<string, bigint>} Map of asset keys to total amounts paid
   * @since 1.0.0
   */
  get totalAmountPaid(): ReadonlyMap<string, bigint> {
    return this.totalPaid;
  }

  /**
   * @description Get total paid for a specific asset on a network.
   * @param {X402Network} network - The CAIP-2 network identifier
   * @param {string} asset - The token contract address
   * @returns {bigint} Total amount paid in atomic units
   * @since 1.0.0
   */
  getTotalPaid(network: X402Network, asset: string): bigint {
    return this.totalPaid.get(`${network}:${asset}`) ?? 0n;
  }

  /**
   * @description Check if auto-pay is enabled.
   * @returns {boolean} Whether the client is enabled for automatic payments
   * @since 1.0.0
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Factory
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create an X402Client with the provided configuration.
 * @param {X402ClientConfig} config - Client configuration
 * @returns {X402Client} A new X402Client instance
 * @since 1.0.0
 */
export function createX402Client(config: X402ClientConfig): X402Client {
  return new X402Client(config);
}
