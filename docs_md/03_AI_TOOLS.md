# 03 — AI Tools: LangChain + Protocol Factories

> **Imports**: `@…/synapse-client-sdk/ai`, `/ai/tools`, `/ai/tools/protocols`  
> **Source**: `src/ai/tools/`  
> **Prerequisites**: [01_CORE.md](./01_CORE.md) — you need a `SynapseClient` or `HttpTransport`. Install `zod` and `@langchain/core`.

---

## Overview

The AI Tools module turns Solana RPC methods and DeFi protocol APIs into **LangChain-compatible tools** that any AI agent can call. There are two levels:

| Level | What | Tool count | Data source |
|-------|------|-----------|-------------|
| **Level 1** | Solana RPC tools | 53 | Your RPC endpoint |
| **Level 2** | Protocol tools | 80+ | External APIs (Jupiter, Raydium, Metaplex, etc.) |

```
Level 1: createExecutableSolanaTools(transport)
         → 53 StructuredTool[] for every Solana RPC method

Level 2: createProtocolTools(client, config)
         → Jupiter (22) + Raydium (16) + Metaplex + On-chain + Programs
```

---

## Level 1: Solana RPC Tools

### Quick start

```ts
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createExecutableSolanaTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = new SynapseClient({ endpoint: 'https://rpc.synapse.com', apiKey: 'sk-...' });
const { tools, toolMap } = createExecutableSolanaTools(client.getTransport());

// tools → SolanaTool[] (53 LangChain StructuredTool instances)
// toolMap → Record<string, SolanaTool> — access by name

// Use with LangChain
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';

const llm = new ChatOpenAI({ model: 'gpt-4o' });
const agent = createStructuredChatAgent({ llm, tools, prompt: myPrompt });
const executor = AgentExecutor.fromAgentAndTools({ agent, tools });

const result = await executor.invoke({
  input: 'What is the SOL balance of DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy?',
});
```

### What you get

Each tool is a `StructuredTool` with:
- **name** — the RPC method name (e.g., `getBalance`)
- **description** — human-readable description for the LLM
- **schema** — Zod input validation schema
- **`_call(input)`** — executes the RPC call and returns JSON

```ts
const balanceTool = toolMap.getBalance;
const result = await balanceTool.invoke({ pubkey: 'So111...' });
// → '{"context":{"slot":250000000},"value":1500000000}'
```

### Available constants

```ts
import {
  agentRpcMethods,   // AgentRpcMethod[] — schema definitions for all 53 methods
  solanaToolNames,    // string[] — all tool names
} from '@oobe-protocol-labs/synapse-client-sdk/ai';
```

---

## Level 2: Protocol Tools

Protocol tools call external DeFi APIs (Jupiter, Raydium, etc.) and expose them as LangChain tools.

### Option A: Individual factories

Create tools for one protocol at a time:

```ts
import {
  createJupiterTools,
  createRaydiumTools,
  createMetaplexTools,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Jupiter — 22 tools (REST API)
const jupiter = createJupiterTools({
  apiKey: 'jup-api-key',           // optional
  apiKeyHeader: 'x-api-key',      // custom header name
  // baseUrl: 'https://api.jup.ag',  // default
});

// Raydium — 16 tools (REST API)
const raydium = createRaydiumTools({
  // baseUrl: 'https://api-v3.raydium.io',  // default
});

// Metaplex — DAS tools (via your RPC)
const metaplex = createMetaplexTools(client);
```

### Option B: Super-factory (recommended)

Create all protocol toolkits in a single call:

```ts
import { createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const result = createProtocolTools(client, {
  jupiter:         { apiKey: 'jup-key' },
  raydium:         {},                        // default config
  metaplex:        {},                        // uses client RPC
  jupiterOnchain:  {},                        // on-chain via RPC
  raydiumOnchain:  {},                        // on-chain via RPC
  solanaPrograms:  {},                        // instruction builders
  // raydium: false,                          // disable a protocol
});

// Access individual toolkits
result.jupiter.tools        // → ProtocolTool[]
result.raydium.toolMap      // → Record<string, ProtocolTool>

// Or get all tools combined
result.allTools            // → ProtocolTool[] (every tool from every protocol)
result.totalToolCount      // → 84
result.protocolSummary     // → { jupiter: 22, raydium: 16, ... }
```

### Protocol summary

| Protocol | Factory | Tool count | Data source |
|----------|---------|-----------|-------------|
| **Jupiter** | `createJupiterTools()` | 22 | REST API (`api.jup.ag`) |
| **Raydium** | `createRaydiumTools()` | 16 | REST API (`api-v3.raydium.io`) |
| **Metaplex** | `createMetaplexTools()` | varies | Your RPC (DAS) |
| **Jupiter On-chain** | `createJupiterOnchainTools()` | 10 | Your RPC (account reads) |
| **Raydium On-chain** | `createRaydiumOnchainTools()` | 10 | Your RPC (account reads) |
| **Solana Programs** | `createSolanaProgramsTools()` | varies | Instruction building |

### Cherry-pick tools with `include` / `exclude`

> **Important**: Don't give an AI agent 84 tools — it gets confused. Select only the tools relevant to your use case.

```ts
const jupiter = createJupiterTools({
  apiKey: 'jup-key',
  include: ['getQuote', 'smartSwap', 'getTokenInfo'],  // only these 3
});

// Or exclude specific tools
const raydium = createRaydiumTools({
  exclude: ['getClmmPositions'],  // everything except this
});
```

### ProtocolToolkit — the return type

Every factory returns a `ProtocolToolkit`:

```ts
interface ProtocolToolkit {
  protocol:    string;                            // 'jupiter', 'raydium', etc.
  tools:       ProtocolTool[];                    // flat array for agents
  toolMap:     Record<string, ProtocolTool>;      // pick by name
  methods:     ProtocolMethod[];                  // registered method schemas
  methodNames: string[];                          // all method names
  httpClient:  ProtocolHttpClient;                // direct REST client
  getHeaders(): Record<string, string>;           // auth headers
}
```

### Using the raw HTTP client

Every toolkit exposes its `httpClient` for calling endpoints not covered by the tools:

```ts
const jupiter = createJupiterTools({ apiKey: 'jup-key' });

// Call an endpoint directly
const data = await jupiter.httpClient.get('/v6/quote', {
  inputMint: 'So111...',
  outputMint: 'EPjFWdd5...',
  amount: '1000000000',
});
```

---

## Building Custom Protocol Tools

You can create tools for any REST API using the shared infrastructure:

### Step 1: Define method schemas

```ts
import { createMethodRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { z } from 'zod';

const { register, methods } = createMethodRegistry('myprotocol');

register(
  'getPrice',                               // method name
  z.object({ symbol: z.string() }),          // input schema
  z.object({ price: z.number() }),           // output schema (documentation)
  'Get the current price of a token',        // description for LLM
  { httpMethod: 'GET', path: '/v1/price' }, // HTTP config
);

register(
  'executeTrade',
  z.object({ symbol: z.string(), amount: z.number(), side: z.enum(['buy', 'sell']) }),
  z.object({ txId: z.string() }),
  'Execute a trade',
  { httpMethod: 'POST', path: '/v1/trade' },
);
```

### Step 2: Build tools

```ts
import { buildProtocolTools, ProtocolHttpClient } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const httpClient = new ProtocolHttpClient({
  baseUrl: 'https://api.myprotocol.xyz',
  apiKey:  'my-key',
  timeout: 15_000,
});

const toolkit = buildProtocolTools(
  methods(),                                            // ProtocolMethod[]
  async (method, input) => {                            // execute function
    if (method.httpMethod === 'POST') {
      return httpClient.post(method.path!, input);
    }
    return httpClient.get(method.path!, input);
  },
  { prefix: 'myprotocol_', prettyJson: true },          // options
);

// toolkit.tools → 2 LangChain tools: myprotocol_getPrice, myprotocol_executeTrade
```

### `ProtocolMethod` schema

```ts
interface ProtocolMethod {
  name:         string;                    // e.g., 'getQuote'
  description?: string;                    // for the LLM
  input:        z.ZodTypeAny;              // Zod input validation
  output:       z.ZodTypeAny;              // Zod output (documentation only)
  protocol:     string;                    // e.g., 'jupiter'
  httpMethod?:  'GET' | 'POST';
  path?:        string;                    // e.g., '/v6/quote'
}
```

### `CreateProtocolToolsOpts`

Options available on all factory functions:

```ts
interface CreateProtocolToolsOpts {
  prefix?:        string;       // tool name prefix (default: '<protocol>_')
  include?:       string[];     // whitelist specific methods
  exclude?:       string[];     // blacklist specific methods
  prettyJson?:    boolean;      // format output JSON (default: true)
  throwOnError?:  boolean;      // default: false (errors returned as JSON, not thrown)
}
```

> **Note**: `throwOnError: false` (default) means errors are returned as JSON strings instead of thrown. This is the LangChain convention — agents handle errors in their reasoning loop.

---

## Lazy Factories (Next.js / webpack safe)

In environments where top-level `import` triggers side effects (SSR, webpack), use lazy factories:

```ts
import { getJupiterTools, getRaydiumTools } from '@oobe-protocol-labs/synapse-client-sdk/ai/lazy';

// Tools are created only when awaited — no import side effects
const jupiter = await getJupiterTools({ apiKey: '...' });
const raydium = await getRaydiumTools({});
```

---

## Constants

```ts
import {
  JUPITER_API_URL,       // 'https://api.jup.ag'
  RAYDIUM_API_URL,       // 'https://api-v3.raydium.io'
  JUPITER_PROGRAM_IDS,   // Program IDs for Jupiter on-chain
  RAYDIUM_PROGRAM_IDS,   // Program IDs for Raydium on-chain
} from '@oobe-protocol-labs/synapse-client-sdk/ai';
```

---

## Common Patterns

### AI agent with RPC + Jupiter + Raydium

```ts
const client = new SynapseClient({ endpoint, apiKey });

// RPC tools (53)
const { tools: rpcTools } = createExecutableSolanaTools(client.getTransport());

// Protocol tools
const jupiter = createJupiterTools({
  apiKey: 'jup-key',
  include: ['getQuote', 'smartSwap', 'getTokenInfo'],
});
const raydium = createRaydiumTools({
  include: ['getPoolInfo', 'getSwapQuote'],
});

// Give the agent a focused set of tools
const agentTools = [...rpcTools, ...jupiter.tools, ...raydium.tools];
```

### Monetized tools (preview)

Protocol tools are the foundation for monetization. Wrap them with the gateway to charge per call:

```ts
import { createMonetizedTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const monetized = createMonetizedTools(gateway, sessionId, jupiter);
// Each tool call now: check budget → execute → charge → attest
```

See [04_AI_GATEWAY.md](./04_AI_GATEWAY.md) for the full monetization guide.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `Cannot find module 'zod'` | Missing peer dependency | `pnpm add zod` |
| `Cannot find module '@langchain/core'` | Missing peer dependency | `pnpm add @langchain/core` |
| Agent calls wrong tool | Too many tools registered | Use `include` to limit to relevant tools |
| API returns 401/403 | Missing or invalid API key | Check `apiKey` / `apiKeyHeader` config |
| Tool returns error string instead of throwing | Expected behavior | `throwOnError: false` is the default |

---

## Next Steps

- **[10_PLUGINS.md](./10_PLUGINS.md)** — 110 additional tools via the plugin system (Token, NFT, DeFi, Misc, Blinks)
- **[11_MCP.md](./11_MCP.md)** — Expose tools as an MCP server for Claude Desktop, Cursor, and VS Code
- **[04_AI_GATEWAY.md](./04_AI_GATEWAY.md)** — Monetize these tools with agent-to-agent commerce
- **[06_INTENTS.md](./06_INTENTS.md)** — Chain tools across protocols with the Intent Resolver
