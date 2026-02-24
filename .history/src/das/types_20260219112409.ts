/**
 * DAS (Digital Asset Standard) types — Metaplex Read API for NFT/cNFT.
 * Fully typed according to the DAS specification.
 */
import type { Pubkey, Slot, Commitment } from '../core/types';

// ── Request options ────────────────────────────────────────────
export interface DasOpts {
  commitment?: Commitment;
}

// ── Content ────────────────────────────────────────────────────
export interface DasFile {
  uri?: string;
  mime?: string;
  quality?: string;
  contexts?: string[];
}

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
export interface DasOwnership {
  frozen: boolean;
  delegated: boolean;
  delegate: Pubkey | null;
  ownership_model: 'single' | 'token';
  owner: Pubkey;
}

export interface DasAuthority {
  address: Pubkey;
  scopes: string[];
}

// ── Compression ────────────────────────────────────────────────
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
export interface DasGrouping {
  group_key: string;
  group_value: string;
  verified?: boolean;
  collection_metadata?: DasContent;
}

export interface DasRoyalty {
  royalty_model: string;
  target: Pubkey | null;
  percent: number;
  basis_points: number;
  primary_sale_happened: boolean;
  locked: boolean;
}

export interface DasCreator {
  address: Pubkey;
  share: number;
  verified: boolean;
}

export interface DasSupply {
  print_max_supply: number;
  print_current_supply: number;
  edition_nonce: number | null;
}

// ── Core Asset ─────────────────────────────────────────────────
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
export interface DasAssetProof {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: Pubkey;
}

// ── List result ────────────────────────────────────────────────
export interface DasPage<T = DasAsset> {
  total: number;
  limit: number;
  page: number;
  cursor?: string;
  items: T[];
}

// ── Search params ──────────────────────────────────────────────
export type DasSortBy = 'created' | 'updated' | 'recent_action' | 'none';
export type DasSortDirection = 'asc' | 'desc';

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
