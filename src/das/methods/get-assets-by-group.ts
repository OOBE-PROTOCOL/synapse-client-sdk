/**
 * @module das/methods/get-assets-by-group
 * @description Fetches all digital assets belonging to a specific group (e.g. a collection).
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasPage, DasAsset, DasOpts, DasSortBy, DasSortDirection } from '../types';

/**
 * Parameters for fetching assets by group (e.g. collection).
 * @since 1.0.0
 */
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

/**
 * Fetch all digital assets belonging to a specific group.
 *
 * @param t - HTTP transport instance
 * @param params - Group key/value pair and pagination/display options
 * @param opts - Commitment level and call options
 * @returns Paginated list of assets in the group
 *
 * @example
 * ```ts
 * const page = await getAssetsByGroup(transport, {
 *   groupKey: 'collection',
 *   groupValue: 'CollectionPubkey...',
 * });
 * console.log(page.total);
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetsByGroup(
  t: HttpTransport,
  params: GetAssetsByGroupParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetsByGroup', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
