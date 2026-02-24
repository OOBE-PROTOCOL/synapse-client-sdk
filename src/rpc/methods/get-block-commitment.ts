/**
 * @module rpc/methods/get-block-commitment
 * @description Returns the commitment for a particular block (slot).
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the commitment status for a particular block (slot).
 *
 * @param t - HTTP transport instance
 * @param slot - Slot number to query commitment for
 * @param opts - Additional call options
 * @returns Object containing the commitment array and total active stake
 *
 * @example
 * ```ts
 * const { commitment, totalStake } = await getBlockCommitment(transport, 100_000);
 * console.log(`Total stake: ${totalStake}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getBlockCommitment(
  t: HttpTransport,
  slot: Slot,
  opts: CallOptions = {}
): Promise<{ commitment: number[] | null; totalStake: number }> {
  return t.request('getBlockCommitment', [slot], opts);
}
