/**
 * @module ai/plugins/nft/schemas
 * @description NFT Plugin — Zod schemas for NFT operations.
 *
 * Covers:
 *  - Metaplex NFT management     (collection deploy, mint, metadata, royalties)
 *  - 3.Land integration          (create collection, mint + auto-list, list for sale)
 *  - DAS queries                 (search, get by owner, get by creator)
 *
 * @since 2.0.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../../tools/protocols/shared';

const zPubkey = z.string().describe('Solana public key (base58)');
const zMint   = z.string().describe('NFT mint address (base58)');
const zTx     = z.string().describe('Base64-encoded serialized transaction');

/* ═══════════════════════════════════════════════════════════════
 *  1. Metaplex NFT Management
 * ═══════════════════════════════════════════════════════════════ */

const { register: regMpl, methods: metaplexNftMethods } = createMethodRegistry('metaplex-nft');

regMpl(
  'deployCollection',
  z.object({
    authority: zPubkey.describe('Collection authority wallet'),
    name: z.string().describe('Collection name'),
    symbol: z.string().max(10).describe('Collection symbol'),
    uri: z.string().url().describe('URI to collection metadata JSON'),
    sellerFeeBasisPoints: z.number().int().min(0).max(10000).default(500)
      .describe('Royalty fee in bps (500 = 5%)'),
    isMutable: z.boolean().optional().default(true),
    maxSupply: z.number().int().optional().describe('Max NFTs in collection (0 = unlimited)'),
    creators: z.array(z.object({
      address: zPubkey,
      share: z.number().int().min(0).max(100).describe('Revenue share percentage'),
      verified: z.boolean().optional().default(false),
    })).optional().describe('Creator list with revenue shares (must sum to 100)'),
  }),
  z.object({
    collectionMint: zMint.describe('Collection NFT mint address'),
    metadataAddress: zPubkey,
    masterEditionAddress: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Deploy a new NFT collection via Metaplex. Returns the collection mint and metadata addresses.',
);

regMpl(
  'mintNFT',
  z.object({
    authority: zPubkey.describe('Mint authority wallet'),
    collection: zMint.optional().describe('Collection mint to add this NFT to'),
    name: z.string().describe('NFT name'),
    symbol: z.string().max(10).optional().describe('NFT symbol'),
    uri: z.string().url().describe('URI to NFT metadata JSON (image, attributes, etc.)'),
    sellerFeeBasisPoints: z.number().int().min(0).max(10000).default(500),
    isMutable: z.boolean().optional().default(true),
    creators: z.array(z.object({
      address: zPubkey,
      share: z.number().int().min(0).max(100),
      verified: z.boolean().optional().default(false),
    })).optional(),
    recipient: zPubkey.optional().describe('Recipient wallet (default: authority)'),
    isCompressed: z.boolean().optional().default(false).describe('Mint as compressed NFT (cNFT) for lower cost'),
    merkleTree: zPubkey.optional().describe('Merkle tree account for compressed NFTs'),
  }),
  z.object({
    mint: zMint.describe('NFT mint address'),
    metadataAddress: zPubkey,
    editionAddress: zPubkey.optional(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Mint a new NFT via Metaplex. Supports both standard and compressed (cNFT) minting.',
);

regMpl(
  'updateMetadata',
  z.object({
    mint: zMint.describe('NFT mint address'),
    updateAuthority: zPubkey.describe('Current update authority'),
    name: z.string().optional().describe('New name'),
    symbol: z.string().optional().describe('New symbol'),
    uri: z.string().url().optional().describe('New metadata URI'),
    sellerFeeBasisPoints: z.number().int().min(0).max(10000).optional(),
    creators: z.array(z.object({
      address: zPubkey,
      share: z.number().int().min(0).max(100),
      verified: z.boolean().optional(),
    })).optional(),
    isMutable: z.boolean().optional(),
    primarySaleHappened: z.boolean().optional(),
    newUpdateAuthority: zPubkey.optional().describe('Transfer update authority to a new wallet'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Update NFT metadata fields (name, symbol, URI, creators, royalties, authority).',
);

regMpl(
  'verifyCreator',
  z.object({
    mint: zMint,
    creator: zPubkey.describe('Creator wallet to verify'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Verify a creator on an NFT\'s metadata (requires creator\'s signature).',
);

regMpl(
  'verifyCollection',
  z.object({
    mint: zMint.describe('NFT mint to verify'),
    collection: zMint.describe('Collection mint'),
    collectionAuthority: zPubkey.describe('Collection authority wallet'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Verify an NFT as part of a collection.',
);

regMpl(
  'setAndVerifyCollection',
  z.object({
    mint: zMint,
    collection: zMint,
    collectionAuthority: zPubkey,
    updateAuthority: zPubkey.describe('NFT update authority'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Set and verify a collection on an NFT in a single transaction.',
);

regMpl(
  'delegateAuthority',
  z.object({
    mint: zMint,
    currentAuthority: zPubkey,
    newAuthority: zPubkey,
    authorityType: z.enum(['update', 'mint', 'freeze', 'collection']).describe('Type of authority to delegate'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Delegate a specific authority (update, mint, freeze, collection) to another wallet.',
);

regMpl(
  'revokeAuthority',
  z.object({
    mint: zMint,
    authority: zPubkey.describe('Current authority holder'),
    authorityType: z.enum(['update', 'mint', 'freeze', 'collection']),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Revoke (remove) a specific authority. Irreversible for some types.',
);

regMpl(
  'configureRoyalties',
  z.object({
    mint: zMint,
    updateAuthority: zPubkey,
    sellerFeeBasisPoints: z.number().int().min(0).max(10000).describe('Royalty fee in bps'),
    creators: z.array(z.object({
      address: zPubkey,
      share: z.number().int().min(0).max(100),
    })).describe('Creator list with revenue shares (must sum to 100)'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Configure royalty fee and creator splits for an NFT.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. 3.Land NFT Marketplace
 * ═══════════════════════════════════════════════════════════════ */

const { register: reg3land, methods: threeLandMethods } = createMethodRegistry('3land');

reg3land(
  'createCollection',
  z.object({
    owner: zPubkey.describe('Collection owner wallet'),
    name: z.string().describe('Collection name'),
    symbol: z.string().describe('Collection symbol'),
    description: z.string().optional().describe('Collection description'),
    image: z.string().url().describe('Collection cover image URL'),
    royaltyBps: z.number().int().min(0).max(10000).default(500),
    creators: z.array(z.object({
      address: zPubkey,
      share: z.number().int().min(0).max(100),
    })).optional(),
  }),
  z.object({
    collectionId: z.string().describe('3.Land collection ID'),
    collectionMint: zMint,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a new NFT collection on 3.Land marketplace.',
);

reg3land(
  'mintAndList',
  z.object({
    owner: zPubkey,
    collection: z.string().describe('3.Land collection ID'),
    name: z.string(),
    description: z.string().optional(),
    image: z.string().url().describe('NFT image URL'),
    attributes: z.array(z.object({
      trait_type: z.string(),
      value: z.union([z.string(), z.number()]),
    })).optional(),
    price: z.string().describe('Listing price in token amount'),
    priceMint: zMint.optional().describe('Price in this SPL token (default: SOL)'),
    supply: z.number().int().positive().optional().default(1).describe('Edition supply'),
  }),
  z.object({
    mint: zMint,
    listingId: z.string(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Mint an NFT on 3.Land and automatically list it for sale.',
);

reg3land(
  'listForSale',
  z.object({
    seller: zPubkey,
    mint: zMint.describe('NFT mint to list'),
    price: z.string().describe('Listing price (in specified token)'),
    priceMint: zMint.optional().describe('SPL token for pricing (default: SOL). Any SPL token supported.'),
    expiry: z.string().optional().describe('ISO 8601 listing expiry timestamp'),
  }),
  z.object({
    listingId: z.string(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'List an NFT for sale on 3.Land in any SPL token.',
);

reg3land(
  'cancelListing',
  z.object({
    seller: zPubkey,
    listingId: z.string().describe('3.Land listing ID to cancel'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Cancel an active NFT listing on 3.Land.',
);

reg3land(
  'buyNFT',
  z.object({
    buyer: zPubkey,
    listingId: z.string().describe('3.Land listing ID'),
  }),
  z.object({
    mint: zMint,
    tx: zTx,
    price: z.string(),
    priceMint: zMint,
    signature: z.string().optional(),
  }),
  'Purchase an NFT from a 3.Land listing.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. DAS — Digital Asset Standard queries
 * ═══════════════════════════════════════════════════════════════ */

const { register: regDas, methods: dasMethods } = createMethodRegistry('das');

regDas(
  'getAsset',
  z.object({
    id: zMint.describe('Asset mint address'),
  }),
  z.object({
    id: zMint,
    content: z.object({
      json_uri: z.string().optional(),
      metadata: z.object({
        name: z.string().optional(),
        symbol: z.string().optional(),
        description: z.string().optional(),
        image: z.string().optional(),
        attributes: z.array(z.object({
          trait_type: z.string(),
          value: z.union([z.string(), z.number()]),
        })).optional(),
      }).optional(),
    }).optional(),
    authorities: z.array(z.unknown()).optional(),
    compression: z.object({
      compressed: z.boolean(),
      tree: zPubkey.optional(),
      leaf_id: z.number().optional(),
    }).optional(),
    ownership: z.object({
      owner: zPubkey,
      delegate: zPubkey.optional(),
      frozen: z.boolean().optional(),
    }).optional(),
    royalty: z.object({
      basis_points: z.number().optional(),
      primary_sale_happened: z.boolean().optional(),
    }).optional(),
  }),
  'Get detailed information about a single NFT/asset via DAS.',
);

regDas(
  'getAssetsByOwner',
  z.object({
    ownerAddress: zPubkey,
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().min(1).max(1000).optional().default(100),
    sortBy: z.enum(['created', 'updated', 'recent_action']).optional(),
    before: z.string().optional(),
    after: z.string().optional(),
  }),
  z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
  'Get all NFTs/assets owned by a wallet via DAS (supports pagination).',
);

regDas(
  'getAssetsByCreator',
  z.object({
    creatorAddress: zPubkey,
    onlyVerified: z.boolean().optional().default(true),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().min(1).max(1000).optional().default(100),
  }),
  z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    page: z.number(),
  }),
  'Get all NFTs/assets created by a specific creator via DAS.',
);

regDas(
  'getAssetsByCollection',
  z.object({
    collectionAddress: zMint,
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().min(1).max(1000).optional().default(100),
  }),
  z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    page: z.number(),
  }),
  'Get all NFTs in a collection via DAS.',
);

regDas(
  'searchAssets',
  z.object({
    ownerAddress: zPubkey.optional(),
    creatorAddress: zPubkey.optional(),
    grouping: z.tuple([z.string(), z.string()]).optional().describe('Grouping key-value pair (e.g. ["collection", "mint_address"])'),
    compressed: z.boolean().optional(),
    frozen: z.boolean().optional(),
    burnt: z.boolean().optional().default(false),
    jsonUri: z.string().optional(),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().min(1).max(1000).optional().default(100),
  }),
  z.object({
    items: z.array(z.unknown()),
    total: z.number(),
    page: z.number(),
  }),
  'Search NFTs/assets with flexible filters via DAS.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

export { metaplexNftMethods, threeLandMethods, dasMethods };
export const allNftMethods = [...metaplexNftMethods, ...threeLandMethods, ...dasMethods] as const;
