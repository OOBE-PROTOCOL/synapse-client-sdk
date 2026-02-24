import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasSearchAssetsRequest, DasSearchAssetsResponse, DasRequestOptions } from '../types';

export const searchAssets = (
  client: RpcGatewayClient,
  params: DasSearchAssetsRequest,
  options: DasRequestOptions = {}
): Promise<DasSearchAssetsResponse> => {
  return client.call<DasSearchAssetsResponse>('searchAssets', [{ ...params, ...options }]);
};
