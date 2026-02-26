/**
 * @module ai/gateway/x402/facilitator
 * @description x402 Facilitator Client — HTTP client for the x402 facilitator service.
 *
 * The facilitator is a third-party service that:
 *  1. Verifies payment payloads (checks signatures, balances, allowances)
 *  2. Settles payments on-chain (co-signs, submits, confirms)
 *  3. Reports supported payment kinds (scheme + network pairs)
 *
 * Supports both direct URL config and known facilitator selection:
 *
 * @example
 * ```ts
 * // Known facilitator (one-liner)
 * const f = createFacilitator(KnownFacilitator.PayAI);
 *
 * // Custom URL
 * const f = createFacilitator({ url: 'https://my-facilitator.com' });
 * ```
 *
 * @since 1.0.0
 */

import type {
  X402FacilitatorConfig,
  X402PaymentPayload,
  X402PaymentRequirements,
  X402VerifyResponse,
  X402SettleResponse,
  X402SupportedResponse,
} from './types';
import { KnownFacilitator } from './types';
import { resolveKnownFacilitator } from './registry';

/* ═══════════════════════════════════════════════════════════════
 *  Constants
 * ═══════════════════════════════════════════════════════════════ */

const DEFAULT_FACILITATOR_URL = 'https://facilitator.payai.network';
const DEFAULT_TIMEOUT_MS = 30_000;

/* ═══════════════════════════════════════════════════════════════
 *  Errors
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error thrown by the FacilitatorClient when a request fails.
 * @since 1.0.0
 */
export class FacilitatorError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }
}

/**
 * @description Error thrown when payment verification fails at the facilitator.
 * @since 1.0.0
 */
export class VerifyError extends FacilitatorError {
  constructor(statusCode: number, response: X402VerifyResponse) {
    super(
      `Payment verification failed: ${response.invalidReason ?? 'unknown'}`,
      '/verify',
      statusCode,
      response,
    );
    this.name = 'VerifyError';
  }
}

/**
 * @description Error thrown when payment settlement fails at the facilitator.
 * @since 1.0.0
 */
export class SettleError extends FacilitatorError {
  constructor(statusCode: number, response: X402SettleResponse) {
    super(
      `Payment settlement failed: ${response.errorReason ?? 'unknown'}`,
      '/settle',
      statusCode,
      response,
    );
    this.name = 'SettleError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  FacilitatorClient
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description HTTP client for an x402 facilitator.
 *
 * @example
 * ```ts
 * // From known facilitator enum
 * const facilitator = new FacilitatorClient(KnownFacilitator.PayAI);
 *
 * // From config object
 * const facilitator = new FacilitatorClient({
 *   url: 'https://x402.org/facilitator',
 *   createAuthHeaders: async () => ({
 *     verify: { Authorization: 'Bearer ...' },
 *     settle: { Authorization: 'Bearer ...' },
 *     supported: {},
 *   }),
 * });
 *
 * const verifyResult = await facilitator.verify(payload, requirements);
 * const settleResult = await facilitator.settle(payload, requirements);
 * const supported = await facilitator.supported();
 * ```
 *
 * @since 1.0.0
 */
export class FacilitatorClient {
  private readonly url: string;
  private readonly config: X402FacilitatorConfig;
  /** @description The known facilitator id if one was used, otherwise undefined @since 1.0.0 */
  public readonly knownFacilitator?: KnownFacilitator;

  /**
   * @description Create a new FacilitatorClient.
   * @param {KnownFacilitator | Partial<X402FacilitatorConfig>} [config] - Known facilitator enum or custom config. Defaults to PayAI free tier.
   * @since 1.0.0
   */
  constructor(config?: KnownFacilitator | Partial<X402FacilitatorConfig>) {
    // Resolve known facilitator enum to config
    if (typeof config === 'string' && Object.values(KnownFacilitator).includes(config as KnownFacilitator)) {
      this.knownFacilitator = config as KnownFacilitator;
      const resolved = resolveKnownFacilitator(config as KnownFacilitator);
      this.config = resolved;
    } else {
      const cfg = config as Partial<X402FacilitatorConfig> | undefined;
      this.config = {
        url: cfg?.url ?? DEFAULT_FACILITATOR_URL,
        createAuthHeaders: cfg?.createAuthHeaders,
        timeoutMs: cfg?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      };
    }
    this.url = this.config.url.replace(/\/$/, ''); // strip trailing slash
  }

  /* ── Verify ──────────────────────────────────────────────── */

  /**
   * @description Verify a payment payload against requirements.
   * POST /verify
   *
   * @param {X402PaymentPayload} paymentPayload - The client's signed payment payload
   * @param {X402PaymentRequirements} paymentRequirements - The accepted payment requirements
   * @returns {Promise<X402VerifyResponse>} Verification result
   * @throws {VerifyError} If verification fails
   * @since 1.0.0
   */
  async verify(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<X402VerifyResponse> {
    const headers = await this.getHeaders('verify');

    const res = await this.fetch(`${this.url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        paymentPayload: this.toJsonSafe(paymentPayload),
        paymentRequirements: this.toJsonSafe(paymentRequirements),
      }),
    });

    const data = await res.json() as X402VerifyResponse;

    if (res.status !== 200 || !data.isValid) {
      throw new VerifyError(res.status, data);
    }

    return data;
  }

  /* ── Settle ──────────────────────────────────────────────── */

  /**
   * @description Settle a verified payment on-chain.
   * POST /settle
   *
   * @param {X402PaymentPayload} paymentPayload - The client's signed payment payload
   * @param {X402PaymentRequirements} paymentRequirements - The accepted payment requirements
   * @returns {Promise<X402SettleResponse>} Settlement result with on-chain tx signature
   * @throws {SettleError} If settlement fails
   * @since 1.0.0
   */
  async settle(
    paymentPayload: X402PaymentPayload,
    paymentRequirements: X402PaymentRequirements,
  ): Promise<X402SettleResponse> {
    const headers = await this.getHeaders('settle');

    const res = await this.fetch(`${this.url}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        paymentPayload: this.toJsonSafe(paymentPayload),
        paymentRequirements: this.toJsonSafe(paymentRequirements),
      }),
    });

    const data = await res.json() as X402SettleResponse;

    if (res.status !== 200 || !data.success) {
      throw new SettleError(res.status, data);
    }

    return data;
  }

  /* ── Supported ───────────────────────────────────────────── */

  /**
   * @description Query the facilitator for supported payment kinds.
   * GET /supported
   *
   * @returns {Promise<X402SupportedResponse>} Supported scheme + network pairs (+ extra like feePayer)
   * @throws {FacilitatorError} If the request fails
   * @since 1.0.0
   */
  async supported(): Promise<X402SupportedResponse> {
    const headers = await this.getHeaders('supported');

    const res = await this.fetch(`${this.url}/supported`, {
      method: 'GET',
      headers,
    });

    if (res.status !== 200) {
      throw new FacilitatorError(
        `Failed to fetch supported kinds: ${res.status} ${res.statusText}`,
        '/supported',
        res.status,
      );
    }

    return await res.json() as X402SupportedResponse;
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  private async getHeaders(
    endpoint: 'verify' | 'settle' | 'supported',
  ): Promise<Record<string, string>> {
    if (!this.config.createAuthHeaders) return {};
    const authHeaders = await this.config.createAuthHeaders();
    return authHeaders[endpoint] ?? {};
  }

  /**
   * @description Fetch with timeout support via AbortController.
   * @param {string} url - The URL to fetch
   * @param {RequestInit} init - Fetch options
   * @returns {Promise<Response>} The response
   * @throws {FacilitatorError} On timeout
   * @since 1.0.0
   */
  private async fetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      return await globalThis.fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new FacilitatorError(
          `Facilitator request timed out after ${this.config.timeoutMs}ms`,
          url,
          0,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * @description Ensure BigInt values are serialized as strings for JSON transport.
   * @param {unknown} obj - The object to serialize
   * @returns {unknown} A JSON-safe copy of the object
   * @since 1.0.0
   */
  private toJsonSafe(obj: unknown): unknown {
    return JSON.parse(
      JSON.stringify(obj, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  /**
   * @description Get the configured facilitator URL.
   * @returns {string} The facilitator base URL
   * @since 1.0.0
   */
  get facilitatorUrl(): string {
    return this.url;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Factory
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create a facilitator client from a known facilitator enum or custom config.
 *
 * @example
 * ```ts
 * import { createFacilitator, KnownFacilitator } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * // One-liner with a known facilitator
 * const facilitator = createFacilitator(KnownFacilitator.PayAI);
 * const facilitator = createFacilitator(KnownFacilitator.RelAI);
 * const facilitator = createFacilitator(KnownFacilitator.Dexter);
 * const facilitator = createFacilitator(KnownFacilitator.CDP);
 *
 * // Custom URL
 * const facilitator = createFacilitator({ url: 'https://my-facilitator.com' });
 *
 * // Known facilitator + auth override
 * const facilitator = createFacilitator(KnownFacilitator.PayAI);
 * // Then set PAYAI_API_KEY_ID / PAYAI_API_KEY_SECRET env vars for production.
 *
 * // Default (PayAI free tier)
 * const facilitator = createFacilitator();
 * ```
 *
 * @param {KnownFacilitator | Partial<X402FacilitatorConfig>} [config] - Known facilitator or custom config
 * @returns {FacilitatorClient} A new FacilitatorClient instance
 * @since 1.0.0
 */
export function createFacilitator(
  config?: KnownFacilitator | Partial<X402FacilitatorConfig>,
): FacilitatorClient {
  return new FacilitatorClient(config);
}
