/**
 * @module rpc/methods/get-transaction-count
 * @description Returns the current transaction count from the ledger.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

/**
 * Fetch the current transaction count from the ledger.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Total number of transactions processed by the ledger
 *
 * @example
 * ```ts
 * const count = await getTransactionCount(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getTransactionCount(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<number> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getTransactionCount', [cfg], rest);
}
