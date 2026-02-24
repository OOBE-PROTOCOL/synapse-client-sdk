# @oobe-protocol-labs/synapse-client-sdk

Typed Solana RPC gateway SDK for Node.js and the browser.
Covers JSON-RPC, WebSocket PubSub, gRPC/Geyser streaming, DAS (Digital Asset Standard),
AI agent tooling (LangChain + Zod), and the x402 HTTP payment protocol --
all behind a single `SynapseClient` entry point.

| | |
|-|-|
| **Version** | 1.0.1 |
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
8. [Testing](#testing)
9. [Build and Development](#build-and-development)
10. [Package Exports](#package-exports)
11. [Documentation](#documentation)
12. [Contributing](#contributing)
13. [License](#license)

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
 |-- .rpc        SolanaRpc          53 JSON-RPC methods (lazy-loaded)
 |-- .das        DasClient          11 DAS/Metaplex Read API methods
 |-- .ws         WsClient           WebSocket PubSub subscriptions
 |-- .grpc       GrpcTransport      gRPC unary calls + Geyser parser
 |
 |-- call()      Raw JSON-RPC call
 |-- batch()     Batched JSON-RPC calls
 |-- destroy()   Tear down all connections
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

AI agent commerce layer. Zod schemas, LangChain tools, protocol integrations, gateway, x402.

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
  "./utils":      "Helpers + endpoint resolution"
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
```

---

## Documentation

| Resource | Location |
|----------|----------|
| TypeDoc API reference | `docs/` (HTML, auto-generated) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |
| Contributing guide | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| AI skill guides | `src/ai/skills/` (10 markdown files) |
| Example scripts | `examples/` |

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
