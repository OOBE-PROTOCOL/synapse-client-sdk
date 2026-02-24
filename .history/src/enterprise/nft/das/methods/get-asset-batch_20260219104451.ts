import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasAssetBatchResponse, DasRequestOptions } from '../types';
import type { PublicKeyString } from '../../../solana/types';

export const getAssetBatch = (
  client: RpcGatewayClient,
  ids: PublicKeyString[],
  options: DasRequestOptions = {}
): Promise<DasAssetBatchResponse> => {
  return client.call<DasAssetBatchResponse>('getAssetBatch', [{ ids, ...options }]);
};
