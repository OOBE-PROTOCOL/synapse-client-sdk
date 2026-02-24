/**
 * @module rpc/methods/get-blocks
 * @description Returns a list of confirmed blocks between two slot numbers.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment } from '../../core/types';

/**
 * Fetch a list of confirmed blocks between two slot numbers.
 *
 * @param t - HTTP transport instance
 * @param startSlot - Start slot (inclusive)
 * @param endSlot - End slot (inclusive); omit to use the latest confirmed slot
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Array of confirmed slot numbers in the range
 *
 * @example
 * ```ts
 * const slots = await getBlocks(transport, 100_000, 100_010);
 * console.log(`Confirmed blocks: ${slots}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getBlocks(
  t: HttpTransport,
  startSlot: Slot,
  endSlot?: Slot,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<Slot[]> {
  const params: unknown[] = endSlot != null
    ? [startSlot, endSlot, { commitment }]
    : [startSlot, { commitment }];
  return t.request('getBlocks', params, opts);
}
