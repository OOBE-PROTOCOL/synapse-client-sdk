/**
 * @module ai/mcp/server
 * @description MCP Server — exposes a SynapseAgentKit as a fully spec-compliant
 * Model Context Protocol server over stdio or SSE.
 *
 * Zero external MCP dependencies — implements the protocol directly using
 * the MCP spec (2024-11-05). Works with Claude Desktop, Cursor, VS Code,
 * Cline, and any MCP-compatible client.
 *
 * ## Usage — stdio (Claude Desktop / Cursor)
 *
 * ```ts
 * import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
 * import { SynapseMcpServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
 *   .use(TokenPlugin)
 *   .use(DeFiPlugin);
 *
 * const server = new SynapseMcpServer(kit, {
 *   name: 'synapse-solana',
 *   version: '2.0.0',
 *   instructions: 'Solana blockchain tools for AI agents — token, NFT, DeFi, and more.',
 * });
 *
 * await server.start(); // Listens on stdin/stdout
 * ```
 *
 * ## Usage — SSE (web-based clients)
 *
 * ```ts
 * const server = new SynapseMcpServer(kit, {
 *   transport: 'sse',
 *   ssePort: 3001,
 *   ssePath: '/mcp',
 * });
 *
 * await server.start(); // HTTP server on port 3001
 * ```
 *
 * ## Claude Desktop config (claude_desktop_config.json)
 *
 * ```json
 * {
 *   "mcpServers": {
 *     "synapse-solana": {
 *       "command": "npx",
 *       "args": ["synapse-mcp-server"],
 *       "env": { "SYNAPSE_RPC_URL": "https://..." }
 *     }
 *   }
 * }
 * ```
 *
 * @since 2.0.0
 */
import type { SynapseAgentKit } from '../plugins/registry';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpServerConfig,
  McpServerInfo,
  McpCapabilities,
  McpInitializeResult,
  McpToolDefinition,
  McpToolsListResult,
  McpToolCallParams,
  McpToolCallResult,
  McpResourceDefinition,
  McpResourcesListResult,
  McpResourceTemplate,
  McpContentItem,
} from './types';
import { MCP_PROTOCOL_VERSION, MCP_JSONRPC_VERSION } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  MCP Errors
 * ═══════════════════════════════════════════════════════════════ */

const MCP_ERRORS = {
  PARSE_ERROR:       { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:   { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND:  { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:    { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:    { code: -32603, message: 'Internal error' },
} as const;

export class McpServerError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32603,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'McpServerError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Zod → JSON Schema (deep conversion)
 * ═══════════════════════════════════════════════════════════════ */

function zodToMcpSchema(schema: unknown): McpToolDefinition['inputSchema'] {
  const result = convertZod(schema);
  if (result.type === 'object') return result as McpToolDefinition['inputSchema'];
  return { type: 'object', properties: { value: result } };
}

function convertZod(z: unknown): Record<string, unknown> {
  if (!z || typeof z !== 'object') return { type: 'string' };
  const def = (z as any)?._def ?? (z as any)?.def;
  if (!def) return { type: 'string' };

  const typeName = def.typeName ?? def.type;
  const description = (z as any)?.description ?? def?.description;

  switch (typeName) {
    case 'ZodString': {
      const base: Record<string, unknown> = { type: 'string' };
      if (description) base.description = description;
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'min') base.minLength = check.value;
          if (check.kind === 'max') base.maxLength = check.value;
          if (check.kind === 'url') base.format = 'uri';
          if (check.kind === 'email') base.format = 'email';
        }
      }
      return base;
    }

    case 'ZodNumber': {
      const base: Record<string, unknown> = { type: 'number' };
      if (description) base.description = description;
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'min') base.minimum = check.value;
          if (check.kind === 'max') base.maximum = check.value;
          if (check.kind === 'int') base.type = 'integer';
        }
      }
      return base;
    }

    case 'ZodBoolean': {
      const base: Record<string, unknown> = { type: 'boolean' };
      if (description) base.description = description;
      return base;
    }

    case 'ZodArray': {
      const base: Record<string, unknown> = {
        type: 'array',
        items: convertZod(def.type),
      };
      if (description) base.description = description;
      return base;
    }

    case 'ZodObject': {
      const shape = (z as any).shape ?? def.shape?.();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      if (shape) {
        for (const [key, val] of Object.entries(shape)) {
          properties[key] = convertZod(val);
          const v = val as any;
          const isOpt = v?._def?.typeName === 'ZodOptional' ||
                        v?._def?.typeName === 'ZodDefault' ||
                        v?.isOptional?.() === true;
          if (!isOpt) required.push(key);
        }
      }

      const base: Record<string, unknown> = { type: 'object', properties };
      if (required.length > 0) base.required = required;
      if (description) base.description = description;
      return base;
    }

    case 'ZodEnum': {
      const values = def.values ?? def.entries;
      const base: Record<string, unknown> = { type: 'string' };
      if (Array.isArray(values)) base.enum = values;
      if (description) base.description = description;
      return base;
    }

    case 'ZodOptional':
      return convertZod(def.innerType);

    case 'ZodDefault':
      return { ...convertZod(def.innerType), default: def.defaultValue?.() };

    case 'ZodNullable': {
      const inner = convertZod(def.innerType);
      return { ...inner, nullable: true };
    }

    case 'ZodRecord': {
      const base: Record<string, unknown> = {
        type: 'object',
        additionalProperties: convertZod(def.valueType),
      };
      if (description) base.description = description;
      return base;
    }

    case 'ZodTuple': {
      const items = (def.items ?? []).map((i: unknown) => convertZod(i));
      const base: Record<string, unknown> = { type: 'array', items, minItems: items.length, maxItems: items.length };
      if (description) base.description = description;
      return base;
    }

    case 'ZodLiteral': {
      return { type: typeof def.value === 'number' ? 'number' : 'string', const: def.value };
    }

    case 'ZodUnion': {
      const options = (def.options ?? []).map((o: unknown) => convertZod(o));
      return { oneOf: options };
    }

    default: {
      const base: Record<string, unknown> = { type: 'string' };
      if (description) base.description = description;
      return base;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  SynapseMcpServer
 * ═══════════════════════════════════════════════════════════════ */

export class SynapseMcpServer {
  private readonly kit: SynapseAgentKit;
  private readonly config: Required<Pick<McpServerConfig, 'name' | 'version'>> & McpServerConfig;
  private readonly toolDefs: McpToolDefinition[];
  private readonly resourceDefs: McpResourceDefinition[];
  private readonly resourceTemplates: McpResourceTemplate[];
  private _initialized = false;
  private _running = false;
  private _stdinBuffer = '';

  // SSE state
  private _httpServer: any = null;
  private _sseClients = new Map<string, { res: any; id: string }>();

  constructor(kit: SynapseAgentKit, config: McpServerConfig = {}) {
    this.kit = kit;
    this.config = {
      name: config.name ?? 'synapse-solana-mcp',
      version: config.version ?? '2.0.0',
      ...config,
    };

    // Pre-build tool definitions from kit
    this.toolDefs = this.buildToolDefinitions();
    this.resourceDefs = this.buildResourceDefinitions();
    this.resourceTemplates = this.buildResourceTemplates();
  }

  /* ── Lifecycle ────────────────────────────────────────────── */

  /**
   * Start the MCP server on the configured transport.
   */
  async start(): Promise<void> {
    if (this._running) return;
    this._running = true;

    const transport = this.config.transport ?? 'stdio';

    if (transport === 'stdio') {
      await this.startStdio();
    } else if (transport === 'sse') {
      await this.startSse();
    } else {
      throw new McpServerError(`Unknown transport: ${transport}`);
    }
  }

  /**
   * Stop the MCP server.
   */
  async stop(): Promise<void> {
    this._running = false;

    if (this._httpServer) {
      await new Promise<void>((resolve) => {
        this._httpServer.close(() => resolve());
      });
      this._httpServer = null;
    }

    // Cleanup SSE clients
    for (const [, client] of this._sseClients) {
      try { client.res.end(); } catch { /* noop */ }
    }
    this._sseClients.clear();
  }

  /* ── stdio Transport ──────────────────────────────────────── */

  private async startStdio(): Promise<void> {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdin.setEncoding('utf8');
    stdin.resume();

    stdin.on('data', (chunk: string) => {
      this._stdinBuffer += chunk;
      this.processStdinBuffer(stdout);
    });

    stdin.on('end', () => {
      this._running = false;
    });

    if (this.config.debug) {
      process.stderr.write(`[MCP] ${this.config.name} listening on stdio\n`);
    }
  }

  private processStdinBuffer(stdout: NodeJS.WriteStream): void {
    // MCP uses newline-delimited JSON
    while (true) {
      const newlineIdx = this._stdinBuffer.indexOf('\n');
      if (newlineIdx === -1) break;

      const line = this._stdinBuffer.slice(0, newlineIdx).trim();
      this._stdinBuffer = this._stdinBuffer.slice(newlineIdx + 1);

      if (!line) continue;

      this.handleMessage(line)
        .then((response) => {
          if (response) {
            stdout.write(JSON.stringify(response) + '\n');
          }
        })
        .catch((err) => {
          if (this.config.debug) {
            process.stderr.write(`[MCP] Error: ${err}\n`);
          }
        });
    }
  }

  /* ── SSE Transport ────────────────────────────────────────── */

  private async startSse(): Promise<void> {
    const http = await import('http');
    const port = this.config.ssePort ?? 3001;
    const basePath = (this.config.ssePath ?? '/mcp').replace(/\/$/, '');

    this._httpServer = http.createServer(async (req: any, res: any) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const path = url.pathname;

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // SSE endpoint — client subscribes here
      if (path === `${basePath}/sse` && req.method === 'GET') {
        const clientId = crypto.randomUUID();

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        // Send the endpoint URL for posting messages
        const messageUrl = `${basePath}/message?sessionId=${clientId}`;
        res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

        this._sseClients.set(clientId, { res, id: clientId });

        req.on('close', () => {
          this._sseClients.delete(clientId);
        });

        if (this.config.debug) {
          process.stderr.write(`[MCP] SSE client connected: ${clientId}\n`);
        }
        return;
      }

      // Message endpoint — client sends JSON-RPC messages here
      if (path === `${basePath}/message` && req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId');
        const client = sessionId ? this._sseClients.get(sessionId) : undefined;

        if (!client) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        try {
          const response = await this.handleMessage(body);
          if (response) {
            // Send response via SSE
            client.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          }
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      // Health check
      if (path === `${basePath}/health`) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          server: this.config.name,
          version: this.config.version,
          tools: this.toolDefs.length,
          resources: this.resourceDefs.length,
          connectedClients: this._sseClients.size,
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => {
      this._httpServer.listen(port, () => {
        if (this.config.debug) {
          process.stderr.write(
            `[MCP] ${this.config.name} SSE server on http://localhost:${port}${basePath}\n`,
          );
        }
        resolve();
      });
    });
  }

  /* ── Message Handling ─────────────────────────────────────── */

  private async handleMessage(raw: string): Promise<JsonRpcResponse | null> {
    let parsed: JsonRpcRequest;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.errorResponse(null, MCP_ERRORS.PARSE_ERROR.code, MCP_ERRORS.PARSE_ERROR.message);
    }

    if (!parsed.jsonrpc || parsed.jsonrpc !== '2.0') {
      return this.errorResponse(
        parsed.id ?? null,
        MCP_ERRORS.INVALID_REQUEST.code,
        MCP_ERRORS.INVALID_REQUEST.message,
      );
    }

    // Notifications (no id) — don't respond
    if (parsed.id === undefined || parsed.id === null) {
      await this.handleNotification(parsed as unknown as JsonRpcNotification);
      return null;
    }

    if (this.config.debug) {
      process.stderr.write(`[MCP] ← ${parsed.method}\n`);
    }

    try {
      const result = await this.dispatch(parsed);
      return {
        jsonrpc: MCP_JSONRPC_VERSION,
        id: parsed.id,
        result,
      };
    } catch (err) {
      const mcpErr = err instanceof McpServerError ? err : new McpServerError(String(err));
      return this.errorResponse(parsed.id, mcpErr.code, mcpErr.message, mcpErr.data);
    }
  }

  private async dispatch(req: JsonRpcRequest): Promise<unknown> {
    switch (req.method) {
      case 'initialize':
        return this.handleInitialize(req.params as any);

      case 'initialized':
        return {}; // acknowledgment

      case 'ping':
        return {}; // pong

      case 'tools/list':
        return this.handleToolsList(req.params as any);

      case 'tools/call':
        return this.handleToolsCall(req.params as unknown as McpToolCallParams);

      case 'resources/list':
        return this.handleResourcesList(req.params as any);

      case 'resources/read':
        return this.handleResourcesRead(req.params as any);

      case 'resources/templates/list':
        return this.handleResourceTemplatesList();

      case 'prompts/list':
        return { prompts: [] }; // No prompts for now

      case 'prompts/get':
        throw new McpServerError('Prompt not found', MCP_ERRORS.INVALID_PARAMS.code);

      case 'completion/complete':
        return { completion: { values: [], hasMore: false, total: 0 } };

      case 'logging/setLevel':
        return {};

      default:
        throw new McpServerError(
          `Unknown method: ${req.method}`,
          MCP_ERRORS.METHOD_NOT_FOUND.code,
        );
    }
  }

  private async handleNotification(notif: JsonRpcNotification): Promise<void> {
    switch (notif.method) {
      case 'notifications/initialized':
        this._initialized = true;
        break;
      case 'notifications/cancelled':
        // Handle cancellation if needed
        break;
      default:
        if (this.config.debug) {
          process.stderr.write(`[MCP] Unhandled notification: ${notif.method}\n`);
        }
    }
  }

  /* ── MCP Method Handlers ──────────────────────────────────── */

  private handleInitialize(params: any): McpInitializeResult {
    this._initialized = true;

    const capabilities: McpCapabilities = {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      ...this.config.capabilities,
    };

    const summary = this.kit.summary();

    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities,
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
      instructions: this.config.instructions ??
        `Synapse Solana MCP Server — ${summary.totalTools} tools across ${summary.totalProtocols} protocols. ` +
        `Plugins: ${summary.plugins.map((p) => p.name).join(', ')}. ` +
        `Provides full Solana blockchain access: tokens, NFTs, DeFi, staking, domains, oracles, and more.`,
    };
  }

  private handleToolsList(_params?: any): McpToolsListResult {
    return { tools: this.toolDefs };
  }

  private async handleToolsCall(params: McpToolCallParams): Promise<McpToolCallResult> {
    const { name, arguments: args } = params;

    if (!name) {
      throw new McpServerError('Tool name is required', MCP_ERRORS.INVALID_PARAMS.code);
    }

    // Find the tool in the kit
    const toolMap = this.kit.getToolMap();
    const tool = toolMap[name];

    if (!tool) {
      throw new McpServerError(
        `Tool not found: "${name}". Available: ${Object.keys(toolMap).slice(0, 10).join(', ')}...`,
        MCP_ERRORS.INVALID_PARAMS.code,
      );
    }

    try {
      // Invoke the LangChain tool
      const result = await tool.invoke(args ?? {});
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      return {
        content: [{ type: 'text', text }],
        isError: false,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error executing ${name}: ${errMsg}` }],
        isError: true,
      };
    }
  }

  private handleResourcesList(_params?: any): McpResourcesListResult {
    return { resources: this.resourceDefs };
  }

  private async handleResourcesRead(params: { uri: string }): Promise<unknown> {
    const { uri } = params;

    // Try to match resource templates and execute
    // For now, return a description of the resource
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          uri,
          message: `Resource ${uri} — use the corresponding tool to fetch actual data.`,
          availableTools: Object.keys(this.kit.getToolMap()).slice(0, 20),
        }, null, 2),
      }],
    };
  }

  private handleResourceTemplatesList(): { resourceTemplates: McpResourceTemplate[] } {
    return { resourceTemplates: this.resourceTemplates };
  }

  /* ── Builders ─────────────────────────────────────────────── */

  private buildToolDefinitions(): McpToolDefinition[] {
    const defs: McpToolDefinition[] = [];
    const descriptors = this.kit.getMcpToolDescriptors();

    for (const desc of descriptors) {
      // Find the matching protocol method for deep schema conversion
      const pluginTools = this.kit.getPluginTools(desc.plugin);
      const method = pluginTools
        ? this.findMethodByName(desc.plugin, desc.name)
        : undefined;

      defs.push({
        name: desc.name,
        description: desc.description,
        inputSchema: method
          ? zodToMcpSchema(method.input)
          : (desc.inputSchema as McpToolDefinition['inputSchema']),
      });
    }

    return defs;
  }

  private buildResourceDefinitions(): McpResourceDefinition[] {
    return this.kit.getMcpResourceDescriptors().map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  private buildResourceTemplates(): McpResourceTemplate[] {
    // Convert resource URIs with {param} into templates
    return this.kit.getMcpResourceDescriptors()
      .filter((r) => r.uri.includes('{'))
      .map((r) => ({
        uriTemplate: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
  }

  private findMethodByName(pluginId: string, toolName: string): any | undefined {
    const summary = this.kit.summary();
    const pluginInfo = summary.plugins.find((p) => p.id === pluginId);
    if (!pluginInfo) return undefined;

    for (const protoId of pluginInfo.protocols) {
      const toolkit = this.kit.getProtocolToolkit(pluginId, protoId);
      if (toolkit) {
        const method = toolkit.methods.find((m) => `${protoId}_${m.name}` === toolName);
        if (method) return method;
      }
    }
    return undefined;
  }

  /* ── Response Helpers ─────────────────────────────────────── */

  private errorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcResponse {
    return {
      jsonrpc: MCP_JSONRPC_VERSION,
      id: id ?? 0,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    };
  }

  /* ── Introspection ────────────────────────────────────────── */

  /**
   * Get server info and stats.
   */
  info(): {
    name: string;
    version: string;
    transport: string;
    tools: number;
    resources: number;
    resourceTemplates: number;
    running: boolean;
    initialized: boolean;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      transport: this.config.transport ?? 'stdio',
      tools: this.toolDefs.length,
      resources: this.resourceDefs.length,
      resourceTemplates: this.resourceTemplates.length,
      running: this._running,
      initialized: this._initialized,
    };
  }
}
