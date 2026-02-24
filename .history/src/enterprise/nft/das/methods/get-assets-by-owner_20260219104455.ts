import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasAssetsByOwnerResponse, DasRequestOptions } from '../types';
import type { PublicKeyString, RpcPaginationOptions } from '../../../solana/types';

export interface GetAssetsByOwnerParams extends RpcPaginationOptions {
  ownerAddress: PublicKeyString;
  before?: string;
  after?: string;
  sortBy?: string;
}

export const getAssetsByOwner = (
  client: RpcGatewayClient,
  params: GetAssetsByOwnerParams,
  options: DasRequestOptions = {}
): Promise<DasAssetsByOwnerResponse> => {
  return client.call<DasAssetsByOwnerResponse>('getAssetsByOwner', [{ ...params, ...options }]);
};
