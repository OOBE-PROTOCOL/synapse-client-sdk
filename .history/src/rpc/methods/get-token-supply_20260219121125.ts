/**
 * getTokenSupply — returns the total supply of an SPL Token type.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAmount } from '../../core/types';

export async function getTokenSupply(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenSupply', [mint, { commitment }], opts);
}
