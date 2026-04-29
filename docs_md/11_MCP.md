# 11 — MCP: Model Context Protocol Server & Client

> **Import**: `@…/synapse-client-sdk/ai/mcp`
> **Source**: `src/ai/mcp/`
> **Prerequisites**: [10_PLUGINS.md](./10_PLUGINS.md) (SynapseAgentKit + plugins)

---

## Overview

The MCP module implements the full [Model Context Protocol](https://modelcontextprotocol.io/) (spec 2024-11-05) with **zero external MCP dependencies**. It works in both directions:

| Direction | Class | What it does |
|-----------|-------|-------------|
| **Server** | `SynapseMcpServer` | Exposes any `SynapseAgentKit` as an MCP server — works with Claude Desktop, Cursor, VS Code, Cline, and any MCP client |
| **Client** | `McpClientBridge` | Connects to external MCP servers (GitHub, Postgres, filesystem, etc.) and imports their tools into the SDK |

```
┌──────────────────┐            ┌──────────────────────┐
│  Claude Desktop  │◄── stdio ─►│  SynapseMcpServer    │
│  Cursor          │            │  (your 110+ tools)   │
│  VS Code         │            └──────────┬───────────┘
│  Any MCP Client  │                       │
└──────────────────┘               SynapseAgentKit
                                    .use(TokenPlugin)
                                    .use(DeFiPlugin)
                                    .use(...)

┌──────────────────┐            ┌──────────────────────┐
│  GitHub MCP      │◄── stdio ─►│  McpClientBridge     │
│  Postgres MCP    │            │  (imports tools)     │
│  Filesystem MCP  │◄── sse ──►│                      │
│  Any MCP Server  │            └──────────┬───────────┘
└──────────────────┘                       │
                                    kit.use(bridge.toPlugin())
```

---

## MCP Server

### stdio transport (Claude Desktop, Cursor)

stdio is the primary transport. The server reads JSON-RPC messages from `stdin` and writes responses to `stdout`, one per line.

```ts
import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { SynapseMcpServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(TokenPlugin)
  .use(DeFiPlugin);

const server = new SynapseMcpServer(kit, {
  name: 'synapse-solana',
  version: '2.0.0',
  instructions: 'Solana blockchain tools for AI agents — tokens, DeFi, and more.',
});

await server.start(); // Reads from stdin, writes to stdout
```

#### Claude Desktop config

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "synapse-solana": {
      "command": "npx",
      "args": ["tsx", "/path/to/your/mcp-server.ts"],
      "env": {
        "RPC_URL": "https://rpc.synapse.com"
      }
    }
  }
}
```

#### Cursor config

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "synapse-solana": {
      "command": "npx",
      "args": ["tsx", "./mcp-server.ts"],
      "env": {
        "RPC_URL": "https://rpc.synapse.com"
      }
    }
  }
}
```

### SSE transport (web clients)

For browser-based or HTTP-based MCP clients:

```ts
const server = new SynapseMcpServer(kit, {
  name: 'synapse-solana',
  version: '2.0.0',
});

await server.startSse({ port: 3001 });
// HTTP endpoints:
//   GET  /mcp/sse       — EventSource stream
//   POST /mcp/message   — JSON-RPC messages
//   GET  /mcp/health    — health check
```

Connect with any SSE-compatible MCP client:

```ts
const eventSource = new EventSource('http://localhost:3001/mcp/sse');
eventSource.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log(response);
};
```

### What the server exposes

The server automatically exposes all tools, resources, and prompts from the `SynapseAgentKit`:

| MCP Method | What happens |
|------------|-------------|
| `initialize` | Returns server info, capabilities, protocol version |
| `tools/list` | Lists all plugin tools with JSON Schema input schemas |
| `tools/call` | Executes a tool by name with validated input |
| `resources/list` | Lists protocol-level resources |
| `resources/read` | Reads a specific resource by URI |
| `resources/templates/list` | Lists URI template patterns |
| `prompts/list` | Lists available prompt templates |
| `prompts/get` | Returns a specific prompt with messages |
| `ping` | Health check (returns empty result) |
| `completion/complete` | Auto-completion for tool/resource names |
| `logging/setLevel` | Set server log level |

### Zod → JSON Schema conversion

The server includes a deep Zod-to-JSON-Schema converter that handles all Zod types used in plugin schemas:

| Zod Type | JSON Schema |
|----------|-------------|
| `z.string()` | `{ type: 'string' }` with minLength, maxLength, pattern |
| `z.number()` | `{ type: 'number' }` with minimum, maximum |
| `z.boolean()` | `{ type: 'boolean' }` |
| `z.array(T)` | `{ type: 'array', items: T }` |
| `z.object({})` | `{ type: 'object', properties, required }` |
| `z.enum([])` | `{ type: 'string', enum: [...] }` |
| `z.optional(T)` | Removes key from `required` |
| `z.default(T)` | Adds `default` to schema |
| `z.nullable(T)` | `{ oneOf: [T, { type: 'null' }] }` |
| `z.record(K, V)` | `{ type: 'object', additionalProperties: V }` |
| `z.tuple([...])` | `{ type: 'array', prefixItems: [...] }` |
| `z.union([...])` | `{ oneOf: [...] }` |
| `z.literal(v)` | `{ const: v }` |

### Server introspection

```ts
const info = server.info();
// {
//   name: 'synapse-solana',
//   version: '2.0.0',
//   toolCount: 65,
//   resourceCount: 2,
//   promptCount: 0,
//   transport: 'stdio'
// }
```

---

## MCP Client Bridge

The `McpClientBridge` connects to any external MCP server and imports its tools into your SDK workflow. This is how you access tools from GitHub, Postgres, filesystem, and any other MCP server.

### Connect to MCP servers

```ts
import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const bridge = new McpClientBridge({ debug: true });

// ── stdio servers ──────────────────────────────────────────────
await bridge.connect({
  id: 'github',
  name: 'GitHub',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
  toolPrefix: 'github_',
});

await bridge.connect({
  id: 'postgres',
  name: 'PostgreSQL',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!],
  toolPrefix: 'pg_',
});

await bridge.connect({
  id: 'filesystem',
  name: 'Filesystem',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
  toolPrefix: 'fs_',
});

// ── SSE servers ────────────────────────────────────────────────
await bridge.connect({
  id: 'custom',
  name: 'Custom MCP Server',
  transport: 'sse',
  url: 'https://my-mcp-server.com/mcp/sse',
  headers: { Authorization: 'Bearer sk-...' },
  toolPrefix: 'custom_',
});
```

### Get LangChain tools

```ts
// All tools from all connected servers
const remoteTools = bridge.getTools();
// → StructuredTool[] with prefixed names (github_create_issue, pg_query, etc.)

// Tools from a specific server
const githubTools = bridge.getServerTools('github');
```

### Call tools directly

```ts
const result = await bridge.callTool('github', 'create_issue', {
  owner: 'my-org',
  repo: 'my-repo',
  title: 'Bug report from AI agent',
  body: 'Automatically detected issue...',
});
```

### Read resources

```ts
const resource = await bridge.readResource('postgres', 'postgres://table/users');
```

### Convert to plugin

The bridge can be converted to a `SynapsePlugin` for seamless integration with `SynapseAgentKit`:

```ts
import { SynapseAgentKit, TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';

const kit = new SynapseAgentKit({ rpcUrl })
  .use(TokenPlugin)           // 22 Solana token tools
  .use(bridge.toPlugin());    // + all remote MCP tools

const allTools = kit.getTools();
// → Token tools + GitHub tools + Postgres tools + filesystem tools
```

### Connection management

```ts
// Check status
const status = bridge.getStatus('github');
// {
//   id: 'github',
//   name: 'GitHub',
//   status: 'connected',
//   toolCount: 25,
//   resourceCount: 0,
//   serverInfo: { name: 'github-mcp-server', version: '1.0.0' },
//   connectedAt: 1709712000000
// }

// All statuses
const all = bridge.getAllStatuses();

// All tool definitions with server IDs
const defs = bridge.getAllToolDefinitions();
// → [{ name, description, inputSchema, serverId }, ...]

// Disconnect one server
await bridge.disconnect('postgres');

// Disconnect all
await bridge.disconnectAll();
```

---

## Combined: Server + Client

Expose your Solana tools **and** external MCP tools as a single MCP server:

```ts
import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { SynapseMcpServer, McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

// 1. Set up the bridge with external servers
const bridge = new McpClientBridge();
await bridge.connect({
  id: 'github',
  name: 'GitHub',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
});

// 2. Build the kit with plugins + bridge
const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(TokenPlugin)
  .use(DeFiPlugin)
  .use(bridge.toPlugin());

// 3. Expose everything as a single MCP server
const server = new SynapseMcpServer(kit, {
  name: 'synapse-full-stack',
  version: '2.0.0',
  instructions: 'Solana tools + GitHub integration for AI agents.',
});

await server.start();
// Claude Desktop now sees: Token tools + DeFi tools + GitHub tools
```

---

## Preset Registry

The SDK ships a built-in registry of well-known MCP server presets. A preset is
a **static, secret-free** connection template. Credentials are supplied at
runtime via `connectPreset(id, overrides)` — they are never stored in the
registry.

### List available presets

```ts
const presets = bridge.listMcpPresets();
// [
//   { id: 'github',       name: 'GitHub',         transport: 'stdio', toolPrefix: 'github_',   ... },
//   { id: 'postgres',     name: 'PostgreSQL',      transport: 'stdio', toolPrefix: 'pg_',       ... },
//   { id: 'filesystem',   name: 'Filesystem',      transport: 'stdio', toolPrefix: 'fs_',       ... },
//   { id: 'slack',        name: 'Slack',           transport: 'stdio', toolPrefix: 'slack_',    ... },
//   { id: 'brave-search', name: 'Brave Search',    transport: 'stdio', toolPrefix: 'brave_',    ... },
// ]
```

### Connect via preset — stdio (GitHub)

```ts
await bridge.connectPreset('github', {
  env: { GITHUB_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN! },
});
// Imports: github_create_issue, github_list_prs, github_search_code, ...
```

### Connect via preset — stdio (PostgreSQL)

```ts
await bridge.connectPreset('postgres', {
  env: { DATABASE_URL: process.env.DATABASE_URL! },
});
```

### Connect via preset — SSE (custom service)

```ts
await bridge.connectPreset('orbis', {
  headers: { Authorization: `Bearer ${process.env.ORBIS_API_KEY}` },
});
```

### Connect via preset — override timeout

```ts
await bridge.connectPreset('filesystem', {
  env: { FS_ALLOWED_DIR: '/tmp/agent-sandbox' },
  timeout: 10_000,
});
```

### Registered presets

| ID | Name | Transport | Tool Prefix | npm Package |
|----|------|-----------|-------------|-------------|
| `github` | GitHub | stdio | `github_` | `@modelcontextprotocol/server-github` |
| `postgres` | PostgreSQL | stdio | `pg_` | `@modelcontextprotocol/server-postgres` |
| `filesystem` | Filesystem | stdio | `fs_` | `@modelcontextprotocol/server-filesystem` |
| `slack` | Slack | stdio | `slack_` | `@modelcontextprotocol/server-slack` |
| `brave-search` | Brave Search | stdio | `brave_` | `@modelcontextprotocol/server-brave-search` |

> To add a new preset, see the [Contributing Guide — Adding an MCP Server Preset](../CONTRIBUTING.md#adding-an-mcp-server-preset).

---

## McpExternalServerConfig

```ts
interface McpExternalServerConfig {
  /** Unique identifier for this connection */
  id: string;

  /** Human-readable server name */
  name: string;

  /** Transport type */
  transport: 'stdio' | 'sse';

  // ── stdio only ────────────────────────────
  /** Command to spawn (e.g. 'npx', 'node') */
  command?: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables for the child process */
  env?: Record<string, string>;

  // ── SSE only ──────────────────────────────
  /** SSE endpoint URL */
  url?: string;

  /** HTTP headers for SSE connection */
  headers?: Record<string, string>;

  // ── Shared ────────────────────────────────
  /** Prefix for imported tool names (e.g. 'github_') */
  toolPrefix?: string;

  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}
```

---

## McpServerConfig

```ts
interface McpServerConfig {
  /** Server name (shown in MCP client UIs) */
  name: string;

  /** Server version */
  version: string;

  /** Instructions for AI agents using this server */
  instructions?: string;

  /** Additional prompts to expose */
  prompts?: McpPromptDefinition[];

  /** Additional resources to expose */
  resources?: McpResourceDefinition[];

  /** Resource URI templates */
  resourceTemplates?: McpResourceTemplate[];
}
```

---

## JSON Schema → Zod (Runtime)

The client bridge includes a runtime JSON Schema → Zod converter. When connecting to an external MCP server, tool input schemas (JSON Schema) are automatically converted to Zod schemas so they work with LangChain and the plugin system:

```
External MCP Server
    │
    │── tools/list → { name, description, inputSchema: JSONSchema }
    │
    ▼
McpClientBridge
    │
    │── jsonSchemaToZod(inputSchema) → z.ZodTypeAny
    │── tool(name, description, zodSchema, execFn) → StructuredTool
    │
    ▼
LangChain StructuredTool[]    (ready for any agent)
```

Supported JSON Schema types:

| JSON Schema | Zod Type |
|-------------|----------|
| `{ type: 'object', properties, required }` | `z.object({})` |
| `{ type: 'string' }` | `z.string()` |
| `{ type: 'string', enum: [...] }` | `z.enum([...])` |
| `{ type: 'number' }` / `{ type: 'integer' }` | `z.number()` / `z.number().int()` |
| `{ type: 'boolean' }` | `z.boolean()` |
| `{ type: 'array', items }` | `z.array(T)` |
| No matching type | `z.unknown()` |

---

## Protocol

The implementation follows MCP spec **2024-11-05**:

- **JSON-RPC 2.0** message framing
- **Capabilities** negotiation on `initialize`
- **Notifications** (`notifications/initialized`)
- **Error codes** (-32700 Parse error, -32600 Invalid request, -32601 Method not found, -32602 Invalid params, -32603 Internal error)

The SDK implements the protocol from scratch with zero external MCP dependencies. The full `@modelcontextprotocol/sdk` is **not** required — but if you already use it, both can coexist.

---

## Next

- [09_PIPELINES.md](./09_PIPELINES.md) — Full end-to-end integration patterns.
- [10_PLUGINS.md](./10_PLUGINS.md) — Plugin system details and custom plugin creation.

---

## Synapse Extension Methods

The following methods are **Synapse-specific extensions** (non-standard JSON-RPC).
They are available on the `us-1-mainnet` endpoint and recommended for all new
integrations that need paginated results.

Endpoint: `https://us-1-mainnet.oobeprotocol.ai/rpc?api_key=<KEY>`

---

### `getProgramAccountsV2`

Paginated, cursor-based replacement for `getProgramAccounts`. Works on programs
of any size (tested on metaplex-core with 6.4 M+ accounts). The v1 method can
time-out or return `502` for large programs — V2 is always safe.

#### Request

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getProgramAccountsV2",
  "params": [
    "<programId: base58>",
    {
      "limit": 1000,                  // required, 1..=1000
      "encoding": "base64",           // "base64" | "base64+zstd" | "jsonParsed"
      "filters": [                    // optional — same shape as v1
        { "dataSize": 182 },
        { "memcmp": { "offset": 0, "bytes": "<base58>" } }
      ],
      "paginationKey": "<opaque>",    // optional, from previous response
      "commitment": "confirmed",      // optional, default "confirmed"
      "dataSlice": { "offset": 0, "length": 64 }
    }
  ]
}
```

#### Response

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "items": [
      {
        "pubkey": "<base58>",
        "account": {
          "lamports": 2039280,
          "owner": "<base58>",
          "executable": false,
          "rentEpoch": 18446744073709551615,
          "data": ["<base64>", "base64"]
        }
      }
    ],
    "paginationKey": "<opaque-or-null>",  // null = no more pages
    "context": { "slot": 401234567 }
  }
}
```

#### TypeScript SDK types

```ts
export interface GpaV2Filter {
  dataSize?: number;
  memcmp?: { offset: number; bytes: string };
}

export interface GpaV2Params {
  limit: number;                    // 1..=1000
  encoding?: 'base64' | 'base64+zstd' | 'jsonParsed';
  filters?: GpaV2Filter[];
  paginationKey?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  dataSlice?: { offset: number; length: number };
}

export interface GpaV2Account {
  pubkey: string;
  account: {
    lamports: number;
    owner: string;
    executable: boolean;
    rentEpoch: number;
    data: [string, 'base64' | 'base64+zstd' | 'jsonParsed'];
  };
}

export interface GpaV2Result {
  items: GpaV2Account[];
  paginationKey: string | null;
  context: { slot: number };
}
```

#### Fetch a single page

```ts
const result = await client.call<GpaV2Result>('getProgramAccountsV2', [
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
  { limit: 1000, encoding: 'base64', commitment: 'confirmed' },
]);

for (const { pubkey, account } of result.items) {
  console.log(pubkey, account.lamports);
}
const nextKey = result.paginationKey; // null when done
```

#### Walk all pages — async iterator

```ts
async function* iterateProgramAccountsV2(
  client: SynapseClient,
  programId: string,
  params: Omit<GpaV2Params, 'paginationKey'>,
): AsyncGenerator<GpaV2Account> {
  let key: string | undefined;
  do {
    const page = await client.call<GpaV2Result>('getProgramAccountsV2', [
      programId,
      { ...params, paginationKey: key },
    ]);
    for (const item of page.items) yield item;
    key = page.paginationKey ?? undefined;
  } while (key);
}

for await (const account of iterateProgramAccountsV2(client, PROGRAM_ID, { limit: 1000 })) {
  // process account
}
```

#### Latency benchmarks (us-1 mainnet)

| Scenario | Items | Latency | Payload |
|----------|-------|---------|---------|
| metaplex-core, page 1, limit 1000 | 1000 | 1.57 s | 471 KB |
| metaplex-core, page 2, limit 1000 | 1000 | 1.58 s | 459 KB |
| metaplex-core + dataSize filter | 2 | 0.65 s | 1.1 KB |
| bubblegum, limit 50 | 50 | 0.80 s | 20 KB |

#### Secondary indexes (auto-accelerated filters)

For known filter shapes the gateway scans a pre-built secondary index instead
of walking the full program — no opt-in required, same response schema.

| Program | Filter shape | Acceleration |
|---------|-------------|-------------|
| `metaplex-core` | `memcmp { offset: 33, bytes: [0x02, <32-byte collection pubkey>] }` | Collection index |
| `metaplex-core` | `memcmp { offset: 34, bytes: <32-byte collection pubkey> }` | Collection index (short form) |

For low-selectivity filters not covered by an index, prefer the DAS API
(`searchAssets`) or `getMultipleAccounts` if the address set is known.

---

### `getSignaturesForAddressV2`

Paginated, always-available replacement for `getSignaturesForAddress`.
Uses HMAC-signed cursors instead of raw `before` signatures — clients cannot
forge or tamper. Adds a warm cache for hot addresses.

#### Request

```jsonc
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "getSignaturesForAddressV2",
  "params": [
    "<address: base58>",
    {
      "limit": 100,                  // required, 1..=1000
      "paginationKey": "<opaque>",   // optional, from previous response
      "commitment": "confirmed"      // optional, default "confirmed"
    }
  ]
}
```

#### Response

```jsonc
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "items": [
      {
        "signature": "<base58, 64 bytes>",
        "slot": 401234567,
        "err": null,
        "memo": null,
        "blockTime": 1745678901,
        "confirmationStatus": "finalized"
      }
    ],
    "paginationKey": "<opaque-or-null>"  // null = end of history
  }
}
```

#### TypeScript SDK types

```ts
export interface GsfaV2Params {
  limit: number;                    // 1..=1000
  paginationKey?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface SignatureItem {
  signature: string;
  slot: number;
  err: unknown | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
}

export interface GsfaV2Result {
  items: SignatureItem[];
  paginationKey: string | null;
}
```

#### Fetch a single page

```ts
const result = await client.call<GsfaV2Result>('getSignaturesForAddressV2', [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  { limit: 100, commitment: 'confirmed' },
]);

for (const item of result.items) {
  console.log(item.signature, item.slot, item.blockTime);
}
const nextKey = result.paginationKey; // null = no more history
```

#### Walk full history — async iterator

```ts
async function* iterateSignaturesV2(
  client: SynapseClient,
  address: string,
  params: Omit<GsfaV2Params, 'paginationKey'>,
): AsyncGenerator<SignatureItem> {
  let key: string | undefined;
  do {
    const page = await client.call<GsfaV2Result>('getSignaturesForAddressV2', [
      address,
      { ...params, paginationKey: key },
    ]);
    for (const item of page.items) yield item;
    key = page.paginationKey ?? undefined;
  } while (key);
}
```

#### Latency benchmarks (us-1 mainnet)

| Scenario | Items | Latency |
|----------|-------|---------|
| Token program, page 1, limit 100 | 100 | 0.98 s |
| Token program, page 2, limit 100 | 100 | 0.79 s (warm cache) |

Warm cache hits on the same address can drop to 0.05–0.10 s.

---

### Error handling for V2 methods

Both V2 methods return standard JSON-RPC 2.0 errors:

| Code | Name | Meaning | Action |
|------|------|---------|--------|
| `-32600` | InvalidRequest | Bad params, `limit` out of range | Fix the request |
| `-32602` | InvalidParams | `paginationKey` tampered or from wrong address | Restart from page 1 |
| `-32603` | InternalError | Upstream unavailable | Retry with backoff |
| `-32005` | RateLimited | Per-key quota exceeded | Honor `Retry-After` |

```jsonc
// Example error
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "invalid paginationKey: hmac mismatch",
    "data": { "reason": "tampered_or_wrong_secret" }
  }
}
```

### Cursor rules

- `paginationKey` is **opaque** — never parse, modify, or store long-term.
- It is **address-bound**: a key from address A is rejected on address B (`-32602`).
- `null` paginationKey means end of results — stop iteration.

### Migration from v1

| v1 method | V2 equivalent | Key difference |
|-----------|--------------|----------------|
| `getProgramAccounts` | `getProgramAccountsV2` | Always paginated; result is `{items, paginationKey, context}` |
| `getSignaturesForAddress` | `getSignaturesForAddressV2` | `before` cursor replaced by `paginationKey`; result is `{items, paginationKey}` |
