/**
 * @module ai/mcp/types
 * @description MCP (Model Context Protocol) types — protocol-level interfaces.
 *
 * These types follow the MCP specification (2024-11-05) and are independent
 * of `@modelcontextprotocol/sdk` so the SDK has zero MCP runtime dependencies
 * unless the user opts in.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2024-11-05/
 * @since 2.0.0
 */

/* ═══════════════════════════════════════════════════════════════
 *  JSON-RPC 2.0 Base
 * ═══════════════════════════════════════════════════════════════ */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════
 *  MCP Initialization
 * ═══════════════════════════════════════════════════════════════ */

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, never>;
}

export interface McpInitializeParams {
  protocolVersion: string;
  capabilities?: McpCapabilities;
  clientInfo: McpServerInfo;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
  instructions?: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  MCP Tools
 * ═══════════════════════════════════════════════════════════════ */

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface McpToolsListResult {
  tools: McpToolDefinition[];
  nextCursor?: string;
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: { uri: string; mimeType?: string; text?: string };
}

export interface McpToolCallResult {
  content: McpContentItem[];
  isError?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
 *  MCP Resources
 * ═══════════════════════════════════════════════════════════════ */

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourcesListResult {
  resources: McpResourceDefinition[];
  nextCursor?: string;
}

export interface McpResourceReadParams {
  uri: string;
}

export interface McpResourceReadResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  MCP Prompts
 * ═══════════════════════════════════════════════════════════════ */

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: McpContentItem;
}

export interface McpGetPromptResult {
  description?: string;
  messages: McpPromptMessage[];
}

/* ═══════════════════════════════════════════════════════════════
 *  Transport Interfaces
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Abstract MCP transport — implement for stdio, SSE, WebSocket, etc.
 */
export interface McpTransport {
  /** Start listening for messages. */
  start(): Promise<void>;
  /** Stop and cleanup. */
  close(): Promise<void>;
  /** Send a JSON-RPC message. */
  send(message: JsonRpcResponse | JsonRpcNotification): Promise<void>;
  /** Register handler for incoming messages. */
  onMessage(handler: (message: JsonRpcRequest | JsonRpcNotification) => void): void;
  /** Register close handler. */
  onClose(handler: () => void): void;
  /** Register error handler. */
  onError(handler: (error: Error) => void): void;
}

/* ═══════════════════════════════════════════════════════════════
 *  Server Configuration
 * ═══════════════════════════════════════════════════════════════ */

export interface McpServerConfig {
  /** Server name (shown to MCP clients). */
  name?: string;
  /** Server version. */
  version?: string;
  /** Server instructions/description shown to the connecting LLM. */
  instructions?: string;
  /** Transport mode. Default: 'stdio'. */
  transport?: 'stdio' | 'sse';
  /** SSE port (only for 'sse' transport). Default: 3001. */
  ssePort?: number;
  /** SSE path prefix. Default: '/mcp'. */
  ssePath?: string;
  /** Enable request logging. Default: false. */
  debug?: boolean;
  /** Custom capabilities to advertise. */
  capabilities?: Partial<McpCapabilities>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Client / Bridge Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for connecting to an external MCP server.
 */
export interface McpExternalServerConfig {
  /** Unique identifier for this connection. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Transport type. */
  transport: 'stdio' | 'sse';
  /** Command to spawn (for stdio). */
  command?: string;
  /** Command arguments (for stdio). */
  args?: string[];
  /** Environment variables (for stdio). */
  env?: Record<string, string>;
  /** SSE endpoint URL (for sse transport). */
  url?: string;
  /** SSE auth headers. */
  headers?: Record<string, string>;
  /** Tool name prefix to avoid collisions (e.g. 'github_'). */
  toolPrefix?: string;
  /** Whether to auto-reconnect on disconnect. */
  reconnect?: boolean;
  /** Connection timeout in ms. */
  timeout?: number;
}

/**
 * @description Status of an external MCP server connection.
 */
export interface McpConnectionStatus {
  id: string;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  toolCount: number;
  resourceCount: number;
  serverInfo?: McpServerInfo;
  error?: string;
  connectedAt?: number;
}

export const MCP_PROTOCOL_VERSION = '2024-11-05';
export const MCP_JSONRPC_VERSION = '2.0' as const;
