import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

export interface GetAssetsByGroupParams {
  groupKey: string;
  groupValue: string;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
  showCollectionMetadata?: boolean;
  showUnverifiedCollections?: boolean;
  showFungible?: boolean;
}

export async function getAssetsByGroup(
  t: HttpTransport,
  params: GetAssetsByGroupParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByGroup', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
