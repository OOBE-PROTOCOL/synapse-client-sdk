# @oobe-protocol-labs/synapse-client-sdk

Typed Solana RPC gateway SDK for Node.js and the browser.
Covers JSON-RPC, WebSocket PubSub, gRPC/Geyser streaming, DAS (Digital Asset Standard),
AI agent tooling (LangChain + Zod), a modular plugin system (110+ on-chain tools),
MCP (Model Context Protocol) server & client bridge, and the x402 HTTP payment protocol —
all behind a single `SynapseClient` entry point.

| | |
|-|-|
| **Version** | 2.0.0 |
| **License** | MIT |
| **Node** | >= 18.0.0 |
| **TypeScript** | >= 5.0 |
| **Registry** | `npm i @oobe-protocol-labs/synapse-client-sdk` |

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Module Reference](#module-reference)
   - [core/](#core)
   - [rpc/](#rpc)
   - [das/](#das)
   - [websocket/](#websocket)
   - [grpc/](#grpc)
   - [ai/](#ai)
   - [utils/](#utils)
5. [Endpoints and Regions](#endpoints-and-regions)
6. [Branded Types](#branded-types)
7. [AI Agent Integration](#ai-agent-integration)
   - [Zod Schemas and LangChain Tools](#zod-schemas-and-langchain-tools)
   - [Protocol Tools (Jupiter, Raydium, Metaplex)](#protocol-tools)
   - [Agent Commerce Gateway](#agent-commerce-gateway)
   - [x402 Payment Protocol](#x402-payment-protocol)
8. [Plugin System (SynapseAgentKit)](#plugin-system-synapseagentkit)
9. [MCP (Model Context Protocol)](#mcp-model-context-protocol)
10. [Testing](#testing)
11. [Build and Development](#build-and-development)
12. [Package Exports](#package-exports)
13. [Documentation](#documentation)
14. [Contributing](#contributing)
15. [License](#license)

---

## Installation

```bash
# pnpm (recommended)
pnpm add @oobe-protocol-labs/synapse-client-sdk

# npm
npm install @oobe-protocol-labs/synapse-client-sdk

# yarn
yarn add @oobe-protocol-labs/synapse-client-sdk
```

TypeScript is a peer dependency. Ensure `typescript >= 5.0` is installed in your project.

---

## Quick Start

```ts
import { SynapseClient, Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';

const client = new SynapseClient({
  endpoint: 'https://rpc.synapse.com',
  apiKey: 'sk-...',
});

// JSON-RPC
const balance = await client.rpc.getBalance(Pubkey('So11111111111111111111111111111111'));
console.log(balance.value); // lamports

// DAS (compressed NFTs)
const asset = await client.das.getAsset(Pubkey('...'));
console.log(asset.content.metadata?.name);

// WebSocket
client.ws.onSlotChange((slot) => console.log('slot', slot));

// Cleanup
client.destroy();
```

### Factory helpers

```ts
import { createSynapse } from '@oobe-protocol-labs/synapse-client-sdk';

const client = createSynapse({ endpoint: 'https://rpc.synapse.com' });
```

```ts
import { SynapseClient, SynapseNetwork, SynapseRegion } from '@oobe-protocol-labs/synapse-client-sdk';

// Auto-resolved endpoint by network and region
const client = SynapseClient.fromEndpoint({
  network: SynapseNetwork.Mainnet,
  region: SynapseRegion.US,
  apiKey: 'sk-...',
});
```

---

## Architecture

```
SynapseClient
 |
 |-- .rpc           SolanaRpc          53 JSON-RPC methods (lazy-loaded)
 |-- .das           DasClient          11 DAS/Metaplex Read API methods
 |-- .ws            WsClient           WebSocket PubSub subscriptions
 |-- .grpc          GrpcTransport      gRPC unary calls + Geyser parser
 |
 |-- call()         Raw JSON-RPC call
 |-- batch()        Batched JSON-RPC calls
 |-- destroy()      Tear down all connections

SynapseAgentKit                         ← Plugin system (v2)
 |
 |-- .use(Plugin)   Chainable plugin loader
 |-- .getTools()    LangChain StructuredTool[] (all plugins)
 |-- .getVercelAITools()   Vercel AI SDK tools
 |-- .getMcpToolDescriptors()  MCP-shaped descriptors
 |
 |-- Plugins:       Token (22) · NFT (19) · DeFi (43) · Misc (20) · Blinks (6)

SynapseMcpServer                        ← MCP server
 |
 |-- start()        stdio transport (Claude Desktop, Cursor)
 |-- startSse()     SSE transport (web clients)

McpClientBridge                         ← MCP client
 |
 |-- connect()      Connect to external MCP servers
 |-- getTools()     LangChain tools from remote servers
 |-- toPlugin()     Convert to .use()-able plugin
```

Sub-clients are initialized on first property access.
If you never touch `client.grpc`, the gRPC module is never loaded.

All I/O flows through `HttpTransport` (`src/core/transport.ts`), which handles
JSON-RPC framing, timeout, abort signals, and batch aggregation.

---

## Module Reference

### core/

Foundation layer. No external dependencies.

| File | Purpose |
|------|---------|
| `src/core/types.ts` | Branded primitive types: `Pubkey`, `Signature`, `Slot`, `Epoch`, `Lamports`, `UnixTimestamp`. RPC wire types, account shapes, transaction metadata, validator info, token amounts, filter types. |
| `src/core/errors.ts` | Error hierarchy: `SynapseError` (base), `NetworkError`, `TimeoutError`, `RpcMethodNotFoundError`, `UpstreamError`. |
| `src/core/transport.ts` | `HttpTransport` class -- JSON-RPC HTTP transport. `request()` for single calls, `batch()` for aggregated calls. |
| `src/core/client.ts` | `SynapseClient` class -- top-level orchestrator. Lazy getters for `.rpc`, `.das`, `.ws`, `.grpc`. Static `fromEndpoint()` factory. |

### rpc/

53 Solana JSON-RPC methods. Each method lives in its own file under `src/rpc/methods/` for tree-shaking.

| File | Purpose |
|------|---------|
| `src/rpc/solana-rpc.ts` | `SolanaRpc` facade class. Delegates to standalone functions. |
| `src/rpc/methods/*.ts` | One file per RPC method. Each exports a typed async function and optional `Opts` interface. |
| `src/rpc/methods/index.ts` | Barrel re-export. |

Method categories:

| Category | Methods |
|----------|---------|
| Account | `getAccountInfo`, `getBalance`, `getMultipleAccounts`, `getProgramAccounts` |
| Block | `getBlock`, `getBlockHeight`, `getBlockTime`, `getBlockProduction`, `getBlocks`, `getBlocksWithLimit`, `getBlockCommitment` |
| Transaction | `getTransaction`, `getSignaturesForAddress`, `getSignatureStatuses`, `sendTransaction`, `simulateTransaction`, `requestAirdrop` |
| Blockhash | `getLatestBlockhash`, `isBlockhashValid` |
| Cluster / Epoch | `getSlot`, `getSlotLeader`, `getSlotLeaders`, `getEpochInfo`, `getEpochSchedule`, `getInflationGovernor`, `getInflationRate`, `getInflationReward`, `getVoteAccounts`, `getClusterNodes`, `getSupply`, `getRecentPerformanceSamples`, `getHealth`, `getVersion`, `getGenesisHash`, `getIdentity`, `getMinimumBalanceForRentExemption`, `minimumLedgerSlot`, `getFirstAvailableBlock`, `getHighestSnapshotSlot`, `getLeaderSchedule`, `getMaxRetransmitSlot`, `getMaxShredInsertSlot`, `getTransactionCount`, `getStakeMinimumDelegation`, `getRecentPrioritizationFees` |
| Token | `getTokenAccountBalance`, `getTokenAccountsByOwner`, `getTokenAccountsByDelegate`, `getTokenLargestAccounts`, `getTokenSupply`, `getLargestAccounts`, `getStakeActivation` (deprecated), `getFeeForMessage` |

### das/

11 DAS (Digital Asset Standard) methods for NFT/cNFT via the Metaplex Read API.

| File | Purpose |
|------|---------|
| `src/das/types.ts` | DAS type definitions: `DasAsset`, `DasContent`, `DasCompression`, `DasOwnership`, `DasProof`, `DasPage`, `DasSearchParams`, and 10+ supporting interfaces. |
| `src/das/client.ts` | `DasClient` facade class. |
| `src/das/methods/*.ts` | `getAsset`, `getAssetProof`, `getAssetBatch`, `getAssetProofBatch`, `getAssetsByOwner`, `getAssetsByGroup`, `getAssetsByCreator`, `getAssetsByAuthority`, `searchAssets`, `getSignaturesForAsset`, `getTokenAccounts`. |

### websocket/

Real-time Solana PubSub over WebSocket.

| File | Purpose |
|------|---------|
| `src/websocket/types.ts` | `WsConfig`, subscription parameter interfaces, notification types, `WsNotification` union. |
| `src/websocket/client.ts` | `WsClient` class. Methods: `onAccountChange`, `onProgramAccountChange`, `onLogs`, `onSignature`, `onSlotChange`, `onRootChange`, `unsubscribe`, `close`. |

### grpc/

Optional gRPC transport and Geyser streaming parser.
Requires `@grpc/grpc-js` and `@grpc/proto-loader` as optional peer dependencies.

| File | Purpose |
|------|---------|
| `src/grpc/types.ts` | `GrpcTransportConfig`, `GrpcCallOptions`, `UnaryMethod`. |
| `src/grpc/transport.ts` | `GrpcTransport` class. Lazy proto loading, service resolution, typed unary calls. |
| `src/grpc/parser/types.ts` | Raw Geyser gRPC protobuf shapes and parsed output types (20+ interfaces). |
| `src/grpc/parser/programs.ts` | Known-program registry (80+ programs). `resolveProgram`, `resolveProgramBatch`, `isProgramInCategory`. |
| `src/grpc/parser/decoder.ts` | Low-level decoders: `decodeTransaction`, `decodeAccountUpdate`, `decodeSlotUpdate`, `decodeBlockMeta`, `decodeEntry`, and balance/token-balance diff utilities. |
| `src/grpc/parser/geyser-parser.ts` | `GeyserParser` class. High-level stream parsing with event emitter, statistics tracking, batch processing, and configurable filters (skip votes, skip zero balances). |

### ai/

AI agent layer. Zod schemas, LangChain tools, protocol integrations, gateway, x402, plugin system, MCP.

| File | Purpose |
|------|---------|
| `src/ai/tools/zod/types.ts` | `AgentMethodDef` interface -- Zod input/output schema pair. |
| `src/ai/tools/zod/index.ts` | `agentRpcMethods` registry (53 method schemas) and `createExecutableSolanaTools()` factory. |
| `src/ai/tools/protocols/shared.ts` | `ProtocolHttpClient`, `createMethodRegistry`, `buildProtocolTools` -- shared protocol infrastructure. |
| `src/ai/tools/protocols/jupiter/` | Jupiter DEX: 21 methods (swap, quote, route, limit orders, DCA, token list, price). Schemas in `schemas.ts`, tool factory in `tools.ts`. |
| `src/ai/tools/protocols/raydium/` | Raydium DEX: 16 methods (pools, liquidity, farming, swaps, CLMM). |
| `src/ai/tools/protocols/metaplex/` | Metaplex NFT: 12 methods (DAS queries, resolve collection). |
| `src/ai/tools/protocols/index.ts` | `createProtocolTools()` super-factory -- creates all protocol toolkits in one call. |
| `src/ai/gateway/types.ts` | Gateway type definitions: `PaymentIntent`, `PricingTier`, `ToolListing`, `SessionReceipt`, events. |
| `src/ai/gateway/session.ts` | `AgentSession` -- budget tracking, rate limiting, TTL enforcement, call counting. |
| `src/ai/gateway/pricing.ts` | `PricingEngine` -- tier resolution, dynamic congestion pricing, bundle discounts. |
| `src/ai/gateway/validator.ts` | `ResponseValidator` -- SHA-256 attestation, integrity verification, attestation log. |
| `src/ai/gateway/marketplace.ts` | `ToolMarketplace` -- listing, search, filtering, reputation scoring, bundle registry. |
| `src/ai/gateway/index.ts` | `AgentGateway` class -- session lifecycle, execution pipeline, settlement, event system. |
| `src/ai/gateway/x402/types.ts` | x402 protocol types: `PaymentRequirements`, `PaymentPayload`, `SettlementResult`, network constants. |
| `src/ai/gateway/x402/paywall.ts` | `X402Paywall` -- seller-side HTTP 402 middleware. |
| `src/ai/gateway/x402/client.ts` | `X402BuyerClient` -- buyer-side payment header construction. |
| `src/ai/gateway/x402/facilitator.ts` | `FacilitatorClient` -- on-chain settlement verification. |
| `src/ai/gateway/x402/registry.ts` | `FACILITATOR_REGISTRY` -- pre-configured endpoints for known facilitators (PayAI, Dexter, RelAI, CDP). |
| `src/ai/plugins/types.ts` | Plugin system core types: `SynapsePlugin`, `PluginMeta`, `PluginProtocol`, `PluginContext`, `PluginExecutor`. |
| `src/ai/plugins/registry.ts` | `SynapseAgentKit` class — chainable `.use()`, multi-format tool export (LangChain, Vercel AI, MCP). |
| `src/ai/plugins/token/` | Token plugin: 22 methods (SPL tokens, staking, bridging). |
| `src/ai/plugins/nft/` | NFT plugin: 19 methods (Metaplex, 3Land, DAS). |
| `src/ai/plugins/defi/` | DeFi plugin: 43 methods (Pump, Raydium, Orca, Manifest, Meteora, OpenBook, Drift, Adrena, Lulo, Jito). |
| `src/ai/plugins/misc/` | Misc plugin: 20 methods (SNS, AllDomains, Pyth, CoinGecko, GibWork, Send Arcade). |
| `src/ai/plugins/blinks/` | Blinks plugin: 6 methods (Solana Actions spec). |
| `src/ai/mcp/types.ts` | MCP protocol types (JSON-RPC, tools, resources, prompts, transports). |
| `src/ai/mcp/server.ts` | `SynapseMcpServer` — expose SynapseAgentKit as MCP server (stdio + SSE). |
| `src/ai/mcp/client.ts` | `McpClientBridge` — connect to external MCP servers, import tools. |

### utils/

| File | Purpose |
|------|---------|
| `src/utils/helpers.ts` | `lamportsToSol`, `solToLamports`, `isValidPubkey`, `isValidSignature`, `sleep`, `chunk`, `retry`. |
| `src/utils/synapse.ts` | `SynapseNetwork`, `SynapseRegion` enums, `resolveEndpoint`, `probeLatency`, `autoSelectRegion`, pre-resolved constants (`SYNAPSE_MAINNET_US`, etc.). |

---

## Endpoints and Regions

The SDK ships with a typed endpoint registry. Each endpoint includes `rpc`, `wss`, and `grpc` URLs.

```ts
import {
  SynapseNetwork,
  SynapseRegion,
  resolveEndpoint,
  autoSelectRegion,
} from '@oobe-protocol-labs/synapse-client-sdk';

// Explicit resolution
const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);
// ep.rpc  -> 'https://mainnet.eu.synapse.com'
// ep.wss  -> 'wss://mainnet.eu.synapse.com/ws'
// ep.grpc -> 'https://mainnet.eu.synapse.com:443'

// Latency-based auto-selection
const best = await autoSelectRegion(SynapseNetwork.Mainnet);
console.log(best.region, best.latencyMs);
```

Available combinations:

| Network | Regions |
|---------|---------|
| `Mainnet` | US, EU |
| `Devnet` | US, EU |
| `Testnet` | US, EU |

---

## Branded Types

The SDK uses branded types for compile-time safety. Primitive values are
wrapped at construction and the brand is erased at runtime (zero overhead).

```ts
import { Pubkey, Signature, Slot, Lamports } from '@oobe-protocol-labs/synapse-client-sdk';

const pk = Pubkey('So11111111111111111111111111111111'); // branded string
const sig = Signature('5vR3z...');                       // branded string
const slot = Slot(12345678);                             // branded number
const lam = Lamports(1_000_000_000);                     // branded number
```

Passing a raw `string` where `Pubkey` is expected is a compile-time error.

---

## AI Agent Integration

### Zod Schemas and LangChain Tools

Every RPC method has a corresponding Zod input/output schema. These schemas
are used to generate LangChain `DynamicStructuredTool` instances:

```ts
import { createExecutableSolanaTools } from '@oobe-protocol-labs/synapse-client-sdk';

const transport = new HttpTransport({ endpoint: '...' });
const { tools, toolMap } = createExecutableSolanaTools(transport);
// tools: DynamicStructuredTool[] (53 tools, prefixed "solana_")
// toolMap: Map<string, DynamicStructuredTool>
```

Options:
- `prefix` -- custom tool name prefix (default: `"solana_"`)
- `include` -- whitelist of method names
- `exclude` -- blacklist of method names

### Protocol Tools

49 additional tools for on-chain protocols:

```ts
import { createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk';

const { jupiter, raydium, metaplex, allTools } = createProtocolTools({
  jupiter: { apiKey: '...' },
  raydium: true,
  metaplex: { transport },
});
// allTools: DynamicStructuredTool[] (49 tools)
```

| Protocol | Tool Count | Categories |
|----------|-----------|------------|
| Jupiter | 21 | Ultra Swap, Metis Swap, Quote, Route, Limit Orders, DCA, Token List, Price API |
| Raydium | 16 | Pools, Liquidity, Farming, Swaps, CLMM Positions, Token Info |
| Metaplex | 12 | DAS Queries (asset, proof, owner, group, creator, authority, search), Resolve Collection |

### Agent Commerce Gateway

Session-based metering and payment infrastructure for monetized AI tool access:

```ts
import { AgentGateway, createAgentGateway } from '@oobe-protocol-labs/synapse-client-sdk';

const gw = createAgentGateway({ transport, seller: Pubkey('...') });

const session = await gw.openSession(paymentIntent);
const result = await gw.execute(session.id, 'getBalance', [pubkey]);
const receipt = await gw.settleSession(session.id);
```

Components:
- `AgentSession` -- budget tracking, rate limiting, TTL enforcement
- `PricingEngine` -- tier resolution, dynamic pricing, bundle discounts
- `ResponseValidator` -- SHA-256 attestation, integrity proofs
- `ToolMarketplace` -- listing, discovery, reputation scoring

### x402 Payment Protocol

Native HTTP 402 payment flow (v1/v2):

```ts
// Seller side
import { X402Paywall } from '@oobe-protocol-labs/synapse-client-sdk';
const paywall = new X402Paywall(config);
const result = await paywall.processRequest(request);

// Buyer side
import { X402BuyerClient } from '@oobe-protocol-labs/synapse-client-sdk';
const buyer = new X402BuyerClient(config);
const response = await buyer.payAndRetry(url, options);
```

Known facilitator registry:

```ts
import {
  KnownFacilitator,
  resolveKnownFacilitator,
  findFacilitatorsByNetwork,
} from '@oobe-protocol-labs/synapse-client-sdk';

const config = resolveKnownFacilitator(KnownFacilitator.PayAI);
const solanaFacilitators = findFacilitatorsByNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
```

---

## Plugin System (SynapseAgentKit)

The v2 plugin system provides **110 Solana-native tools** across 5 plugins and 18 protocols, all composable via a chainable `.use()` API:

```ts
import {
  SynapseAgentKit,
  TokenPlugin, NFTPlugin, DeFiPlugin, MiscPlugin, BlinksPlugin,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';

const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(TokenPlugin)
  .use(NFTPlugin)
  .use(DeFiPlugin)
  .use(MiscPlugin)
  .use(BlinksPlugin);

// LangChain
const tools = kit.getTools();            // StructuredTool[] (110 tools)

// Vercel AI SDK
const vercelTools = kit.getVercelAITools();

// MCP descriptors
const mcpTools = kit.getMcpToolDescriptors();

// Introspection
console.log(kit.summary());
// → { plugins: 5, protocols: 18, tools: 110, resources: [...] }
```

### Plugin catalog

| Plugin | Protocols | Tools | Coverage |
|--------|-----------|-------|----------|
| **TokenPlugin** | `spl-token`, `staking`, `bridging` | 22 | Deploy, transfer, mint, burn, freeze, stake (SOL/JupSOL/Solayer), bridge (Wormhole/deBridge) |
| **NFTPlugin** | `metaplex-nft`, `3land`, `das` | 19 | Deploy collections, mint, update metadata, verify, 3Land marketplace, DAS queries |
| **DeFiPlugin** | `pump`, `raydium-pools`, `orca`, `manifest`, `meteora`, `openbook`, `drift`, `adrena`, `lulo`, `jito` | 43 | AMM/CLMM pools, swaps, limit orders, perps, lending, MEV bundles |
| **MiscPlugin** | `sns`, `alldomains`, `pyth`, `coingecko`, `gibwork`, `send-arcade` | 20 | Domain resolution (SNS/AllDomains), oracle prices, market data, bounties, gaming |
| **BlinksPlugin** | `blinks` | 6 | Solana Actions spec: GET/POST actions, resolve dial.to, validate actions.json |

### Custom plugins

```ts
import { SynapsePlugin, PluginContext } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { createMethodRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { z } from 'zod';

const MyPlugin: SynapsePlugin = {
  meta: { id: 'my-plugin', name: 'My Plugin', version: '1.0.0' },
  protocols: [{
    id: 'my-protocol',
    name: 'My Protocol',
    methods: createMethodRegistry('my-protocol').methods,
    requiresClient: true,
  }],
  install(context: PluginContext) {
    return {
      executor: async (method, input) => {
        const transport = context.client.transport;
        return transport.request(method.name, [input]);
      },
    };
  },
};

kit.use(MyPlugin);
```

See [10_PLUGINS.md](./docs_md/10_PLUGINS.md) for the full plugin guide.

---

## MCP (Model Context Protocol)

The SDK is a fully spec-compliant MCP server and client — zero external MCP dependencies.

### Expose tools as MCP server

```ts
import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { SynapseMcpServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(TokenPlugin)
  .use(DeFiPlugin);

// stdio transport — Claude Desktop, Cursor, VS Code
const server = new SynapseMcpServer(kit, {
  name: 'synapse-solana',
  version: '2.0.0',
});
await server.start();

// OR SSE transport — web-based MCP clients
await server.startSse({ port: 3001 });
```

### Connect to external MCP servers

```ts
import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const bridge = new McpClientBridge();

// Connect to GitHub MCP server
await bridge.connect({
  id: 'github',
  name: 'GitHub',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
  toolPrefix: 'github_',
});

// Connect to Postgres MCP server
await bridge.connect({
  id: 'postgres',
  name: 'PostgreSQL',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!],
  toolPrefix: 'pg_',
});

// Get LangChain tools from all connected servers
const remoteTools = bridge.getTools();

// Or add as a plugin to SynapseAgentKit
kit.use(bridge.toPlugin());
```

See [11_MCP.md](./docs_md/11_MCP.md) for the full MCP guide.

---

## Testing

The project uses [Vitest](https://vitest.dev/) with 378 tests across 10 suites.

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

Test suites:

| Suite | File | Covers |
|-------|------|--------|
| Endpoints | `tests/utils/endpoints.test.ts` | Network/region resolution, auto-select, constants |
| gRPC Parser | `tests/grpc/parser.test.ts` | Decoders, program registry, GeyserParser class |
| Session | `tests/ai/session.test.ts` | Budget, rate limits, TTL, pause/resume, events |
| Gateway | `tests/ai/gateway.test.ts` | Full session lifecycle, execute, settle, metrics |
| x402 | `tests/ai/x402.test.ts` | Paywall, facilitator, registry, header encoding |
| Validator | `tests/ai/validator.test.ts` | Attestation, integrity, signature verification |
| Marketplace | `tests/ai/marketplace.test.ts` | Listing, search, reputation, bundles |
| Pricing | `tests/ai/pricing.test.ts` | Tiers, dynamic pricing, cost estimation |
| Protocols | `tests/ai/protocols.test.ts` | Jupiter/Raydium/Metaplex schemas and tools |
| Tools | `tests/ai/tools.test.ts` | Zod registry, executable tool creation, execution |

---

## Build and Development

```bash
# Type-check (no emit)
pnpm typecheck

# Build CJS + ESM + docs
pnpm build

# Watch mode (TypeScript)
pnpm dev

# Lint
pnpm lint
pnpm lint:check
```

The build pipeline:

1. `tsc -p tsconfig.cjs.json` -- compile to `dist/cjs/` (CommonJS)
2. `tsc -p tsconfig.esm.json` -- compile to `dist/esm/` (ES Modules)
3. `scripts/fix-esm-imports.mjs` -- append `.js` extensions to ESM imports
4. `typedoc` -- generate API reference in `dist/docs/`

Output structure:

```
dist/
  cjs/       CommonJS build
  esm/       ES Module build
  docs/      TypeDoc HTML reference
```

---

## Package Exports

The package exposes granular entry points for consumers that need only a subset:

```json
{
  ".":            "Full SDK",
  "./core":       "SynapseClient class only",
  "./core/types": "Branded types and RPC type definitions",
  "./rpc":        "SolanaRpc facade + all 53 method functions",
  "./grpc":       "GrpcTransport + Geyser parser",
  "./das":        "DasClient + 11 DAS method functions",
  "./websocket":  "WsClient + subscription types",
  "./utils":      "Helpers + endpoint resolution",
  "./ai/plugins": "SynapseAgentKit + all 5 plugins",
  "./ai/plugins/token":  "TokenPlugin (22 tools)",
  "./ai/plugins/nft":    "NFTPlugin (19 tools)",
  "./ai/plugins/defi":   "DeFiPlugin (43 tools)",
  "./ai/plugins/misc":   "MiscPlugin (20 tools)",
  "./ai/plugins/blinks": "BlinksPlugin (6 tools)",
  "./ai/mcp":     "MCP server + client bridge"
}
```

Import examples:

```ts
// Full SDK
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';

// Types only (zero runtime)
import type { Pubkey, Signature, AccountInfo } from '@oobe-protocol-labs/synapse-client-sdk/core/types';

// Individual RPC method (tree-shakeable)
import { getBalance } from '@oobe-protocol-labs/synapse-client-sdk/rpc';

// WebSocket only
import { WsClient } from '@oobe-protocol-labs/synapse-client-sdk/websocket';

// Plugin system (110 Solana-native tools)
import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';

// MCP server + client
import { SynapseMcpServer, McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';
```

---

## Documentation

| Resource | Location |
|----------|----------|
| TypeDoc API reference | `docs/` (HTML, auto-generated) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |
| Contributing guide | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| AI skill guides | `src/ai/skills/` (10 markdown files) |
| Architecture guides | `docs_md/` (11 markdown files) |
| Example scripts | `examples/` |

Architecture guides (in `docs_md/`):

| File | Topic |
|------|-------|
| `00_SYNAPSE_CLIENT_SDK.md` | SDK overview and design philosophy |
| `01_CORE.md` | Core client, transport, branded types |
| `02_RPC.md` | 53 Solana JSON-RPC methods |
| `03_AI_TOOLS.md` | LangChain tools + protocol factories |
| `04_AI_GATEWAY.md` | Agent commerce, sessions, x402 payments |
| `05_SAP.md` | Synapse Anchor Protocol |
| `06_INTENTS.md` | Cross-protocol intent resolver |
| `07_ACTIONS_BLINKS.md` | Solana Actions server + Blink generator |
| `08_PERSISTENCE.md` | State persistence layer |
| `09_PIPELINES.md` | End-to-end integration patterns |
| `10_PLUGINS.md` | Plugin system (SynapseAgentKit) |
| `11_MCP.md` | MCP server + client bridge |

Skill guides (in `src/ai/skills/`):

| File | Topic |
|------|-------|
| `01-langchain-tools.md` | Creating and using LangChain tools |
| `02-gateway-sessions.md` | Session lifecycle and management |
| `03-pricing-metering.md` | Pricing tiers and metering |
| `04-response-attestation.md` | Response integrity and attestation |
| `05-tool-marketplace.md` | Listing and discovering tools |
| `06-x402-seller-paywall.md` | Seller-side x402 integration |
| `07-x402-buyer-client.md` | Buyer-side x402 integration |
| `08-full-gateway-orchestration.md` | End-to-end gateway orchestration |
| `09-events-observability.md` | Event system and observability |

To regenerate the API reference:

```bash
pnpm docs
```

---

## Source Map

```
src/
  index.ts                        Main entry point, barrel exports
  core/
    types.ts                      Branded types, RPC wire types
    errors.ts                     Error hierarchy
    transport.ts                  HttpTransport (JSON-RPC)
    client.ts                     SynapseClient orchestrator
  rpc/
    solana-rpc.ts                 SolanaRpc facade (53 methods)
    methods/                      One file per RPC method (53 files)
  das/
    types.ts                      DAS type definitions
    client.ts                     DasClient facade (11 methods)
    methods/                      One file per DAS method (11 files)
  websocket/
    types.ts                      Subscription and notification types
    client.ts                     WsClient (6 subscription methods)
  grpc/
    types.ts                      gRPC transport types
    transport.ts                  GrpcTransport class
    parser/
      types.ts                    Geyser protobuf types
      programs.ts                 Known-program registry (80+)
      decoder.ts                  Low-level stream decoders
      geyser-parser.ts            GeyserParser high-level class
  ai/
    tools/
      zod/                        Zod schemas for 53 RPC methods
      protocols/
        shared.ts                 Protocol infrastructure
        jupiter/                  Jupiter DEX (21 methods)
        raydium/                  Raydium DEX (16 methods)
        metaplex/                 Metaplex NFT (12 methods)
    gateway/
      types.ts                    Gateway type definitions
      session.ts                  AgentSession
      pricing.ts                  PricingEngine
      validator.ts                ResponseValidator
      marketplace.ts              ToolMarketplace
      index.ts                    AgentGateway
      x402/
        types.ts                  x402 protocol types
        paywall.ts                Seller-side paywall
        client.ts                 Buyer-side client
        facilitator.ts            Settlement verification
        registry.ts               Known facilitators
    plugins/
      types.ts                    Plugin system core types
      registry.ts                 SynapseAgentKit (.use() chainable)
      token/                      Token plugin (22 methods)
      nft/                        NFT plugin (19 methods)
      defi/                       DeFi plugin (43 methods, 10 protocols)
      misc/                       Misc plugin (20 methods, 6 protocols)
      blinks/                     Blinks plugin (6 methods)
    mcp/
      types.ts                    MCP protocol types (JSON-RPC 2.0)
      server.ts                   SynapseMcpServer (stdio + SSE)
      client.ts                   McpClientBridge (external servers)
    skills/                       10 markdown skill guides
  utils/
    helpers.ts                    lamportsToSol, sleep, chunk, retry
    synapse.ts                    Endpoint registry, auto-select
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branching strategy, commit conventions, and development setup.

---

## License

MIT -- see [LICENSE](./LICENSE).

Copyright (c) OOBE Protocol Labs -- [oobeprotocol.ai](https://oobeprotocol.ai)
