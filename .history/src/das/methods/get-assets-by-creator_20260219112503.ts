import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

export interface GetAssetsByCreatorParams {
  creatorAddress: Pubkey;
  onlyVerified?: boolean;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
  showCollectionMetadata?: boolean;
  showUnverifiedCollections?: boolean;
}

export async function getAssetsByCreator(
  t: HttpTransport,
  params: GetAssetsByCreatorParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByCreator', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
