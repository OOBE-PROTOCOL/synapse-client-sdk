/**
 * @module rpc/methods/get-slot-leader
 * @description Returns the identity public key of the current slot leader.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment } from '../../core/types';

/**
 * Fetch the identity public key of the current slot leader.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Base-58 encoded public key of the current slot leader
 *
 * @example
 * ```ts
 * const leader = await getSlotLeader(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getSlotLeader(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<Pubkey> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getSlotLeader', [cfg], rest);
}
