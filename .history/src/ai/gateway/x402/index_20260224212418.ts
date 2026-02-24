/**
 * x402 Protocol Module — HTTP-native payments for agent-to-agent commerce.
 *
 * This module implements the Coinbase x402 protocol v1 & v2 for Solana and Base (EVM),
 * enabling agents to buy and sell RPC access using on-chain stablecoin payments.
 *
 * Architecture:
 *  - types.ts       — Canonical x402 v1/v2 type definitions + enums
 *  - registry.ts    — Known facilitator registry (PayAI, Dexter, RelAI, CDP, ...)
 *  - facilitator.ts — HTTP client for the facilitator service
 *  - paywall.ts     — Resource server side (seller generates 402 responses)
 *  - client.ts      — Buyer side (handles 402 responses, signs payments)
 *
 * The developer controls all configuration: facilitator selection, auth headers,
 * signer, pricing, network, and asset.
 *
 * @example Quick start with known facilitator
 * ```ts
 * import { createFacilitator, KnownFacilitator } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const facilitator = createFacilitator(KnownFacilitator.PayAI);
 * const supported = await facilitator.supported();
 * ```
 *
 * @example Resource Server (Seller) on Solana
 * ```ts
 * import { X402Paywall, KnownFacilitator, SOLANA_MAINNET, USDC_SOLANA_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const paywall = new X402Paywall({
 *   enabled: true,
 *   payTo: 'YourSolanaWalletAddress',
 *   facilitator: { url: 'https://facilitator.payai.network' },
 *   defaultNetwork: SOLANA_MAINNET,
 *   defaultAsset: USDC_SOLANA_MAINNET,
 *   defaultPrice: '1000', // 0.001 USDC per call
 * });
 * ```
 *
 * @example Resource Server (Seller) on Base
 * ```ts
 * import { X402Paywall, BASE_MAINNET, USDC_BASE_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const paywall = new X402Paywall({
 *   enabled: true,
 *   payTo: '0xYourEthAddress',
 *   facilitator: { url: 'https://facilitator.x402.fi' },
 *   defaultNetwork: BASE_MAINNET,
 *   defaultAsset: USDC_BASE_MAINNET,
 *   defaultPrice: '1000',
 * });
 * ```
 *
 * @example Client (Buyer)
 * ```ts
 * import { X402Client, SOLANA_MAINNET, USDC_SOLANA_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const client = new X402Client({
 *   enabled: true,
 *   signer: async (requirements, resource) => {
 *     return { x402Version: 2, accepted: requirements, resource, payload: { transaction: '...' } };
 *   },
 *   preferredNetwork: SOLANA_MAINNET,
 *   preferredAsset: USDC_SOLANA_MAINNET,
 *   maxAmountPerCall: '10000',
 * });
 * ```
 *
 * @since 1.0.0
 */

/* ── Types ───────────────────────────────────────────────────── */
export type {
  X402Network,
  X402ResourceInfo,
  X402PaymentRequirements,
  X402PaymentRequired,
  X402PaymentPayload,
  ExactSvmPayload,
  ExactEvmEip3009Payload,
  ExactEvmPermit2Payload,
  X402VerifyResponse,
  X402SettleResponse,
  X402SettlementResponse,
  X402CreateAuthHeaders,
  X402FacilitatorConfig,
  X402SupportedKind,
  X402SupportedResponse,
  X402RouteConfig,
  X402Config,
  KnownFacilitatorInfo,
} from './types';

export {
  /* ── Solana networks & assets ── */
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  USDC_SOLANA_MAINNET,
  USDC_SOLANA_DEVNET,
  USDC_MAINNET,  // deprecated alias
  USDC_DEVNET,   // deprecated alias

  /* ── Base / EVM networks & assets ── */
  BASE_MAINNET,
  BASE_SEPOLIA,
  ETHEREUM_MAINNET,
  POLYGON_MAINNET,
  AVALANCHE_MAINNET,
  SEI_MAINNET,
  USDC_BASE_MAINNET,
  USDC_BASE_SEPOLIA,
  USDC_ETHEREUM_MAINNET,
  X402_PERMIT2_PROXY,

  /* ── Network collections & helpers ── */
  SVM_NETWORKS,
  EVM_NETWORKS,
  isSvmNetwork,
  isEvmNetwork,

  /* ── Enums ── */
  KnownFacilitator,
  EvmTransferMethod,
  X402ProtocolVersion,

  /* ── Header constants ── */
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_STATUS_CODE,
  X402_VERSION,
} from './types';

/* ── Facilitator Registry ────────────────────────────────────── */
export {
  FACILITATOR_REGISTRY,
  getFacilitatorInfo,
  findFacilitatorsByNetwork,
  findGasSponsoredFacilitators,
  listKnownFacilitators,
  resolveKnownFacilitator,
} from './registry';

/* ── Facilitator Client ──────────────────────────────────────── */
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
