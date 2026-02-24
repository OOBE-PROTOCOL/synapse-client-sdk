/**
 * @module das/methods/get-asset-batch
 * @description Fetches multiple DAS assets in a single batch request.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAsset, DasOpts } from '../types';

/**
 * Fetch multiple digital assets in a single batch RPC call.
 *
 * @param t - HTTP transport instance
 * @param ids - Array of base-58 encoded asset public keys
 * @param opts - Commitment level and call options
 * @returns Array of DAS asset objects
 *
 * @example
 * ```ts
 * const assets = await getAssetBatch(transport, [id1, id2, id3]);
 * assets.forEach(a => console.log(a.id));
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetBatch(
  t: HttpTransport,
  ids: Pubkey[],
  opts: DasOpts & CallOptions = {}
): Promise<DasAsset[]> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetBatch', [{ ids, ...(commitment ? { commitment } : {}) }], rest);
}
