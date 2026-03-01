/**
 * @module das/methods/get-assets-by-authority
 * @description Fetches all digital assets managed by a given authority address.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

/**
 * Parameters for fetching assets by authority.
 * @since 1.0.0
 */
export interface GetAssetsByAuthorityParams {
  authorityAddress: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortBy?: { sortBy: DasSortBy; sortDirection: DasSortDirection };
}

/**
 * Fetch all digital assets managed by a given authority address.
 *
 * @param t - HTTP transport instance
 * @param params - Authority address and pagination/sorting options
 * @param opts - Commitment level and call options
 * @returns Paginated list of assets under the authority
 *
 * @example
 * ```ts
 * const page = await getAssetsByAuthority(transport, {
 *   authorityAddress: 'Auth111...',
 *   page: 1,
 * });
 * console.log(page.total);
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetsByAuthority(
  t: HttpTransport,
  params: GetAssetsByAuthorityParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByAuthority', { ...params, ...(commitment ? { commitment } : {}) }, rest);
}
