/**
 * @module rpc/methods/get-token-accounts-by-delegate
 * @description Returns all SPL Token accounts by approved delegate.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAccount, DataSlice } from '../../core/types';

/**
 * Fetch all SPL Token accounts approved for a given delegate.
 *
 * @param t - HTTP transport instance
 * @param delegate - Base-58 encoded delegate public key
 * @param filter - Filter by either `{ mint }` or `{ programId }`
 * @param opts - Commitment, data-slice, and call options
 * @returns Array of token accounts wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getTokenAccountsByDelegate(transport, delegate, { mint });
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenAccountsByDelegate(
  t: HttpTransport,
  delegate: Pubkey,
  filter: { mint: Pubkey } | { programId: Pubkey },
  opts: CallOptions & { commitment?: Commitment; minContextSlot?: number; dataSlice?: DataSlice } = {}
): Promise<RpcContext<TokenAccount[]>> {
  const { commitment = 'confirmed', minContextSlot, dataSlice, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment, encoding: 'jsonParsed' };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  if (dataSlice) cfg.dataSlice = dataSlice;
  return t.request('getTokenAccountsByDelegate', [delegate, filter, cfg], rest);
}
