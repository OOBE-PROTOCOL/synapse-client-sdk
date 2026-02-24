/**
 * @module das/methods/get-asset
 * @description Fetches a single DAS asset by its ID via the Metaplex Read API.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAsset, DasOpts } from '../types';

/**
 * Fetch a single digital asset by its unique identifier.
 *
 * @param t - HTTP transport instance
 * @param id - Base-58 encoded asset public key
 * @param opts - Commitment level and call options
 * @returns The full DAS asset object
 *
 * @example
 * ```ts
 * const asset = await getAsset(transport, 'So1111...');
 * console.log(asset.content.metadata?.name);
 * ```
 *
 * @since 1.0.0
 */
export async function getAsset(
  t: HttpTransport,
  id: Pubkey,
  opts: DasOpts & CallOptions = {}
): Promise<DasAsset> {
  const { commitment, ...rest } = opts;
  return t.request('getAsset', [{ id, ...(commitment ? { commitment } : {}) }], rest);
}
