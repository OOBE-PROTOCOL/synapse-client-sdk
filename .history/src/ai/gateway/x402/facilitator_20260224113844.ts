/**
 * x402 Facilitator Client — HTTP client for the x402 facilitator service.
 *
 * The facilitator is a third-party service that:
 *  1. Verifies payment payloads (checks signatures, balances, allowances)
 *  2. Settles payments on-chain (co-signs, submits, confirms)
 *  3. Reports supported payment kinds (scheme + network pairs)
 *
 * Supports both direct URL config and known facilitator selection:
 *
 * ```ts
 * // Known facilitator (one-liner)
 * const f = createFacilitator(KnownFacilitator.PayAI);
 *
 * // Custom URL
 * const f = createFacilitator({ url: 'https://my-facilitator.com' });
 * ```
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

const DEFAULT_FACILITATOR_URL = 'https://https://facilitator.payai.network/';
const DEFAULT_TIMEOUT_MS = 30_000;

/* ═══════════════════════════════════════════════════════════════
 *  Errors
 * ═══════════════════════════════════════════════════════════════ */

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
 * HTTP client for an x402 facilitator.
 *
 * Usage:
 * ```ts
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
 */
export class FacilitatorClient {
  private readonly url: string;
  private readonly config: X402FacilitatorConfig;

  constructor(config?: Partial<X402FacilitatorConfig>) {
    this.config = {
      url: config?.url ?? DEFAULT_FACILITATOR_URL,
      createAuthHeaders: config?.createAuthHeaders,
      timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    this.url = this.config.url.replace(/\/$/, ''); // strip trailing slash
  }

  /* ── Verify ──────────────────────────────────────────────── */

  /**
   * Verify a payment payload against requirements.
   * POST /verify
   *
   * @param paymentPayload — the client's signed payment payload
   * @param paymentRequirements — the accepted payment requirements
   * @returns verification result
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
   * Settle a verified payment on-chain.
   * POST /settle
   *
   * @param paymentPayload — the client's signed payment payload
   * @param paymentRequirements — the accepted payment requirements
   * @returns settlement result with on-chain tx signature
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
   * Query the facilitator for supported payment kinds.
   * GET /supported
   *
   * @returns supported scheme + network pairs (+ extra like feePayer)
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
   * Fetch with timeout support via AbortController.
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
   * Ensure BigInt values are serialized as strings for JSON transport.
   */
  private toJsonSafe(obj: unknown): unknown {
    return JSON.parse(
      JSON.stringify(obj, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  /** Get the configured facilitator URL */
  get facilitatorUrl(): string {
    return this.url;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Factory
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Create a facilitator client with the default or custom config.
 *
 * ```ts
 * // Use Coinbase's public facilitator
 * const facilitator = createFacilitator();
 *
 * // Use your own facilitator
 * const facilitator = createFacilitator({
 *   url: 'https://my-facilitator.com',
 *   createAuthHeaders: async () => ({
 *     verify: { 'X-API-Key': 'sk_...' },
 *     settle: { 'X-API-Key': 'sk_...' },
 *     supported: {},
 *   }),
 * });
 * ```
 */
export function createFacilitator(
  config?: Partial<X402FacilitatorConfig>,
): FacilitatorClient {
  return new FacilitatorClient(config);
}
