import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasAssetResponse, DasRequestOptions } from '../types';
import type { PublicKeyString } from '../../../solana/types';

export const getAsset = (
  client: RpcGatewayClient,
  id: PublicKeyString,
  options: DasRequestOptions = {}
): Promise<DasAssetResponse> => {
  return client.call<DasAssetResponse>('getAsset', [{ id, ...options }]);
};
