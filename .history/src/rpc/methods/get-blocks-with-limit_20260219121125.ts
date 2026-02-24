/**
 * getBlocksWithLimit — returns a list of confirmed blocks starting at the given slot for up to `limit` blocks.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment } from '../../core/types';

export async function getBlocksWithLimit(
  t: HttpTransport,
  startSlot: Slot,
  limit: number,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<Slot[]> {
  return t.request('getBlocksWithLimit', [startSlot, limit, { commitment }], opts);
}
