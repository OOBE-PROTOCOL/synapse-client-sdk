/**
 * @module rpc/methods/get-slot
 * @description Returns the slot that has reached the given commitment level.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment } from '../../core/types';

/**
 * Fetch the current slot the node is processing.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Current slot number
 *
 * @example
 * ```ts
 * const slot = await getSlot(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getSlot(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<Slot> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getSlot', [cfg], rest);
}
