/**
 * getBlockCommitment — returns commitment for a particular block.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function getBlockCommitment(
  t: HttpTransport,
  slot: Slot,
  opts: CallOptions = {}
): Promise<{ commitment: number[] | null; totalStake: number }> {
  return t.request('getBlockCommitment', [slot], opts);
}
