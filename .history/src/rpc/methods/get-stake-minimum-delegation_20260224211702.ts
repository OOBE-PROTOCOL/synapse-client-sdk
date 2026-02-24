/**
 * @module rpc/methods/get-stake-minimum-delegation
 * @description Returns the stake minimum delegation amount in lamports.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

/**
 * Fetch the minimum delegation amount for stake accounts.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Minimum delegation in lamports, wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getStakeMinimumDelegation(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getStakeMinimumDelegation(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<number>> {
  return t.request('getStakeMinimumDelegation', [{ commitment }], opts);
}
