/**
 * @module rpc/methods/get-token-account-balance
 * @description Returns the token balance of an SPL Token account.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAmount } from '../../core/types';

/**
 * Fetch the token balance of an SPL Token account.
 *
 * @param t - HTTP transport instance
 * @param tokenAccount - Base-58 encoded public key of the token account
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Token amount details wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getTokenAccountBalance(transport, tokenAccountPubkey);
 * console.log(value.uiAmountString);
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenAccountBalance(
  t: HttpTransport,
  tokenAccount: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenAccountBalance', [tokenAccount, { commitment }], opts);
}
