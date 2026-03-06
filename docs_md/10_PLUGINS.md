# 10 — Plugin System: SynapseAgentKit & 110 On-Chain Tools

> **Import**: `@…/synapse-client-sdk/ai/plugins`
> **Source**: `src/ai/plugins/`
> **Prerequisites**: [01_CORE.md](./01_CORE.md) (SynapseClient), [03_AI_TOOLS.md](./03_AI_TOOLS.md) (understanding of LangChain tools)

---

## Overview

The **Plugin System** adds 110 Solana-native tools across 5 plugins and 18 protocols, all composable via a chainable `.use()` API. Every tool gets Zod-validated input/output and can be exported as:

- **LangChain** `StructuredTool[]`
- **Vercel AI SDK** tool objects
- **MCP** tool descriptors

```
SynapseAgentKit
 │
 │── .use(TokenPlugin)      22 tools  (SPL, staking, bridging)
 │── .use(NFTPlugin)        19 tools  (Metaplex, 3Land, DAS)
 │── .use(DeFiPlugin)       43 tools  (10 DeFi protocols)
 │── .use(MiscPlugin)       20 tools  (domains, oracles, market data)
 │── .use(BlinksPlugin)      6 tools  (Solana Actions spec)
 │
 │── .getTools()            → StructuredTool[] (LangChain)
 │── .getVercelAITools()    → Vercel AI tools
 │── .getMcpToolDescriptors()  → McpToolDescriptor[]
 │── .getMcpResourceDescriptors() → McpResourceDescriptor[]
 │── .summary()             → { plugins, protocols, tools, resources }
 │── .destroy()             → teardown all plugins
```

---

## Quick Start

```ts
import {
  SynapseAgentKit,
  TokenPlugin,
  NFTPlugin,
  DeFiPlugin,
  MiscPlugin,
  BlinksPlugin,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';

const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(TokenPlugin)
  .use(NFTPlugin)
  .use(DeFiPlugin)
  .use(MiscPlugin)
  .use(BlinksPlugin);

// 110 LangChain tools, ready for any agent framework
const tools = kit.getTools();
```

### Use with LangChain

```ts
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const tools = kit.getTools();

const agent = createStructuredChatAgent({ llm, tools, prompt });
const executor = AgentExecutor.fromAgentAndTools({ agent, tools });

const result = await executor.invoke({
  input: 'What is the SOL balance of DRpb...? Then swap 0.5 SOL to USDC on Orca.',
});
```

### Use with Vercel AI SDK

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const vercelTools = kit.getVercelAITools();

const { text } = await generateText({
  model: openai('gpt-4o'),
  tools: vercelTools,
  prompt: 'Get the current Pyth price of SOL/USD',
});
```

### Selective plugin loading

Load only what you need — unused plugins are never instantiated:

```ts
// DeFi-only agent
const defiKit = new SynapseAgentKit({ rpcUrl })
  .use(DeFiPlugin);
// → 43 tools

// Token + NFT agent
const nftKit = new SynapseAgentKit({ rpcUrl })
  .use(TokenPlugin)
  .use(NFTPlugin);
// → 41 tools
```

---

## AgentKitConfig

```ts
interface AgentKitConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string;

  /** Optional API key for authenticated RPC */
  apiKey?: string;

  /** Wallet public key (for write operations) */
  walletPubkey?: string;

  /** Per-protocol config overrides */
  protocolConfig?: Record<string, unknown>;

  /** Tool generation options */
  toolOpts?: {
    prefix?: string;       // tool name prefix (default: none)
    include?: string[];    // whitelist method names
    exclude?: string[];    // blacklist method names
  };
}
```

---

## Plugin Catalog

### TokenPlugin — 22 tools

| Protocol | Method | Type | Description |
|----------|--------|------|-------------|
| `spl-token` | `deployToken` | write | Deploy a new SPL token with metadata |
| | `transfer` | write | Transfer SPL tokens to a recipient |
| | `transferSol` | write | Transfer native SOL |
| | `getBalance` | read | Get SOL or SPL token balance |
| | `getTokenAccounts` | read | List all token accounts for a wallet |
| | `mintTo` | write | Mint tokens to an existing account |
| | `burn` | write | Burn tokens from an account |
| | `freezeAccount` | write | Freeze a token account |
| | `thawAccount` | write | Unfreeze a token account |
| | `closeAccount` | write | Close an empty token account |
| | `rugCheck` | read | Analyze token for potential rug pull indicators |
| `staking` | `stakeSOL` | write | Stake SOL to a validator |
| | `unstakeSOL` | write | Unstake SOL (deactivate + withdraw) |
| | `getStakeAccounts` | read | List all stake accounts for a wallet |
| | `stakeJupSOL` | write | Liquid-stake SOL via Jupiter (jupSOL) |
| | `unstakeJupSOL` | write | Unstake jupSOL |
| | `stakeSolayer` | write | Stake via Solayer (restaking) |
| | `unstakeSolayer` | write | Unstake from Solayer |
| `bridging` | `bridgeWormhole` | write | Cross-chain bridge via Wormhole |
| | `bridgeWormholeStatus` | read | Check Wormhole bridge status |
| | `bridgeDeBridge` | write | Cross-chain bridge via deBridge |
| | `bridgeDeBridgeStatus` | read | Check deBridge bridge status |

### NFTPlugin — 19 tools

| Protocol | Method | Type | Description |
|----------|--------|------|-------------|
| `metaplex-nft` | `deployCollection` | write | Create a new NFT collection |
| | `mintNFT` | write | Mint an NFT into a collection |
| | `updateMetadata` | write | Update NFT metadata |
| | `verifyCreator` | write | Verify creator on an NFT |
| | `verifyCollection` | write | Verify collection membership |
| | `setAndVerifyCollection` | write | Set and verify collection in one call |
| | `delegateAuthority` | write | Delegate update/transfer authority |
| | `revokeAuthority` | write | Revoke delegated authority |
| | `configureRoyalties` | write | Configure royalty percentages |
| `3land` | `createCollection` | write | Create a 3Land collection |
| | `mintAndList` | write | Mint and list on 3Land marketplace |
| | `listForSale` | write | List existing NFT for sale |
| | `cancelListing` | write | Cancel a 3Land listing |
| | `buyNFT` | write | Buy an NFT from 3Land |
| `das` | `getAsset` | read | Get asset metadata via DAS |
| | `getAssetsByOwner` | read | List assets owned by a wallet |
| | `getAssetsByCreator` | read | List assets by creator |
| | `getAssetsByCollection` | read | List assets in a collection |
| | `searchAssets` | read | Full-text search across DAS |

### DeFiPlugin — 43 tools

| Protocol | Methods | Description |
|----------|---------|-------------|
| **Pump.fun** (2) | `launchToken`, `trade` | Fair-launch tokens on Pump.fun |
| **Raydium Pools** (5) | `createCPMM`, `createCLMM`, `createAMMv4`, `addLiquidity`, `removeLiquidity` | AMM/CLMM pool management |
| **Orca** (5) | `getWhirlpool`, `swap`, `openPosition`, `closePosition`, `collectFees` | Whirlpool concentrated liquidity |
| **Manifest** (4) | `createMarket`, `placeLimitOrder`, `cancelOrder`, `getOrderbook` | On-chain limit order book |
| **Meteora** (5) | `createDynamicPool`, `createDLMMPool`, `addDLMMLiquidity`, `removeDLMMLiquidity`, `createAlphaVault` | Dynamic/DLMM pools + vaults |
| **OpenBook** (3) | `createMarket`, `placeOrder`, `cancelOrder` | Central limit order book |
| **Drift** (7) | `deposit`, `withdraw`, `openPerpPosition`, `closePerpPosition`, `getPositions`, `lend`, `borrow` | Perpetuals + margin lending |
| **Adrena** (5) | `openPosition`, `closePosition`, `addCollateral`, `removeCollateral`, `getPositions` | Leverage trading |
| **Lulo** (4) | `deposit`, `withdraw`, `getBestRates`, `getPositions` | Yield aggregation |
| **Jito** (3) | `sendBundle`, `getBundleStatus`, `getTipEstimate` | MEV bundle submission |

### MiscPlugin — 20 tools

| Protocol | Methods | Description |
|----------|---------|-------------|
| **SNS** (3) | `registerDomain`, `resolveDomain`, `reverseLookup` | Solana Name Service (.sol domains) |
| **AllDomains** (3) | `registerDomain`, `resolveDomain`, `getOwnedDomains` | Multi-TLD domain resolution |
| **Pyth** (3) | `getPrice`, `getPriceHistory`, `listPriceFeeds` | Oracle price feeds via Hermes API |
| **CoinGecko** (6) | `getTokenPrice`, `getTrending`, `getTopGainersLosers`, `getTokenInfo`, `getPoolsByToken`, `getOHLCV` | Market data (free + Pro API) |
| **GibWork** (3) | `createBounty`, `listBounties`, `submitWork` | On-chain bounty marketplace |
| **Send Arcade** (2) | `listGames`, `playGame` | Solana gaming platform |

### BlinksPlugin — 6 tools

| Protocol | Method | Description |
|----------|--------|-------------|
| `blinks` | `getAction` | Fetch Solana Action metadata via GET |
| | `executeAction` | Execute a Solana Action via POST |
| | `confirmAction` | Confirm an action transaction on-chain |
| | `resolveBlinkUrl` | Resolve dial.to Blink URLs to action URLs |
| | `validateActionsJson` | Validate a domain's actions.json manifest |
| | `buildActionUrl` | Build a shareable Blink URL |

---

## Architecture

### Plugin Interface

Every plugin implements the `SynapsePlugin` interface:

```ts
interface SynapsePlugin {
  /** Plugin metadata (id, name, version, description, tags) */
  meta: PluginMeta;

  /** Protocols this plugin provides */
  protocols: PluginProtocol[];

  /** Install the plugin — returns executor + optional teardown */
  install(context: PluginContext): PluginInstallResult;
}
```

### Protocol Methods

Each protocol contains typed methods with Zod input/output schemas:

```ts
interface ProtocolMethod {
  name: string;            // e.g. 'getBalance'
  description: string;     // human-readable for LLMs
  input: z.ZodTypeAny;     // Zod input schema
  output: z.ZodTypeAny;    // Zod output schema
  protocol: string;        // parent protocol id
}
```

### Execution Flow

```
kit.getTools()
    │
    ▼
for each installed plugin:
    for each protocol:
        for each method:
            → LangChain tool(name, description, zodSchema, executorFn)
    │
    ▼
StructuredTool[]         (ready for AgentExecutor, createReactAgent, etc.)
```

When a tool is invoked by an LLM:

```
LLM generates JSON
    │
    ▼
Zod validates input      (type-safe at runtime)
    │
    ▼
plugin.executor(method, input)
    │
    ├─ Read ops  → transport.request(rpcMethod, params) → JSON result
    ├─ HTTP ops  → fetch(externalApi) → parsed result
    └─ Write ops → { status: 'instruction_ready', params } → client assembles tx
```

---

## Creating Custom Plugins

### Minimal plugin

```ts
import { SynapsePlugin, PluginContext } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { createMethodRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { z } from 'zod';

const { methods, register } = createMethodRegistry('my-protocol');

register({
  name: 'helloWorld',
  description: 'Returns a greeting',
  input: z.object({ name: z.string().describe('Name to greet') }),
  output: z.object({ message: z.string() }),
});

const MyPlugin: SynapsePlugin = {
  meta: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'A custom greeting plugin',
    tags: ['example'],
  },
  protocols: [{
    id: 'my-protocol',
    name: 'My Protocol',
    methods,
    requiresClient: false,
  }],
  install(_context: PluginContext) {
    return {
      executor: async (method, input) => {
        if (method.name === 'helloWorld') {
          return { message: `Hello, ${input.name}!` };
        }
        throw new Error(`Unknown method: ${method.name}`);
      },
    };
  },
};

export { MyPlugin };
```

### Plugin with RPC transport

```ts
install(context: PluginContext) {
  const transport = context.client.transport;

  return {
    executor: async (method, input) => {
      switch (method.name) {
        case 'getAccountAge': {
          const sigs = await transport.request('getSignaturesForAddress', [
            input.address,
            { limit: 1, before: undefined },  // oldest first
          ]);
          return {
            address: input.address,
            firstTx: sigs?.[0]?.blockTime ?? null,
          };
        }
        default:
          return { status: 'instruction_ready', method: method.name, params: input };
      }
    },
  };
}
```

### Plugin with teardown

```ts
install(context: PluginContext) {
  const ws = new WebSocket(context.config.wsUrl);

  return {
    executor: async (method, input) => { /* ... */ },
    teardown: async () => {
      ws.close();  // cleanup on kit.destroy()
    },
  };
}
```

---

## Introspection

```ts
const summary = kit.summary();
console.log(summary);
// {
//   plugins: ['token', 'nft', 'defi', 'misc', 'blinks'],
//   protocols: 18,
//   tools: 110,
//   resources: [...]
// }

// Get tool map (name → tool)
const toolMap = kit.getToolMap();
const balanceTool = toolMap.get('getBalance');

// MCP descriptors (for MCP server integration)
const mcpTools = kit.getMcpToolDescriptors();
// → [{ name, description, inputSchema: JSONSchema }, ...]

const mcpResources = kit.getMcpResourceDescriptors();
// → [{ uri, name, description, mimeType }, ...]
```

---

## Read vs Write Operations

| Type | What happens | Example |
|------|-------------|---------|
| **Read** | Executes RPC call, returns data | `getBalance`, `getStakeAccounts`, `getAsset` |
| **HTTP Read** | Calls external API, returns data | `getTokenPrice`, `getPrice`, `getTrending` |
| **Write** | Returns `{ status: 'instruction_ready', params }` | `transfer`, `stakeSOL`, `swap` |

Write operations return instruction data that must be assembled into a transaction
and signed client-side. This is by design — the SDK never holds private keys.

```ts
const result = await tool.invoke({ amount: '1000000000', to: 'ABcd...' });
// {
//   status: 'instruction_ready',
//   method: 'transfer',
//   params: { amount: '1000000000', to: 'ABcd...' },
//   message: 'transfer instruction prepared. Sign and submit the transaction.'
// }
```

---

## Subpath Imports

```ts
// All plugins + SynapseAgentKit
import { SynapseAgentKit, TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';

// Individual plugin (tree-shakeable)
import { TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token';
import { NFTPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft';
import { DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi';
import { MiscPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc';
import { BlinksPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks';
```

---

## Next

- [11_MCP.md](./11_MCP.md) — Expose plugins as an MCP server or connect to external MCP servers.
- [09_PIPELINES.md](./09_PIPELINES.md) — End-to-end integration patterns combining plugins with gateway, intents, and more.
