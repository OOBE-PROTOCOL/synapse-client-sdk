/**
 * getLargestAccounts — returns the 20 largest accounts, by lamport balance.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext } from '../../core/types';

export async function getLargestAccounts(
  t: HttpTransport,
  opts: CallOptions & { commitment?: Commitment; filter?: 'circulating' | 'nonCirculating' } = {}
): Promise<RpcContext<{ address: Pubkey; lamports: number }[]>> {
  const { commitment, filter, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (filter) cfg.filter = filter;
  return t.request('getLargestAccounts', [cfg], rest);
}
