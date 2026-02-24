/**
 * getFirstAvailableBlock — returns the slot of the lowest confirmed block that has not been purged.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function getFirstAvailableBlock(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getFirstAvailableBlock', [], opts);
}
