/**
 * @module das/types
 * @description DAS type definitions for the Metaplex Read API — fully typed
 * interfaces for NFTs, compressed NFTs, assets, proofs, and search queries
 * conforming to the Digital Asset Standard specification.
 * @since 1.0.0
 */
import type { Pubkey, Slot, Commitment } from '../core/types';

// ── Request options ────────────────────────────────────────────

/**
 * Common request options for DAS API calls.
 *
 * Shared optional parameters passed to every DAS method.
 * @since 1.0.0
 */
export interface DasOpts {
  commitment?: Commitment;
}

// ── Content ────────────────────────────────────────────────────

/**
 * A file reference attached to a digital asset's content.
 *
 * Represents a single off-chain file (image, video, etc.) linked to an asset.
 * @since 1.0.0
 */
export interface DasFile {
  uri?: string;
  mime?: string;
  quality?: string;
  contexts?: string[];
}

/**
 * On-chain and off-chain content metadata for a digital asset.
 *
 * Contains the JSON schema URI, associated files, metadata attributes,
 * and external links for an asset.
 * @since 1.0.0
 */
export interface DasContent {
  $schema?: string;
  json_uri?: string;
  files?: DasFile[];
  metadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    token_standard?: string;
    attributes?: { trait_type: string; value: string }[];
  };
  links?: Record<string, string>;
}

// ── Ownership / Authorities ────────────────────────────────────

/**
 * Ownership details of a digital asset.
 *
 * Tracks the current owner, delegation status, and ownership model.
 * @since 1.0.0
 */
export interface DasOwnership {
  frozen: boolean;
  delegated: boolean;
  delegate: Pubkey | null;
  ownership_model: 'single' | 'token';
  owner: Pubkey;
}

/**
 * An authority associated with a digital asset.
 *
 * Represents an on-chain authority address and its permission scopes.
 * @since 1.0.0
 */
export interface DasAuthority {
  address: Pubkey;
  scopes: string[];
}

// ── Compression ────────────────────────────────────────────────

/**
 * Compression metadata for a compressed NFT (cNFT).
 *
 * Contains Merkle tree hashes, tree address, sequence number,
 * and leaf index for state-compressed assets.
 * @since 1.0.0
 */
export interface DasCompression {
  eligible: boolean;
  compressed: boolean;
  data_hash: string;
  creator_hash: string;
  asset_hash: string;
  tree: Pubkey;
  seq: number;
  leaf_id: number;
}

// ── Grouping / Royalty / Supply ─────────────────────────────────

/**
 * Grouping information for a digital asset (e.g. collection membership).
 *
 * Links an asset to a group such as a verified collection.
 * @since 1.0.0
 */
export interface DasGrouping {
  group_key: string;
  group_value: string;
  verified?: boolean;
  collection_metadata?: DasContent;
}

/**
 * Royalty configuration for a digital asset.
 *
 * Specifies the royalty model, target, basis points, and sale status.
 * @since 1.0.0
 */
export interface DasRoyalty {
  royalty_model: string;
  target: Pubkey | null;
  percent: number;
  basis_points: number;
  primary_sale_happened: boolean;
  locked: boolean;
}

/**
 * A creator entry on a digital asset.
 *
 * Represents a co-creator with their revenue share and verification status.
 * @since 1.0.0
 */
export interface DasCreator {
  address: Pubkey;
  share: number;
  verified: boolean;
}

/**
 * Supply information for a digital asset edition.
 *
 * Tracks max supply, current supply, and edition nonce for print editions.
 * @since 1.0.0
 */
export interface DasSupply {
  print_max_supply: number;
  print_current_supply: number;
  edition_nonce: number | null;
}

// ── Core Asset ─────────────────────────────────────────────────

/**
 * The full representation of a Metaplex Digital Asset.
 *
 * Core response type returned by `getAsset` and search endpoints,
 * containing content, ownership, compression, grouping, royalty, and token info.
 * @since 1.0.0
 */
export interface DasAsset {
  interface: string;
  id: Pubkey;
  content: DasContent;
  authorities: DasAuthority[];
  compression: DasCompression;
  grouping: DasGrouping[];
  royalty: DasRoyalty;
  creators: DasCreator[];
  ownership: DasOwnership;
  supply: DasSupply | null;
  mutable: boolean;
  burnt: boolean;
  mint_extensions?: Record<string, unknown>;
  token_info?: {
    symbol?: string;
    balance?: number;
    supply?: number;
    decimals?: number;
    token_program?: Pubkey;
    associated_token_address?: Pubkey;
    mint_authority?: Pubkey;
    freeze_authority?: Pubkey;
    price_info?: {
      price_per_token?: number;
      currency?: string;
      total_price?: number;
    };
  };
}

// ── Proof ──────────────────────────────────────────────────────

/**
 * Merkle proof for a compressed digital asset.
 *
 * Used to verify or modify a cNFT's state on the concurrent Merkle tree.
 * @since 1.0.0
 */
export interface DasAssetProof {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: Pubkey;
}

// ── List result ────────────────────────────────────────────────

/**
 * Paginated result set returned by DAS list/search endpoints.
 *
 * Wraps an array of items with total count, page size, and cursor
 * for efficient pagination.
 * @typeParam T - The type of items in the page (defaults to {@link DasAsset}).
 * @since 1.0.0
 */
export interface DasPage<T = DasAsset> {
  total: number;
  limit: number;
  page: number;
  cursor?: string;
  items: T[];
}

// ── Search params ──────────────────────────────────────────────

/**
 * Fields by which DAS search results can be sorted.
 * @since 1.0.0
 */
export type DasSortBy = 'created' | 'updated' | 'recent_action' | 'none';

/**
 * Sort direction for DAS search results.
 * @since 1.0.0
 */
export type DasSortDirection = 'asc' | 'desc';

/**
 * Comprehensive search parameters for the DAS `searchAssets` endpoint.
 *
 * Supports filtering by owner, creator, authority, collection grouping,
 * token type, compression status, and many other asset attributes.
 * @since 1.0.0
 */
export interface DasSearchParams {
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
  ownerAddress?: Pubkey;
  creatorAddress?: Pubkey;
  creatorVerified?: boolean;
  authorityAddress?: Pubkey;
  grouping?: [string, string];
  burnt?: boolean;
  compressed?: boolean;
  compressible?: boolean;
  frozen?: boolean;
  supplyMint?: Pubkey;
  supply?: number;
  interface?: string;
  delegate?: Pubkey;
  jsonUri?: string;
  name?: string;
  tokenType?: 'fungible' | 'nonFungible' | 'regularNft' | 'compressedNft' | 'all';
  showUnverifiedCollections?: boolean;
  showCollectionMetadata?: boolean;
  showGrandTotal?: boolean;
  showFungible?: boolean;
  showNativeBalance?: boolean;
  showInscription?: boolean;
  showZeroBalance?: boolean;
}
