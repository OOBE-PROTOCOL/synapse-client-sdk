/**
 * @module rpc/methods/get-recent-prioritization-fees
 * @description Returns a list of recent prioritization fees observed in the cluster.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey } from '../../core/types';

/**
 * Fetch recent prioritization fees observed in the cluster.
 *
 * @param t - HTTP transport instance
 * @param addresses - Optional array of account addresses to filter by
 * @param opts - Additional call options
 * @returns Array of objects containing slot and prioritization fee
 *
 * @example
 * ```ts
 * const fees = await getRecentPrioritizationFees(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getRecentPrioritizationFees(
  t: HttpTransport,
  addresses?: Pubkey[],
  opts: CallOptions = {}
): Promise<{ slot: Slot; prioritizationFee: number }[]> {
  return t.request('getRecentPrioritizationFees', addresses ? [addresses] : [], opts);
}
