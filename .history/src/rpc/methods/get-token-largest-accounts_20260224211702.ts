/**
 * @module rpc/methods/get-token-largest-accounts
 * @description Returns the 20 largest accounts of a particular SPL Token type.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext } from '../../core/types';

/**
 * Fetch the 20 largest accounts for a given SPL Token mint.
 *
 * @param t - HTTP transport instance
 * @param mint - Base-58 encoded mint public key
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Array of largest token account holders wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getTokenLargestAccounts(transport, mintPubkey);
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenLargestAccounts(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<{ address: Pubkey; amount: string; decimals: number; uiAmount: number | null; uiAmountString: string }[]>> {
  return t.request('getTokenLargestAccounts', [mint, { commitment }], opts);
}
