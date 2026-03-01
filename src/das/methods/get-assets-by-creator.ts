/**
 * @module das/methods/get-assets-by-creator
 * @description Fetches all digital assets created by a given creator address.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

/**
 * Parameters for fetching assets by creator.
 * @since 1.0.0
 */
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

/**
 * Fetch all digital assets created by a given creator address.
 *
 * @param t - HTTP transport instance
 * @param params - Creator address, verification filter, and pagination options
 * @param opts - Commitment level and call options
 * @returns Paginated list of assets by the creator
 *
 * @example
 * ```ts
 * const page = await getAssetsByCreator(transport, {
 *   creatorAddress: 'Creator111...',
 *   onlyVerified: true,
 * });
 * console.log(page.items.map(a => a.id));
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetsByCreator(
  t: HttpTransport,
  params: GetAssetsByCreatorParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByCreator', { ...params, ...(commitment ? { commitment } : {}) }, rest);
}
