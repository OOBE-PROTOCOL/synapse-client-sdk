# Synapse Client SDK — AI Agent Skills Reference

> **Package:** `@oobe-protocol-labs/synapse-client-sdk`
> **Source:** `src/`
> **Generated from source code analysis**

---

## Table of Contents

1. [AI Tools (LangChain)](#1-ai-tools-langchain)
2. [Agent Gateway (Commerce)](#2-agent-gateway-commerce)
3. [Gateway Sessions](#3-gateway-sessions)
4. [Pricing Engine](#4-pricing-engine)
5. [Response Validator (Proof of Computation)](#5-response-validator-proof-of-computation)
6. [Tool Marketplace](#6-tool-marketplace)
7. [Monetization Bridge](#7-monetization-bridge)
8. [Agent Registry](#8-agent-registry)
9. [x402 Protocol](#9-x402-protocol)
10. [Solana Agent Protocol (SAP)](#10-solana-agent-protocol-sap)
11. [Intents (DAG Planner)](#11-intents-dag-planner)
12. [Actions & Blinks](#12-actions--blinks)
13. [Persistence](#13-persistence)
14. [Plugins (SynapseAgentKit)](#14-plugins-synapseagentkit)
15. [MCP (Model Context Protocol)](#15-mcp-model-context-protocol)
16. [Lazy Tool Factories](#16-lazy-tool-factories)
17. [Programs (Instruction Encoders)](#17-programs-instruction-encoders)
18. [Kit (@solana/kit Bridge)](#18-kit-solanakit-bridge)
19. [Context (IoC Container)](#19-context-ioc-container)
20. [gRPC / Geyser Parser](#20-grpc--geyser-parser)
21. [Next.js Integration](#21-nextjs-integration)

---

## 1. AI Tools (LangChain)

**Module:** `src/ai/tools/`

LangChain-compatible `DynamicStructuredTool` wrappers for every Solana RPC method and DeFi protocol.

### Key Exported Functions

| Function | Description |
|---|---|
| `createExecutableSolanaTools(client, opts?)` | Creates a `SolanaToolkit` with **53 RPC tools** for all Solana JSON-RPC methods. |
| `createProtocolTools(config?)` | Creates tools for all supported DeFi protocols. |
| `createJupiterTools(config?)` | Jupiter DEX swap/quote/routes/limit-order/DCA tools. |
| `createRaydiumTools(config?)` | Raydium AMM swap/pool/liquidity tools. |
| `createMetaplexTools(config?)` | Metaplex NFT mint/metadata tools. |
| `createJupiterOnchainTools(client)` | Jupiter on-chain instruction builder tools. |
| `createRaydiumOnchainTools(client)` | Raydium on-chain instruction builder tools. |
| `createSolanaProgramsTools(client)` | Tools for native Solana program instructions (System, SPL, ATA, Memo, ComputeBudget). |
| `buildProtocolTools(methods, httpClient)` | Generic factory for building DeFi protocol tools from a method registry. |
| `createMethodRegistry(methods)` | Register protocol methods with Zod schemas . |

### Key Exported Types

| Type | Description |
|---|---|
| `SolanaToolkit` | Object containing all 53 RPC tools. |
| `SolanaTool` | Single LangChain `DynamicStructuredTool` wrapping an RPC method. |
| `SolanaToolMap` | Map of method name → `SolanaTool`. |
| `CreateSolanaToolsOpts` | Options for `createExecutableSolanaTools`. |
| `ProtocolToolkit` | Collection of DeFi protocol tools. |
| `ProtocolTool` | Single DeFi protocol tool. |
| `ProtocolMethod` | Method definition for a DeFi protocol endpoint. |
| `ProtocolHttpClient` | HTTP client for calling DeFi protocol APIs. |
| `ProtocolApiError` | Error thrown by protocol HTTP calls. |

### Constants

| Constant | Description |
|---|---|
| `agentRpcMethods` | Zod schemas for all 53 RPC methods. |
| `solanaToolNames` | Array of method name strings. |
| `JUPITER_API_URL` | Default Jupiter API base URL. |
| `RAYDIUM_API_URL` | Default Raydium API base URL. |
| `JUPITER_PROGRAM_IDS` | Jupiter program addresses. |
| `RAYDIUM_PROGRAM_IDS` | Raydium program addresses. |

---

## 2. Agent Gateway (Commerce)

**Module:** `src/ai/gateway/index.ts`

### Class: `AgentGateway`

Main orchestrator for agent-to-agent RPC commerce with metering, attestation, x402 payments, and marketplace.

#### Constructor

```ts
new AgentGateway(client: SynapseClient, config: GatewayConfig)
```

#### Properties

| Property | Type | Description |
|---|---|---|
| `identity` | `AgentIdentity` | This agent's identity. |
| `agentId` | `AgentId` | Branded agent identifier. |
| `pricing` | `PricingEngine` | Pricing engine instance. |
| `validator` | `ResponseValidator` | Proof-of-computation validator. |
| `marketplace` | `ToolMarketplace` | Tool marketplace instance. |
| `paywall` | `X402Paywall \| undefined` | x402 seller (if configured). |
| `x402Client` | `X402Client \| undefined` | x402 buyer (if configured). |

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `openSession(intent, opts?)` | `AgentSession` | Open a new metered session with budget/rate validation. |
| `settleSession(sessionId, txSignature?)` | `UsageSummary` | Settle and finalize a session, return usage summary. |
| `getSession(id)` | `AgentSession \| undefined` | Retrieve a session by ID. |
| `listSessions(status?)` | `AgentSession[]` | List sessions, optionally filtered by status. |
| `pruneSessions()` | `number` | Prune expired sessions, returns count removed. |
| `execute<T>(sessionId, method, params, opts?)` | `AttestedResult<T>` | Execute a metered+attested RPC call with retry logic. |
| `executeBatch<T>(sessionId, calls)` | `AttestedResult<T>[]` | Execute multiple RPC calls in batch. |
| `processX402Request(method, headers)` | `PaywallResult` | **Seller:** Process an incoming request for x402 payment. |
| `settleX402Payment(payload, requirements)` | `SettleResult` | **Seller:** Settle an x402 payment after serving. |
| `executeWithX402<T>(sessionId, method, params, headers, opts?)` | `AttestedResult<T>` | Full x402 pipeline: verify → execute → settle with step callbacks. |
| `callWithX402<T>(method, params, opts?)` | `AttestedResult<T>` | **Buyer:** Pay-per-call to an external x402 endpoint. |
| `publish(listings)` | `void` | Publish tool listings to the marketplace. |
| `createGatewayTools(sessionId)` | `DynamicStructuredTool[]` | Create LangChain tools with automatic metering/attestation. |
| `getMetrics()` | `GatewayMetrics` | Get aggregate gateway metrics. |
| `snapshot(depth?)` | `GatewaySnapshot` | Snapshot gateway state at configurable depth. |
| `on(event, handler)` | `void` | Subscribe to gateway events. |
| `off(event, handler)` | `void` | Unsubscribe from gateway events. |

#### Factory Function

```ts
createAgentGateway(client: SynapseClient, config: GatewayConfig): AgentGateway
```

#### Errors

| Error | Description |
|---|---|
| `GatewayError` | Base gateway error. |
| `SessionNotFoundError` | Session ID not found. |
| `MaxSessionsError` | Maximum concurrent sessions reached. |
| `IntentVerificationError` | Payment intent verification failed. |

---

## 3. Gateway Sessions

**Module:** `src/ai/gateway/session.ts`

### Class: `AgentSession`

Represents a metered session with budget tracking, rate limiting, and lifecycle events.

#### Constructor

```ts
new AgentSession(intent: PaymentIntent, tier: PricingTier, sellerId: AgentId, ttl: number)
```

#### Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique session identifier. |
| `status` | `SessionStatus` | Current session status. |

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `snapshot()` | `SessionState` | Snapshot current session state. |
| `activate()` | `void` | Transition to active state. |
| `pause()` | `void` | Pause the session. |
| `resume()` | `void` | Resume a paused session. |
| `preCall(method)` | `bigint` | Pre-flight: validate rate limits and budget, return call cost. |
| `postCall(method, cost)` | `void` | Post-flight: record call and update counters. |
| `settle()` | `UsageSummary` | Finalize session and return usage summary. |
| `setMetadata(key, value)` | `void` | Attach arbitrary metadata to session. |
| `on(event, handler)` | `void` | Subscribe to session events. |

#### Errors

| Error | Description |
|---|---|
| `SessionError` | Base session error. |
| `BudgetExhaustedError` | Session budget exhausted. |
| `RateLimitExceededError` | Rate limit exceeded. |
| `SessionExpiredError` | Session TTL expired. |
| `CallLimitExceededError` | Max calls per session exceeded. |

---

## 4. Pricing Engine

**Module:** `src/ai/gateway/pricing.ts`

### Class: `PricingEngine`

Manages pricing tiers, dynamic pricing, and bundle discounts.

#### Constructor

```ts
new PricingEngine(defaultTiers?: PricingTier[], methodTiers?: Map<string, PricingTier[]>, dynamicConfig?: DynamicPricingConfig)
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `getTier(tierId, method?)` | `PricingTier \| undefined` | Look up a pricing tier by ID (with optional method override). |
| `listTierIds()` | `string[]` | List all registered tier IDs. |
| `listTiers()` | `PricingTier[]` | List all default tiers. |
| `computeCallPrice(tier)` | `bigint` | Compute the price for a single call under a tier. |
| `estimateSessionCost(tierId, calls, method?)` | `bigint` | Estimate total session cost for N calls. |
| `registerBundle(bundle)` | `void` | Register a bundle discount. |
| `getBundle(id)` | `ToolBundle \| undefined` | Get a bundle by ID. |
| `listBundles()` | `ToolBundle[]` | List all registered bundles. |
| `computeBundleSessionCost(bundleId, tierId, calls)` | `bigint` | Compute session cost with bundle discount. |
| `reportLatency(ms)` | `void` | Report a call latency for dynamic pricing. |
| `getAvgLatency()` | `number` | Get running average latency. |

#### Constants

| Constant | Description |
|---|---|
| `DEFAULT_TIERS` | Pre-defined tiers: `free`, `standard`, `premium`, `usdc-standard`. |

#### Types

| Type | Description |
|---|---|
| `DynamicPricingConfig` | Configuration for latency-based dynamic pricing. |

---

## 5. Response Validator (Proof of Computation)

**Module:** `src/ai/gateway/validator.ts`

### Class: `ResponseValidator`

Creates tamper-evident attestations for RPC call results (Proof of Computation).

#### Constructor

```ts
new ResponseValidator(config: ValidatorConfig, maxLogSize?: number)
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `attest(sessionId, method, params, response, slot?)` | `ResponseAttestation` | Create an attestation for a call result. |
| `wrapResult<T>(data, sessionId, method, params, slot, latencyMs, callIndex, shouldAttest)` | `AttestedResult<T>` | Wrap raw data with attestation metadata. |
| `getSessionAttestations(sessionId)` | `ResponseAttestation[]` | Retrieve all attestations for a session. |
| `getMethodAttestations(method, limit?)` | `ResponseAttestation[]` | Retrieve attestations by method name. |
| `totalAttestations` | `number` | Total attestation count. |
| `exportLog()` | `ResponseAttestation[]` | Export full attestation log. |

#### Static Methods

| Method | Returns | Description |
|---|---|---|
| `verifyIntegrity(attestation, params, response)` | `boolean` | Verify an attestation's hash matches inputs. |
| `verifySignature(attestation, verifier, pubkey)` | `boolean` | Verify an attestation's cryptographic signature. |

---

## 6. Tool Marketplace

**Module:** `src/ai/gateway/marketplace.ts`

### Class: `ToolMarketplace`

Decentralized tool discovery and reputation system for agent-to-agent commerce.

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `listTool(listing)` | `void` | List a single tool for sale. |
| `listTools(listings)` | `void` | List multiple tools. |
| `delistTool(method, sellerId)` | `boolean` | Remove a tool listing. |
| `delistAll(sellerId)` | `number` | Remove all listings by a seller. |
| `registerBundle(bundle)` | `void` | Register a tool bundle. |
| `getBundle(id)` | `ToolBundle \| undefined` | Get a bundle by ID. |
| `listBundles(sellerId?)` | `ToolBundle[]` | List bundles, optionally by seller. |
| `search(query?)` | `ToolListing[]` | Search listings with optional filters. |
| `findCheapest(method)` | `ToolListing \| undefined` | Find cheapest listing for a method. |
| `findMostReputable(method)` | `ToolListing \| undefined` | Find most reputable listing for a method. |
| `findFastest(method)` | `ToolListing \| undefined` | Find fastest listing for a method. |
| `updateReputation(sellerId, attestation, latencyMs, callDelta)` | `void` | Update seller reputation from attestation data. |
| `getReputationScore(sellerId)` | `number` | Get a seller's reputation score. |
| `getStats()` | `MarketplaceStats` | Get marketplace aggregate stats. |

#### Types

| Type | Description |
|---|---|
| `MarketplaceQuery` | Search query filters (method, seller, tags, etc.). |
| `MarketplaceStats` | Aggregate marketplace statistics. |

---

## 7. Monetization Bridge

**Module:** `src/ai/gateway/monetize.ts`

Bridge for adding per-call metering and attestation to DeFi protocol tool kits.

### Key Exported Functions

| Function | Returns | Description |
|---|---|---|
| `createMonetizedTools(gateway, sessionId, toolkit, config?)` | `MonetizedToolkit` | Wrap a single protocol toolkit with metering/attestation. |
| `createMultiProtocolMonetizedTools(gateway, sessionId, toolkits, config?)` | `MultiMonetizedResult` | Wrap multiple protocol toolkits simultaneously. |

### Types

| Type | Description |
|---|---|
| `MonetizableGateway` | Gateway interface required for monetization. |
| `MonetizeConfig` | Per-tool pricing overrides, event hooks. |
| `MonetizationMetrics` | Per-tool call count and revenue metrics. |
| `MonetizedToolkit` | Wrapped toolkit with tools + metrics. |
| `MultiMonetizedResult` | Result of multi-protocol monetization. |
| `MonetizeError` | Monetization error class. |

---

## 8. Agent Registry

**Module:** `src/ai/gateway/registry.ts`

### Class: `AgentRegistry`

Multi-agent lifecycle management — create, register, search, and persist agent gateways.

#### Constructor

```ts
new AgentRegistry(config?: AgentRegistryConfig)
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `create(client, config)` | `AgentGateway` | Create and register a new agent gateway. |
| `register(gateway)` | `void` | Register an existing gateway. |
| `get(agentId)` | `AgentGateway \| undefined` | Get a gateway by agent ID. |
| `remove(agentId)` | `boolean` | Remove and deregister a gateway. |
| `clear()` | `void` | Remove all gateways. |
| `has(agentId)` | `boolean` | Check if an agent is registered. |
| `size` | `number` | Number of registered agents. |
| `list()` | `AgentGateway[]` | List all gateways. |
| `filter(predicate)` | `AgentGateway[]` | Filter gateways by predicate. |
| `searchMarketplace(query)` | `ToolListing[]` | Search across all agent marketplaces. |
| `getAggregateMetrics()` | `AggregateMetrics` | Aggregate metrics across all agents. |
| `saveAll()` | `Promise<void>` | Persist all agents via the configured adapter. |
| `loadAll()` | `Promise<void>` | Load all agents from the configured adapter. |

#### Types

| Type | Description |
|---|---|
| `PersistenceAdapter` | Interface for registry persistence. |
| `MemoryAdapter` | In-memory persistence adapter. |
| `AgentRegistryConfig` | Registry configuration (max agents, persistence adapter). |

---

## 9. x402 Protocol

**Module:** `src/ai/gateway/x402/`

Coinbase x402 protocol v1 & v2 implementation for HTTP-native agent-to-agent payments on Solana and Base (EVM).

### Class: `X402Paywall` — Seller / Resource Server

Generates 402 Payment Required responses and settles payments after serving.

| Method | Returns | Description |
|---|---|---|
| `processRequest(method, headers)` | `Promise<PaywallResult>` | Check headers for payment; return `payment-required` or `payment-valid`. |
| `settleAfterResponse(paymentPayload, requirements)` | `Promise<SettleResult>` | Settle payment via facilitator after serving the resource. |

### Class: `X402Client` — Buyer

Handles 402 responses, signs payments, and retries with payment headers.

| Method | Returns | Description |
|---|---|---|
| `fetch(url, init?)` | `Promise<{ response, payment }>` | HTTP fetch with automatic 402 payment handling and retry. |

### Class: `FacilitatorClient`

HTTP client for x402 facilitator services (verify, settle, supported).

| Method | Returns | Description |
|---|---|---|
| `verify(paymentPayload, requirements)` | `Promise<X402VerifyResponse>` | Verify a payment payload against requirements. |
| `settle(paymentPayload, requirements)` | `Promise<X402SettleResponse>` | Settle a verified payment on-chain. |
| `supported()` | `Promise<X402SupportedResponse>` | Query supported payment kinds. |

### Class: `FacilitatorDiscovery`

Discovers and health-checks known x402 facilitators.

| Method | Returns | Description |
|---|---|---|
| `all()` | `KnownFacilitatorInfo[]` | Get all known facilitators. |
| `filter(predicate)` | `KnownFacilitatorInfo[]` | Filter facilitators by predicate. |
| `query(criteria)` | `KnownFacilitatorInfo[]` | Query by network, version, gas sponsoring, etc. |
| `healthCheck(facilitator?)` | `Promise<FacilitatorHealthResult[]>` | Health check with latency measurement. |
| `findBest(opts)` | `Promise<KnownFacilitatorInfo \| null>` | Find best facilitator by criteria + health. |

### Factory Functions

| Function | Description |
|---|---|
| `createFacilitator(config?)` | Create a `FacilitatorClient` from `KnownFacilitator` enum or config. |
| `createX402Client(config)` | Create an `X402Client`. |

### Utility Functions

| Function | Description |
|---|---|
| `encodePaymentHeader(payload)` | Base64-encode a payment payload for HTTP headers. |
| `decodePaymentHeader<T>(raw)` | Base64-decode a payment payload from HTTP headers. |
| `defaultRequirementsSelector(accepts, prefs)` | Default selector for choosing payment requirements. |
| `isSvmNetwork(network)` | Check if CAIP-2 network is Solana-based. |
| `isEvmNetwork(network)` | Check if CAIP-2 network is EVM-based. |

### Enums

| Enum | Values |
|---|---|
| `KnownFacilitator` | `PayAI`, `Dexter`, `RelAI`, `CDP`, `AutoIncentive`, `SolPay`, `CoinbaseDefault` |
| `EvmTransferMethod` | `EIP3009`, `Permit2` |
| `X402ProtocolVersion` | `V1`, `V2` |

### Network & Asset Constants

| Constant | Value |
|---|---|
| `SOLANA_MAINNET` | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| `SOLANA_DEVNET` | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| `BASE_MAINNET` | `eip155:8453` |
| `BASE_SEPOLIA` | `eip155:84532` |
| `ETHEREUM_MAINNET` | `eip155:1` |
| `POLYGON_MAINNET` | `eip155:137` |
| `AVALANCHE_MAINNET` | `eip155:43114` |
| `SEI_MAINNET` | `eip155:1329` |
| `USDC_SOLANA_MAINNET` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `USDC_BASE_MAINNET` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `SVM_NETWORKS` | All Solana networks array. |
| `EVM_NETWORKS` | All EVM networks array. |
| `X402_STATUS_CODE` | `402` |
| `X402_VERSION` | `2` |

### x402 Types

| Type | Description |
|---|---|
| `X402Network` | CAIP-2 network identifier (`namespace:reference`). |
| `X402ResourceInfo` | Resource URL, description, mimeType. |
| `X402PaymentRequirements` | Acceptable payment method (scheme, network, asset, amount, payTo). |
| `X402PaymentRequired` | Full 402 response body (v2) with `accepts` array. |
| `X402PaymentPayload` | Client payment payload with signed transaction data. |
| `ExactSvmPayload` | Solana-specific: base64 partially-signed versioned tx. |
| `ExactEvmEip3009Payload` | EVM EIP-3009 (USDC transferWithAuthorization). |
| `ExactEvmPermit2Payload` | EVM Permit2 (universal ERC-20 fallback). |
| `X402VerifyResponse` | Facilitator verify response (`isValid`, `payer`). |
| `X402SettleResponse` | Facilitator settle response (`success`, `transaction`). |
| `X402SettlementResponse` | Response sent in `PAYMENT-RESPONSE` header. |
| `X402FacilitatorConfig` | Facilitator URL, auth headers, timeout. |
| `X402SupportedKind` | Supported payment kind from facilitator. |
| `X402SupportedResponse` | Full `/supported` response. |
| `X402RouteConfig` | Per-method pricing configuration. |
| `X402Config` | Full x402 paywall configuration. |
| `KnownFacilitatorInfo` | Metadata for a known facilitator. |
| `X402PayloadSigner` | Async function to sign payment payloads. |
| `X402RequirementsSelector` | Function to select from `accepts` array. |
| `X402BudgetCheck` | Budget validation function. |
| `X402ClientConfig` | Full x402 client configuration. |
| `X402PaymentOutcome` | Payment outcome with requirements + settlement. |
| `PaywallResult` | Result of `processRequest` (type-discriminated union). |
| `SettleResult` | Result of `settleAfterResponse`. |
| `FacilitatorHealthResult` | Health check result with latency. |
| `FindBestOptions` | Options for `findBest` query. |

### Errors

| Error | Description |
|---|---|
| `FacilitatorError` | Base facilitator error. |
| `VerifyError` | Payment verification failed. |
| `SettleError` | Payment settlement failed. |
| `X402ClientError` | Base x402 client error. |
| `NoAcceptablePaymentError` | No matching payment requirements. |
| `PaymentSigningError` | Payment signing failed. |
| `PaymentRetryError` | Payment retry failed. |

---

## 10. Solana Agent Protocol (SAP) — Integration Bridge

**Module:** `src/ai/sap/`

> **v2.1.0 breaking change.** The full SAP implementation (PDA derivation,
> Borsh serialization, instruction builders, discovery, validation,
> subnetworks, scoring) has moved to the dedicated
> [`@oobe-protocol-labs/synapse-sap-sdk`](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk).
>
> This module now provides a **thin integration bridge** that connects
> the Synapse Client SDK infrastructure (network resolution, HMR-safe
> singletons) with the standalone SAP SDK.

### Class: `SynapseAnchorSap`

Bridge class that resolves Synapse endpoints, creates an Anchor provider,
and initializes a `SapClient` from `@oobe-protocol-labs/synapse-sap-sdk`.

**Peer dependencies** (optional — only needed when using SAP):
- `@oobe-protocol-labs/synapse-sap-sdk` ≥ 0.1.0
- `@coral-xyz/anchor` ≥ 0.30.0
- `@solana/web3.js` ≥ 1.90.0

#### Static factories

| Method | Returns | Description |
|---|---|---|
| `create(config)` | `SynapseAnchorSap` | Create from a `SapBridgeConfig`. Resolves Synapse endpoints automatically. |
| `fromSynapseClient(client, wallet, opts?)` | `SynapseAnchorSap` | Create by extracting the RPC endpoint from an existing `SynapseClient`. |

#### Instance properties

| Property | Type | Description |
|---|---|---|
| `sapClient` | `SapClient` | The underlying SAP SDK client. |
| `endpoint` | `SynapseEndpoint` | Resolved Synapse endpoint. |
| `programId` | `string` | SAP program ID in use. |
| `walletPubkey` | `string` | Wallet public key (base58). |
| `provider` | `AnchorProvider` | The Anchor provider instance. |
| `connection` | `Connection` | The Solana connection instance. |
| `isReady` | `boolean` | Whether the bridge is initialized. |

#### Module getters (proxy to SapClient)

| Getter | SapClient module | Description |
|---|---|---|
| `agent` | `AgentModule` | Register, update, deactivate, reactivate, close, reportCalls, fetchStats. |
| `builder` | `AgentBuilder` | Fluent builder — `.agent('Name').description('...').addCapability(...).register()`. |
| `session` | `SessionManager` | Memory sessions — start, write, readLatest, seal, close. |
| `escrow` | `EscrowModule` | x402 escrow — create, deposit, settle, withdraw, close. |
| `tools` | `ToolSchemaModule` | Tool schema registry — publish, inscribe, update, close. |
| `discovery` | `DiscoveryRegistry` | Find agents by capability, protocol, wallet. |
| `feedback` | `FeedbackModule` | On-chain reviews — give, update, revoke. |
| `attestation` | `AttestationModule` | Web-of-trust attestations — create, revoke. |
| `program` | `Program` | Direct access to the Anchor `Program` for low-level RPC. |

### Function: `createSapProvider`

HMR-safe singleton factory for Next.js server-side routes.
Stores the instance on `globalThis` to survive hot-module reloads.

```ts
function createSapProvider(
  wallet: SapWallet,
  config?: SapProviderConfig,
  opts?: SingletonOptions,
): () => SynapseAnchorSap;
```

| Parameter | Type | Description |
|---|---|---|
| `wallet` | `SapWallet` | Server wallet with signing capability. |
| `config` | `SapProviderConfig` | Network, region, SAP config (extends `SapBridgeConfig` without `wallet`). |
| `opts` | `SingletonOptions` | Singleton options (version for cache busting). |

### Function: `createSapContextBlueprint`

React integration blueprint — returns everything needed to wire SAP
into a React context provider without the SDK depending on React.

```ts
function createSapContextBlueprint(
  config?: Omit<SapBridgeConfig, 'wallet'>,
): SapContextBlueprint;
```

#### Interface: `SapContextBlueprint`

| Property | Type | Description |
|---|---|---|
| `defaultValue` | `SapContextValue<SynapseAnchorSap>` | Default context value (disconnected state). |
| `createManager()` | `SapStateManager` | Create a state manager for connect/disconnect lifecycle. |

#### Interface: `SapStateManager`

| Method | Returns | Description |
|---|---|---|
| `connect(wallet)` | `void` | Create a `SynapseAnchorSap` and store it. |
| `disconnect()` | `void` | Clear the client. |
| `getValue()` | `SapContextValue<SynapseAnchorSap>` | Get current context snapshot. |
| `subscribe(listener)` | `() => void` | Subscribe to state changes. Returns unsubscribe fn. |

### SAP Bridge Types

| Type | Description |
|---|---|
| `SapWallet` | Minimal wallet interface (`publicKey`, `signTransaction`, `signAllTransactions`). |
| `SapCommitment` | `'processed' \| 'confirmed' \| 'finalized'` |
| `SapBridgeConfig` | Full bridge config (wallet, network, region, rpcEndpoint, programId, commitment, etc.). |
| `SapProviderConfig` | `SapBridgeConfig` without `wallet` + optional `version` for cache busting. |
| `SapContextValue<T>` | React context shape (`client`, `loading`, `error`, `connect`, `disconnect`). |

### Constants

| Constant | Value | Description |
|---|---|---|
| `SAP_PROGRAM_ID` | `'SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL'` | Canonical SAP program ID (mainnet). |

### Errors

| Error | Description |
|---|---|
| `SapDependencyError` | Thrown when a required peer dependency (`@solana/web3.js`, `@coral-xyz/anchor`, or `synapse-sap-sdk`) is missing. |

---

## 11. Intents (DAG Planner)

**Module:** `src/ai/intents/`

Multi-step intent planning and execution with DAG-based dependency resolution.

### Class: `IntentParser`

Validates and normalizes intent definitions, auto-detects `$ref` dependencies.

| Method | Returns | Description |
|---|---|---|
| `parse(intent)` | `ValidationResult` | Validate and normalize an intent, detect step reference dependencies. |

### Class: `IntentPlanner`

DAG-based execution planner — cycle detection, topological sort, level assignment.

| Method | Returns | Description |
|---|---|---|
| `plan(intent)` | `IntentPlan` | Build an execution plan with dependency-ordered levels. |

### Class: `IntentExecutor`

Step-by-step execution engine with reference resolution and budget tracking.

| Method | Returns | Description |
|---|---|---|
| `execute(plan, options?)` | `Promise<IntentResult>` | Execute an intent plan with reference resolution and budget tracking. |

### Types

| Type | Description |
|---|---|
| `IntentProtocol` | Protocol identifier for intent steps. |
| `StepReference` | Reference link between steps (`$ref` pattern). |
| `IntentStep` | Single step: method, params, dependencies. |
| `Intent` | Full intent with steps, budget, metadata. |
| `IntentOptions` | Execution options (timeout, events, etc.). |
| `PlannedStep` | Step with resolved level and execution order. |
| `IntentPlan` | Full plan with levels and steps. |
| `StepStatus` | Step execution status enum. |
| `StepResult` | Single step execution result. |
| `IntentResultStatus` | Overall intent status. |
| `IntentResult` | Full intent execution result. |
| `IntentConfig` | Intent system configuration. |
| `ValidationResult` | Parser validation result. |
| `ParserConfig` | Parser configuration. |
| `PlannerConfig` | Planner configuration. |

### Errors

| Error | Description |
|---|---|
| `IntentError` | Base intent error. |
| `CyclicDependencyError` | Cyclic dependency detected in step graph. |
| `UnresolvedReferenceError` | A `$ref` could not be resolved. |
| `BudgetExceededError` | Execution cost exceeded budget. |

---

## 12. Actions & Blinks

**Module:** `src/ai/actions/`

Solana Actions specification compliant HTTP handlers + shareable Blink URL generation.

### Class: `ActionServer`

Framework-agnostic HTTP handler for Solana Actions spec.

| Method | Returns | Description |
|---|---|---|
| `defineAction(def)` | `void` | Register an action definition with handler. |
| `removeAction(id)` | `boolean` | Remove an action. |
| `getAction(id)` | `ActionDefinition \| undefined` | Get an action definition. |
| `listActions()` | `ActionDefinition[]` | List all registered actions. |
| `handleRequest(request)` | `Promise<Response>` | Handle GET/POST requests per Solana Actions spec. |
| `getActionsJson()` | `ActionsJson` | Generate `actions.json` manifest. |
| `toExpressMiddleware()` | `Function` | Convert to Express middleware. |
| `toFetchHandler()` | `Function` | Convert to Fetch API handler (for Next.js/Cloudflare). |

### Class: `BlinkGenerator`

URL generation and social metadata for shareable Blinks.

| Method | Returns | Description |
|---|---|---|
| `createUrl(params?)` | `string` | Generate a Blink URL with encoded parameters. |
| `createMetadata(opts)` | `BlinkMetadata` | Generate social sharing metadata (title, description, icon). |
| `toMetaTags(metadata)` | `string` | Convert metadata to HTML meta tags (Open Graph, Twitter). |
| `toHtmlPage(metadata)` | `string` | Generate a full HTML page with meta tags. |

### Factory Function

```ts
createBlinkFromAction(action: ActionDefinition, serverConfig: ActionServerConfig): { url: string; metadata: BlinkMetadata }
```

### Constants

| Constant | Description |
|---|---|
| `DEFAULT_RESOLVER_URL` | Default Blink resolver URL. |
| `ACTION_SCHEME` | Solana Action URL scheme. |

### Types

| Type | Description |
|---|---|
| `ActionType` | Action type string. |
| `ActionParameter` | Parameter definition (name, label, type). |
| `LinkedAction` | Linked action (href, label, parameters). |
| `ActionGetResponse` | GET response (icon, title, description, links). |
| `ActionPostRequest` | POST request body (account). |
| `ActionPostResponse` | POST response (transaction, message). |
| `ActionsJson` | `actions.json` manifest. |
| `ActionsJsonRule` | Rule for `actions.json` path matching. |
| `ActionHandler` | Async handler for action POST requests. |
| `ActionContext` | Context passed to action handlers. |
| `ActionDefinition` | Full action definition. |
| `ActionServerConfig` | Server configuration (base URL, CORS). |
| `BlinkConfig` | Blink generator configuration. |
| `BlinkMetadata` | Social metadata output. |

### Errors

| Error | Description |
|---|---|
| `ActionServerError` | Action server error. |

---

## 13. Persistence

**Module:** `src/ai/persistence/`

Pluggable persistence for agent state, sessions, receipts, and metrics with three backends.

### Interface: `PersistenceStore`

All backends implement this interface:

#### Key-Value Operations

| Method | Returns | Description |
|---|---|---|
| `connect()` | `Promise<void>` | Connect to the store. |
| `disconnect()` | `Promise<void>` | Disconnect from the store. |
| `ping()` | `Promise<boolean>` | Health check. |
| `get<T>(key)` | `Promise<T \| null>` | Get a value by key. |
| `set(key, value, opts?)` | `Promise<void>` | Set a value (optional TTL). |
| `del(key)` | `Promise<void>` | Delete a key. |
| `has(key)` | `Promise<boolean>` | Check key existence. |

#### Agent Operations

| Method | Returns | Description |
|---|---|---|
| `saveAgent(snapshot)` | `Promise<void>` | Save an agent gateway snapshot. |
| `loadAgent(agentId)` | `Promise<GatewaySnapshot \| null>` | Load an agent snapshot. |
| `deleteAgent(agentId)` | `Promise<void>` | Delete an agent. |
| `listAgents()` | `Promise<AgentId[]>` | List all agent IDs. |

#### Session Operations

| Method | Returns | Description |
|---|---|---|
| `saveSession(record)` | `Promise<void>` | Save a session record. |
| `loadSession(agentId, sessionId)` | `Promise<SessionRecord \| null>` | Load a session. |
| `deleteSessions(agentId)` | `Promise<void>` | Delete all sessions for an agent. |
| `listSessions(agentId, opts?)` | `Promise<SessionRecord[]>` | List sessions with optional filters. |

#### Receipt & Metrics Operations

| Method | Returns | Description |
|---|---|---|
| `saveReceipt(record)` | `Promise<void>` | Save a payment receipt. |
| `listReceipts(agentId, opts?)` | `Promise<ReceiptRecord[]>` | List receipts with optional filters. |
| `recordMetric(agentId, key, value, labels?)` | `Promise<void>` | Record a time-series metric. |
| `queryMetrics(agentId, opts)` | `Promise<MetricPoint[]>` | Query time-series metrics. |

### Backends

| Class | Description |
|---|---|
| `MemoryStore` | In-memory Map-based store with TTL + FIFO eviction. |
| `RedisPersistence` | Redis/Valkey-backed store with configurable key prefix. |
| `PostgresPersistence` | PostgreSQL store with JSONB columns and auto-migration. |

### Configuration Types

| Type | Description |
|---|---|
| `StoreConfig` | Base store config. |
| `MemoryStoreConfig` | Memory store config (maxSize, defaultTtl). |
| `RedisStoreConfig` | Redis config (client, keyPrefix). |
| `PostgresStoreConfig` | PostgreSQL config (pool, schema, tableName). |
| `SetOptions` | Set operation options (ttl). |
| `ListOptions` | List operation options (limit, offset, status filter). |
| `MetricQueryOpts` | Metric query options (key, from, to, limit). |
| `SessionRecord` | Serialized session data. |
| `ReceiptRecord` | Serialized payment receipt. |
| `MetricPoint` | Time-series metric data point. |
| `RedisLike` | Minimal Redis client interface. |
| `PgLike` | Minimal PostgreSQL pool interface. |

### Utility Functions

| Function | Description |
|---|---|
| `serialize(value)` | BigInt-safe JSON serialization. |
| `deserialize<T>(json)` | BigInt-safe JSON deserialization. |
| `buildKey(prefix, ...parts)` | Build a namespaced key. |
| `parseKey(key)` | Parse a namespaced key. |
| `extractAgentId(key)` | Extract agent ID from a namespaced key. |
| `buildSchema(config)` | Build PostgreSQL schema DDL. |
| `buildKvCleanupSql(config)` | Build PostgreSQL TTL cleanup SQL. |

### Constants / Errors

| Name | Description |
|---|---|
| `SCHEMA_VERSION` | Current schema version constant. |
| `PersistenceError` | Persistence error class. |

---

## 14. Plugins (SynapseAgentKit)

**Module:** `src/ai/plugins/`

Chainable plugin system for composing agent capabilities.

### Class: `SynapseAgentKit`

Plugin host that aggregates tools from installed plugins.

#### Constructor

```ts
new SynapseAgentKit(config: AgentKitConfig)
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `use(plugin, config?)` | `this` | Install a plugin (chainable). |
| `getTools()` | `DynamicStructuredTool[]` | Get all tools across all installed plugins. |
| `getToolMap()` | `Map<string, DynamicStructuredTool>` | Get tools as a name→tool map. |
| `getPluginTools(pluginId)` | `DynamicStructuredTool[]` | Get tools from a specific plugin. |
| `getProtocolToolkit(pluginId, protocolId)` | `ProtocolToolkit` | Get protocol-specific tools from a plugin. |
| `getMcpToolDescriptors()` | `McpToolDescriptor[]` | Get MCP-compatible tool descriptors. |
| `getMcpResourceDescriptors()` | `McpResourceDescriptor[]` | Get MCP-compatible resource descriptors. |
| `getVercelAITools()` | `object` | Get tools in Vercel AI SDK format. |
| `summary()` | `object` | Summary of installed plugins and tool counts. |
| `hasPlugin(pluginId)` | `boolean` | Check if a plugin is installed. |
| `getInstalledPlugins()` | `InstalledPlugin[]` | List installed plugins with metadata. |
| `destroy()` | `Promise<void>` | Tear down all plugins. |

### Built-in Plugins

| Plugin | Description |
|---|---|
| `TokenPlugin` | SPL token operations (transfer, mint, burn, etc.). |
| `NFTPlugin` | Metaplex NFT operations. |
| `DeFiPlugin` | Jupiter + Raydium DeFi protocol tools. |
| `MiscPlugin` | Utility tools (memo, compute budget, etc.). |
| `BlinksPlugin` | Blink URL generation tools. |

### Plugin Interface

```ts
interface SynapsePlugin {
  meta: PluginMeta;               // id, name, version, description
  protocols?: PluginProtocol[];   // protocol toolkits
  install(ctx: PluginContext, config?: unknown): PluginInstallResult;
  destroy?(): Promise<void>;
}
```

### Types

| Type | Description |
|---|---|
| `SynapsePlugin` | Plugin interface. |
| `PluginMeta` | Plugin metadata (id, name, version, description). |
| `PluginProtocol` | Protocol toolkit within a plugin. |
| `PluginContext` | Context provided during plugin installation. |
| `PluginExecutor` | Executor function for plugin tools. |
| `PluginInstallResult` | Installation result with tools + resources. |
| `InstalledPlugin` | Installed plugin metadata + tool count. |
| `AgentKitConfig` | AgentKit configuration (client, gateway, options). |
| `McpToolDescriptor` | MCP-compatible tool descriptor. |
| `McpResourceDescriptor` | MCP-compatible resource descriptor. |

---

## 15. MCP (Model Context Protocol)

**Module:** `src/ai/mcp/`

MCP spec 2024-11-05 — expose SynapseAgentKit as an MCP server or bridge to external MCP servers.

### Class: `SynapseMcpServer`

Exposes a `SynapseAgentKit` as a stdio/SSE MCP server with full protocol support.

#### Constructor

```ts
new SynapseMcpServer(kit: SynapseAgentKit, config?: McpServerConfig)
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `start()` | `Promise<void>` | Start the MCP server (stdio or SSE). |
| `stop()` | `Promise<void>` | Stop the MCP server. |

**Implements MCP spec methods:** `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, `ping`.

### Class: `McpClientBridge`

Connects to external MCP servers and imports their tools as LangChain-compatible tools.

#### Constructor

```ts
new McpClientBridge(opts?: { timeout?: number })
```

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `connect(config)` | `Promise<void>` | Connect to an external MCP server. |
| `disconnect(id)` | `Promise<void>` | Disconnect from a specific server. |
| `disconnectAll()` | `Promise<void>` | Disconnect from all servers. |
| `getTools()` | `DynamicStructuredTool[]` | Get all imported tools across all servers. |
| `getServerTools(serverId)` | `DynamicStructuredTool[]` | Get tools from a specific server. |
| `callTool(serverId, toolName, args?)` | `Promise<McpToolCallResult>` | Call a tool on a specific server. |
| `readResource(serverId, uri)` | `Promise<string>` | Read a resource from a server. |
| `toPlugin()` | `SynapsePlugin` | Convert bridge to a `SynapsePlugin` for use with `SynapseAgentKit`. |
| `getStatus(id)` | `McpConnectionStatus` | Get connection status for a server. |
| `getAllStatuses()` | `Map<string, McpConnectionStatus>` | Get all connection statuses. |
| `getAllToolDefinitions()` | `McpToolDefinition[]` | Get raw MCP tool definitions. |

### Constants

| Constant | Description |
|---|---|
| `MCP_PROTOCOL_VERSION` | `"2024-11-05"` |
| `MCP_JSONRPC_VERSION` | `"2.0"` |

### Types

| Type | Description |
|---|---|
| `JsonRpcRequest` | JSON-RPC 2.0 request. |
| `JsonRpcResponse` | JSON-RPC 2.0 response. |
| `JsonRpcNotification` | JSON-RPC 2.0 notification. |
| `McpToolDefinition` | MCP tool definition (name, description, inputSchema). |
| `McpToolCallParams` | Tool call parameters. |
| `McpToolCallResult` | Tool call result. |
| `McpResourceDefinition` | MCP resource definition. |
| `McpResourceTemplate` | MCP resource template. |
| `McpPromptDefinition` | MCP prompt definition. |
| `McpPromptMessage` | MCP prompt message. |
| `McpServerInfo` | Server info (name, version). |
| `McpCapabilities` | Server capability declaration. |
| `McpTransport` | Transport type (`stdio` \| `sse`). |
| `McpServerConfig` | Server configuration. |
| `McpExternalServerConfig` | External server connection config. |
| `McpConnectionStatus` | Connection status enum. |

### Errors

| Error | Description |
|---|---|
| `McpServerError` | MCP server error. |

---

## 16. Lazy Tool Factories

**Module:** `src/ai/lazy.ts`

Dynamic-import wrappers for protocol tools — prevents webpack/Next.js from bundling large dependencies.

| Function | Returns | Description |
|---|---|---|
| `getJupiterTools(config?)` | `Promise<ProtocolToolkit>` | Lazily load and cache Jupiter tools (singleton). |
| `getRaydiumTools(config?)` | `Promise<ProtocolToolkit>` | Lazily load and cache Raydium tools (singleton). |

---

## 17. Programs (Instruction Encoders)

**Module:** `src/programs/`

Zero-dependency Solana native program instruction encoders.

### Static Classes

| Class | Methods |
|---|---|
| `SystemProgram` | `transfer`, `createAccount`, `assign`, `allocate`, `createAccountWithSeed`, `advanceNonceAccount`, `withdrawNonceAccount`, `authorizeNonceAccount`, `initializeNonceAccount` |
| `SplToken` | `initializeMint`, `initializeAccount`, `transfer`, `transferChecked`, `approve`, `revoke`, `mintTo`, `burn`, `closeAccount`, `freezeAccount`, `syncNative` |
| `AssociatedToken` | `createATA`, `recoverNested` |
| `Memo` | `addMemo` |
| `ComputeBudget` | `setComputeUnitLimit`, `setComputeUnitPrice`, `requestHeapFrame` |

### Utility Function

| Function | Description |
|---|---|
| `toKitInstruction(ix)` | Convert Synapse `TransactionInstruction` to `@solana/kit` instruction. |

### Types

| Type | Description |
|---|---|
| `AccountMeta` | Account metadata (pubkey, isSigner, isWritable). |
| `TransactionInstruction` | Instruction (programId, keys, data). |
| `InstructionWriter` | Low-level instruction data writer. |

---

## 18. Kit (@solana/kit Bridge)

**Module:** `src/kit/`

Re-exports curated types and functions from `@solana/kit` (official Anza SDK).

### Categories of Re-exports

| Category | Examples |
|---|---|
| **Addresses** | `Address`, `address()`, `isAddress()`, `getAddressFromPublicKey()` |
| **Keys/Signatures** | `Signature`, `SignatureBytes`, `isSignature()` |
| **Signers** | `KeyPairSigner`, `createKeyPairSignerFromBytes()`, `generateKeyPairSigner()`, `createSignerFromKeyPair()` |
| **RPC** | `Rpc`, `SolanaRpcApi`, `createSolanaRpc()`, `createSolanaRpcSubscriptions()` |
| **Subscriptions** | `RpcSubscriptions`, `SolanaRpcSubscriptionsApi` |
| **Transaction Building** | `createTransactionMessage()`, `setTransactionMessageLifetimeUsingBlockhash()`, `appendTransactionMessageInstruction()`, `compileTransaction()` |
| **Sending/Confirmation** | `sendAndConfirmTransactionFactory()`, `getSignatureFromTransaction()` |
| **Codecs** | `getBase58Decoder()`, `getBase58Encoder()`, `getBase64Decoder()`, `getBase64Encoder()`, `getUtf8Encoder()` |
| **Errors** | `isSolanaError()`, `SolanaError` |

### Bridge Function

| Function | Description |
|---|---|
| `toKitAddress(pubkey)` | Convert a base58 public key string to a `@solana/kit` `Address`. |

---

## 19. Context (IoC Container)

**Module:** `src/context/`

Dependency injection container with scoping, middleware, lifecycle management, and ref-counting.

### Class: `SynapseContext`

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `register(token, provider, tags?)` | `void` | Register a service provider with optional tags. |
| `registerMany(registrations)` | `void` | Register multiple providers at once. |
| `registerIfMissing(token, provider, tags?)` | `boolean` | Register only if not already registered. |
| `resolve<T>(token)` | `T` | Resolve a service synchronously. |
| `resolveAsync<T>(token)` | `Promise<T>` | Resolve a service asynchronously. |
| `tryResolve<T>(token)` | `T \| undefined` | Resolve or return undefined. |
| `has(token)` | `boolean` | Check if a service is registered. |
| `resolveByTag(tag)` | `unknown[]` | Resolve all services with a given tag. |
| `createScope(scopeId?)` | `SynapseContext` | Create a child scope (inherits parent registrations). |
| `addMiddleware(mw)` | `void` | Add resolution middleware. |
| `acquireRef<T>(token)` | `ServiceRef<T>` | Acquire a ref-counted service handle. |
| `bind(tokens)` | `BoundServices` | Bind multiple tokens at once for convenience. |
| `refCount(token)` | `number` | Get current ref count for a token. |
| `enableMemoryGuard(config?)` | `void` | Enable memory usage monitoring. |
| `dispose()` | `void` | Dispose all services and scopes. |

### Factory Functions

| Function | Returns | Description |
|---|---|---|
| `createSynapseContext(config, opts?)` | `SynapseContext` | Create a fully wired context with all SDK services. |
| `createBareContext()` | `SynapseContext` | Create an empty context. |

### Pre-defined Tokens

| Token | Description |
|---|---|
| `Tokens.RPC` | Solana RPC client. |
| `Tokens.DAS` | DAS client. |
| `Tokens.Programs` | Programs module. |

### Hooks & Utilities

| Function | Description |
|---|---|
| `setGlobalContext(ctx)` | Set the global context singleton. |
| `getContext()` | Get the global context. |
| `useService<T>(token)` | Resolve a service from the global context. |
| `createServiceHook(token)` | Create a reusable service hook. |
| `autoWire(target)` | Decorator for automatic DI wiring. |
| `createReactAdapter(ctx)` | Create a React context provider + hook. |
| `createServerMiddleware(ctx)` | Create Express/Koa middleware for per-request scoping. |

### Ref-counting Classes

| Class | Description |
|---|---|
| `ServiceRef<T>` | Ref-counted service handle with `release()`. |
| `WeakServiceRef<T>` | Weak-ref variant. |
| `RefRegistry` | Registry of all active refs. |
| `MemoryGuard` | Memory usage monitor. |

### Errors

| Error | Description |
|---|---|
| `ServiceNotFoundError` | Token not registered. |
| `CircularDependencyError` | Circular dependency detected during resolution. |
| `AsyncProviderError` | Async provider errors. |

---

## 20. gRPC / Geyser Parser

**Module:** `src/grpc/`

Parser for Solana Geyser gRPC subscription updates.

### Class: `GeyserParser` *(extends EventEmitter)*

Streaming parser for Geyser gRPC subscription data.

#### Public Methods

| Method | Returns | Description |
|---|---|---|
| `parse(raw)` | `ParsedGeyserUpdate \| null` | Parse a raw Geyser update. |
| `passthrough(raw)` | `void` | Emit raw update without parsing. |
| `updateConfig(patch)` | `void` | Patch parser configuration. |
| `addPrograms(programs)` | `void` | Add program IDs for parsing. |
| `resetStats()` | `void` | Reset parse statistics. |
| `config` *(getter)* | `GeyserParserConfig` | Get current configuration. |
| `stats` *(getter)* | `GeyserParserStats` | Get parse statistics. |

### Decoder Functions

| Function | Description |
|---|---|
| `parseTransaction(raw)` | Parse a raw Geyser transaction update. |
| `parseAccountUpdate(raw)` | Parse a raw Geyser account update. |
| `parseSlotUpdate(raw)` | Parse a slot update. |
| `parseBlockMeta(raw)` | Parse block metadata. |
| `parseEntry(raw)` | Parse a ledger entry. |
| `parseGeyserUpdate(raw)` | Parse any Geyser update (auto-detect type). |
| `computeBalanceChanges(tx)` | Compute SOL balance changes from a transaction. |
| `computeTokenBalanceChanges(tx)` | Compute token balance changes from a transaction. |
| `base58Encode(bytes)` | Encode bytes to base58. |
| `rawBufferToBytes(buf)` | Convert raw buffer to `Uint8Array`. |
| `rawBufferToBase58(buf)` | Convert raw buffer to base58 string. |
| `rawBufferToHex(buf)` | Convert raw buffer to hex string. |
| `rawBufferToBase64(buf)` | Convert raw buffer to base64 string. |

### Known Programs

| Function / Constant | Description |
|---|---|
| `KNOWN_PROGRAMS` | Map of known program IDs → names. |
| `resolveProgram(programId)` | Resolve program ID to human name. |
| `resolveProgramBatch(programIds)` | Batch resolve program IDs. |
| Constants | `JUPITER_V6`, `RAYDIUM_AMM`, `METEORA`, `ORCA_WHIRLPOOL`, `METAPLEX_TOKEN_METADATA`, `MARINADE_FINANCE`, etc. |

### Types

| Type | Description |
|---|---|
| `GeyserParserConfig` | Parser configuration (programs, filters, options). |
| `GeyserParserEvents` | Event map for typed EventEmitter. |
| `GeyserParserStats` | Parse statistics (counts, errors, latency). |
| `ParsedTransaction` | Parsed transaction with instructions, accounts, balances. |
| `ParsedAccountUpdate` | Parsed account update. |
| `ParsedSlotUpdate` | Parsed slot update. |
| `ParsedBlockMeta` | Parsed block metadata. |
| `ParsedEntry` | Parsed ledger entry. |
| `ParsedGeyserUpdate` | Union type of all parsed update types. |

---

## 21. Next.js Integration

**Module:** `src/next/`

HMR-safe singleton providers and response helpers for Next.js API routes.

### Exported Functions

| Function | Returns | Description |
|---|---|---|
| `synapseResponse(data, init?)` | `Response` | Create a BigInt-safe JSON `Response`. |
| `withSynapseError(handler)` | `Function` | Wrap an API route handler with error boundary. |
| `createSynapseProvider(config, opts?)` | `() => SynapseClient` | HMR-safe singleton `SynapseClient` provider. |
| `createGatewayProvider(clientProvider, configFactory, opts?)` | `() => AgentGateway` | HMR-safe singleton `AgentGateway` provider. |

---

## Gateway Core Types

**Module:** `src/ai/gateway/types.ts`

| Type | Description |
|---|---|
| `AgentId` | Branded string identifier + `AgentId(value)` factory. |
| `AgentIdentity` | Agent identity (id, name, walletPubkey, description, tags). |
| `AgentCredential` | Agent credential for signing. |
| `PaymentToken` | Token type (`SOL` \| `USDC` \| `SPL` with mint + decimals). |
| `PricingTier` | Tier config (id, label, pricePerCall, maxCalls, rateLimit, token, attestation). |
| `PaymentIntent` | Session payment intent. |
| `PaymentReceipt` | Settlement receipt. |
| `SessionStatus` | `'pending' \| 'active' \| 'paused' \| 'settled' \| 'expired'` |
| `SessionState` | Full session state snapshot. |
| `ResponseAttestation` | Attestation hash, timestamp, slot, signature. |
| `AttestedResult<T>` | Wrapped result with attestation + metadata. |
| `ToolListing` | Marketplace tool listing. |
| `ToolBundle` | Bundle of tools with discount. |
| `GatewayEventType` | Event type enum. |
| `GatewayEvent` | Event object. |
| `GatewayEventHandler` | Event handler function. |
| `GatewayConfig` | Full gateway configuration. |
| `RetryConfig` | Retry policy config. |
| `SnapshotDepth` | `'summary' \| 'full' \| 'debug'` |
| `GatewaySnapshot` | Gateway state snapshot. |
| `X402PipelineStep` | x402 pipeline step for progress callbacks. |
