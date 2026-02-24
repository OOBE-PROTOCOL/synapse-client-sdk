/**
 * x402 Protocol Types — Canonical types following the Coinbase x402 v2 specification.
 *
 * Reference: https://github.com/coinbase/x402
 *
 * The x402 protocol defines 3 roles:
 *  - Client:          an agent that wants to pay for a resource
 *  - Resource Server: an HTTP server selling a resource (our gateway)
 *  - Facilitator:     a server that verifies & settles payments on-chain
 *
 * Solana-specific:
 *  - scheme = "exact"
 *  - network = CAIP-2 format, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" (mainnet)
 *  - extra.feePayer = facilitator's Solana pubkey that sponsors tx fees
 *  - payload.transaction = base64-encoded partially-signed versioned Solana tx
 */

/* ═══════════════════════════════════════════════════════════════
 *  Network identifiers (CAIP-2)
 * ═══════════════════════════════════════════════════════════════ */

/** CAIP-2 style network identifier — "namespace:reference" */
export type X402Network = `${string}:${string}`;

/** Well-known Solana network identifiers */
export const SOLANA_MAINNET: X402Network = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const SOLANA_DEVNET: X402Network = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/** Well-known Solana token mints */
export const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/* ═══════════════════════════════════════════════════════════════
 *  Resource info
 * ═══════════════════════════════════════════════════════════════ */

/** Describes the resource being accessed (included in 402 responses). */
export interface X402ResourceInfo {
  /** The URL of the protected resource */
  url: string;
  /** Human-readable description */
  description: string;
  /** Expected response MIME type */
  mimeType: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Payment Requirements (server → client in 402 response)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * A single acceptable payment method.
 * In the 402 response, the server provides an array of these.
 * The client picks one and creates a PaymentPayload.
 */
export interface X402PaymentRequirements {
  /** Payment scheme identifier (e.g. "exact") */
  scheme: string;
  /** Blockchain network in CAIP-2 format */
  network: X402Network;
  /** Token asset address (SPL mint for Solana, ERC-20 for EVM) */
  asset: string;
  /** Required payment amount in atomic token units (lamports, micro-USDC) */
  amount: string;
  /** Recipient wallet address (the resource server / seller) */
  payTo: string;
  /** Max seconds before payment is considered expired */
  maxTimeoutSeconds: number;
  /** Scheme/network-specific extra data. For Solana: { feePayer: "..." } */
  extra: Record<string, unknown>;
}

/**
 * The full 402 Payment Required response body (v2).
 * Sent as a base64-encoded JSON in the `PAYMENT-REQUIRED` header.
 */
export interface X402PaymentRequired {
  /** Protocol version — always 2 for v2 */
  x402Version: 2;
  /** Optional error message */
  error?: string;
  /** Description of the resource being accessed */
  resource: X402ResourceInfo;
  /** Array of acceptable payment methods */
  accepts: X402PaymentRequirements[];
  /** Optional protocol extensions */
  extensions?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Payment Payload (client → server in retry request)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * The payment payload sent by the client.
 * Sent as a base64-encoded JSON in the `PAYMENT-SIGNATURE` header.
 */
export interface X402PaymentPayload {
  /** Protocol version */
  x402Version: number;
  /** Info about the resource being paid for */
  resource?: X402ResourceInfo;
  /** The PaymentRequirements being fulfilled */
  accepted: X402PaymentRequirements;
  /** Scheme-specific payload data */
  payload: Record<string, unknown>;
  /** Optional protocol extensions (echoed from PaymentRequired) */
  extensions?: Record<string, unknown>;
}

/** Solana-specific payload for the "exact" scheme */
export interface ExactSvmPayload {
  /** Base64-encoded partially-signed versioned Solana transaction */
  transaction: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Facilitator Responses
 * ═══════════════════════════════════════════════════════════════ */

/** Response from the facilitator's /verify endpoint. */
export interface X402VerifyResponse {
  /** Whether the payment payload is valid */
  isValid: boolean;
  /** Reason for invalidity, if applicable */
  invalidReason?: string;
  /** The payer's wallet address */
  payer?: string;
}

/** Response from the facilitator's /settle endpoint. */
export interface X402SettleResponse {
  /** Whether the settlement was successful */
  success: boolean;
  /** Reason for failure, if applicable */
  errorReason?: string;
  /** The payer's wallet address */
  payer?: string;
  /** On-chain transaction signature/hash */
  transaction: string;
  /** Network where the settlement occurred */
  network: string;
}

/** Settlement response sent in the PAYMENT-RESPONSE header. */
export interface X402SettlementResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer?: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Facilitator Configuration (developer-provided)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Auth headers factory for facilitator endpoints.
 * Allows API key, JWT, or custom auth per-endpoint.
 */
export type X402CreateAuthHeaders = () => Promise<{
  verify: Record<string, string>;
  settle: Record<string, string>;
  supported: Record<string, string>;
}>;

/**
 * Facilitator configuration — fully controlled by the developer.
 *
 * The facilitator is an external service that verifies and settles
 * x402 payments on-chain. The default is Coinbase's public facilitator.
 */
export interface X402FacilitatorConfig {
  /** Facilitator server URL (default: "https://x402.org/facilitator") */
  url: string;
  /** Optional factory for auth headers (e.g. API key, JWT) */
  createAuthHeaders?: X402CreateAuthHeaders;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

/** Supported payment kind (returned by facilitator /supported endpoint). */
export interface X402SupportedKind {
  /** x402 protocol version */
  x402Version: number;
  /** Payment scheme */
  scheme: string;
  /** Network identifier */
  network: string;
  /** Extra data (e.g. { feePayer: "..." } for Solana) */
  extra?: Record<string, unknown>;
}

/** Response from the facilitator's /supported endpoint. */
export interface X402SupportedResponse {
  kinds: X402SupportedKind[];
}

/* ═══════════════════════════════════════════════════════════════
 *  Resource Server Configuration (for the gateway acting as seller)
 * ═══════════════════════════════════════════════════════════════ */

/** Per-method (route) payment configuration. */
export interface X402RouteConfig {
  /** Price in atomic token units (e.g. "1000" = 0.001 USDC) */
  price: string;
  /** Network to accept payment on */
  network: X402Network;
  /** Token asset address */
  asset: string;
  /** Optional description override */
  description?: string;
  /** Optional MIME type override */
  mimeType?: string;
  /** Max timeout in seconds (default: 60) */
  maxTimeoutSeconds?: number;
}

/**
 * Full x402 integration configuration for the gateway.
 * The developer sets this up to enable x402 payments.
 */
export interface X402Config {
  /** Enable x402 payment protocol */
  enabled: boolean;

  /** Address to receive payments (Solana wallet pubkey) */
  payTo: string;

  /** Facilitator configuration */
  facilitator: X402FacilitatorConfig;

  /** Default network for payments */
  defaultNetwork: X402Network;

  /** Default token asset for payments */
  defaultAsset: string;

  /** Per-method payment configuration overrides */
  routes?: Record<string, X402RouteConfig>;

  /** Default price per call in atomic token units (applied to all methods without a route) */
  defaultPrice?: string;

  /** Default max timeout in seconds */
  defaultMaxTimeoutSeconds?: number;

  /**
   * Custom PaymentPayload signer.
   * For the CLIENT role: signs the payment payload before sending.
   * For Solana, this partially signs a transaction.
   */
  payloadSigner?: (payload: X402PaymentPayload) => Promise<X402PaymentPayload>;

  /**
   * Custom PaymentPayload verifier (optional local verification).
   * Bypass the facilitator for trusted scenarios.
   */
  localVerifier?: (
    payload: X402PaymentPayload,
    requirements: X402PaymentRequirements,
  ) => Promise<X402VerifyResponse>;
}

/* ═══════════════════════════════════════════════════════════════
 *  x402 HTTP header constants
 * ═══════════════════════════════════════════════════════════════ */

export const X402_HEADER_PAYMENT_REQUIRED = 'PAYMENT-REQUIRED';
export const X402_HEADER_PAYMENT_SIGNATURE = 'PAYMENT-SIGNATURE';
export const X402_HEADER_PAYMENT_RESPONSE = 'PAYMENT-RESPONSE';
export const X402_STATUS_CODE = 402;
export const X402_VERSION = 2;
