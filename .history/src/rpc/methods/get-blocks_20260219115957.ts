/**
 * getBlocks — returns a list of confirmed blocks between two slots.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment } from '../../core/types';

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
