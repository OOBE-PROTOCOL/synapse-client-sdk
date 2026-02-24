/**
 * @module rpc/methods/get-slot-leaders
 * @description Returns the slot leaders for a given slot range.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey } from '../../core/types';

/**
 * Fetch the slot leaders for a given slot range.
 *
 * @param t - HTTP transport instance
 * @param startSlot - Start slot (inclusive)
 * @param limit - Number of leaders to return (between 1 and 5000)
 * @param opts - Additional call options
 * @returns Array of base-58 encoded validator identity public keys
 *
 * @example
 * ```ts
 * const leaders = await getSlotLeaders(transport, 100, 10);
 * ```
 *
 * @since 1.0.0
 */
export async function getSlotLeaders(
  t: HttpTransport,
  startSlot: Slot,
  limit: number,
  opts: CallOptions = {}
): Promise<Pubkey[]> {
  return t.request('getSlotLeaders', [startSlot, limit], opts);
}
