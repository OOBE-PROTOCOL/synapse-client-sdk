/**
 * x402 Protocol Types — Canonical types following the Coinbase x402 v1 & v2 specification.
 *
 * Reference: https://github.com/coinbase/x402
 *
 * The x402 protocol defines 3 roles:
 *  - Client:          an agent that wants to pay for a resource
 *  - Resource Server: an HTTP server selling a resource (our gateway)
 *  - Facilitator:     a server that verifies & settles payments on-chain
 *
 * Supports two blockchain families:
 *
 * Solana (SVM):
 *  - scheme = "exact"
 *  - network = CAIP-2 format, e.g. "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" (mainnet)
 *  - extra.feePayer = facilitator's Solana pubkey that sponsors tx fees
 *  - payload.transaction = base64-encoded partially-signed versioned Solana tx
 *  - TransferChecked instruction with 3–5 instructions layout
 *
 * Base / EVM (EIP-155):
 *  - scheme = "exact"
 *  - network = CAIP-2 format, e.g. "eip155:8453" (Base mainnet)
 *  - Two AssetTransferMethods:
 *    1. EIP-3009 (transferWithAuthorization) — recommended for USDC
 *    2. Permit2  (permitWitnessTransferFrom)  — universal ERC-20 fallback
 *  - extra.name = token name (e.g. "USDC"), extra.version = EIP-712 domain version
 */

/* ═══════════════════════════════════════════════════════════════
 *  Network identifiers (CAIP-2)
 * ═══════════════════════════════════════════════════════════════ */

/** CAIP-2 style network identifier — "namespace:reference" */
export type X402Network = `${string}:${string}`;

/* ── Solana (SVM) ──────────────────────────────────────────── */

/** Well-known Solana network identifiers */
export const SOLANA_MAINNET: X402Network = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const SOLANA_DEVNET: X402Network = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/** Well-known Solana token mints */
export const USDC_SOLANA_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_SOLANA_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** @deprecated Use USDC_SOLANA_MAINNET instead */
export const USDC_MAINNET = USDC_SOLANA_MAINNET;
/** @deprecated Use USDC_SOLANA_DEVNET instead */
export const USDC_DEVNET = USDC_SOLANA_DEVNET;

/* ── Base / EVM (EIP-155) ──────────────────────────────────── */

/** Well-known Base (Coinbase L2) network identifiers */
export const BASE_MAINNET: X402Network = 'eip155:8453';
export const BASE_SEPOLIA: X402Network = 'eip155:84532';

/** Well-known EVM network identifiers (additional) */
export const ETHEREUM_MAINNET: X402Network = 'eip155:1';
export const POLYGON_MAINNET: X402Network = 'eip155:137';
export const AVALANCHE_MAINNET: X402Network = 'eip155:43114';
export const SEI_MAINNET: X402Network = 'eip155:1329';

/** USDC contract addresses on EVM chains */
export const USDC_BASE_MAINNET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_ETHEREUM_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

/** Canonical Permit2 proxy contract for x402 exact EVM scheme */
export const X402_PERMIT2_PROXY = '0x4020CD856C882D5fb903D99CE35316A085Bb0001';

/* ── Network family helpers ────────────────────────────────── */

/** All well-known Solana (SVM) networks */
export const SVM_NETWORKS = [SOLANA_MAINNET, SOLANA_DEVNET] as const;

/** All well-known EVM networks */
export const EVM_NETWORKS = [
  BASE_MAINNET, BASE_SEPOLIA,
  ETHEREUM_MAINNET, POLYGON_MAINNET,
  AVALANCHE_MAINNET, SEI_MAINNET,
] as const;

/** Determine whether a CAIP-2 network is SVM-based */
export function isSvmNetwork(network: X402Network): boolean {
  return network.startsWith('solana:');
}

/** Determine whether a CAIP-2 network is EVM-based */
export function isEvmNetwork(network: X402Network): boolean {
  return network.startsWith('eip155:');
}

/* ═══════════════════════════════════════════════════════════════
 *  Known Facilitators — native registry for rapid integration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Enum of known x402 facilitators from the Coinbase x402 ecosystem.
 * Developers can use these directly with `createFacilitator()`:
 *
 * ```ts
 * import { createFacilitator, KnownFacilitator } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const facilitator = createFacilitator(KnownFacilitator.PayAI);
 * ```
 */
export enum KnownFacilitator {
  /** PayAI — Solana-first, multi-network facilitator. No API key needed for free tier. */
  PayAI = 'payai',
  /** Dexter — Solana & Base facilitator with integrated marketplace and MCP bridge. */
  Dexter = 'dexter',
  /** RelAI — Multi-chain facilitator with gas-sponsored payments and Zauth protection. */
  RelAI = 'relai',
  /** CDP — Coinbase Developer Platform reference facilitator (Base-first, fee-free USDC). */
  CDP = 'cdp',
  /** AutoIncentive — Free, public facilitator for Base and Solana. No API keys required. */
  AutoIncentive = 'autoincentive',
  /** SolPay — Solana-native facilitator with sub-second finality and trustless escrow. */
  SolPay = 'solpay',
  /** Coinbase default x402.org testnet facilitator. */
  CoinbaseDefault = 'coinbase-default',
}

/** EVM AssetTransferMethod used in the exact scheme on EVM chains. */
export enum EvmTransferMethod {
  /** EIP-3009 transferWithAuthorization — recommended for USDC (native support) */
  EIP3009 = 'eip-3009',
  /** Permit2 permitWitnessTransferFrom — universal ERC-20 fallback via proxy */
  Permit2 = 'permit2',
}

/** x402 protocol version */
export enum X402ProtocolVersion {
  /** v1 — Legacy: network names like "base-sepolia", "solana-devnet" */
  V1 = 1,
  /** v2 — Current: CAIP-2 network IDs, resource object, accepts array, extensions */
  V2 = 2,
}

/**
 * Metadata for a known facilitator — contains all the information
 * needed to connect, plus descriptive metadata for developer tools.
 */
export interface KnownFacilitatorInfo {
  /** Unique facilitator identifier */
  id: KnownFacilitator;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Facilitator API base URL */
  url: string;
  /** Supported blockchain networks (CAIP-2) */
  supportedNetworks: X402Network[];
  /** Supported x402 protocol versions */
  supportedVersions: X402ProtocolVersion[];
  /** Supported payment schemes */
  supportedSchemes: string[];
  /** Whether an API key is required for production use */
  requiresApiKey: boolean;
  /** Whether the facilitator sponsors gas fees for users */
  gasSponsored: boolean;
  /** Website URL for documentation / dashboard */
  website: string;
  /** Optional notes for developers */
  notes?: string;
}

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

/** Solana (SVM) specific payload for the "exact" scheme */
export interface ExactSvmPayload {
  /** Base64-encoded partially-signed versioned Solana transaction */
  transaction: string;
}

/** EVM (EIP-3009) specific payload for the "exact" scheme — used for USDC */
export interface ExactEvmEip3009Payload {
  /** EIP-712 typed data signature (65 bytes, hex) */
  signature: string;
  /** EIP-3009 transferWithAuthorization parameters */
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: string;
  };
}

/** EVM (Permit2) specific payload for the "exact" scheme — universal ERC-20 */
export interface ExactEvmPermit2Payload {
  /** EIP-712 typed data signature (65 bytes, hex) */
  signature: string;
  /** Permit2 witness transfer parameters */
  permit2Authorization: {
    permitted: { token: string; amount: string };
    nonce: string;
    deadline: string;
    witness: {
      payTo: string;
      amount: string;
      nonce: string;
    };
  };
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
