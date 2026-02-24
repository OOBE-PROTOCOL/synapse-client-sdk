import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

export interface GetAssetsByOwnerParams {
  ownerAddress: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
  showFungible?: boolean;
  showNativeBalance?: boolean;
  showInscription?: boolean;
  showCollectionMetadata?: boolean;
  showZeroBalance?: boolean;
  showUnverifiedCollections?: boolean;
}

export async function getAssetsByOwner(
  t: HttpTransport,
  params: GetAssetsByOwnerParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByOwner', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
