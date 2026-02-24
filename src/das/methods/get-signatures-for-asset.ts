/**
 * @module das/methods/get-signatures-for-asset
 * @description Fetches transaction signatures associated with a digital asset.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasOpts } from '../types';
import type { Pubkey } from '../../core/types';

/**
 * Parameters for fetching transaction signatures of a digital asset.
 * @since 1.0.0
 */
export interface SignaturesForAssetParams {
  id: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * A single transaction signature entry for an asset.
 * @since 1.0.0
 */
export interface AssetSignatureInfo {
  signature: string;
  type?: string;
  slot?: number;
}

/**
 * Paginated list of transaction signatures for an asset.
 * @since 1.0.0
 */
export interface AssetSignaturesPage {
  total: number;
  limit: number;
  page: number;
  items: AssetSignatureInfo[];
}

/**
 * Fetch transaction signatures associated with a digital asset.
 *
 * @param t - HTTP transport instance
 * @param params - Asset ID and pagination/sorting options
 * @param opts - Commitment level and call options
 * @returns Paginated list of transaction signatures for the asset
 *
 * @example
 * ```ts
 * const sigs = await getSignaturesForAsset(transport, {
 *   id: 'Asset111...',
 *   page: 1,
 * });
 * sigs.items.forEach(s => console.log(s.signature));
 * ```
 *
 * @since 1.0.0
 */
export async function getSignaturesForAsset(
  t: HttpTransport,
  params: SignaturesForAssetParams,
  opts: DasOpts & CallOptions = {}
): Promise<AssetSignaturesPage> {
  const { commitment, ...rest } = opts;
  return t.request('getSignaturesForAsset', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
