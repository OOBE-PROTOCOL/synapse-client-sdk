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
