/**
 * @module rpc/methods/get-latest-blockhash
 * @description Returns the latest blockhash and its last valid block height.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

/**
 * The blockhash value and its last valid block height.
 *
 * @since 1.0.0
 */
export interface BlockhashResult {
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Fetch the latest blockhash and its last valid block height.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Context-wrapped blockhash result
 *
 * @example
 * ```ts
 * const { value } = await getLatestBlockhash(transport);
 * console.log(`Blockhash: ${value.blockhash}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getLatestBlockhash(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<BlockhashResult>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getLatestBlockhash', [cfg], rest);
}
