/**
 * @module ai
 * @description Synapse AI module — Agent-ready tools for Solana on-chain interaction.
 *
 * Sub-modules:
 *  - `./tools`    — LangChain-compatible tools for every Solana RPC method
 *  - `./gateway`  — Agent-to-agent commerce: metered sessions, x402 payments,
 *                   response attestation (Proof of Computation), marketplace
 *
 * @example
 * ```ts
 * import { createExecutableSolanaTools, AgentGateway } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 * ```
 *
 * @since 1.0.0
 */

// ── Tools (LangChain) ─────────────────────────────────────────
export {
  createExecutableSolanaTools,
  agentRpcMethods,
  solanaToolNames,
  type AgentRpcMethod,
  type SolanaTool,
  type SolanaToolMap,
  type SolanaToolkit,
  type CreateSolanaToolsOpts,
} from './tools';

// ── Protocol Tools (Jupiter, Raydium, Metaplex, On-Chain) ─────
export {
  // Factories
  createJupiterTools,
  createRaydiumTools,
  createMetaplexTools,
  createJupiterOnchainTools,
  createRaydiumOnchainTools,
  createSolanaProgramsTools,
  createProtocolTools,
  // Schemas
  jupiterMethods,
  jupiterMethodNames,
  raydiumMethods,
  raydiumMethodNames,
  metaplexMethods,
  metaplexMethodNames,
  jupiterOnchainMethods,
  jupiterOnchainMethodNames,
  raydiumOnchainMethods,
  raydiumOnchainMethodNames,
  solanaProgramsMethods,
  solanaProgramsMethodNames,
  // Shared infrastructure
  ProtocolHttpClient,
  ProtocolApiError,
  buildProtocolTools,
  createMethodRegistry,
  // Constants
  JUPITER_API_URL,
  RAYDIUM_API_URL,
  JUPITER_PROGRAM_IDS,
  RAYDIUM_PROGRAM_IDS,
  // Types
  type ProtocolMethod,
  type ProtocolToolkit,
  type ProtocolTool,
  type ProtocolClientConfig,
  type CreateProtocolToolsOpts,
  type JupiterToolsConfig,
  type RaydiumToolsConfig,
  type MetaplexToolsConfig,
  type JupiterOnchainToolsConfig,
  type RaydiumOnchainToolsConfig,
  type SolanaProgramsToolsConfig,
  type CreateProtocolToolsConfig,
  type AllProtocolToolkits,
} from './tools';

// ── Gateway (Agent Commerce) ──────────────────────────────────
export {
  // Main orchestrator
  AgentGateway,
  createAgentGateway,

  // Session
  AgentSession,
  SessionError,
  BudgetExhaustedError,
  RateLimitExceededError,
  SessionExpiredError,
  CallLimitExceededError,

  // Pricing
  PricingEngine,
  DEFAULT_TIERS,

  // Attestation
  ResponseValidator,

  // Marketplace
  ToolMarketplace,

  // Errors
  GatewayError,
  SessionNotFoundError,
  MaxSessionsError,
  IntentVerificationError,

  // Types
  type AgentId,
  type AgentIdentity,
  type AgentCredential,
  type PaymentToken,
  type PricingTier,
  type PaymentIntent,
  type PaymentReceipt,
  type SessionState,
  type SessionStatus,
  type ResponseAttestation,
  type AttestedResult,
  type ToolListing,
  type ToolBundle,
  type GatewayEventType,
  type GatewayEvent,
  type GatewayEventHandler,
  type GatewayConfig,
  type DynamicPricingConfig,
  type MarketplaceQuery,
  type MarketplaceStats,
  createAgentId,

  // x402 Protocol
  X402Paywall,
  X402Client,
  FacilitatorClient,
  createFacilitator,
  createX402Client,
  encodePaymentHeader,
  decodePaymentHeader,
  defaultRequirementsSelector,
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  USDC_MAINNET,
  USDC_DEVNET,
  X402_HEADER_PAYMENT_REQUIRED,
  X402_HEADER_PAYMENT_SIGNATURE,
  X402_HEADER_PAYMENT_RESPONSE,
  X402_STATUS_CODE,
  X402_VERSION,

  // x402 Errors
  FacilitatorError,
  VerifyError,
  SettleError,
  X402ClientError,
  NoAcceptablePaymentError,
  PaymentSigningError,
  PaymentRetryError,

  // x402 Types
  type X402Network,
  type X402ResourceInfo,
  type X402PaymentRequirements,
  type X402PaymentRequired,
  type X402PaymentPayload,
  type ExactSvmPayload,
  type X402VerifyResponse,
  type X402SettleResponse,
  type X402SettlementResponse,
  type X402CreateAuthHeaders,
  type X402FacilitatorConfig,
  type X402SupportedKind,
  type X402SupportedResponse,
  type X402RouteConfig,
  type X402Config,
  type X402PayloadSigner,
  type X402RequirementsSelector,
  type X402BudgetCheck,
  type X402ClientConfig,
  type X402PaymentOutcome,
  type PaywallResult,
  type SettleResult,
} from './gateway';

// ── Lazy factories (Next.js / webpack compatibility) ──────────
export {
  getJupiterTools,
  getRaydiumTools,
} from './lazy';
