import type { RpcGatewayClient } from '../../../rpc/rpc-client';
import type { DasAssetProofResponse, DasRequestOptions } from '../types';
import type { PublicKeyString } from '../../../solana/types';

export const getAssetProof = (
  client: RpcGatewayClient,
  id: PublicKeyString,
  options: DasRequestOptions = {}
): Promise<DasAssetProofResponse> => {
  return client.call<DasAssetProofResponse>('getAssetProof', [{ id, ...options }]);
};
