/**
 * @module rpc/methods/get-minimum-balance-for-rent-exemption
 * @description Returns the minimum balance required to make an account rent-exempt.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

/**
 * Fetch the minimum lamport balance required to make an account with
 * the given data length rent-exempt.
 *
 * @param t - HTTP transport instance
 * @param dataLength - Size of the account data in bytes
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Minimum balance in lamports
 *
 * @example
 * ```ts
 * const lamports = await getMinimumBalanceForRentExemption(transport, 165);
 * ```
 *
 * @since 1.0.0
 */
export async function getMinimumBalanceForRentExemption(
  t: HttpTransport,
  dataLength: number,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<number> {
  return t.request('getMinimumBalanceForRentExemption', [dataLength, { commitment }], opts);
}
