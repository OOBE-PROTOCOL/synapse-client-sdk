/**
 * getTokenAccountsByOwner — returns all SPL Token accounts by token owner.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAccount, DataSlice } from '../../core/types';

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
