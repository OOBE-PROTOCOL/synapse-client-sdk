/**
 * @module rpc/methods/get-largest-accounts
 * @description Returns the 20 largest accounts by lamport balance.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext } from '../../core/types';

/**
 * Fetch the 20 largest accounts by lamport balance.
 *
 * @param t - HTTP transport instance
 * @param opts - Commitment, filter (`"circulating"` or `"nonCirculating"`), and other call options
 * @returns Context-wrapped array of address/lamport pairs
 *
 * @example
 * ```ts
 * const { value } = await getLargestAccounts(transport, { filter: 'circulating' });
 * value.forEach(a => console.log(`${a.address}: ${a.lamports}`));
 * ```
 *
 * @since 1.0.0
 */
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
