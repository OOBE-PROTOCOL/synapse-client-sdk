/**
 * @module ai/mcp/client
 * @description MCP Client Bridge — connects to external MCP servers and imports
 * their tools into a SynapseAgentKit as a plugin.
 *
 * Supports stdio and SSE transports for connecting to any MCP server:
 * - GitHub MCP Server
 * - PostgreSQL MCP Server
 * - Filesystem MCP Server
 * - Any custom MCP server
 *
 * ## Usage
 *
 * ```ts
 * import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';
 *
 * const bridge = new McpClientBridge();
 *
 * // Connect to GitHub MCP server
 * await bridge.connect({
 *   id: 'github',
 *   name: 'GitHub',
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-github'],
 *   env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
 *   toolPrefix: 'github_',
 * });
 *
 * // Connect to Postgres MCP server
 * await bridge.connect({
 *   id: 'postgres',
 *   name: 'PostgreSQL',
 *   transport: 'stdio',
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!],
 *   toolPrefix: 'pg_',
 * });
 *
 * // Get all external tools as LangChain tools
 * const tools = bridge.getTools();
 *
 * // Or create a plugin to .use() on SynapseAgentKit
 * const plugin = bridge.toPlugin();
 * kit.use(plugin);
 * ```
 *
 * @since 2.0.0
 */
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createMethodRegistry, type ProtocolMethod } from '../tools/protocols/shared';
import type {
  McpExternalServerConfig,
  McpConnectionStatus,
  McpToolDefinition,
  McpResourceDefinition,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerInfo,
} from './types';
import { MCP_PROTOCOL_VERSION, MCP_JSONRPC_VERSION } from './types';
import type { SynapsePlugin, PluginContext, PluginProtocol } from '../plugins/types';

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

interface McpConnection {
  config: McpExternalServerConfig;
  status: McpConnectionStatus['status'];
  tools: McpToolDefinition[];
  resources: McpResourceDefinition[];
  serverInfo?: McpServerInfo;
  connectedAt?: number;
  error?: string;

  // stdio transport
  process?: any; // ChildProcess
  // SSE transport
  eventSource?: any;
  sseEndpoint?: string;
  sseSessionId?: string;

  // JSON-RPC state
  requestId: number;
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>;
  buffer: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  McpClientBridge
 * ═══════════════════════════════════════════════════════════════ */

export class McpClientBridge {
  private readonly connections = new Map<string, McpConnection>();
  private readonly debug: boolean;

  constructor(opts?: { debug?: boolean }) {
    this.debug = opts?.debug ?? false;
  }

  /* ── Connection Management ────────────────────────────────── */

  /**
   * Connect to an external MCP server.
   */
  async connect(config: McpExternalServerConfig): Promise<McpConnectionStatus> {
    if (this.connections.has(config.id)) {
      throw new Error(`MCP connection "${config.id}" already exists. Disconnect first.`);
    }

    const conn: McpConnection = {
      config,
      status: 'connecting',
      tools: [],
      resources: [],
      requestId: 0,
      pendingRequests: new Map(),
      buffer: '',
    };
    this.connections.set(config.id, conn);

    try {
      if (config.transport === 'stdio') {
        await this.connectStdio(conn);
      } else if (config.transport === 'sse') {
        await this.connectSse(conn);
      } else {
        throw new Error(`Unknown transport: ${config.transport}`);
      }

      // Initialize the MCP session
      const initResult = await this.sendRequest(conn, 'initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'synapse-mcp-bridge', version: '2.0.0' },
      });
      conn.serverInfo = (initResult as any)?.serverInfo;

      // Send initialized notification
      this.sendNotification(conn, 'notifications/initialized');

      // Fetch tools
      const toolsResult = await this.sendRequest(conn, 'tools/list', {});
      conn.tools = (toolsResult as any)?.tools ?? [];

      // Fetch resources
      try {
        const resourcesResult = await this.sendRequest(conn, 'resources/list', {});
        conn.resources = (resourcesResult as any)?.resources ?? [];
      } catch {
        // Resources are optional
        conn.resources = [];
      }

      conn.status = 'connected';
      conn.connectedAt = Date.now();

      if (this.debug) {
        process.stderr.write(
          `[McpBridge] Connected to "${config.name}" — ${conn.tools.length} tools, ${conn.resources.length} resources\n`,
        );
      }

      return this.getStatus(config.id)!;
    } catch (err) {
      conn.status = 'error';
      conn.error = String(err);

      if (this.debug) {
        process.stderr.write(`[McpBridge] Failed to connect to "${config.name}": ${err}\n`);
      }

      return this.getStatus(config.id)!;
    }
  }

  /**
   * Disconnect from an external MCP server.
   */
  async disconnect(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;

    // Reject pending requests
    for (const [, pending] of conn.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    conn.pendingRequests.clear();

    // Kill process
    if (conn.process) {
      try { conn.process.kill(); } catch { /* noop */ }
      conn.process = undefined;
    }

    // Close SSE
    if (conn.eventSource) {
      try { conn.eventSource.close(); } catch { /* noop */ }
      conn.eventSource = undefined;
    }

    conn.status = 'disconnected';
    this.connections.delete(id);
  }

  /**
   * Disconnect from all servers.
   */
  async disconnectAll(): Promise<void> {
    const ids = [...this.connections.keys()];
    await Promise.all(ids.map((id) => this.disconnect(id)));
  }

  /* ── Tool Access ──────────────────────────────────────────── */

  /**
   * Get LangChain-compatible tools from all connected servers.
   */
  getTools(): StructuredToolInterface[] {
    const tools: StructuredToolInterface[] = [];

    for (const [, conn] of this.connections) {
      if (conn.status !== 'connected') continue;
      tools.push(...this.buildLangChainTools(conn));
    }

    return tools;
  }

  /**
   * Get tools from a specific connected server.
   */
  getServerTools(serverId: string): StructuredToolInterface[] {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') return [];
    return this.buildLangChainTools(conn);
  }

  /**
   * Call a tool on a specific server.
   */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCP server "${serverId}" is not connected`);
    }

    const result = await this.sendRequest(conn, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    return result;
  }

  /**
   * Read a resource from a specific server.
   */
  async readResource(serverId: string, uri: string): Promise<unknown> {
    const conn = this.connections.get(serverId);
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCP server "${serverId}" is not connected`);
    }

    return this.sendRequest(conn, 'resources/read', { uri });
  }

  /* ── Plugin Conversion ────────────────────────────────────── */

  /**
   * Convert all connected MCP servers into a SynapsePlugin
   * that can be `.use()`'d on a SynapseAgentKit.
   *
   * ```ts
   * const plugin = bridge.toPlugin();
   * kit.use(plugin);
   * ```
   */
  toPlugin(): SynapsePlugin {
    const bridge = this;
    const protocols: PluginProtocol[] = [];

    for (const [id, conn] of this.connections) {
      if (conn.status !== 'connected') continue;

      const prefix = conn.config.toolPrefix ?? `${id}_`;
      const { methods } = createMethodRegistry(id);

      for (const mcpTool of conn.tools) {
        const inputSchema = jsonSchemaToZod(mcpTool.inputSchema);
        const outputSchema = z.object({ content: z.array(z.unknown()), isError: z.boolean().optional() });

        methods.push({
          name: mcpTool.name,
          description: mcpTool.description,
          input: inputSchema,
          output: outputSchema,
          protocol: id,
        });
      }

      protocols.push({
        id,
        name: conn.config.name,
        methods,
        requiresClient: false,
      });
    }

    return {
      meta: {
        id: 'mcp-bridge',
        name: 'MCP Bridge',
        description: `External MCP servers: ${[...this.connections.values()]
          .filter((c) => c.status === 'connected')
          .map((c) => c.config.name)
          .join(', ')}`,
        version: '2.0.0',
        tags: ['mcp', 'bridge', 'external'],
      },
      protocols,
      install(_context: PluginContext) {
        return {
          executor: async (method, input) => {
            const result = await bridge.callTool(method.protocol, method.name, input);
            return result;
          },
          teardown: async () => {
            await bridge.disconnectAll();
          },
        };
      },
    };
  }

  /* ── Introspection ────────────────────────────────────────── */

  /**
   * Get connection status for a specific server.
   */
  getStatus(id: string): McpConnectionStatus | undefined {
    const conn = this.connections.get(id);
    if (!conn) return undefined;

    return {
      id: conn.config.id,
      name: conn.config.name,
      status: conn.status,
      toolCount: conn.tools.length,
      resourceCount: conn.resources.length,
      serverInfo: conn.serverInfo,
      error: conn.error,
      connectedAt: conn.connectedAt,
    };
  }

  /**
   * Get all connection statuses.
   */
  getAllStatuses(): McpConnectionStatus[] {
    return [...this.connections.keys()]
      .map((id) => this.getStatus(id)!)
      .filter(Boolean);
  }

  /**
   * Get all tool definitions from all connected servers.
   */
  getAllToolDefinitions(): Array<McpToolDefinition & { serverId: string }> {
    const defs: Array<McpToolDefinition & { serverId: string }> = [];
    for (const [id, conn] of this.connections) {
      if (conn.status !== 'connected') continue;
      for (const t of conn.tools) {
        defs.push({ ...t, serverId: id });
      }
    }
    return defs;
  }

  /* ── stdio Transport Implementation ───────────────────────── */

  private async connectStdio(conn: McpConnection): Promise<void> {
    const { spawn } = await import('child_process');

    if (!conn.config.command) {
      throw new Error(`stdio transport requires a "command" in config`);
    }

    conn.process = spawn(conn.config.command, conn.config.args ?? [], {
      env: { ...process.env, ...conn.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Read stdout (MCP messages)
    conn.process.stdout.setEncoding('utf8');
    conn.process.stdout.on('data', (data: string) => {
      conn.buffer += data;
      this.processBuffer(conn);
    });

    // Read stderr (debug output)
    conn.process.stderr.setEncoding('utf8');
    conn.process.stderr.on('data', (data: string) => {
      if (this.debug) {
        process.stderr.write(`[McpBridge:${conn.config.id}:stderr] ${data}`);
      }
    });

    conn.process.on('exit', (code: number) => {
      if (this.debug) {
        process.stderr.write(`[McpBridge] "${conn.config.id}" exited with code ${code}\n`);
      }
      conn.status = 'disconnected';
      for (const [, pending] of conn.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Process exited with code ${code}`));
      }
      conn.pendingRequests.clear();
    });

    conn.process.on('error', (err: Error) => {
      conn.status = 'error';
      conn.error = err.message;
    });

    // Wait a bit for process to start
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (conn.process.exitCode !== null) {
      throw new Error(`MCP server process exited immediately with code ${conn.process.exitCode}`);
    }
  }

  /* ── SSE Transport Implementation ─────────────────────────── */

  private async connectSse(conn: McpConnection): Promise<void> {
    if (!conn.config.url) {
      throw new Error(`SSE transport requires a "url" in config`);
    }

    const sseUrl = conn.config.url;

    // Connect to SSE endpoint
    const response = await fetch(sseUrl, {
      headers: {
        Accept: 'text/event-stream',
        ...conn.config.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('SSE response has no body');
    }

    // Find the message endpoint from SSE events
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let endpointFound = false;

    // Read initial SSE events to get the endpoint
    const readInitial = async (): Promise<void> => {
      while (!endpointFound) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: endpoint')) {
            // Next data line has the endpoint
            continue;
          }
          if (line.startsWith('data: ') && !endpointFound) {
            const data = line.slice(6).trim();
            if (data.includes('/message')) {
              // Construct full URL
              const base = new URL(sseUrl);
              conn.sseEndpoint = data.startsWith('/')
                ? `${base.origin}${data}`
                : data;
              // Extract session ID
              const url = new URL(conn.sseEndpoint);
              conn.sseSessionId = url.searchParams.get('sessionId') ?? undefined;
              endpointFound = true;
            }
          }
        }
      }
    };

    // Timeout for initial connection
    await Promise.race([
      readInitial(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SSE endpoint timeout')), conn.config.timeout ?? 10_000),
      ),
    ]);

    if (!conn.sseEndpoint) {
      throw new Error('Failed to get SSE message endpoint');
    }

    // Continue reading SSE for responses (in background)
    this.readSseResponses(conn, reader, decoder);
  }

  private readSseResponses(conn: McpConnection, reader: ReadableStreamDefaultReader, decoder: TextDecoder): void {
    const read = async (): Promise<void> => {
      try {
        while (conn.status === 'connected' || conn.status === 'connecting') {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const msg = JSON.parse(data) as JsonRpcResponse;
                this.handleResponse(conn, msg);
              } catch {
                // Not JSON, ignore
              }
            }
          }
        }
      } catch (err) {
        if (conn.status === 'connected') {
          conn.status = 'error';
          conn.error = String(err);
        }
      }
    };
    read();
  }

  /* ── JSON-RPC Communication ───────────────────────────────── */

  private async sendRequest(conn: McpConnection, method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++conn.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: MCP_JSONRPC_VERSION,
      id,
      method,
      params,
    };

    const timeout = conn.config.timeout ?? 30_000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method} (${timeout}ms)`));
      }, timeout);

      conn.pendingRequests.set(id, { resolve, reject, timeout: timer });

      if (conn.config.transport === 'stdio' && conn.process?.stdin) {
        conn.process.stdin.write(JSON.stringify(request) + '\n');
      } else if (conn.config.transport === 'sse' && conn.sseEndpoint) {
        fetch(conn.sseEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...conn.config.headers,
          },
          body: JSON.stringify(request),
        }).catch((err) => {
          conn.pendingRequests.delete(id);
          clearTimeout(timer);
          reject(err);
        });
      } else {
        conn.pendingRequests.delete(id);
        clearTimeout(timer);
        reject(new Error('No transport available'));
      }
    });
  }

  private sendNotification(conn: McpConnection, method: string, params?: Record<string, unknown>): void {
    const notif = { jsonrpc: '2.0' as const, method, params };

    if (conn.config.transport === 'stdio' && conn.process?.stdin) {
      conn.process.stdin.write(JSON.stringify(notif) + '\n');
    } else if (conn.config.transport === 'sse' && conn.sseEndpoint) {
      fetch(conn.sseEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...conn.config.headers },
        body: JSON.stringify(notif),
      }).catch(() => { /* fire and forget */ });
    }
  }

  private processBuffer(conn: McpConnection): void {
    while (true) {
      const newlineIdx = conn.buffer.indexOf('\n');
      if (newlineIdx === -1) break;

      const line = conn.buffer.slice(0, newlineIdx).trim();
      conn.buffer = conn.buffer.slice(newlineIdx + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        this.handleResponse(conn, msg);
      } catch {
        if (this.debug) {
          process.stderr.write(`[McpBridge:${conn.config.id}] Invalid JSON: ${line.slice(0, 100)}\n`);
        }
      }
    }
  }

  private handleResponse(conn: McpConnection, msg: JsonRpcResponse): void {
    if (msg.id === undefined || msg.id === null) return;

    const pending = conn.pendingRequests.get(msg.id as number);
    if (!pending) return;

    conn.pendingRequests.delete(msg.id as number);
    clearTimeout(pending.timeout);

    if (msg.error) {
      pending.reject(new Error(`MCP error: ${msg.error.message} (${msg.error.code})`));
    } else {
      pending.resolve(msg.result);
    }
  }

  /* ── LangChain Tool Builder ───────────────────────────────── */

  private buildLangChainTools(conn: McpConnection): StructuredToolInterface[] {
    const prefix = conn.config.toolPrefix ?? '';
    const tools: StructuredToolInterface[] = [];

    for (const mcpTool of conn.tools) {
      const name = `${prefix}${mcpTool.name}`;
      const inputSchema = jsonSchemaToZod(mcpTool.inputSchema);

      const t = tool(
        async (input) => {
          const result = await this.callTool(conn.config.id, mcpTool.name, input as Record<string, unknown>);
          const content = (result as any)?.content;
          if (Array.isArray(content)) {
            return content
              .map((c: any) => c.text ?? JSON.stringify(c))
              .join('\n');
          }
          return JSON.stringify(result, null, 2);
        },
        {
          name,
          description: mcpTool.description ?? `External MCP tool: ${mcpTool.name}`,
          schema: inputSchema,
        },
      );

      tools.push(t as unknown as StructuredToolInterface);
    }

    return tools;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  JSON Schema → Zod (runtime conversion)
 *
 *  Converts MCP tool inputSchema (JSON Schema) to Zod schemas
 *  so they work with LangChain and the plugin system.
 * ═══════════════════════════════════════════════════════════════ */

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  if (!schema) return z.object({});

  const type = schema.type as string;

  switch (type) {
    case 'object': {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = new Set((schema.required ?? []) as string[]);
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, propSchema] of Object.entries(properties)) {
        let field = jsonSchemaToZod(propSchema);

        // Add description
        const desc = propSchema.description as string | undefined;
        if (desc) field = field.describe(desc);

        // Make optional if not required
        if (!required.has(key)) {
          field = field.optional() as any;
        }

        shape[key] = field;
      }

      return z.object(shape);
    }

    case 'string': {
      let s = z.string();
      if (schema.enum) return z.enum(schema.enum as [string, ...string[]]);
      if (schema.description) s = s.describe(schema.description as string);
      return s;
    }

    case 'number':
    case 'integer': {
      let n = z.number();
      if (type === 'integer') n = n.int() as typeof n;
      if (schema.minimum !== undefined) n = n.min(schema.minimum as number) as typeof n;
      if (schema.maximum !== undefined) n = n.max(schema.maximum as number) as typeof n;
      if (schema.description) n = n.describe(schema.description as string);
      return n;
    }

    case 'boolean': {
      let b = z.boolean();
      if (schema.description) b = b.describe(schema.description as string);
      return b;
    }

    case 'array': {
      const items = schema.items ? jsonSchemaToZod(schema.items as Record<string, unknown>) : z.unknown();
      let arr = z.array(items);
      if (schema.description) arr = arr.describe(schema.description as string);
      return arr;
    }

    default:
      return z.unknown();
  }
}
