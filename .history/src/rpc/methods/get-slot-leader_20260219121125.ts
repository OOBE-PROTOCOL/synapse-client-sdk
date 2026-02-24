/**
 * getSlotLeader — returns the current slot leader.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment } from '../../core/types';

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
