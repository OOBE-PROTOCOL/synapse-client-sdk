/**
 * @module ai/tools/protocols/metaplex/tools
 * @description Metaplex Protocol — LangChain tool factory.
 *
 * Creates 12 executable tools that call DAS methods through the Solana RPC
 * transport (no external REST API needed — DAS is an RPC extension).
 *
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * const client = new SynapseClient({ endpoint: '...' });
 * const metaplex = createMetaplexTools(client);
 * ```
 *
 * @since 1.0.0
 */
import {
  buildProtocolTools,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { metaplexMethods } from './schemas';
import type { SynapseClient } from '../../../../core/client';
import type { HttpTransport } from '../../../../core/transport';

/* ═══════════════════════════════════════════════════════════════
 *  DAS RPC method name mapping
 *
 *  Maps our public tool names → actual JSON-RPC method names
 *  used by the DAS extension on the Solana RPC node.
 * ═══════════════════════════════════════════════════════════════ */

const DAS_RPC_METHODS: Record<string, string> = {
  getAsset:              'getAsset',
  getAssets:             'getAssetBatch',
  getAssetProof:         'getAssetProof',
  getAssetProofs:        'getAssetProofBatch',
  getAssetsByOwner:      'getAssetsByOwner',
  getAssetsByCreator:    'getAssetsByCreator',
  getAssetsByCollection: 'getAssetsByGroup',
  getAssetsByAuthority:  'getAssetsByAuthority',
  searchAssets:          'searchAssets',
  getAssetSignatures:    'getSignaturesForAsset',
  getTokenAccounts:      'getTokenAccounts',
};

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher — DAS via RPC transport
 * ═══════════════════════════════════════════════════════════════ */

function createMetaplexExecutor(transport: HttpTransport) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const rpcMethod = DAS_RPC_METHODS[method.name];

    // ── resolveCollection: compound helper ──────────────────
    if (method.name === 'resolveCollection') {
      return executeResolveCollection(transport, input);
    }

    if (!rpcMethod) {
      throw new Error(`Unknown Metaplex DAS method: ${method.name}`);
    }

    // Strip the commitment field — DAS methods embed it in the params object
    const { commitment, ...params } = input;

    // DAS methods expect a single params array element
    const rpcParams = commitment
      ? [{ ...params, commitment }]
      : [params];

    // For single-ID methods, unwrap to match the DAS API signature
    if (method.name === 'getAsset' || method.name === 'getAssetProof') {
      return transport.request(rpcMethod, [{ id: params.id, ...(commitment ? { commitment } : {}) }]);
    }

    if (method.name === 'getAssets' || method.name === 'getAssetProofs') {
      return transport.request(rpcMethod, [{ ids: params.ids, ...(commitment ? { commitment } : {}) }]);
    }

    return transport.request(rpcMethod, rpcParams);
  };
}

/**
 * resolveCollection — compound helper that:
 * 1. Fetches the collection asset metadata
 * 2. Fetches a sample page of items in the collection
 * 3. Computes stats (unique owners, compressed count, traits)
 */
async function executeResolveCollection(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const collectionAddress = input.collectionAddress as string;
  const sampleSize = (input.sampleSize as number) || 10;
  const commitment = input.commitment as string | undefined;

  const commitmentParam = commitment ? { commitment } : {};

  // Fetch collection asset + sample items in parallel
  const [collection, page] = await Promise.all([
    transport.request('getAsset', [{ id: collectionAddress, ...commitmentParam }]),
    transport.request('getAssetsByGroup', [{
      groupKey: 'collection',
      groupValue: collectionAddress,
      limit: sampleSize,
      page: 1,
      ...commitmentParam,
    }]),
  ]);

  // Compute stats from the sample
  const items = (page as any)?.items ?? [];
  const owners = new Set<string>();
  let compressedCount = 0;
  let burnedCount = 0;
  const traitMap: Record<string, Set<string>> = {};

  for (const item of items) {
    if (item?.ownership?.owner) owners.add(item.ownership.owner);
    if (item?.compression?.compressed) compressedCount++;
    if (item?.burnt) burnedCount++;

    const attrs = item?.content?.metadata?.attributes;
    if (Array.isArray(attrs)) {
      for (const attr of attrs) {
        if (!attr.trait_type || !attr.value) continue;
        if (!traitMap[attr.trait_type]) traitMap[attr.trait_type] = new Set();
        traitMap[attr.trait_type].add(String(attr.value));
      }
    }
  }

  // Convert sets to arrays for serialisation
  const traitSummary: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(traitMap)) {
    traitSummary[k] = [...v];
  }

  return {
    collection,
    stats: {
      totalSupply: (page as any)?.total ?? items.length,
      sampleSize: items.length,
      uniqueOwners: owners.size,
      compressedCount,
      burnedCount,
      traitSummary,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createMetaplexTools()
 * ═══════════════════════════════════════════════════════════════ */

/** Metaplex-specific config (just tool options — transport comes from SynapseClient). */
export type MetaplexToolsConfig = CreateProtocolToolsOpts;

/**
 * Create LangChain-compatible tools for Metaplex DAS API.
 *
 * Unlike Jupiter/Raydium, Metaplex tools use the Solana RPC transport
 * (DAS is an extension of the JSON-RPC interface).
 *
 * @param client  Initialised SynapseClient (provides HttpTransport)
 * @param opts    Tool creation options
 *
 * @example
 * ```ts
 * const client = new SynapseClient({ endpoint: 'https://...' });
 * const metaplex = createMetaplexTools(client);
 * const nfts = metaplex.toolMap.getAssetsByOwner;
 * ```
 */
export function createMetaplexTools(
  client: SynapseClient,
  opts: MetaplexToolsConfig = {},
): ProtocolToolkit {
  const execute = createMetaplexExecutor(client.transport);

  return buildProtocolTools(metaplexMethods, execute, {
    defaultPrefix: 'metaplex_',
    ...opts,
  });
}

/** Re-export schemas for direct access. */
export { metaplexMethods, metaplexMethodNames } from './schemas';
