/**
 * Synapse AI module — Agent-ready tools for Solana on-chain interaction.
 *
 * Sub-modules:
 *  ./tools    — LangChain-compatible tools for every Solana RPC method
 *  ./gateway  — Agent-to-agent commerce: metered sessions, x402 payments,
 *               response attestation (Proof of Computation), marketplace
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
} from './gateway';
