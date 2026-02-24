/**
 * Metaplex Protocol — Zod schemas for 12 DAS + NFT helper methods.
 *
 * Covers:
 *  - DAS API     (11 methods — wraps existing src/das/ via RPC)
 *  - Helpers      (1 method  — collection resolver)
 *
 * These methods go through the Solana JSON-RPC transport (DAS extension),
 * NOT a separate REST API like Jupiter/Raydium.
 *
 * @module protocols/metaplex/schemas
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('metaplex');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zPubkey     = z.string().describe('Base58-encoded Solana public key');
const zCommitment = z.enum(['processed', 'confirmed', 'finalized']).optional();

const zSortBy = z.object({
  sortBy: z.enum(['created', 'updated', 'recent_action', 'none']).describe('Sort field'),
  sortDirection: z.enum(['asc', 'desc']).describe('Sort direction'),
}).optional().describe('Sorting options');

const zPagination = {
  page: z.number().int().positive().optional().describe('Page number (1-indexed)'),
  limit: z.number().int().positive().max(1000).optional().describe('Items per page (max 1000)'),
  cursor: z.string().optional().describe('Cursor for keyset pagination'),
  before: z.string().optional().describe('Cursor: return items before this'),
  after: z.string().optional().describe('Cursor: return items after this'),
};

const zDisplayOpts = {
  showFungible: z.boolean().optional().describe('Include fungible tokens'),
  showNativeBalance: z.boolean().optional().describe('Include SOL balance'),
  showInscription: z.boolean().optional().describe('Include inscription data'),
  showCollectionMetadata: z.boolean().optional().describe('Include collection metadata'),
  showZeroBalance: z.boolean().optional().describe('Include zero-balance accounts'),
  showUnverifiedCollections: z.boolean().optional().describe('Include unverified collections'),
};

/* ── Output shapes ──────────────────────────────────────────── */

const zDasContent = z.object({
  json_uri: z.string().optional(),
  metadata: z.object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    description: z.string().optional(),
    token_standard: z.string().optional(),
    attributes: z.array(z.object({ trait_type: z.string(), value: z.string() })).optional(),
  }).optional(),
  files: z.array(z.object({ uri: z.string().optional(), mime: z.string().optional() })).optional(),
  links: z.record(z.string()).optional(),
});

const zDasOwnership = z.object({
  owner: zPubkey,
  frozen: z.boolean(),
  delegated: z.boolean(),
  delegate: zPubkey.nullable(),
  ownership_model: z.enum(['single', 'token']),
});

const zDasAsset = z.object({
  interface: z.string(),
  id: zPubkey,
  content: zDasContent,
  authorities: z.array(z.object({ address: zPubkey, scopes: z.array(z.string()) })),
  compression: z.object({
    compressed: z.boolean(),
    data_hash: z.string(),
    creator_hash: z.string(),
    asset_hash: z.string(),
    tree: zPubkey,
    seq: z.number(),
    leaf_id: z.number(),
  }),
  grouping: z.array(z.object({ group_key: z.string(), group_value: z.string() })),
  royalty: z.object({
    royalty_model: z.string(),
    percent: z.number(),
    basis_points: z.number(),
    primary_sale_happened: z.boolean(),
    locked: z.boolean(),
  }),
  creators: z.array(z.object({ address: zPubkey, share: z.number(), verified: z.boolean() })),
  ownership: zDasOwnership,
  mutable: z.boolean(),
  burnt: z.boolean(),
  token_info: z.object({
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    supply: z.number().optional(),
    balance: z.number().optional(),
    price_info: z.object({
      price_per_token: z.number().optional(),
      currency: z.string().optional(),
    }).optional(),
  }).optional(),
});

const zDasPage = z.object({
  total: z.number(),
  limit: z.number(),
  page: z.number(),
  cursor: z.string().optional(),
  items: z.array(zDasAsset),
});

const zDasProof = z.object({
  root: z.string(),
  proof: z.array(z.string()),
  node_index: z.number(),
  leaf: z.string(),
  tree_id: zPubkey,
});

/* ═══════════════════════════════════════════════════════════════
 *  1. DAS Core Methods
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getAsset',
  z.object({
    id: zPubkey.describe('Asset ID (mint address or asset ID)'),
    commitment: zCommitment,
  }),
  zDasAsset,
  'Get complete metadata, ownership, compression, and royalty info for a single digital asset (NFT, cNFT, Core, or fungible).',
);

register(
  'getAssets',
  z.object({
    ids: z.array(zPubkey).min(1).max(1000).describe('Asset IDs to fetch'),
    commitment: zCommitment,
  }),
  z.array(zDasAsset),
  'Batch-fetch metadata for multiple digital assets in a single RPC call.',
);

register(
  'getAssetProof',
  z.object({
    id: zPubkey.describe('Compressed NFT asset ID'),
    commitment: zCommitment,
  }),
  zDasProof,
  'Get the Merkle tree proof for a compressed NFT. Required for transfers and burns of cNFTs.',
);

register(
  'getAssetProofs',
  z.object({
    ids: z.array(zPubkey).min(1).max(1000).describe('Compressed NFT asset IDs'),
    commitment: zCommitment,
  }),
  z.record(zPubkey, zDasProof),
  'Batch-fetch Merkle tree proofs for multiple compressed NFTs.',
);

register(
  'getAssetsByOwner',
  z.object({
    ownerAddress: zPubkey.describe('Wallet address of the owner'),
    ...zPagination,
    sortBy: zSortBy,
    ...zDisplayOpts,
    commitment: zCommitment,
  }),
  zDasPage,
  'Get all digital assets (NFTs, cNFTs, fungibles) owned by a wallet address.',
);

register(
  'getAssetsByCreator',
  z.object({
    creatorAddress: zPubkey.describe('Creator address'),
    onlyVerified: z.boolean().optional().describe('Only return assets with verified creator'),
    ...zPagination,
    sortBy: zSortBy,
    ...zDisplayOpts,
    commitment: zCommitment,
  }),
  zDasPage,
  'Get all digital assets created by a specific creator address.',
);

register(
  'getAssetsByCollection',
  z.object({
    groupKey: z.literal('collection').default('collection'),
    groupValue: zPubkey.describe('Collection address'),
    ...zPagination,
    sortBy: zSortBy,
    ...zDisplayOpts,
    commitment: zCommitment,
  }),
  zDasPage,
  'Get all assets in a Metaplex collection. Uses DAS getAssetsByGroup with groupKey="collection".',
);

register(
  'getAssetsByAuthority',
  z.object({
    authorityAddress: zPubkey.describe('Authority address'),
    ...zPagination,
    sortBy: zSortBy,
    commitment: zCommitment,
  }),
  zDasPage,
  'Get all digital assets managed by a specific authority address.',
);

register(
  'searchAssets',
  z.object({
    ownerAddress: zPubkey.optional(),
    creatorAddress: zPubkey.optional(),
    creatorVerified: z.boolean().optional(),
    authorityAddress: zPubkey.optional(),
    grouping: z.tuple([z.string(), z.string()]).optional().describe('[groupKey, groupValue] pair'),
    burnt: z.boolean().optional(),
    compressed: z.boolean().optional(),
    frozen: z.boolean().optional(),
    name: z.string().optional().describe('Search by asset name (substring match)'),
    tokenType: z.enum(['fungible', 'nonFungible', 'regularNft', 'compressedNft', 'all']).optional(),
    interface: z.string().optional().describe('Asset interface (e.g. "V1_NFT", "MplCoreAsset")'),
    jsonUri: z.string().optional().describe('Filter by off-chain JSON URI'),
    ...zPagination,
    sortBy: zSortBy,
    ...zDisplayOpts,
    commitment: zCommitment,
  }),
  zDasPage,
  'Advanced multi-filter search across all indexed digital assets (NFTs, cNFTs, fungibles, Core assets).',
);

register(
  'getAssetSignatures',
  z.object({
    id: zPubkey.describe('Asset ID to get transaction history for'),
    ...zPagination,
    sortDirection: z.enum(['asc', 'desc']).optional(),
    commitment: zCommitment,
  }),
  z.object({
    total: z.number(),
    limit: z.number(),
    page: z.number(),
    items: z.array(z.object({
      signature: z.string(),
      type: z.string().optional(),
      slot: z.number().optional(),
    })),
  }),
  'Get the transaction history (signatures) for a specific compressed NFT.',
);

register(
  'getTokenAccounts',
  z.object({
    owner: zPubkey.optional().describe('Token account owner'),
    mint: zPubkey.optional().describe('Filter by token mint'),
    ...zPagination,
    showZeroBalance: z.boolean().optional(),
    commitment: zCommitment,
  }),
  z.object({
    total: z.number(),
    limit: z.number(),
    page: z.number(),
    token_accounts: z.array(z.object({
      address: zPubkey,
      mint: zPubkey,
      owner: zPubkey,
      amount: z.number(),
      delegated_amount: z.number().optional(),
      frozen: z.boolean().optional(),
    })),
  }),
  'Get SPL / Token-2022 token accounts via DAS, with optional filters.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Higher-level Helpers
 * ═══════════════════════════════════════════════════════════════ */

register(
  'resolveCollection',
  z.object({
    collectionAddress: zPubkey.describe('Collection mint / address'),
    sampleSize: z.number().int().positive().max(50).optional()
      .describe('Number of sample assets to fetch for trait analysis (default 10)'),
    commitment: zCommitment,
  }),
  z.object({
    collection: zDasAsset.describe('Collection asset metadata'),
    stats: z.object({
      totalSupply: z.number(),
      sampleSize: z.number(),
      uniqueOwners: z.number(),
      compressedCount: z.number(),
      burnedCount: z.number(),
      traitSummary: z.record(z.string(), z.array(z.string())).optional(),
    }),
  }),
  'Resolve a collection address into full metadata + computed stats (supply, owners, traits).',
);

/* ═══════════════════════════════════════════════════════════════
 *  Export
 * ═══════════════════════════════════════════════════════════════ */

/** All 12 registered Metaplex methods with typed Zod schemas. */
export const metaplexMethods = methods;

/** Metaplex method names as a readonly tuple for allow-listing. */
export const metaplexMethodNames = methods.map((m) => m.name) as readonly string[];
