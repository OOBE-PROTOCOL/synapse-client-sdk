/**
 * getRecentPrioritizationFees — returns recent prioritization fees.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey } from '../../core/types';

export async function getRecentPrioritizationFees(
  t: HttpTransport,
  addresses?: Pubkey[],
  opts: CallOptions = {}
): Promise<{ slot: Slot; prioritizationFee: number }[]> {
  return t.request('getRecentPrioritizationFees', addresses ? [addresses] : [], opts);
}
