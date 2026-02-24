/**
 * @module rpc/methods/get-block-production
 * @description Returns recent block production information from the current or previous epoch.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment, BlockProduction, RpcContext, Pubkey } from '../../core/types';

/**
 * Options for {@link getBlockProduction}.
 *
 * @since 1.0.0
 */
export interface GetBlockProductionOpts extends CallOptions {
  commitment?: Commitment;
  range?: { firstSlot: Slot; lastSlot?: Slot };
  identity?: Pubkey;
}

/**
 * Fetch recent block production information from the current or previous epoch.
 *
 * @param t - HTTP transport instance
 * @param opts - Commitment, slot range, identity filter, and other call options
 * @returns Context-wrapped block production statistics
 *
 * @example
 * ```ts
 * const { context, value } = await getBlockProduction(transport);
 * console.log(value.byIdentity);
 * ```
 *
 * @since 1.0.0
 */
export async function getBlockProduction(
  t: HttpTransport,
  opts: GetBlockProductionOpts = {}
): Promise<RpcContext<BlockProduction>> {
  const { commitment, range, identity, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (range) cfg.range = range;
  if (identity) cfg.identity = identity;
  return t.request('getBlockProduction', [cfg], rest);
}
