/**
 * @module rpc/methods/get-block-height
 * @description Returns the current block height of the node.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

/**
 * Fetch the current block height of the node.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns The current block height
 *
 * @example
 * ```ts
 * const height = await getBlockHeight(transport);
 * console.log(`Current block height: ${height}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getBlockHeight(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<number> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getBlockHeight', [cfg], rest);
}
