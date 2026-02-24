/**
 * @module rpc/methods/get-token-supply
 * @description Returns the total supply of an SPL Token type.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAmount } from '../../core/types';

/**
 * Fetch the total supply of an SPL Token mint.
 *
 * @param t - HTTP transport instance
 * @param mint - Base-58 encoded mint public key
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Token supply details wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getTokenSupply(transport, mintPubkey);
 * console.log(value.uiAmountString);
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenSupply(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenSupply', [mint, { commitment }], opts);
}
