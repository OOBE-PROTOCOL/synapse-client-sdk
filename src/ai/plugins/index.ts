/**
 * @module ai/plugins
 * @description Plugin system barrel — exports the SynapseAgentKit, all plugins, and types.
 *
 * ```ts
 * import {
 *   SynapseAgentKit,
 *   TokenPlugin, NFTPlugin, DeFiPlugin, MiscPlugin, BlinksPlugin,
 * } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(TokenPlugin)
 *   .use(NFTPlugin)
 *   .use(DeFiPlugin)
 *   .use(MiscPlugin)
 *   .use(BlinksPlugin);
 *
 * const tools = kit.getTools(); // 110+ LangChain tools
 * ```
 *
 * @since 2.0.0
 */

// ── Registry ──────────────────────────────────────────────────
export { SynapseAgentKit } from './registry';

// ── Plugins ───────────────────────────────────────────────────
export { TokenPlugin } from './token';
export { NFTPlugin } from './nft';
export { DeFiPlugin } from './defi';
export { MiscPlugin } from './misc';
export { BlinksPlugin } from './blinks';

// ── Types ─────────────────────────────────────────────────────
export type {
  SynapsePlugin,
  PluginMeta,
  PluginProtocol,
  PluginContext,
  PluginExecutor,
  PluginInstallResult,
  InstalledPlugin,
  AgentKitConfig,
  McpToolDescriptor,
  McpResourceDescriptor,
} from './types';
