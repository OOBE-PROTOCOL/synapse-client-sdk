/**
 * getMaxShredInsertSlot — returns the max slot seen from after shred insert.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function getMaxShredInsertSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getMaxShredInsertSlot', [], opts);
}
