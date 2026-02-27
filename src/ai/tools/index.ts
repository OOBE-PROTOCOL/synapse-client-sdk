/**
 * @module ai/tools
 * @description Synapse AI Tools — LangChain-compatible tools for every Solana RPC method.
 *
 * Usage:
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { createSolanaTools, solanaToolNames } from '@oobe-protocol-labs/synapse-client-sdk/ai/tools';
 *
 * const client = new SynapseClient({ endpoint: 'https://...' });
 * const { tools, toolMap } = createSolanaTools(client);
 *
 * // Pass all tools to an agent:
 * const agent = createDeepAgent({ tools, ... });
 *
 * // Or pick individual tools:
 * const balanceTool = toolMap.getBalance;
 * ```
 *
 * @since 1.0.0
 */
import { tool, type DynamicStructuredTool } from '@langchain/core/tools';
import type { SynapseClient } from '../../core/client';
import type { HttpTransport } from '../../core/transport';
import { agentRpcMethods, type AgentRpcMethod } from './zod';

// Re-export for convenience
export { agentRpcMethods, type AgentRpcMethod } from './zod';

// ── Protocol tools (Jupiter, Raydium, Metaplex + On-Chain) ────
export {
  // Factories
  createJupiterTools,
  createRaydiumTools,
  createMetaplexTools,
  createJupiterOnchainTools,
  createRaydiumOnchainTools,
  createProtocolTools,
  // Schemas
  jupiterMethods,
  jupiterMethodNames,
  raydiumMethods,
  raydiumMethodNames,
  metaplexMethods,
  metaplexMethodNames,
  jupiterOnchainMethods,
  jupiterOnchainMethodNames,
  raydiumOnchainMethods,
  raydiumOnchainMethodNames,
  // Shared infrastructure
  ProtocolHttpClient,
  ProtocolApiError,
  buildProtocolTools,
  createMethodRegistry,
  // Constants
  JUPITER_API_URL,
  JUPITER_TOKENS_API_URL,
  RAYDIUM_API_URL,
  JUPITER_PROGRAM_IDS,
  RAYDIUM_PROGRAM_IDS,
  // Types
  type ProtocolMethod,
  type ProtocolToolkit,
  type ProtocolTool,
  type ProtocolClientConfig,
  type CreateProtocolToolsOpts,
  type JupiterToolsConfig,
  type RaydiumToolsConfig,
  type MetaplexToolsConfig,
  type JupiterOnchainToolsConfig,
  type RaydiumOnchainToolsConfig,
  type CreateProtocolToolsConfig,
  type AllProtocolToolkits,
} from './protocols';

/* ═══════════════════════════════════════════════════════════════
 *  Method name → standalone function dispatcher
 *
 *  Maps each RPC method name to its actual implementation so the
 *  tool executor can call the right function dynamically.
 * ═══════════════════════════════════════════════════════════════ */

import * as methods from '../../rpc/methods/index';

/**
 * Mapping from JSON-RPC method name → { fn, argMapper }.
 * `argMapper` extracts positional args from the flat Zod input object
 * in the order expected by the standalone function.
 */
interface MethodBinding {
  // eslint-disable-next-line @typescript-eslint/ban-types
  fn: Function;
  /** Converts validated Zod input → positional args (excluding transport). */
  argsFrom: (input: Record<string, unknown>, t: HttpTransport) => unknown[];
}

const bindings: Record<string, MethodBinding> = {
  // ── Account ─────────────────────────────────────────────────
  getAccountInfo: {
    fn: methods.getAccountInfo,
    argsFrom: (i, t) => [t, i.pubkey, { encoding: i.encoding, dataSlice: i.dataSlice, commitment: i.commitment, minContextSlot: i.minContextSlot }],
  },
  getBalance: {
    fn: methods.getBalance,
    argsFrom: (i, t) => [t, i.pubkey, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getMultipleAccounts: {
    fn: methods.getMultipleAccounts,
    argsFrom: (i, t) => [t, i.pubkeys, { encoding: i.encoding, dataSlice: i.dataSlice, commitment: i.commitment, minContextSlot: i.minContextSlot }],
  },
  getProgramAccounts: {
    fn: methods.getProgramAccounts,
    argsFrom: (i, t) => [t, i.programId, { encoding: i.encoding, dataSlice: i.dataSlice, commitment: i.commitment, minContextSlot: i.minContextSlot, withContext: i.withContext, filters: i.filters }],
  },
  getLargestAccounts: {
    fn: methods.getLargestAccounts,
    argsFrom: (i, t) => [t, { commitment: i.commitment, filter: i.filter }],
  },

  // ── Block ───────────────────────────────────────────────────
  getBlock: {
    fn: methods.getBlock,
    argsFrom: (i, t) => [t, i.slot, { encoding: i.encoding, commitment: i.commitment, transactionDetails: i.transactionDetails, rewards: i.rewards, maxSupportedTransactionVersion: i.maxSupportedTransactionVersion }],
  },
  getBlockHeight: {
    fn: methods.getBlockHeight,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getBlockTime: {
    fn: methods.getBlockTime,
    argsFrom: (i, t) => [t, i.slot],
  },
  getBlockProduction: {
    fn: methods.getBlockProduction,
    argsFrom: (i, t) => [t, { commitment: i.commitment, range: i.range, identity: i.identity }],
  },
  getBlocks: {
    fn: methods.getBlocks,
    argsFrom: (i, t) => [t, i.startSlot, i.endSlot, i.commitment],
  },
  getBlocksWithLimit: {
    fn: methods.getBlocksWithLimit,
    argsFrom: (i, t) => [t, i.startSlot, i.limit, i.commitment],
  },
  getBlockCommitment: {
    fn: methods.getBlockCommitment,
    argsFrom: (i, t) => [t, i.slot],
  },
  getFirstAvailableBlock: {
    fn: methods.getFirstAvailableBlock,
    argsFrom: (_i, t) => [t],
  },

  // ── Transaction ─────────────────────────────────────────────
  getTransaction: {
    fn: methods.getTransaction,
    argsFrom: (i, t) => [t, i.signature, { encoding: i.encoding, commitment: i.commitment, maxSupportedTransactionVersion: i.maxSupportedTransactionVersion }],
  },
  getSignaturesForAddress: {
    fn: methods.getSignaturesForAddress,
    argsFrom: (i, t) => [t, i.address, { limit: i.limit, before: i.before, until: i.until, commitment: i.commitment, minContextSlot: i.minContextSlot }],
  },
  getSignatureStatuses: {
    fn: methods.getSignatureStatuses,
    argsFrom: (i, t) => [t, i.signatures, { searchTransactionHistory: i.searchTransactionHistory }],
  },
  getTransactionCount: {
    fn: methods.getTransactionCount,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getFeeForMessage: {
    fn: methods.getFeeForMessage,
    argsFrom: (i, t) => [t, i.message, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getRecentPrioritizationFees: {
    fn: methods.getRecentPrioritizationFees,
    argsFrom: (i, t) => [t, i.addresses],
  },

  // ── Blockhash ───────────────────────────────────────────────
  getLatestBlockhash: {
    fn: methods.getLatestBlockhash,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  isBlockhashValid: {
    fn: methods.isBlockhashValid,
    argsFrom: (i, t) => [t, i.blockhash, i.commitment, { minContextSlot: i.minContextSlot }],
  },

  // ── Submission ──────────────────────────────────────────────
  sendTransaction: {
    fn: methods.sendTransaction,
    argsFrom: (i, t) => [t, i.signedTx, { encoding: i.encoding, skipPreflight: i.skipPreflight, preflightCommitment: i.preflightCommitment, maxRetries: i.maxRetries, minContextSlot: i.minContextSlot }],
  },
  simulateTransaction: {
    fn: methods.simulateTransaction,
    argsFrom: (i, t) => [t, i.tx, { encoding: i.encoding, commitment: i.commitment, sigVerify: i.sigVerify, replaceRecentBlockhash: i.replaceRecentBlockhash, accounts: i.accounts, minContextSlot: i.minContextSlot, innerInstructions: i.innerInstructions }],
  },
  requestAirdrop: {
    fn: methods.requestAirdrop,
    argsFrom: (i, t) => [t, i.pubkey, i.lamports, i.commitment],
  },

  // ── Slot / Epoch ────────────────────────────────────────────
  getSlot: {
    fn: methods.getSlot,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getSlotLeader: {
    fn: methods.getSlotLeader,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getSlotLeaders: {
    fn: methods.getSlotLeaders,
    argsFrom: (i, t) => [t, i.startSlot, i.limit],
  },
  getEpochInfo: {
    fn: methods.getEpochInfo,
    argsFrom: (i, t) => [t, i.commitment, { minContextSlot: i.minContextSlot }],
  },
  getEpochSchedule: {
    fn: methods.getEpochSchedule,
    argsFrom: (_i, t) => [t],
  },

  // ── Inflation ───────────────────────────────────────────────
  getInflationRate: {
    fn: methods.getInflationRate,
    argsFrom: (_i, t) => [t],
  },
  getInflationGovernor: {
    fn: methods.getInflationGovernor,
    argsFrom: (i, t) => [t, i.commitment],
  },
  getInflationReward: {
    fn: methods.getInflationReward,
    argsFrom: (i, t) => [t, i.addresses, { epoch: i.epoch, commitment: i.commitment, minContextSlot: i.minContextSlot }],
  },

  // ── Cluster / Network ──────────────────────────────────────
  getVoteAccounts: {
    fn: methods.getVoteAccounts,
    argsFrom: (i, t) => [t, { commitment: i.commitment, votePubkey: i.votePubkey, keepUnstakedDelinquents: i.keepUnstakedDelinquents, delinquentSlotDistance: i.delinquentSlotDistance }],
  },
  getClusterNodes: {
    fn: methods.getClusterNodes,
    argsFrom: (_i, t) => [t],
  },
  getSupply: {
    fn: methods.getSupply,
    argsFrom: (i, t) => [t, { commitment: i.commitment, excludeNonCirculatingAccountsList: i.excludeNonCirculatingAccountsList }],
  },
  getRecentPerformanceSamples: {
    fn: methods.getRecentPerformanceSamples,
    argsFrom: (i, t) => [t, i.limit],
  },
  getHealth: {
    fn: methods.getHealth,
    argsFrom: (_i, t) => [t],
  },
  getVersion: {
    fn: methods.getVersion,
    argsFrom: (_i, t) => [t],
  },
  getGenesisHash: {
    fn: methods.getGenesisHash,
    argsFrom: (_i, t) => [t],
  },
  getIdentity: {
    fn: methods.getIdentity,
    argsFrom: (_i, t) => [t],
  },
  getLeaderSchedule: {
    fn: methods.getLeaderSchedule,
    argsFrom: (i, t) => [t, i.slot, { commitment: i.commitment, identity: i.identity }],
  },
  getHighestSnapshotSlot: {
    fn: methods.getHighestSnapshotSlot,
    argsFrom: (_i, t) => [t],
  },

  // ── Rent / Ledger ──────────────────────────────────────────
  getMinimumBalanceForRentExemption: {
    fn: methods.getMinimumBalanceForRentExemption,
    argsFrom: (i, t) => [t, i.dataLength, i.commitment],
  },
  minimumLedgerSlot: {
    fn: methods.minimumLedgerSlot,
    argsFrom: (_i, t) => [t],
  },
  getMaxRetransmitSlot: {
    fn: methods.getMaxRetransmitSlot,
    argsFrom: (_i, t) => [t],
  },
  getMaxShredInsertSlot: {
    fn: methods.getMaxShredInsertSlot,
    argsFrom: (_i, t) => [t],
  },

  // ── Staking ─────────────────────────────────────────────────
  getStakeMinimumDelegation: {
    fn: methods.getStakeMinimumDelegation,
    argsFrom: (i, t) => [t, i.commitment],
  },
  getStakeActivation: {
    fn: methods.getStakeActivation,
    argsFrom: (i, t) => [t, i.stakeAccount, { commitment: i.commitment, epoch: i.epoch, minContextSlot: i.minContextSlot }],
  },

  // ── Token (SPL) ─────────────────────────────────────────────
  getTokenAccountBalance: {
    fn: methods.getTokenAccountBalance,
    argsFrom: (i, t) => [t, i.tokenAccount, i.commitment],
  },
  getTokenAccountsByOwner: {
    fn: methods.getTokenAccountsByOwner,
    argsFrom: (i, t) => [t, i.owner, i.filter, { commitment: i.commitment, minContextSlot: i.minContextSlot, dataSlice: i.dataSlice }],
  },
  getTokenAccountsByDelegate: {
    fn: methods.getTokenAccountsByDelegate,
    argsFrom: (i, t) => [t, i.delegate, i.filter, { commitment: i.commitment, minContextSlot: i.minContextSlot, dataSlice: i.dataSlice }],
  },
  getTokenLargestAccounts: {
    fn: methods.getTokenLargestAccounts,
    argsFrom: (i, t) => [t, i.mint, i.commitment],
  },
  getTokenSupply: {
    fn: methods.getTokenSupply,
    argsFrom: (i, t) => [t, i.mint, i.commitment],
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Constant list of all Solana RPC tool names.
 *  Useful for filtering, logging, allow-lists, etc.
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Constant array of all Solana RPC tool names (prefixed with 'solana_').
 * Useful for filtering, logging, allow-lists, etc.
 * @since 1.0.0
 */
export const solanaToolNames = agentRpcMethods.map(m => `solana_${m.name}`) as readonly string[];

/* ═══════════════════════════════════════════════════════════════
 *  Tool types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A single LangChain-compatible tool created from a Solana RPC method.
 * @since 1.0.0
 */
export type SolanaTool = ReturnType<typeof tool>;

/**
 * @description A record keyed by camelCase method name → LangChain tool.
 * @since 1.0.0
 */
export type SolanaToolMap = Record<string, SolanaTool>;

/**
 * @description Toolkit object returned by {@link createExecutableSolanaTools}.
 * Contains a flat tool array and a keyed map for cherry-picking.
 * @since 1.0.0
 */
export interface SolanaToolkit {
  /** Flat array of all tools — pass directly to an agent's `tools` param. */
  tools: SolanaTool[];
  /**
   * Keyed map for cherry-picking individual tools:
   * ```ts
   * const { toolMap } = createSolanaTools(client);
   * toolMap.getBalance // ← DynamicStructuredTool
   * ```
   */
  toolMap: SolanaToolMap;
}

/* ═══════════════════════════════════════════════════════════════
 *  createSolanaTools()
 *
 *  Factory that hydrates every registered Zod schema into a
 *  real LangChain tool bound to a live SynapseClient transport.
 *
 *  @param client  – initialised SynapseClient (provides HttpTransport)
 *  @param opts    – optional overrides
 *  @returns { tools, toolMap }
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Options for creating Solana RPC tools.
 * @since 1.0.0
 */
export interface CreateSolanaToolsOpts {
  /** Prefix prepended to every tool name (default: `"solana_"`). */
  prefix?: string;
  /** Restrict to a subset of method names (e.g. `['getBalance', 'getSlot']`). */
  include?: string[];
  /** Exclude specific method names. Applied after `include`. */
  exclude?: string[];
  /** If true, stringifies the JSON result with 2-space indent (default: true). */
  prettyJson?: boolean;
}

/**
 * @description Factory that hydrates every registered Zod schema into a
 * real LangChain tool bound to a live SynapseClient transport.
 *
 * @param {SynapseClient} client - Initialised SynapseClient (provides HttpTransport)
 * @param {CreateSolanaToolsOpts} [opts={}] - Optional overrides for prefix, include/exclude, and JSON formatting
 * @returns {SolanaToolkit} Object with `tools` array and `toolMap` record
 * @since 1.0.0
 */
export function createExecutableSolanaTools(
  client: SynapseClient,
  opts: CreateSolanaToolsOpts = {},
): SolanaToolkit {
  const {
    prefix = 'solana_',
    include,
    exclude,
    prettyJson = true,
  } = opts;

  const transport = client.transport;
  const tools: SolanaTool[] = [];
  const toolMap: SolanaToolMap = {};

  for (const method of agentRpcMethods) {
    // Filter gates
    if (include && !include.includes(method.name)) continue;
    if (exclude && exclude.includes(method.name)) continue;

    const binding = bindings[method.name];
    if (!binding) {
      // Safety: skip if no binding registered (should never happen)
      console.warn(`[synapse-ai] No binding for RPC method "${method.name}", skipping tool creation.`);
      continue;
    }

    const toolName = `${prefix}${method.name}`;

    const t = tool(
      async (input) => {
        try {
          const args = binding.argsFrom(input as Record<string, unknown>, transport);
          const result = await binding.fn(...args);
          return prettyJson ? JSON.stringify(result, null, 2) : JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({
            error: true,
            method: method.name,
            message: err?.message ?? String(err),
          });
        }
      },
      {
        name: toolName,
        description: method.description ?? `Solana RPC: ${method.name}`,
        schema: method.input as import('zod').ZodObject<any>,
      },
    );

    tools.push(t);
    toolMap[method.name] = t;
  }

  return { tools, toolMap };
}