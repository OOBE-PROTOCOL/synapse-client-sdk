/**
 * @module ai/plugins/registry
 * @description Plugin Registry — the `.use()` chainable infrastructure.
 *
 * SynapseAgentKit is the main entry point. Install plugins via `.use()`,
 * then extract tools for LangChain, Vercel AI SDK, or MCP servers.
 *
 * ```ts
 * const kit = new SynapseAgentKit({ rpcUrl: '...', walletPubkey: '...' })
 *   .use(TokenPlugin)
 *   .use(NFTPlugin)
 *   .use(DefiPlugin);
 *
 * // LangChain
 * const tools = kit.getTools();
 *
 * // Vercel AI SDK
 * const vercelTools = kit.getVercelAITools();
 *
 * // MCP descriptors
 * const mcpTools = kit.getMcpToolDescriptors();
 * ```
 *
 * @since 2.0.0
 */
import { buildProtocolTools, type ProtocolToolkit, type ProtocolTool, type ProtocolMethod } from '../tools/protocols/shared';
import type {
  SynapsePlugin,
  InstalledPlugin,
  PluginContext,
  AgentKitConfig,
  McpToolDescriptor,
  McpResourceDescriptor,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  SynapseAgentKit
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description The agent kit — chainable plugin host that produces tools for any framework.
 *
 * @example
 * ```ts
 * import { SynapseAgentKit } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
 * import { TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token';
 * import { DefiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
 *   .use(TokenPlugin)
 *   .use(DefiPlugin);
 *
 * // 53 RPC tools + Token tools + DeFi tools
 * const tools = kit.getTools();
 * ```
 *
 * @since 2.0.0
 */
export class SynapseAgentKit {
  /** Installed plugins keyed by plugin ID. */
  private readonly _plugins = new Map<string, InstalledPlugin>();
  /** Plugin installation order. */
  private readonly _pluginOrder: string[] = [];
  /** Kit configuration. */
  private readonly _config: AgentKitConfig;
  /** Shared plugin context. */
  private readonly _context: PluginContext;

  constructor(config: AgentKitConfig) {
    this._config = config;

    // Create a lightweight client-like object for plugins
    // Plugins that need the full SynapseClient can import and create one
    this._context = {
      client: {
        transport: {
          endpoint: config.rpcUrl,
          apiKey: config.apiKey,
          request: async (method: string, params?: unknown[]) => {
            const res = await fetch(config.rpcUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
              },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }),
            });
            const json = await res.json() as Record<string, unknown>;
            if (json.error) throw new Error(JSON.stringify(json.error));
            return json.result;
          },
        },
        getTransport() { return this.transport; },
      } as any,
      walletPubkey: config.walletPubkey,
      config: config.protocolConfig ?? {},
      toolOpts: config.toolOpts ?? {},
    };
  }

  /* ── Plugin installation ──────────────────────────────────── */

  /**
   * @description Install a plugin. Returns `this` for chaining.
   *
   * @param {SynapsePlugin} plugin - Plugin to install
   * @param {Record<string, unknown>} [config] - Plugin-specific config overrides
   * @returns {this} The agent kit (for chaining)
   *
   * @example
   * ```ts
   * kit.use(TokenPlugin).use(NFTPlugin);
   * ```
   *
   * @since 2.0.0
   */
  use(plugin: SynapsePlugin, config?: Record<string, unknown>): this {
    if (this._plugins.has(plugin.meta.id)) {
      throw new Error(`Plugin "${plugin.meta.id}" is already installed`);
    }

    // Check dependencies
    if (plugin.meta.dependencies) {
      for (const dep of plugin.meta.dependencies) {
        if (!this._plugins.has(dep)) {
          throw new Error(
            `Plugin "${plugin.meta.id}" requires "${dep}" — install it first with .use()`,
          );
        }
      }
    }

    // Install the plugin
    const context: PluginContext = {
      ...this._context,
      config: { ...this._context.config, ...config },
    };

    const installResult = plugin.install(context);
    const toolkits: Record<string, ProtocolToolkit> = {};
    const allTools: ProtocolTool[] = [];

    // Build toolkits per protocol
    for (const protocol of plugin.protocols) {
      const toolkit = buildProtocolTools(
        protocol.methods,
        async (method, input) => installResult.executor(method, input, context),
        {
          defaultPrefix: `${protocol.id}_`,
          ...this._config.toolOpts,
        },
      );
      toolkits[protocol.id] = toolkit;
      allTools.push(...toolkit.tools);
    }

    const installed: InstalledPlugin = {
      plugin,
      toolkits,
      tools: allTools,
      installResult,
    };

    this._plugins.set(plugin.meta.id, installed);
    this._pluginOrder.push(plugin.meta.id);

    return this;
  }

  /* ── Tool extraction ──────────────────────────────────────── */

  /**
   * @description Get all LangChain-compatible tools from installed plugins.
   * @returns {ProtocolTool[]} Flat array of all tools
   * @since 2.0.0
   */
  getTools(): ProtocolTool[] {
    const tools: ProtocolTool[] = [];
    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      tools.push(...installed.tools);
    }
    return tools;
  }

  /**
   * @description Get tools keyed by name for cherry-picking.
   * @returns {Record<string, ProtocolTool>} Map of tool name → tool
   * @since 2.0.0
   */
  getToolMap(): Record<string, ProtocolTool> {
    const map: Record<string, ProtocolTool> = {};
    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      for (const [protoId, toolkit] of Object.entries(installed.toolkits)) {
        Object.assign(map, toolkit.toolMap);
      }
    }
    return map;
  }

  /**
   * @description Get tools for a specific plugin by ID.
   * @param {string} pluginId - Plugin identifier (e.g. 'token', 'defi')
   * @returns {ProtocolTool[] | undefined} Tools for that plugin, or undefined if not installed
   * @since 2.0.0
   */
  getPluginTools(pluginId: string): ProtocolTool[] | undefined {
    return this._plugins.get(pluginId)?.tools;
  }

  /**
   * @description Get a specific protocol toolkit from within a plugin.
   * @param {string} pluginId - Plugin identifier
   * @param {string} protocolId - Protocol identifier within the plugin
   * @returns {ProtocolToolkit | undefined}
   * @since 2.0.0
   */
  getProtocolToolkit(pluginId: string, protocolId: string): ProtocolToolkit | undefined {
    return this._plugins.get(pluginId)?.toolkits[protocolId];
  }

  /* ── MCP support ──────────────────────────────────────────── */

  /**
   * @description Get MCP tool descriptors for all installed plugins.
   * @returns {McpToolDescriptor[]} MCP-compatible tool descriptors
   * @since 2.0.0
   */
  getMcpToolDescriptors(): McpToolDescriptor[] {
    const descriptors: McpToolDescriptor[] = [];

    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      for (const protocol of installed.plugin.protocols) {
        for (const method of protocol.methods) {
          descriptors.push({
            name: `${protocol.id}_${method.name}`,
            description: method.description ?? `${protocol.id}: ${method.name}`,
            inputSchema: zodToJsonSchema(method.input),
            outputSchema: zodToJsonSchema(method.output),
            protocol: protocol.id,
            plugin: id,
          });
        }
      }
    }

    return descriptors;
  }

  /**
   * @description Get MCP resource descriptors for all installed plugins.
   * @returns {McpResourceDescriptor[]} MCP-compatible resource descriptors
   * @since 2.0.0
   */
  getMcpResourceDescriptors(): McpResourceDescriptor[] {
    const descriptors: McpResourceDescriptor[] = [];

    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      const resources = installed.plugin.meta.mcpResources ?? [];

      for (const uri of resources) {
        descriptors.push({
          uri,
          name: uri.split('/').pop() ?? uri,
          description: `Resource from ${installed.plugin.meta.name}`,
          mimeType: 'application/json',
        });
      }
    }

    return descriptors;
  }

  /* ── Vercel AI SDK support ────────────────────────────────── */

  /**
   * @description Get tools formatted for the Vercel AI SDK.
   * Returns a record of `{ toolName: { description, parameters, execute } }`.
   *
   * @returns {Record<string, { description: string; parameters: unknown; execute: Function }>}
   * @since 2.0.0
   */
  getVercelAITools(): Record<string, { description: string; parameters: unknown; execute: (input: Record<string, unknown>) => Promise<string> }> {
    const vercelTools: Record<string, { description: string; parameters: unknown; execute: (input: Record<string, unknown>) => Promise<string> }> = {};

    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      for (const protocol of installed.plugin.protocols) {
        for (const method of protocol.methods) {
          const toolName = `${protocol.id}_${method.name}`;
          vercelTools[toolName] = {
            description: method.description ?? `${protocol.id}: ${method.name}`,
            parameters: method.input,
            execute: async (input: Record<string, unknown>) => {
              const result = await installed.installResult.executor(method, input, this._context);
              return JSON.stringify(result, null, 2);
            },
          };
        }
      }
    }

    return vercelTools;
  }

  /* ── Introspection ────────────────────────────────────────── */

  /**
   * @description Get a summary of all installed plugins.
   * @returns {{ plugins: PluginMeta[]; totalTools: number; protocols: string[] }}
   * @since 2.0.0
   */
  summary(): { plugins: { id: string; name: string; toolCount: number; protocols: string[] }[]; totalTools: number; totalProtocols: number } {
    const plugins = this._pluginOrder.map((id) => {
      const installed = this._plugins.get(id)!;
      return {
        id: installed.plugin.meta.id,
        name: installed.plugin.meta.name,
        toolCount: installed.tools.length,
        protocols: installed.plugin.protocols.map((p) => p.id),
      };
    });

    return {
      plugins,
      totalTools: plugins.reduce((sum, p) => sum + p.toolCount, 0),
      totalProtocols: plugins.reduce((sum, p) => sum + p.protocols.length, 0),
    };
  }

  /**
   * @description Check if a plugin is installed.
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean}
   * @since 2.0.0
   */
  hasPlugin(pluginId: string): boolean {
    return this._plugins.has(pluginId);
  }

  /**
   * @description List all installed plugin IDs in installation order.
   * @returns {string[]}
   * @since 2.0.0
   */
  getInstalledPlugins(): string[] {
    return [...this._pluginOrder];
  }

  /* ── Lifecycle ────────────────────────────────────────────── */

  /**
   * @description Destroy the agent kit and call teardown on all plugins.
   * @since 2.0.0
   */
  async destroy(): Promise<void> {
    for (const id of this._pluginOrder) {
      const installed = this._plugins.get(id)!;
      await installed.installResult.teardown?.();
    }
    this._plugins.clear();
    this._pluginOrder.length = 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Minimal Zod → JSON Schema conversion for MCP compatibility.
 * Uses zod's `.describe()` and shape introspection.
 */
function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Use zod-to-json-schema if available, otherwise basic fallback
  try {
    const z = schema as any;
    if (z?._def?.typeName === 'ZodObject') {
      const shape = z.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        const v = val as any;
        properties[key] = {
          type: inferZodType(v),
          description: v?.description ?? v?._def?.description ?? undefined,
        };
        if (!v?.isOptional?.()) {
          required.push(key);
        }
      }
      return { type: 'object', properties, required };
    }
  } catch {
    // fallback
  }
  return { type: 'object' };
}

function inferZodType(z: any): string {
  const typeName = z?._def?.typeName;
  switch (typeName) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodArray': return 'array';
    case 'ZodObject': return 'object';
    case 'ZodEnum': return 'string';
    case 'ZodOptional': return inferZodType(z._def.innerType);
    case 'ZodDefault': return inferZodType(z._def.innerType);
    default: return 'string';
  }
}
