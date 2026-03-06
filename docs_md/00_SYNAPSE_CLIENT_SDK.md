# Synapse Client SDK

> The enterprise-grade TypeScript SDK for Solana RPC, AI agents, and agent-to-agent commerce.

| | |
|---|---|
| **Package** | `@oobe-protocol-labs/synapse-client-sdk` |
| **Version** | 2.0.0 |
| **License** | MIT |
| **Node.js** | ≥ 18.0.0 |
| **Runtimes** | Node.js · Bun · Deno · Cloudflare Workers · Browser |
| **npm** | [npmjs.com/package/@oobe-protocol-labs/synapse-client-sdk](https://www.npmjs.com/package/@oobe-protocol-labs/synapse-client-sdk) |
| **GitHub** | [github.com/OOBE-PROTOCOL/synapse-client-sdk](https://github.com/OOBE-PROTOCOL/synapse-client-sdk) |

---

## Table of Contents

| # | Document | What you'll learn |
|---|----------|-------------------|
| **00** | **This file** | Architecture, installation, quick start |
| **01** | [Core](./01_CORE.md) | `SynapseClient`, `HttpTransport`, branded types, errors |
| **02** | [RPC](./02_RPC.md) | 53 JSON-RPC methods, WebSocket subscriptions, gRPC/Geyser |
| **03** | [AI Tools](./03_AI_TOOLS.md) | LangChain tools, protocol factories (Jupiter, Raydium, etc.) |
| **04** | [AI Gateway](./04_AI_GATEWAY.md) | Agent-to-agent commerce, metered sessions, x402 payments |
| **05** | [SAP](./05_SAP.md) | On-chain agent identity via Program Derived Addresses |
| **06** | [Intents](./06_INTENTS.md) | Cross-protocol intent resolution with DAG execution |
| **07** | [Actions & Blinks](./07_ACTIONS_BLINKS.md) | Solana Actions spec, shareable Blockchain Links |
| **08** | [Persistence](./08_PERSISTENCE.md) | Redis, PostgreSQL, and in-memory storage adapters |
| **09** | [Pipelines](./09_PIPELINES.md) | End-to-end integration patterns and production recipes |
| **10** | [Plugins](./10_PLUGINS.md) | SynapseAgentKit, 110 on-chain tools, custom plugin API |
| **11** | [MCP](./11_MCP.md) | MCP server (stdio/SSE), client bridge, external MCP servers |

---

## Installation

```bash
# npm
npm install @oobe-protocol-labs/synapse-client-sdk

# pnpm (recommended)
pnpm add @oobe-protocol-labs/synapse-client-sdk

# yarn
yarn add @oobe-protocol-labs/synapse-client-sdk
```

### Peer dependencies — install only what you use

```bash
# AI tools (LangChain integration)
pnpm add zod @langchain/core

# Redis persistence
pnpm add ioredis

# PostgreSQL persistence
pnpm add pg
```

> `@solana/kit` is a direct dependency — no separate install required.

---

## Quick Start

### 1. Connect to an RPC endpoint

```ts
import { SynapseClient, Pubkey, Lamports } from '@oobe-protocol-labs/synapse-client-sdk';

const client = new SynapseClient({
  endpoint: 'https://rpc.synapse.com',  // any Solana RPC URL
  apiKey:   'sk-your-key',              // optional Bearer token
});

// All 53 RPC methods are fully typed
const slot    = await client.rpc.getSlot();                        // → Slot
const balance = await client.rpc.getBalance(Pubkey('So11111...')); // → RpcContext<Lamports>
const block   = await client.rpc.getBlock(slot);                   // → Block
```

### 2. Decode on-chain accounts

```ts
import { decodeTokenAccount } from '@oobe-protocol-labs/synapse-client-sdk/decoders';

const info = await client.rpc.getAccountInfo(Pubkey('TokenAddr...'));
const data = Buffer.from(info.value!.data[0], 'base64');
const token = decodeTokenAccount(data);
// → { mint, owner, amount, delegate, state, isNative, ... }
```

### 3. Build native program instructions

```ts
import { SystemProgram, ComputeBudget } from '@oobe-protocol-labs/synapse-client-sdk/programs';

const transferIx = SystemProgram.transfer({
  from:     Pubkey('FromWallet...'),
  to:       Pubkey('ToWallet...'),
  lamports: Lamports(1_000_000_000n),   // 1 SOL
});

const priorityIx = ComputeBudget.setComputeUnitPrice({
  microLamports: 50_000n,
});
```

### 4. Create AI agent tools

```ts
import { createExecutableSolanaTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const tools = createExecutableSolanaTools(client.getTransport());
// → 53 LangChain StructuredTool[] — plug into any agent framework
```

### 5. Real-time WebSocket subscriptions

```ts
const unsub = client.ws.onAccountChange(
  Pubkey('WalletToWatch...'),
  (notification) => console.log('New balance:', notification.result.value.lamports),
);

// Clean up when done
unsub();

// Always destroy the client on shutdown
client.destroy();
```

---

## Architecture

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Zero-cost lazy loading** | `.rpc`, `.ws`, `.das`, `.grpc`, `.accounts` are instantiated on first property access. If you never call `client.ws`, WebSocket code is never loaded. |
| **Branded (nominal) types** | `Pubkey`, `Signature`, `Lamports`, `Slot` are compile-time branded. Passing a `Pubkey` where a `Signature` is expected → TypeScript error. Zero runtime overhead. |
| **Tree-shakeable** | Every module has its own subpath export. Bundlers drop unused modules. `"sideEffects": false`. |
| **Dual CJS + ESM** | Ships `dist/cjs/` and `dist/esm/`. Works with `require()`, `import`, and every bundler. |
| **Inject, don't bundle** | Heavy deps (`ioredis`, `pg`, `@grpc/grpc-js`) are injected by you — never bundled in the SDK. Your bundle stays small. |

### Client Module Map

```
SynapseClient
│
├── .rpc          → SolanaRpc          53 typed JSON-RPC methods
├── .das          → DasClient          Metaplex Digital Asset Standard
├── .ws           → WsClient           6 PubSub subscriptions + auto-reconnect
├── .grpc         → GrpcTransport      Geyser streaming + parser
├── .accounts     → AccountsClient     fetch + decode in one call
├── .kitRpc       → Rpc<SolanaRpcApi>  @solana/kit native RPC
└── .kitSubs      → RpcSubscriptions   @solana/kit native subscriptions
```

---

## Subpath Export Map

Import only what you need to keep your bundle small:

```ts
// ~5 KB — just the core client
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';

// ~2 KB — just a single decoder
import { decodeTokenAccount } from '@oobe-protocol-labs/synapse-client-sdk/decoders/token';

// ~10 KB — just Jupiter AI tools
import { createJupiterTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// ~15 KB — just the x402 paywall
import { X402Paywall } from '@oobe-protocol-labs/synapse-client-sdk/ai/gateway/x402';
```

Every subpath provides three conditions: `types` (declarations), `import` (ESM), `require` (CJS).

<details>
<summary><strong>Full export map (click to expand)</strong></summary>

| Subpath | Description | Approx. Size |
|---------|-------------|-------------|
| `.` | Full SDK barrel | ~Full |
| `./core` | `SynapseClient`, `HttpTransport` | ~5 KB |
| `./core/types` | Branded types (`Pubkey`, `Lamports`, etc.) | ~2 KB |
| `./rpc` | 53 JSON-RPC method functions | ~15 KB |
| `./grpc` | gRPC transport + Geyser parser | ~8 KB |
| `./das` | DAS / cNFT queries | ~6 KB |
| `./websocket` | WebSocket PubSub client | ~4 KB |
| `./utils` | Helpers, environment detection | ~2 KB |
| `./kit` | `@solana/kit` bridge | ~3 KB |
| `./decoders` | All account data decoders | ~10 KB |
| `./decoders/token` | SPL Token decoder | ~2 KB |
| `./decoders/token-2022` | Token-2022 + extensions | ~4 KB |
| `./decoders/stake` | Stake account decoder | ~2 KB |
| `./decoders/nonce` | Nonce account decoder | ~1 KB |
| `./decoders/lookup-table` | Address Lookup Table | ~1 KB |
| `./decoders/multisig` | Multisig account decoder | ~1 KB |
| `./decoders/layout` | `AccountReader` base class | ~1 KB |
| `./accounts` | Typed fetchers (RPC + decode) | ~5 KB |
| `./programs` | All instruction encoders | ~12 KB |
| `./programs/system` | System Program | ~3 KB |
| `./programs/spl-token` | SPL Token instructions | ~5 KB |
| `./programs/associated-token` | ATA instructions | ~1 KB |
| `./programs/memo` | Memo v1/v2 | ~1 KB |
| `./programs/compute-budget` | Priority fees | ~1 KB |
| `./programs/types` | `AccountMeta`, `InstructionWriter` | ~2 KB |
| `./context` | IoC container, DI, hooks | ~8 KB |
| `./next` | Next.js SSR adapter | ~2 KB |
| `./ai` | AI barrel (all sub-modules) | ~Full AI |
| `./ai/tools` | LangChain Solana tools | ~10 KB |
| `./ai/tools/protocols` | Protocol factories | ~30 KB |
| `./ai/lazy` | Lazy tool factories | ~1 KB |
| `./ai/persistence` | Redis / PG / Memory stores | ~12 KB |
| `./ai/gateway` | Agent commerce orchestrator | ~25 KB |
| `./ai/gateway/x402` | x402 payment protocol | ~15 KB |
| `./ai/gateway/monetize` | Monetization bridge | ~8 KB |
| `./ai/sap` | Solana Agent Protocol (PDA) | ~15 KB |
| `./ai/intents` | Cross-protocol intent resolver | ~12 KB |
| `./ai/actions` | Solana Actions & Blinks | ~10 KB |

</details>

---

## Error Hierarchy

All SDK errors extend `SynapseError` with a numeric `code` and optional `data` payload:

```
SynapseError
├── NetworkError                    DNS / TCP / HTTP failure
├── TimeoutError                    AbortController timeout
├── RpcMethodNotFoundError          JSON-RPC -32601
├── UpstreamError                   Upstream provider error
│
├── GatewayError                    Agent commerce
│   ├── SessionNotFoundError
│   ├── MaxSessionsError
│   └── IntentVerificationError
│
├── SessionError                    Metered sessions
│   ├── BudgetExhaustedError
│   ├── RateLimitExceededError
│   ├── SessionExpiredError
│   └── CallLimitExceededError
│
├── X402ClientError                 x402 buyer
│   ├── NoAcceptablePaymentError
│   ├── PaymentSigningError
│   └── PaymentRetryError
│
├── FacilitatorError                x402 settlement
│   ├── VerifyError
│   └── SettleError
│
├── MonetizeError                   Tool monetization bridge
├── ProtocolApiError                External API call failure
├── SAPProgramError                 SAP instruction building
├── SAPDiscoveryError               On-chain agent discovery
├── ActionServerError               Actions/Blinks handler
│
├── IntentError                     Cross-protocol intents
│   ├── CyclicDependencyError
│   ├── UnresolvedReferenceError
│   └── IntentBudgetExceededError
│
├── PersistenceError                Storage adapters
├── ServiceNotFoundError            IoC container
├── CircularDependencyError         IoC container
└── AsyncProviderError              IoC container
```

**Best practice** — catch from most specific to most general:

```ts
import {
  SynapseError,
  NetworkError,
  TimeoutError,
  UpstreamError,
} from '@oobe-protocol-labs/synapse-client-sdk';

try {
  await client.rpc.getSlot();
} catch (err) {
  if (err instanceof TimeoutError) {
    // increase timeout and retry
  } else if (err instanceof UpstreamError) {
    console.error('Upstream failed:', err.upstreamName, err.upstreamUrl);
  } else if (err instanceof NetworkError) {
    // check connectivity
  } else if (err instanceof SynapseError) {
    console.error(`[${err.code}] ${err.message}`, err.data);
  }
}
```

---

## Dependencies

### Direct (always installed)

| Package | Version | Purpose |
|---------|---------|---------|
| `@solana/kit` | ^6.1.0 | Native Solana types, signers, RPC bridge |
| `eventemitter3` | ^5.0.1 | Typed event emitter (gateway events) |
| `ws` | ^8.18.3 | WebSocket client for Node.js |

### Peer (install what you use)

| Package | Version | Required for | Optional? |
|---------|---------|-------------|-----------|
| `zod` | ≥3.23 or ≥4.0 | AI tool input validation | Yes |
| `@langchain/core` | ≥0.3.0 <0.4.0 | LangChain `StructuredTool` wrappers | Yes |
| `ioredis` | ≥5.0.0 | `RedisPersistence` adapter | Yes |
| `pg` | ≥8.0.0 | `PostgresPersistence` adapter | Yes |
| `typescript` | ≥5.0.0 | Type definitions | Yes |

### Browser builds

`ws`, `@grpc/grpc-js`, and `@grpc/proto-loader` are excluded from browser bundles via the `"browser"` field in `package.json`.

---

## Runtime Compatibility

| Runtime | Support | Notes |
|---------|---------|-------|
| **Node.js** ≥ 18 | ✅ Full | All features including gRPC and WebSocket |
| **Bun** | ✅ Full | Native `fetch`, native WebSocket |
| **Deno** | ✅ Full | Use `npm:@oobe-protocol-labs/synapse-client-sdk` |
| **Cloudflare Workers** | ⚠️ Partial | No WebSocket / gRPC (use REST + polling) |
| **Browser** | ⚠️ Partial | No gRPC; uses native WebSocket |

---

## TypeScript Setup

Recommended `tsconfig.json` for consumers:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",            // or "Node16" / "NodeNext"
    "moduleResolution": "bundler", // or "node16" / "nodenext"
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## What's Next?

| Goal | Start here |
|------|-----------|
| Build a basic RPC app | [01_CORE.md](./01_CORE.md) → [02_RPC.md](./02_RPC.md) |
| Build an AI agent | [03_AI_TOOLS.md](./03_AI_TOOLS.md) |
| Monetize agent tools | [04_AI_GATEWAY.md](./04_AI_GATEWAY.md) |
| Register agent on-chain | [05_SAP.md](./05_SAP.md) |
| Multi-step DeFi automation | [06_INTENTS.md](./06_INTENTS.md) |
| Social-shareable transactions | [07_ACTIONS_BLINKS.md](./07_ACTIONS_BLINKS.md) |
| Production deployment | [09_PIPELINES.md](./09_PIPELINES.md) |
