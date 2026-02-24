/**
 * @module das/methods/get-asset-proof
 * @description Fetches the Merkle proof for a compressed DAS asset.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAssetProof, DasOpts } from '../types';

/**
 * Fetch the Merkle proof for a compressed digital asset.
 *
 * @param t - HTTP transport instance
 * @param id - Base-58 encoded asset public key
 * @param opts - Commitment level and call options
 * @returns The Merkle proof containing root, proof nodes, leaf, and tree ID
 *
 * @example
 * ```ts
 * const proof = await getAssetProof(transport, assetId);
 * console.log(proof.root, proof.proof.length);
 * ```
 *
 * @since 1.0.0
 */
export async function getAssetProof(
  t: HttpTransport,
  id: Pubkey,
  opts: DasOpts & CallOptions = {}
): Promise<DasAssetProof> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetProof', [{ id, ...(commitment ? { commitment } : {}) }], rest);
}
