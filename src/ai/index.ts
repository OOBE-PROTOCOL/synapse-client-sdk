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

// ── Protocol Tools (Jupiter, Raydium, Metaplex, KAMIYO, On-Chain) ─────
export {
  // Factories
  createJupiterTools,
  createRaydiumTools,
  createMetaplexTools,
  createKamiyoTools,
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
  kamiyoMethods,
  kamiyoMethodNames,
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
  KAMIYO_API_URL,
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
  type KamiyoToolsConfig,
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

  // Agent Registry
  AgentRegistry,
  MemoryAdapter,
  type PersistenceAdapter,
  type AgentRegistryConfig,

  // Monetization Bridge
  MonetizeError,
  createMonetizedTools,
  createMultiProtocolMonetizedTools,
  type MonetizableGateway,
  type MonetizeConfig,
  type MonetizationMetrics,
  type MonetizedToolkit,
  type MultiMonetizedResult,

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
  type RetryConfig,
  type SnapshotDepth,
  type GatewaySnapshot,
  type X402PipelineStep,

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

  // x402 Discovery
  FacilitatorDiscovery,
  type FacilitatorHealthResult,
  type FindBestOptions,

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

// ── Persistence (Redis, PostgreSQL, Memory) ──────────────────
export {
  // Adapters
  MemoryStore,
  RedisPersistence,
  PostgresPersistence,

  // Error
  PersistenceError,

  // Helpers
  serialize as serializeForStore,
  deserialize as deserializeFromStore,
  buildKey as buildStoreKey,
  parseKey as parseStoreKey,
  extractAgentId as extractStoreAgentId,
  buildSchema as buildPostgresSchema,
  buildKvCleanupSql as buildPostgresCleanupSql,
  SCHEMA_VERSION as PERSISTENCE_SCHEMA_VERSION,

  // Types
  type PersistenceStore,
  type RedisLike,
  type PgLike,
  type SessionRecord,
  type ReceiptRecord,
  type MetricPoint,
  type SetOptions,
  type ListOptions,
  type MetricQueryOpts,
  type StoreConfig,
  type RedisStoreConfig,
  type PostgresStoreConfig,
  type MemoryStoreConfig,
} from './persistence';

// ── Lazy factories (Next.js / webpack compatibility) ──────────
export {
  getJupiterTools,
  getRaydiumTools,
} from './lazy';

// ── Solana Agent Protocol (SAP) — Integration Bridge ──────────
export {
  // Client bridge
  SynapseAnchorSap,

  // Provider & React blueprint
  createSapProvider,
  createSapContextBlueprint,

  // Constants
  SAP_PROGRAM_ID,

  // Error
  SapDependencyError,

  // Types
  type SapWallet,
  type SapCommitment,
  type SapBridgeConfig,
  type SapProviderConfig,
  type SapContextValue,
  type SapContextBlueprint,
  type SapStateManager,
} from './sap';

// ── Cross-Protocol Intent Resolver ────────────────────────────
export {
  // Errors
  IntentError,
  CyclicDependencyError,
  UnresolvedReferenceError,
  BudgetExceededError as IntentBudgetExceededError,

  // Classes
  IntentParser,
  IntentPlanner,
  IntentExecutor,

  // Types
  type IntentProtocol,
  type StepReference,
  type IntentStep,
  type Intent,
  type IntentOptions,
  type PlannedStep,
  type IntentPlan,
  type StepStatus,
  type StepResult,
  type IntentResultStatus,
  type IntentResult,
  type IntentConfig,
  type ValidationResult,
  type ParserConfig,
  type PlannerConfig,
} from './intents';

// ── Solana Actions & Blinks ───────────────────────────────────
export {
  // Server
  ActionServer,
  ActionServerError,

  // Blinks
  BlinkGenerator,
  createBlinkFromAction,
  DEFAULT_RESOLVER_URL,
  ACTION_SCHEME,

  // Types
  type ActionType,
  type ActionParameter,
  type LinkedAction,
  type ActionGetResponse,
  type ActionPostRequest,
  type ActionPostResponse,
  type ActionsJson,
  type ActionsJsonRule,
  type ActionHandler,
  type ActionContext,
  type ActionDefinition,
  type ActionServerConfig,
  type BlinkConfig,
  type BlinkMetadata,
} from './actions';

// ── Plugin System ─────────────────────────────────────────────
export {
  // Registry
  SynapseAgentKit,

  // Plugins
  TokenPlugin,
  NFTPlugin,
  DeFiPlugin,
  MiscPlugin,
  BlinksPlugin,

  // Types
  type SynapsePlugin,
  type PluginMeta,
  type PluginProtocol,
  type PluginContext,
  type PluginExecutor,
  type PluginInstallResult,
  type InstalledPlugin,
  type AgentKitConfig,
  type McpToolDescriptor,
  type McpResourceDescriptor,
} from './plugins';

// ── MCP (Model Context Protocol) ──────────────────────────────
export {
  // Server (expose tools as MCP)
  SynapseMcpServer,
  McpServerError,

  // Client Bridge (connect external MCP servers)
  McpClientBridge,

  // Constants & Types
  MCP_PROTOCOL_VERSION,
  MCP_JSONRPC_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type McpToolDefinition,
  type McpToolCallParams,
  type McpToolCallResult,
  type McpResourceDefinition,
  type McpResourceTemplate,
  type McpPromptDefinition,
  type McpPromptMessage,
  type McpServerInfo,
  type McpCapabilities,
  type McpTransport,
  type McpServerConfig,
  type McpExternalServerConfig,
  type McpConnectionStatus,
} from './mcp';
