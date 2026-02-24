/**
 * getBalance — returns lamport balance for a pubkey.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Lamports, RpcContext } from '../../core/types';

export async function getBalance(
  t: HttpTransport,
  pubkey: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<Lamports>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getBalance', [pubkey, cfg], rest);
}
