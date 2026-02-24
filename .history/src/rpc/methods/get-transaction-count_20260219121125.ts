/**
 * getTransactionCount — returns the current transaction count from the ledger.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

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
