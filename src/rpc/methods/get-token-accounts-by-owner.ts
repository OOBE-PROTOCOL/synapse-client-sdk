/**
 * @module rpc/methods/get-token-accounts-by-owner
 * @description Returns all SPL Token accounts by token owner.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAccount, DataSlice } from '../../core/types';

/**
 * Fetch all SPL Token accounts owned by the given address.
 *
 * @param t - HTTP transport instance
 * @param owner - Base-58 encoded owner public key
 * @param filter - Filter by either `{ mint }` or `{ programId }`
 * @param opts - Commitment, data-slice, and call options
 * @returns Array of token accounts wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getTokenAccountsByOwner(transport, owner, { mint });
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenAccountsByOwner(
  t: HttpTransport,
  owner: Pubkey,
  filter: { mint: Pubkey } | { programId: Pubkey },
  opts: CallOptions & { commitment?: Commitment; minContextSlot?: number; dataSlice?: DataSlice } = {}
): Promise<RpcContext<TokenAccount[]>> {
  const { commitment = 'confirmed', minContextSlot, dataSlice, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment, encoding: 'jsonParsed' };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  if (dataSlice) cfg.dataSlice = dataSlice;
  return t.request('getTokenAccountsByOwner', [owner, filter, cfg], rest);
}
