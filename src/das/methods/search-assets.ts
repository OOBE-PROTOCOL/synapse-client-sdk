/**
 * @module das/methods/search-assets
 * @description Searches for digital assets using flexible filter criteria.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasPage, DasAsset, DasOpts, DasSearchParams } from '../types';

/**
 * Search for digital assets using flexible filter criteria.
 *
 * @param t - HTTP transport instance
 * @param params - Search filters including owner, creator, authority, grouping, etc.
 * @param opts - Commitment level and call options
 * @returns Paginated list of matching assets
 *
 * @example
 * ```ts
 * const page = await searchAssets(transport, {
 *   ownerAddress: 'Owner111...',
 *   compressed: true,
 *   page: 1,
 * });
 * console.log(page.total, page.items.length);
 * ```
 *
 * @since 1.0.0
 */
export async function searchAssets(
  t: HttpTransport,
  params: DasSearchParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('searchAssets', { ...params, ...(commitment ? { commitment } : {}) }, rest);
}
