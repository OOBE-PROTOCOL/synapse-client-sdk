/**
 * getTokenAccountBalance — returns the token balance of an SPL Token account.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAmount } from '../../core/types';

export async function getTokenAccountBalance(
  t: HttpTransport,
  tokenAccount: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenAccountBalance', [tokenAccount, { commitment }], opts);
}
