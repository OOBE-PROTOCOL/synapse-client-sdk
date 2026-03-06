/**
 * @module ai/mcp
 * @description MCP (Model Context Protocol) for Synapse SDK.
 *
 * Provides both **server** and **client** capabilities:
 *
 * - **Server**: Expose SynapseAgentKit tools as an MCP server (stdio/SSE)
 * - **Client**: Connect to external MCP servers and import their tools
 * - **Plugin**: `.use(McpPlugin)` to integrate external MCP tools
 *
 * @since 2.0.0
 */

// ── Server ──────────────────────────────────────────────────────
export { SynapseMcpServer, McpServerError } from './server';

// ── Client Bridge ───────────────────────────────────────────────
export { McpClientBridge } from './client';

// ── Types ───────────────────────────────────────────────────────
export {
  MCP_PROTOCOL_VERSION,
  MCP_JSONRPC_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type McpToolDefinition,
  type McpToolCallParams,
  type McpToolCallResult,
  type McpResourceDefinition,
  type McpResourceTemplate,
  type McpPromptDefinition,
  type McpPromptMessage,
  type McpServerInfo,
  type McpCapabilities,
  type McpTransport,
  type McpServerConfig,
  type McpExternalServerConfig,
  type McpConnectionStatus,
} from './types';
