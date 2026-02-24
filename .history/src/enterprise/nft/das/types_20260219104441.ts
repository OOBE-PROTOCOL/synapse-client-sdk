import type { Commitment, PublicKeyString, RpcPaginationOptions, RpcSortOptions } from '../../solana/types';

export interface DasContext {
  slot?: number;
}

export interface DasRequestOptions {
  commitment?: Commitment;
  withContext?: boolean;
}

export interface DasAssetFile {
  uri?: string;
  mime?: string;
  size?: number;
  quality?: number;
}

export interface DasAssetContent {
  json_uri?: string;
  files?: DasAssetFile[];
  metadata?: Record<string, unknown>;
  links?: Record<string, string>;
}

export interface DasAssetOwnership {
  owner?: PublicKeyString;
  delegate?: PublicKeyString;
  frozen?: boolean;
}

export interface DasAssetCompression {
  eligible?: boolean;
  compressed?: boolean;
  data_hash?: string;
  creator_hash?: string;
  leaf_id?: number;
  tree?: PublicKeyString;
  seq?: number;
}

export interface DasAssetGrouping {
  group_key: string;
  group_value: string;
}

export interface DasAssetRoyalty {
  royalty_model?: string;
  target?: string;
  percent?: number;
  basis_points?: number;
  primary_sale_happened?: boolean;
  locked?: boolean;
}

export interface DasAssetSupply {
  print_max_supply?: number;
  print_current_supply?: number;
  edition_nonce?: number;
}

export interface DasAssetBurnt {
  burnt?: boolean;
}

export interface DasAssetAuthorities {
  address?: PublicKeyString;
  scopes?: string[];
}

export interface DasAsset {
  id: PublicKeyString;
  interface?: string;
  content?: DasAssetContent;
  ownership?: DasAssetOwnership;
  compression?: DasAssetCompression;
  grouping?: DasAssetGrouping[];
  royalty?: DasAssetRoyalty;
  supply?: DasAssetSupply;
  burnt?: DasAssetBurnt;
  authorities?: DasAssetAuthorities[];
  mutable?: boolean;
  mint_extensions?: Record<string, unknown>;
}

export interface DasAssetProof {
  root?: string;
  proof?: string[];
  node_index?: number;
  leaf?: string;
  tree_id?: PublicKeyString;
}

export interface DasAssetResponse {
  context?: DasContext;
  result: DasAsset | null;
}

export interface DasAssetProofResponse {
  context?: DasContext;
  result: DasAssetProof | null;
}

export interface DasAssetBatchResponse {
  context?: DasContext;
  result: DasAsset[];
}

export interface DasSearchAssetsRequest extends RpcPaginationOptions, RpcSortOptions {
  ownerAddress?: PublicKeyString;
  creatorAddress?: PublicKeyString;
  authorityAddress?: PublicKeyString;
  grouping?: DasAssetGrouping;
  burnt?: boolean;
  compressed?: boolean;
  frozen?: boolean;
  supply?: number;
  interface?: string;
  jsonUri?: string;
  name?: string;
  page?: number;
  limit?: number;
}

export interface DasSearchAssetsResponse {
  context?: DasContext;
  result: {
    total: number;
    limit: number;
    page: number;
    items: DasAsset[];
  };
}

export interface DasAssetsByOwnerResponse {
  context?: DasContext;
  result: {
    total: number;
    limit: number;
    page: number;
    items: DasAsset[];
  };
}

export interface DasAssetsByGroupResponse {
  context?: DasContext;
  result: {
    total: number;
    limit: number;
    page: number;
    items: DasAsset[];
  };
}
