/**
 * getBlockTime — returns estimated production time for a block.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, UnixTimestamp } from '../../core/types';

export async function getBlockTime(
  t: HttpTransport,
  slot: Slot,
  opts: CallOptions = {}
): Promise<UnixTimestamp | null> {
  return t.request('getBlockTime', [slot], opts);
}
