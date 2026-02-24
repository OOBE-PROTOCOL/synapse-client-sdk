/**
 * getMinimumBalanceForRentExemption — returns minimum balance required for rent exemption.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

export async function getMinimumBalanceForRentExemption(
  t: HttpTransport,
  dataLength: number,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<number> {
  return t.request('getMinimumBalanceForRentExemption', [dataLength, { commitment }], opts);
}
