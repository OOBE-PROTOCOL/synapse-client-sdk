/**
 * x402 Protocol Module — HTTP-native payments for agent-to-agent commerce.
 *
 * This module implements the Coinbase x402 protocol v2 for Solana,
 * enabling agents to buy and sell RPC access using on-chain payments.
 *
 * Architecture:
 *  - types.ts       — Canonical x402 v2 type definitions
 *  - facilitator.ts — HTTP client for the facilitator service
 *  - paywall.ts     — Resource server side (seller generates 402 responses)
 *  - client.ts      — Buyer side (handles 402 responses, signs payments)
 *
 * The developer controls all configuration: facilitator URL, auth headers,
 * signer, pricing, network, and asset.
 *
 * @example Resource Server (Seller)
 * ```ts
 * import { X402Paywall, createFacilitator, SOLANA_MAINNET, USDC_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const paywall = new X402Paywall({
 *   enabled: true,
 *   payTo: 'YourSolanaWalletAddress',
 *   facilitator: { url: 'https://x402.org/facilitator' },
 *   defaultNetwork: SOLANA_MAINNET,
 *   defaultAsset: USDC_MAINNET,
 *   defaultPrice: '1000', // 0.001 USDC per call
 *   routes: {
 *     getBalance: { price: '500', network: SOLANA_MAINNET, asset: USDC_MAINNET },
 *   },
 * });
 * ```
 *
 * @example Client (Buyer)
 * ```ts
 * import { X402Client, SOLANA_MAINNET, USDC_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const client = new X402Client({
 *   enabled: true,
 *   signer: async (requirements, resource) => {
 *     // Sign the payment transaction
 *     return { x402Version: 2, accepted: requirements, resource, payload: { transaction: '...' } };
 *   },
 *   preferredNetwork: SOLANA_MAINNET,
 *   preferredAsset: USDC_MAINNET,
 *   maxAmountPerCall: '10000',
 * });
 * ```
 */

/* ── Types ───────────────────────────────────────────────────── */
export type {
  X402Network,
  X402ResourceInfo,
  X402PaymentRequirements,
  X402PaymentRequired,
  X402PaymentPayload,
  ExactSvmPayload,
  X402VerifyResponse,
  X402SettleResponse,
  X402SettlementResponse,
  X402CreateAuthHeaders,
  X402FacilitatorConfig,
  X402SupportedKind,
  X402SupportedResponse,
  X402RouteConfig,
  X402Config,
} from './types';

export {
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  USDC_MAINNET,
  USDC_DEVNET,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_STATUS_CODE,
  X402_VERSION,
} from './types';

/* ── Facilitator ─────────────────────────────────────────────── */
export {
  FacilitatorClient,
  FacilitatorError,
  VerifyError,
  SettleError,
  createFacilitator,
} from './facilitator';

/* ── Paywall (Resource Server / Seller) ──────────────────────── */
export {
  X402Paywall,
  encodePaymentHeader,
  decodePaymentHeader,
} from './paywall';

export type {
  PaywallResult,
  SettleResult,
} from './paywall';

/* ── Client (Buyer) ──────────────────────────────────────────── */
export {
  X402Client,
  X402ClientError,
  NoAcceptablePaymentError,
  PaymentSigningError,
  PaymentRetryError,
  defaultRequirementsSelector,
  createX402Client,
} from './client';

export type {
  X402PayloadSigner,
  X402RequirementsSelector,
  X402BudgetCheck,
  X402ClientConfig,
  X402PaymentOutcome,
} from './client';
