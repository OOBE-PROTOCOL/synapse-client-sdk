/**
 * getSlotLeaders — returns the slot leaders for a given slot range.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey } from '../../core/types';

export async function getSlotLeaders(
  t: HttpTransport,
  startSlot: Slot,
  limit: number,
  opts: CallOptions = {}
): Promise<Pubkey[]> {
  return t.request('getSlotLeaders', [startSlot, limit], opts);
}
