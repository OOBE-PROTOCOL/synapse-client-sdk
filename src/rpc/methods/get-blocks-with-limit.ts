/**
 * @module rpc/methods/get-blocks-with-limit
 * @description Returns a list of confirmed blocks starting at a given slot, up to a specified limit.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment } from '../../core/types';

/**
 * Fetch a list of confirmed blocks starting at a given slot, up to a specified limit.
 *
 * @param t - HTTP transport instance
 * @param startSlot - Start slot (inclusive)
 * @param limit - Maximum number of blocks to return
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Array of confirmed slot numbers
 *
 * @example
 * ```ts
 * const slots = await getBlocksWithLimit(transport, 100_000, 10);
 * console.log(`Found ${slots.length} blocks`);
 * ```
 *
 * @since 1.0.0
 */
export async function getBlocksWithLimit(
  t: HttpTransport,
  startSlot: Slot,
  limit: number,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<Slot[]> {
  return t.request('getBlocksWithLimit', [startSlot, limit, { commitment }], opts);
}
