/**
 * getTokenLargestAccounts — returns the 20 largest accounts of a particular SPL Token type.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext } from '../../core/types';

export async function getTokenLargestAccounts(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<{ address: Pubkey; amount: string; decimals: number; uiAmount: number | null; uiAmountString: string }[]>> {
  return t.request('getTokenLargestAccounts', [mint, { commitment }], opts);
}
