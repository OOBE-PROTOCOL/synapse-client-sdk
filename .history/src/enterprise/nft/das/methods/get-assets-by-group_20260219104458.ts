import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasAssetsByGroupResponse, DasRequestOptions } from '../types';
import type { RpcPaginationOptions } from '../../../solana/types';

export interface GetAssetsByGroupParams extends RpcPaginationOptions {
  groupKey: string;
  groupValue: string;
  before?: string;
  after?: string;
  sortBy?: string;
}

export const getAssetsByGroup = (
  client: RpcGatewayClient,
  params: GetAssetsByGroupParams,
  options: DasRequestOptions = {}
): Promise<DasAssetsByGroupResponse> => {
  return client.call<DasAssetsByGroupResponse>('getAssetsByGroup', [{ ...params, ...options }]);
};
