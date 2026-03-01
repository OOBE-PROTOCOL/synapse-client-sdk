/**
 * @module das/methods/get-asset-proof-batch
 * @description Fetches Merkle proofs for multiple compressed DAS assets in one request.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAssetProof, DasOpts } from '../types';

/**
 * Fetch Merkle proofs for multiple compressed digital assets in a single batch call.
 *
 * @param t - HTTP transport instance
 * @param ids - Array of base-58 encoded asset public keys
 * @param opts - Commitment level and call options
 * @returns Record mapping each asset ID to its Merkle proof
 *
 * @example
 * ```ts
 * const proofs = await getAssetProofBatch(transport, [id1, id2]);
 * console.log(proofs[id1].root);
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetProofBatch(
  t: HttpTransport,
  ids: Pubkey[],
  opts: DasOpts & CallOptions = {}
): Promise<Record<string, DasAssetProof>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetProofBatch', { ids, ...(commitment ? { commitment } : {}) }, rest);
}
