import type { RpcGatewayClient } from '../../rpc/rpc-client';
import type { PublicKeyString } from '../../solana/types';
import type {
  DasAssetBatchResponse,
  DasAssetProofResponse,
  DasAssetResponse,
  DasAssetsByGroupResponse,
  DasAssetsByOwnerResponse,
  DasRequestOptions,
  DasSearchAssetsRequest,
  DasSearchAssetsResponse
} from './types';
import { getAsset } from './methods/get-asset';
import { getAssetBatch } from './methods/get-asset-batch';
import { getAssetProof } from './methods/get-asset-proof';
import { getAssetsByGroup, type GetAssetsByGroupParams } from './methods/get-assets-by-group';
import { getAssetsByOwner, type GetAssetsByOwnerParams } from './methods/get-assets-by-owner';
import { searchAssets } from './methods/search-assets';

export class DasClient {
  constructor(private rpc: RpcGatewayClient) {}

  getAsset(id: PublicKeyString, options: DasRequestOptions = {}): Promise<DasAssetResponse> {
    return getAsset(this.rpc, id, options);
  }

  getAssetProof(id: PublicKeyString, options: DasRequestOptions = {}): Promise<DasAssetProofResponse> {
    return getAssetProof(this.rpc, id, options);
  }

  getAssetBatch(ids: PublicKeyString[], options: DasRequestOptions = {}): Promise<DasAssetBatchResponse> {
    return getAssetBatch(this.rpc, ids, options);
  }

  getAssetsByOwner(params: GetAssetsByOwnerParams, options: DasRequestOptions = {}): Promise<DasAssetsByOwnerResponse> {
    return getAssetsByOwner(this.rpc, params, options);
  }

  getAssetsByGroup(params: GetAssetsByGroupParams, options: DasRequestOptions = {}): Promise<DasAssetsByGroupResponse> {
    return getAssetsByGroup(this.rpc, params, options);
  }

  searchAssets(params: DasSearchAssetsRequest, options: DasRequestOptions = {}): Promise<DasSearchAssetsResponse> {
    return searchAssets(this.rpc, params, options);
  }
}
