# 09 — Pipelines: End-to-End Integration Patterns

> **Prerequisites**: All previous docs. This guide shows how the modules fit together in real-world production scenarios.

---

## Overview

Each previous doc covers one module. This doc shows how to **combine** them into complete applications. Think of these as recipes — copy, adapt, ship.

### Module Dependency Map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              YOUR APPLICATION                                   │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┬─────────────┤
│ Actions  │ Intents  │ SAP      │ Gateway  │ AI Tools │ Persistence │ Plugins+MCP │
│ (07)     │ (06)     │ (05)     │ (04)     │ (03)     │ (08)        │ (10, 11)    │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────────┴─────────────┤
│                              RPC Layer (02)                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                            Core Client (01)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Subpath Import Reference

| Module | Import path |
|--------|------------|
| Core | `@oobe-protocol-labs/synapse-client-sdk` |
| Core (named) | `@oobe-protocol-labs/synapse-client-sdk/core` |
| Types | `@oobe-protocol-labs/synapse-client-sdk/types` |
| Utils | `@oobe-protocol-labs/synapse-client-sdk/utils` |
| AI Tools | `@oobe-protocol-labs/synapse-client-sdk/ai` |
| AI Gateway | `@oobe-protocol-labs/synapse-client-sdk/ai/gateway` |
| AI SAP | `@oobe-protocol-labs/synapse-client-sdk/ai/sap` |
| AI Intents | `@oobe-protocol-labs/synapse-client-sdk/ai/intents` |
| AI Actions | `@oobe-protocol-labs/synapse-client-sdk/ai/actions` |
| AI Persistence | `@oobe-protocol-labs/synapse-client-sdk/ai/persistence` |
| Plugins | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins` |
| Plugin (Token) | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token` |
| Plugin (NFT) | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft` |
| Plugin (DeFi) | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi` |
| Plugin (Misc) | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc` |
| Plugin (Blinks) | `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks` |
| MCP | `@oobe-protocol-labs/synapse-client-sdk/ai/mcp` |
| DeFi | `@oobe-protocol-labs/synapse-client-sdk/defi` |
| NFT | `@oobe-protocol-labs/synapse-client-sdk/nft` |
| WebSocket | `@oobe-protocol-labs/synapse-client-sdk/websocket` |
| Advanced | `@oobe-protocol-labs/synapse-client-sdk/advanced` |
| Batch | `@oobe-protocol-labs/synapse-client-sdk/batch` |

---

## Pipeline 1: AI Agent with LangChain

**Modules**: Core → AI Tools → LangChain

A conversational agent that can interact with Solana via natural language.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createRpcTools, createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// 1. SDK client
const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });

// 2. Tools — cherry-pick to keep context small
const rpcTools      = createRpcTools(client);
const protocolTools = await createProtocolTools(client, 'all', {
  include: ['jupiter:getQuote', 'jupiter:swap', 'raydium:getPoolInfo'],
});

const tools = [...rpcTools, ...protocolTools];

// 3. LangChain agent
const llm    = new ChatOpenAI({ model: 'gpt-4o', temperature: 0 });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a Solana DeFi assistant. Use tools to answer questions about balances, prices, and swaps.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent    = await createOpenAIFunctionsAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools, verbose: true });

// 4. Run
const result = await executor.invoke({
  input: 'What is the price of 1 SOL in USDC on Jupiter?',
});
console.log(result.output);
```

---

## Pipeline 2: Paid AI Agent (Sell Tools for USDC)

**Modules**: Core → AI Tools → Gateway → SAP → Persistence

An agent that registers on-chain and charges per API call.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import {
  createProtocolTools,
  createAgentGateway,
  createMonetizedTools,
  createAgentId,
  createAgentIdentity,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
import Redis from 'ioredis';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });

// 1. Register on-chain via SAP bridge (one-time)
const sap = SynapseAnchorSap.fromSynapseClient(client, serverWallet);

await sap.builder
  .agent('DeFi Oracle Agent')
  .description('Jupiter + Raydium price and swap tools')
  .addCapability('jupiter:getQuote', { protocol: 'jupiter', version: '6.0' })
  .addCapability('jupiter:swap', { protocol: 'jupiter', version: '6.0' })
  .addCapability('raydium:getPoolInfo', { protocol: 'raydium', version: '4.0' })
  .addPricingTier({
    tierId: 'standard', pricePerCall: 1000,
    rateLimit: 10, tokenType: 'sol', settlementMode: 'x402',
  })
  .x402Endpoint('https://myagent.xyz/.well-known/x402')
  .register();
// → Agent registered on-chain in a single transaction

// 2. Persistence
const redis = new Redis(process.env.REDIS_URL!);
const sessionStore = new RedisPersistence(redis, { prefix: 'sessions:' });
const receiptStore = new RedisPersistence(redis, { prefix: 'receipts:' });

// 3. Gateway
const identity = createAgentIdentity({
  id:     createAgentId(process.env.WALLET_PUBKEY!),
  name:   'DeFi Oracle Agent',
  wallet: process.env.WALLET_PUBKEY!,
});

const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: [{
    id: 'standard', label: 'Standard',
    pricePerCall: 1000n, maxCallsPerSession: 500,
    rateLimit: 10, token: 'USDC', includesAttestation: true,
  }],
  persistence: { sessions: sessionStore, receipts: receiptStore },
});

// 4. Monetized tools
const rawTools = await createProtocolTools(client, 'all', {
  include: ['jupiter:getQuote', 'jupiter:swap', 'raydium:getPoolInfo'],
});

const paidTools = createMonetizedTools(rawTools, gateway, {
  requireSession: true,
  logUsage:       true,
});

// 5. Serve (Express example)
import express from 'express';
const app = express();
app.use(express.json());

app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { sessionId, params } = req.body;
  const tool = paidTools.find(t => t.name === toolName);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  try {
    const result = await tool.invoke({ ...params, sessionId });
    res.json({ result });
  } catch (err: any) {
    res.status(402).json({ error: err.message });
  }
});

app.listen(3000);
```

---

## Pipeline 3: Multi-Step Swap via Intents

**Modules**: Core → AI Tools → Intents

User describes a complex operation; the system plans and executes it.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { IntentParser, IntentPlanner, IntentExecutor } from '@oobe-protocol-labs/synapse-client-sdk/ai/intents';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });
const tools  = await createProtocolTools(client, 'all');

const parser   = new IntentParser();
const planner  = new IntentPlanner();
const executor = new IntentExecutor(tools);

// User input: multi-step DeFi operation
const intents = parser.parse([
  { action: 'getQuote', protocol: 'jupiter',  params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
  { action: 'getQuote', protocol: 'raydium',  params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
  { action: 'swap',     protocol: 'jupiter',  params: {
    inputMint: 'SOL', outputMint: 'USDC', amount: 1e9,
    // Only execute if Jupiter gives better price
    minOut: '$ref:step1.output.outAmount',  // Raydium's price as floor
  }},
]);

const plan   = planner.plan(intents);
console.log(`Execution: ${plan.parallelGroups.length} waves, ${plan.metadata.maxParallelism} max parallel`);

const sim = await executor.simulate(plan);
if (!sim.valid) throw new Error(`Invalid plan: ${sim.warnings.join(', ')}`);

const result = await executor.execute(plan);
console.log('Jupiter quote:', result.outputs.get('step0'));
console.log('Raydium quote:', result.outputs.get('step1'));
console.log('Swap result:',   result.outputs.get('step2'));
```

---

## Pipeline 4: Blink-Powered Donation Page

**Modules**: Core → Actions

A one-click donation page using Solana Actions and Blinks.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { ActionServer, BlinkGenerator } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';
import express from 'express';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });
const server = new ActionServer({ baseUrl: 'https://donate.myapp.com', actions: {} });

// Define donation action with preset amounts
server.defineAction('donate', {
  title:       'Donate SOL',
  icon:        'https://donate.myapp.com/logo.png',
  description: 'Support our open-source SDK development',
  label:       'Donate',
  links: {
    actions: [
      { label: '0.1 SOL', href: '/actions/donate?amount=0.1' },
      { label: '0.5 SOL', href: '/actions/donate?amount=0.5' },
      { label: '1 SOL',   href: '/actions/donate?amount=1' },
      { label: 'Custom',  href: '/actions/donate?amount={amount}', parameters: [
        { name: 'amount', label: 'SOL Amount', type: 'number', required: true, min: 0.01 },
      ]},
    ],
  },
  handler: async (params, account) => {
    // Build transfer transaction
    const lamports = Math.floor(params.amount * 1e9);
    const tx = buildTransferTx(account, 'TreasuryPubkey...', lamports);
    return { transaction: tx, message: `Thank you for donating ${params.amount} SOL!` };
  },
});

// Generate embeddable links
const blink = new BlinkGenerator({ baseUrl: 'https://donate.myapp.com' });

const app = express();
app.use(express.json());
app.use('/actions', server.toExpressMiddleware());

// Landing page with Blink metadata
app.get('/', (req, res) => {
  const metadata = blink.createMetadata('donate', {
    title: 'Donate SOL', description: 'One-click donation', icon: 'https://donate.myapp.com/logo.png',
  });
  res.send(blink.toHtmlPage(metadata));
});

app.listen(3000);
```

---

## Pipeline 5: Agent Discovery + Auto-Connect

**Modules**: Core → SAP → Gateway

Discover the best agent on-chain and connect automatically.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { createAgentGateway } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });
const sap    = SynapseAnchorSap.fromSynapseClient(client, serverWallet);

// Find the best Jupiter swap agent via SAP discovery
const agents = await sap.discovery.findByCapability('jupiter:swap');

if (!agents || agents.length === 0) {
  console.log('No agents found');
  process.exit(1);
}

const best = agents[0];
console.log(`Connecting to: ${best.name} (reputation: ${best.reputationScore})`);

// The discovered agent's data can be used with the commerce gateway
const gateway = createAgentGateway(client, {
  identity: {
    id: best.wallet.toBase58(),
    name: best.name,
    walletPubkey: best.wallet.toBase58(),
    createdAt: Date.now(),
  },
  defaultTiers: [],
});

// Open a session and start using tools
const session = await gateway.openSession({ tierId: 'standard', buyerWallet: 'BuyerPubkey...' });
const result  = await session.callTool('jupiter:swap', {
  inputMint:  'SOL',
  outputMint: 'USDC',
  amount:     1e9,
});
```

---

## Pipeline 6: Real-Time Dashboard with WebSocket

**Modules**: Core → WebSocket → RPC

Live account monitoring for a DeFi dashboard.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { WebSocketClient } from '@oobe-protocol-labs/synapse-client-sdk/websocket';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });

// WebSocket for live updates
const ws = new WebSocketClient(process.env.WS_URL!);

// Monitor a wallet
ws.accountSubscribe('WalletPubkey...', { commitment: 'confirmed' }, (account) => {
  console.log('Balance changed:', account.lamports);
  updateDashboard(account);
});

// Monitor all transactions for a program
ws.logsSubscribe({ mentions: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'] }, (logs) => {
  console.log('Jupiter transaction:', logs.signature);
  parseTx(logs);
});

// Also do periodic RPC polling for data that doesn't have subscriptions
setInterval(async () => {
  const supply = await client.call('getTokenSupply', ['TokenMintPubkey...']);
  updateSupplyChart(supply.value);
}, 30_000);
```

---

## Pipeline 7: Batch RPC for Portfolio View

**Modules**: Core (batch)

Fetch multiple accounts in a single HTTP request.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';

const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });

// User's token accounts to check
const accounts = [
  'TokenAccount1...',
  'TokenAccount2...',
  'TokenAccount3...',
  'TokenAccount4...',
  'TokenAccount5...',
];

// Single batch request — much faster than 5 separate calls
const results = await client.batch(
  accounts.map(pubkey => ({
    method: 'getAccountInfo',
    params: [pubkey, { encoding: 'jsonParsed' }],
  }))
);

// Parse results
const portfolio = results.map((result, i) => ({
  account: accounts[i],
  data:    result?.value?.data?.parsed?.info,
  balance: result?.value?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0,
}));

console.table(portfolio);
```

---

## Pipeline 8: Testing with Mocks

**Modules**: Core (SynapseClientLike)

Unit test your app without hitting the network.

```ts
import type { SynapseClientLike } from '@oobe-protocol-labs/synapse-client-sdk/core';
import { createRpcTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Mock client
const mockClient: SynapseClientLike = {
  call: async (method, params) => {
    if (method === 'getBalance') {
      return { context: { slot: 100 }, value: 5_000_000_000 }; // 5 SOL
    }
    if (method === 'getLatestBlockhash') {
      return {
        context: { slot: 100 },
        value: { blockhash: 'mock-hash', lastValidBlockHeight: 200 },
      };
    }
    throw new Error(`Unmocked method: ${method}`);
  },
  batch: async (requests) => requests.map(() => ({ context: { slot: 100 }, value: null })),
  getTransport: () => ({ baseUrl: 'https://mock.rpc' } as any),
  destroy: async () => {},
};

// Use mock in tests
const tools = createRpcTools(mockClient);
const balanceTool = tools.find(t => t.name === 'getBalance')!;
const result = await balanceTool.invoke({ pubkey: 'AnyPubkey...' });
console.assert(result.value === 5_000_000_000);
```

---

## Pipeline 9: Next.js API Route with Lazy Loading

**Modules**: Core → AI Tools (lazy)

Minimize cold start time in serverless environments.

```ts
// app/api/tools/[tool]/route.ts (Next.js App Router)
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createLazyProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Client is lightweight — safe to create at module scope
const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });

// Lazy tools — only loads the protocol SDK when first called
const getTools = createLazyProtocolTools(client, 'all', {
  include: ['jupiter:getQuote', 'jupiter:swap'],
});

export async function POST(req: Request, { params }: { params: { tool: string } }) {
  const { tool: toolName } = params;
  const body = await req.json();

  // Tools are loaded on first request, cached after
  const tools = await getTools();
  const tool  = tools.find(t => t.name === toolName);

  if (!tool) {
    return Response.json({ error: 'Tool not found' }, { status: 404 });
  }

  try {
    const result = await tool.invoke(body);
    return Response.json({ result });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Pipeline 10: Full Production Stack

**Modules**: All

A complete production setup combining everything.

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import {
  createProtocolTools,
  createAgentGateway,
  createMonetizedTools,
  createAgentId,
  createAgentIdentity,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { IntentParser, IntentPlanner, IntentExecutor } from '@oobe-protocol-labs/synapse-client-sdk/ai/intents';
import { ActionServer, BlinkGenerator } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';
import { RedisPersistence, PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
import { WebSocketClient } from '@oobe-protocol-labs/synapse-client-sdk/websocket';
import Redis from 'ioredis';
import { Pool } from 'pg';
import express from 'express';

// ─── Infrastructure ────────────────────────────────────────
const client = createSynapseClient({ rpcUrl: process.env.RPC_URL! });
const redis  = new Redis(process.env.REDIS_URL!);
const pg     = new Pool({ connectionString: process.env.DATABASE_URL! });
const ws     = new WebSocketClient(process.env.WS_URL!);

// ─── Persistence ───────────────────────────────────────────
const sessionStore = new RedisPersistence(redis, { prefix: 'sessions:', defaultTtl: 3600 });
const receiptStore = new PostgresPersistence(pg, { tableName: 'receipts' });

// ─── Identity & Gateway ────────────────────────────────────
const identity = createAgentIdentity({
  id:     createAgentId(process.env.WALLET!),
  name:   'Production DeFi Agent',
  wallet: process.env.WALLET!,
});

const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: [{
    id: 'pro', label: 'Pro', pricePerCall: 500n,
    maxCallsPerSession: 10_000, rateLimit: 50,
    token: 'USDC', includesAttestation: true,
  }],
  persistence: { sessions: sessionStore, receipts: receiptStore },
});

// ─── Tools ─────────────────────────────────────────────────
const tools     = await createProtocolTools(client, 'all');
const paidTools = createMonetizedTools(tools, gateway, { requireSession: true });

// ─── Intents ───────────────────────────────────────────────
const parser   = new IntentParser();
const planner  = new IntentPlanner();
const executor = new IntentExecutor(paidTools);

// ─── Actions ───────────────────────────────────────────────
const actionServer = new ActionServer({ baseUrl: process.env.BASE_URL!, actions: {} });
const blinkGen     = new BlinkGenerator({ baseUrl: process.env.BASE_URL! });

actionServer.defineAction('swap', {
  title: 'Swap Tokens', icon: `${process.env.BASE_URL}/icon.png`,
  description: 'One-click token swap', label: 'Swap',
  parameters: [
    { name: 'amount', label: 'Amount', type: 'number', required: true },
  ],
  handler: async (params, account) => {
    const intents = parser.parse([
      { action: 'swap', protocol: 'jupiter', params: { inputMint: 'SOL', outputMint: 'USDC', amount: params.amount * 1e9 } },
    ]);
    const plan   = planner.plan(intents);
    const result = await executor.execute(plan);
    return { transaction: result.outputs.get('step0')?.transaction, message: 'Swap executed!' };
  },
});

// ─── Discovery ─────────────────────────────────────────────
const sap = SynapseAnchorSap.fromSynapseClient(client, serverWallet);

// ─── WebSocket monitoring ──────────────────────────────────
ws.accountSubscribe(process.env.WALLET!, { commitment: 'confirmed' }, (account) => {
  console.log('[WS] Treasury balance:', account.lamports / 1e9, 'SOL');
});

// ─── HTTP Server ───────────────────────────────────────────
const app = express();
app.use(express.json());

// Actions
app.use('/actions', actionServer.toExpressMiddleware());

// Tool API
app.post('/api/tools/:tool', async (req, res) => {
  const tool = paidTools.find(t => t.name === req.params.tool);
  if (!tool) return res.status(404).json({ error: 'Not found' });
  const result = await tool.invoke({ ...req.body, sessionId: req.headers['x-session-id'] });
  res.json({ result });
});

// Intent API
app.post('/api/intents', async (req, res) => {
  const intents = parser.parse(req.body.intents);
  const plan    = planner.plan(intents);
  const result  = await executor.execute(plan);
  res.json({ success: result.success, outputs: Object.fromEntries(result.outputs) });
});

// Discovery API
app.get('/api/agents', async (req, res) => {
  const agents = await discovery.findActive();
  res.json(agents);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await Promise.all([
    sessionStore.close(),
    receiptStore.close(),
    ws.close(),
    client.destroy(),
  ]);
  process.exit(0);
});

app.listen(Number(process.env.PORT) || 3000, () => {
  console.log('Production agent running');
});
```

---

## Production Checklist

| Category | Item | Importance |
|----------|------|-----------|
| **RPC** | Use a dedicated RPC provider (not public endpoint) | 🔴 Critical |
| **RPC** | Set appropriate `commitment` levels per operation | 🟡 Important |
| **Persistence** | Use Redis for sessions, Postgres for receipts | 🟡 Important |
| **Persistence** | Set TTLs on all session data | 🟡 Important |
| **Security** | Never expose private keys in environment variables on client | 🔴 Critical |
| **Security** | Validate all user input before passing to tools | 🔴 Critical |
| **Performance** | Use `batch()` instead of sequential `call()` | 🟡 Important |
| **Performance** | Use `createLazyProtocolTools` in serverless | 🟢 Nice |
| **Performance** | Cherry-pick tools with `include` filter | 🟡 Important |
| **Monitoring** | Subscribe via WebSocket for real-time events | 🟢 Nice |
| **Monitoring** | Log all gateway sessions and receipts | 🟡 Important |
| **Shutdown** | Call `destroy()` / `close()` on all clients | 🟡 Important |
| **Testing** | Use `SynapseClientLike` mock for unit tests | 🟡 Important |
| **SAP** | Register agent on-chain for discoverability | 🟢 Nice |
| **Actions** | Serve `actions.json` at `/.well-known/` | 🟡 Important |

---

## Type Connection Diagram

How types flow between modules:

```
SynapseClient ──→ createRpcTools()      ──→ StructuredTool[]
      │
      ├──→ createProtocolTools()         ──→ StructuredTool[]
      │                                        │
      │                                        ├──→ createMonetizedTools() ──→ StructuredTool[]
      │                                        │
      │                                        └──→ IntentExecutor
      │
      ├──→ createAgentGateway()          ──→ AgentGateway
      │         │                                │
      │         ├── AgentIdentity                ├── AgentSession
      │         ├── PricingTier[]                ├── PaymentReceipt
      │         └── PersistenceStore             └── SessionRecord
      │
      ├──→ SynapseAnchorSap.discovery     ──→ DiscoveryRegistry
      │         │                                │
      │         └── .find()              ──→ AgentIdentity (→ Gateway)
      │
      ├──→ ActionServer                  ──→ ActionDefinition
      │                                        │
      │                                        └── ActionHandler → serialized tx
      │
      └──→ WebSocketClient              ──→ Subscription callbacks
```

---

## Next Steps

You've now seen how every module connects. Here's what to explore based on your use case:

| I want to... | Start with |
|-------------|-----------|
| Build a chatbot with Solana tools | Pipeline 1 + [03_AI_TOOLS.md](./03_AI_TOOLS.md) |
| Use 110+ tools with plugin system | [10_PLUGINS.md](./10_PLUGINS.md) |
| Expose tools to Claude Desktop/Cursor | [11_MCP.md](./11_MCP.md) |
| Connect to external MCP servers | [11_MCP.md](./11_MCP.md) (Client Bridge) |
| Sell API access to my agent | Pipeline 2 + [04_AI_GATEWAY.md](./04_AI_GATEWAY.md) |
| Create multi-step DeFi operations | Pipeline 3 + [06_INTENTS.md](./06_INTENTS.md) |
| Build a one-click action page | Pipeline 4 + [07_ACTIONS_BLINKS.md](./07_ACTIONS_BLINKS.md) |
| Deploy to serverless (Vercel, CF) | Pipeline 9 + [03_AI_TOOLS.md](./03_AI_TOOLS.md) |
| Run in production with monitoring | Pipeline 10 (this doc) |
