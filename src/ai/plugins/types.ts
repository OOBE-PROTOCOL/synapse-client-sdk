/**
 * @module ai/plugins/types
 * @description Plugin system types — chainable `.use()` architecture for modular AI tool composition.
 *
 * The plugin system allows developers to install only the tools they need:
 * ```ts
 * import { SynapseAgentKit } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
 * import { TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token';
 * import { DefiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi';
 *
 * const agent = new SynapseAgentKit({ rpcUrl, wallet })
 *   .use(TokenPlugin)
 *   .use(DefiPlugin);
 * ```
 *
 * Each plugin registers a set of `ProtocolMethod` schemas and an executor.
 * The `SynapseAgentKit` wires them into LangChain/Vercel AI/MCP tools automatically.
 *
 * @since 2.0.0
 */
import type { z } from 'zod';
import type { ProtocolMethod, ProtocolToolkit, ProtocolTool, CreateProtocolToolsOpts } from '../tools/protocols/shared';
import type { SynapseClientLike } from '../../core/client';

/* ═══════════════════════════════════════════════════════════════
 *  Plugin Definition
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Metadata about a plugin — displayed in tooling and MCP manifests.
 * @since 2.0.0
 */
export interface PluginMeta {
  /** Unique plugin identifier (e.g. 'token', 'nft', 'defi'). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of the plugin's capabilities. */
  description: string;
  /** Semantic version string. */
  version: string;
  /** Plugin author or org. */
  author?: string;
  /** Capability tags for SAP/MCP discovery. */
  tags?: string[];
  /** MCP resource URIs this plugin can serve. */
  mcpResources?: string[];
  /** Dependent plugin IDs (auto-loaded if available). */
  dependencies?: string[];
}

/**
 * @description A protocol within a plugin — groups methods under a namespace.
 *
 * Each plugin can contain multiple protocols (e.g. the DeFi plugin has
 * 'orca', 'meteora', 'drift', etc.).
 *
 * @since 2.0.0
 */
export interface PluginProtocol {
  /** Protocol identifier (e.g. 'orca', 'meteora', 'pump'). */
  id: string;
  /** Human-readable name (e.g. 'Orca Whirlpool'). */
  name: string;
  /** Registered methods for this protocol. */
  methods: readonly ProtocolMethod[];
  /** Default API base URL (for REST-based protocols). */
  baseUrl?: string;
  /** Whether this protocol requires the Synapse RPC client. */
  requiresClient?: boolean;
}

/**
 * @description Configuration passed to a plugin's `install()` function.
 * @since 2.0.0
 */
export interface PluginContext {
  /** The Synapse RPC client (for on-chain reads, transaction building). */
  client: SynapseClientLike;
  /** Wallet public key for signing/identity. */
  walletPubkey?: string;
  /** Per-protocol config overrides. */
  config?: Record<string, unknown>;
  /** Tool creation options (include/exclude, prefix, etc.). */
  toolOpts?: CreateProtocolToolsOpts;
}

/**
 * @description A plugin executor — called to run a method within the plugin.
 * @since 2.0.0
 */
export type PluginExecutor = (
  method: ProtocolMethod,
  input: Record<string, unknown>,
  context: PluginContext,
) => Promise<unknown>;

/**
 * @description The core plugin interface — implement this to create a plugin.
 *
 * Plugins are stateless factories: `install()` is called once, returns
 * an executor and the protocol methods. The agent kit wires them together.
 *
 * @example
 * ```ts
 * const MyPlugin: SynapsePlugin = {
 *   meta: { id: 'my-plugin', name: 'My Plugin', description: '...', version: '1.0.0' },
 *   protocols: [{ id: 'my-proto', name: 'My Protocol', methods: myMethods }],
 *   install(context) {
 *     return {
 *       executor: async (method, input) => { ... },
 *       teardown: async () => { ... },
 *     };
 *   },
 * };
 * ```
 *
 * @since 2.0.0
 */
export interface SynapsePlugin {
  /** Plugin metadata for discovery and documentation. */
  meta: PluginMeta;
  /** Protocols contained in this plugin. */
  protocols: readonly PluginProtocol[];
  /**
   * Install the plugin — called once when `.use(plugin)` is invoked.
   * Returns an executor function and optional teardown hook.
   */
  install(context: PluginContext): PluginInstallResult;
}

/**
 * @description Result of installing a plugin.
 * @since 2.0.0
 */
export interface PluginInstallResult {
  /** The method executor for all protocols in this plugin. */
  executor: PluginExecutor;
  /** Optional teardown hook (called on `.destroy()`). */
  teardown?: () => Promise<void>;
  /** Optional per-protocol HTTP clients (for direct access). */
  httpClients?: Record<string, { baseUrl: string; getHeaders: () => Record<string, string> }>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Installed Plugin — runtime state
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Runtime state of an installed plugin.
 * @since 2.0.0
 */
export interface InstalledPlugin {
  /** The original plugin definition. */
  plugin: SynapsePlugin;
  /** Toolkit per protocol (keyed by protocol ID). */
  toolkits: Record<string, ProtocolToolkit>;
  /** Flat array of all tools from this plugin. */
  tools: ProtocolTool[];
  /** Install result (executor, teardown). */
  installResult: PluginInstallResult;
}

/* ═══════════════════════════════════════════════════════════════
 *  Agent Kit Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for the SynapseAgentKit.
 * @since 2.0.0
 */
export interface AgentKitConfig {
  /** Solana RPC endpoint URL. */
  rpcUrl: string;
  /** API key for the RPC endpoint. */
  apiKey?: string;
  /** Wallet public key (base58). */
  walletPubkey?: string;
  /** Per-protocol config overrides (keyed by protocol ID). */
  protocolConfig?: Record<string, unknown>;
  /** Default tool creation options. */
  toolOpts?: CreateProtocolToolsOpts;
  /** Whether to enable MCP context output (default: false). */
  mcpEnabled?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
 *  MCP (Model Context Protocol) Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description MCP tool descriptor — compatible with MCP servers.
 * @since 2.0.0
 */
export interface McpToolDescriptor {
  /** Tool name (e.g. 'token_transfer'). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** JSON Schema for input parameters. */
  inputSchema: Record<string, unknown>;
  /** JSON Schema for output (optional). */
  outputSchema?: Record<string, unknown>;
  /** Protocol this tool belongs to. */
  protocol: string;
  /** Plugin this tool belongs to. */
  plugin: string;
}

/**
 * @description MCP resource descriptor.
 * @since 2.0.0
 */
export interface McpResourceDescriptor {
  /** Resource URI (e.g. 'solana://token/{mint}'). */
  uri: string;
  /** Human-readable name. */
  name: string;
  /** Description of the resource. */
  description: string;
  /** MIME type of the resource. */
  mimeType: string;
}
