/**
 * getBlockProduction — leader schedule & block production stats.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment, BlockProduction, RpcContext, Pubkey } from '../../core/types';

export interface GetBlockProductionOpts extends CallOptions {
  commitment?: Commitment;
  range?: { firstSlot: Slot; lastSlot?: Slot };
  identity?: Pubkey;
}

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
