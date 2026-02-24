/**
 * @module ai/tools/protocols
 * @description Protocol Tools — unified barrel export + super-factory.
 *
 * Import individual protocol toolkits:
 * ```ts
 * import { createJupiterTools } from '.../protocols/jupiter';
 * import { createRaydiumTools } from '.../protocols/raydium';
 * import { createMetaplexTools } from '.../protocols/metaplex';
 * ```
 *
 * Or use the unified super-factory:
 * ```ts
 * import { createProtocolTools } from '.../protocols';
 * const all = createProtocolTools(client, { jupiter: {}, raydium: {} });
 * ```
 *
 * @since 1.0.0
 */

// ── Shared infrastructure ──────────────────────────────────────
export {
  type ProtocolMethod,
  type ProtocolToolkit,
  type ProtocolTool,
  type ProtocolClientConfig,
  type CreateProtocolToolsOpts,
  ProtocolHttpClient,
  ProtocolApiError,
  createMethodRegistry,
  buildProtocolTools,
} from './shared';

// ── Jupiter ────────────────────────────────────────────────────
export {
  createJupiterTools,
  jupiterMethods,
  jupiterMethodNames,
  JUPITER_API_URL,
  type JupiterToolsConfig,
} from './jupiter';

// ── Raydium ────────────────────────────────────────────────────
export {
  createRaydiumTools,
  raydiumMethods,
  raydiumMethodNames,
  RAYDIUM_API_URL,
  type RaydiumToolsConfig,
} from './raydium';

// ── Metaplex ───────────────────────────────────────────────────
export {
  createMetaplexTools,
  metaplexMethods,
  metaplexMethodNames,
  type MetaplexToolsConfig,
} from './metaplex';

/* ═══════════════════════════════════════════════════════════════
 *  Super-factory — createProtocolTools()
 *
 *  Creates all protocol toolkits in one call, returning a
 *  unified object with per-protocol toolkits + a merged
 *  `allTools` array for agent consumption.
 * ═══════════════════════════════════════════════════════════════ */

import type { SynapseClient } from '../../../core/client';
import { createJupiterTools, type JupiterToolsConfig } from './jupiter';
import { createRaydiumTools, type RaydiumToolsConfig } from './raydium';
import { createMetaplexTools, type MetaplexToolsConfig } from './metaplex';
import type { ProtocolToolkit, ProtocolTool, CreateProtocolToolsOpts } from './shared';

/**
 * @description Configuration for the unified protocol tools super-factory.
 * Pass `false` for any protocol to skip it entirely.
 * @since 1.0.0
 */
export interface CreateProtocolToolsConfig {
  /** Jupiter config — pass `false` to skip Jupiter tools entirely. */
  jupiter?: JupiterToolsConfig & CreateProtocolToolsOpts | false;
  /** Raydium config — pass `false` to skip Raydium tools entirely. */
  raydium?: RaydiumToolsConfig & CreateProtocolToolsOpts | false;
  /** Metaplex config — pass `false` to skip Metaplex tools entirely. */
  metaplex?: MetaplexToolsConfig | false;
}

/**
 * @description Result of the unified protocol tools super-factory.
 * Contains per-protocol toolkits and a merged `allTools` array.
 * @since 1.0.0
 */
export interface AllProtocolToolkits {
  /** Jupiter toolkit (undefined if disabled). */
  jupiter?: ProtocolToolkit;
  /** Raydium toolkit (undefined if disabled). */
  raydium?: ProtocolToolkit;
  /** Metaplex toolkit (undefined if disabled). */
  metaplex?: ProtocolToolkit;
  /** Flat array of ALL tools across all enabled protocols — pass directly to an agent. */
  allTools: ProtocolTool[];
  /** Total number of tools. */
  totalToolCount: number;
  /** Map of protocol name → method count. */
  protocolSummary: Record<string, number>;
}

/**
 * @description Create tools for all Solana native protocols in a single call.
 *
 * @param {SynapseClient} client - Initialised SynapseClient (needed for Metaplex DAS)
 * @param {CreateProtocolToolsConfig} [config={}] - Per-protocol configuration
 * @returns {AllProtocolToolkits} Object with per-protocol toolkits and merged allTools array
 *
 * @example
 * ```ts
 * const client = new SynapseClient({ endpoint: '...' });
 * const { allTools, jupiter, raydium, metaplex } = createProtocolTools(client, {
 *   jupiter: { apiKey: 'my-jup-key' },
 *   raydium: {},
 *   metaplex: {},
 * });
 *
 * // Pass everything to an agent:
 * const agent = createAgent({ tools: allTools });
 *
 * // Or cherry-pick:
 * const quoteTool = jupiter!.toolMap.getQuote;
 * ```
 *
 * @since 1.0.0
 */
export function createProtocolTools(
  client: SynapseClient,
  config: CreateProtocolToolsConfig = {},
): AllProtocolToolkits {
  const allTools: ProtocolTool[] = [];
  const protocolSummary: Record<string, number> = {};

  let jupiter: ProtocolToolkit | undefined;
  let raydium: ProtocolToolkit | undefined;
  let metaplex: ProtocolToolkit | undefined;

  // Jupiter
  if (config.jupiter !== false) {
    jupiter = createJupiterTools(config.jupiter ?? {});
    allTools.push(...jupiter.tools);
    protocolSummary.jupiter = jupiter.tools.length;
  }

  // Raydium
  if (config.raydium !== false) {
    raydium = createRaydiumTools(config.raydium ?? {});
    allTools.push(...raydium.tools);
    protocolSummary.raydium = raydium.tools.length;
  }

  // Metaplex
  if (config.metaplex !== false) {
    metaplex = createMetaplexTools(client, config.metaplex ?? {});
    allTools.push(...metaplex.tools);
    protocolSummary.metaplex = metaplex.tools.length;
  }

  return {
    jupiter,
    raydium,
    metaplex,
    allTools,
    totalToolCount: allTools.length,
    protocolSummary,
  };
}
