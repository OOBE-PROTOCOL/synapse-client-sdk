import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

export interface GetAssetsByAuthorityParams {
  authorityAddress: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
}

export async function getAssetsByAuthority(
  t: HttpTransport,
  params: GetAssetsByAuthorityParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByAuthority', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
