/**
 * x402 Paywall — Resource Server side of the x402 protocol.
 *
 * When the gateway acts as a SELLER, this module handles:
 *  1. Generating 402 Payment Required responses with proper headers
 *  2. Parsing incoming PAYMENT-SIGNATURE headers from buyers
 *  3. Coordinating verify → execute → settle flow with the facilitator
 *  4. Attaching PAYMENT-RESPONSE headers to successful responses
 *
 * The paywall is transport-agnostic: it produces header/body objects
 * that can be used with Express, Hono, Next.js, raw HTTP, or any framework.
 */

import type {
  X402PaymentRequired,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402ResourceInfo,
  X402VerifyResponse,
  X402SettleResponse,
  X402SettlementResponse,
  X402Config,
  X402RouteConfig,
  X402Network,
} from './types';
import {
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_STATUS_CODE,
  X402_VERSION,
} from './types';
import { FacilitatorClient } from './facilitator';

/* ═══════════════════════════════════════════════════════════════
 *  Encoding helpers
 * ═══════════════════════════════════════════════════════════════ */

/** Encode an object to base64 JSON (for x402 headers). */
export function encodePaymentHeader(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

/** Decode a base64 JSON header back to an object. */
export function decodePaymentHeader<T>(base64: string): T {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as T;
}

/* ═══════════════════════════════════════════════════════════════
 *  Paywall result types (transport-agnostic)
 * ═══════════════════════════════════════════════════════════════ */

/** The result of processing an incoming request through the paywall. */
export type PaywallResult =
  | { type: 'payment-required'; statusCode: 402; headers: Record<string, string>; body: X402PaymentRequired }
  | { type: 'payment-valid'; verifyResponse: X402VerifyResponse; paymentPayload: X402PaymentPayload; requirements: X402PaymentRequirements }
  | { type: 'no-payment-needed' };

/** The result of settling a payment after the resource was served. */
export interface SettleResult {
  success: boolean;
  settleResponse: X402SettleResponse | null;
  /** Base64-encoded PAYMENT-RESPONSE header value */
  responseHeader: string | null;
}

/* ═══════════════════════════════════════════════════════════════
 *  X402Paywall
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Resource Server paywall for x402.
 *
 * The developer provides an X402Config, and the paywall handles
 * the full verify → execute → settle lifecycle.
 *
 * Usage:
 * ```ts
 * const paywall = new X402Paywall(x402Config);
 *
 * // On incoming request:
 * const result = await paywall.processRequest('getBalance', headers);
 *
 * if (result.type === 'payment-required') {
 *   return new Response(JSON.stringify(result.body), {
 *     status: 402,
 *     headers: result.headers,
 *   });
 * }
 *
 * if (result.type === 'payment-valid') {
 *   // Execute the RPC call, then settle
 *   const settle = await paywall.settleAfterResponse(
 *     result.paymentPayload,
 *     result.requirements,
 *   );
 *   // Attach settle.responseHeader to the response
 * }
 * ```
 */
export class X402Paywall {
  private readonly config: X402Config;
  private readonly facilitator: FacilitatorClient;

  /** Cached supported kinds from the facilitator */
  private supportedKindsCache: { kinds: { scheme: string; network: string; extra?: Record<string, unknown> }[]; cachedAt: number } | null = null;
  private readonly supportedKindsCacheTtlMs = 60_000; // 1 min

  constructor(config: X402Config) {
    this.config = config;
    this.facilitator = new FacilitatorClient(config.facilitator);
  }

  /* ── Process incoming request ────────────────────────────── */

  /**
   * Process an incoming request and determine if payment is needed.
   *
   * @param method — the RPC method being called (used to look up route config)
   * @param headers — incoming HTTP headers (to check for PAYMENT-SIGNATURE)
   * @returns PaywallResult indicating what to do next
   */
  async processRequest(
    method: string,
    headers: Record<string, string | undefined>,
  ): Promise<PaywallResult> {
    if (!this.config.enabled) {
      return { type: 'no-payment-needed' };
    }

    // Check for incoming payment
    const paymentSignatureRaw = headers[X402_HEADER_PAYMENT_SIGNATURE]
      ?? headers[X402_HEADER_PAYMENT_SIGNATURE.toLowerCase()]
      ?? headers['payment-signature'];

    if (!paymentSignatureRaw) {
      // No payment → return 402
      return this.buildPaymentRequired(method);
    }

    // Decode & verify the payment
    const paymentPayload = decodePaymentHeader<X402PaymentPayload>(paymentSignatureRaw);
    const requirements = this.buildRequirements(method);

    // Verify with facilitator (or local verifier)
    let verifyResponse: X402VerifyResponse;

    if (this.config.localVerifier) {
      verifyResponse = await this.config.localVerifier(paymentPayload, requirements);
    } else {
      verifyResponse = await this.facilitator.verify(paymentPayload, requirements);
    }

    if (!verifyResponse.isValid) {
      // Invalid payment → return 402 again
      return this.buildPaymentRequired(method, verifyResponse.invalidReason);
    }

    return {
      type: 'payment-valid',
      verifyResponse,
      paymentPayload,
      requirements,
    };
  }

  /* ── Settle after response ───────────────────────────────── */

  /**
   * Settle the payment after the resource has been served.
   * Call this after successfully executing the RPC call.
   *
   * @param paymentPayload — the verified payment payload
   * @param requirements — the requirements that were fulfilled
   * @returns SettleResult with the PAYMENT-RESPONSE header
   */
  async settleAfterResponse(
    paymentPayload: X402PaymentPayload,
    requirements: X402PaymentRequirements,
  ): Promise<SettleResult> {
    try {
      const settleResponse = await this.facilitator.settle(paymentPayload, requirements);

      const settlementHeader: X402SettlementResponse = {
        success: settleResponse.success,
        transaction: settleResponse.transaction,
        network: settleResponse.network,
        payer: settleResponse.payer,
      };

      return {
        success: true,
        settleResponse,
        responseHeader: encodePaymentHeader(settlementHeader),
      };
    } catch {
      return {
        success: false,
        settleResponse: null,
        responseHeader: null,
      };
    }
  }

  /* ── Build payment requirements ──────────────────────────── */

  /**
   * Build PaymentRequirements for a given method.
   */
  buildRequirements(method: string): X402PaymentRequirements {
    const routeConfig = this.config.routes?.[method];

    return {
      scheme: 'exact',
      network: routeConfig?.network ?? this.config.defaultNetwork,
      asset: routeConfig?.asset ?? this.config.defaultAsset,
      amount: routeConfig?.price ?? this.config.defaultPrice ?? '0',
      payTo: this.config.payTo,
      maxTimeoutSeconds: routeConfig?.maxTimeoutSeconds ?? this.config.defaultMaxTimeoutSeconds ?? 60,
      extra: {}, // feePayer will be resolved from facilitator /supported
    };
  }

  /**
   * Build PaymentRequirements with feePayer resolved from the facilitator.
   * This calls /supported to get the facilitator's feePayer address.
   */
  async buildRequirementsWithFeePayer(method: string): Promise<X402PaymentRequirements> {
    const base = this.buildRequirements(method);

    // Resolve feePayer from facilitator
    const feePayer = await this.getFeePayer(base.network);
    if (feePayer) {
      base.extra = { ...base.extra, feePayer };
    }

    return base;
  }

  /* ── Build 402 response ──────────────────────────────────── */

  private async buildPaymentRequired(
    method: string,
    error?: string,
  ): Promise<{ type: 'payment-required'; statusCode: 402; headers: Record<string, string>; body: X402PaymentRequired }> {
    const requirements = await this.buildRequirementsWithFeePayer(method);

    const resource: X402ResourceInfo = {
      url: method, // In RPC context, the method IS the resource
      description: this.config.routes?.[method]?.description ?? `Solana RPC: ${method}`,
      mimeType: this.config.routes?.[method]?.mimeType ?? 'application/json',
    };

    const body: X402PaymentRequired = {
      x402Version: X402_VERSION,
      error,
      resource,
      accepts: [requirements],
    };

    const headerValue = encodePaymentHeader(body);

    return {
      type: 'payment-required',
      statusCode: X402_STATUS_CODE,
      headers: {
        [X402_HEADER_PAYMENT_REQUIRED]: headerValue,
        'Content-Type': 'application/json',
      },
      body,
    };
  }

  /* ── Facilitator helpers ─────────────────────────────────── */

  /**
   * Get the facilitator's feePayer address for a given network.
   * Caches the result for 1 minute.
   */
  private async getFeePayer(network: X402Network): Promise<string | undefined> {
    try {
      const now = Date.now();

      if (
        this.supportedKindsCache &&
        now - this.supportedKindsCache.cachedAt < this.supportedKindsCacheTtlMs
      ) {
        return this.findFeePayer(this.supportedKindsCache.kinds, network);
      }

      const response = await this.facilitator.supported();
      this.supportedKindsCache = {
        kinds: response.kinds,
        cachedAt: now,
      };

      return this.findFeePayer(response.kinds, network);
    } catch {
      // Facilitator may be unavailable — return undefined
      return undefined;
    }
  }

  private findFeePayer(
    kinds: { scheme: string; network: string; extra?: Record<string, unknown> }[],
    network: X402Network,
  ): string | undefined {
    for (const kind of kinds) {
      if (kind.network === network && kind.scheme === 'exact') {
        return kind.extra?.feePayer as string | undefined;
      }
    }
    return undefined;
  }

  /** Get the underlying facilitator client */
  get facilitatorClient(): FacilitatorClient {
    return this.facilitator;
  }
}
