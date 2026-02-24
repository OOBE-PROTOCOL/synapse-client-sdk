/**
 * getMaxRetransmitSlot — returns the max slot seen from retransmit stage.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function getMaxRetransmitSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getMaxRetransmitSlot', [], opts);
}
