/**
 * @module das/methods/get-assets-by-owner
 * @description Fetches all digital assets owned by a specific wallet address.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

/**
 * Parameters for fetching assets by owner.
 * @since 1.0.0
 */
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

/**
 * Fetch all digital assets owned by a given wallet address.
 *
 * @param t - HTTP transport instance
 * @param params - Owner address and pagination/display options
 * @param opts - Commitment level and call options
 * @returns Paginated list of assets owned by the address
 *
 * @example
 * ```ts
 * const page = await getAssetsByOwner(transport, {
 *   ownerAddress: 'So1111...',
 *   page: 1,
 *   limit: 100,
 * });
 * console.log(page.total, page.items.length);
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetsByOwner(
  t: HttpTransport,
  params: GetAssetsByOwnerParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByOwner', { ...params, ...(commitment ? { commitment } : {}) }, rest);
}
