/**
 * @module rpc/methods/get-supply
 * @description Returns information about the current supply of SOL.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext, Supply } from '../../core/types';

/**
 * Fetch information about the current supply of SOL.
 *
 * @param t - HTTP transport instance
 * @param opts - Commitment, supply filtering, and call options
 * @returns Supply information wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getSupply(transport);
 * console.log(value.total, value.circulating);
 * ```
 *
 * @since 1.0.0
 */
export async function getSupply(
  t: HttpTransport,
  opts: CallOptions & { commitment?: Commitment; excludeNonCirculatingAccountsList?: boolean } = {}
): Promise<RpcContext<Supply>> {
  const { commitment, excludeNonCirculatingAccountsList, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (excludeNonCirculatingAccountsList != null) cfg.excludeNonCirculatingAccountsList = excludeNonCirculatingAccountsList;
  return t.request('getSupply', [cfg], rest);
}
