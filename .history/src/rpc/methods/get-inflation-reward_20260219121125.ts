/**
 * getInflationReward — returns the inflation/staking reward for a list of addresses.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Epoch, Slot, Commitment, InflationReward } from '../../core/types';

export async function getInflationReward(
  t: HttpTransport,
  addresses: Pubkey[],
  opts: CallOptions & { epoch?: Epoch; commitment?: Commitment; minContextSlot?: Slot } = {}
): Promise<(InflationReward | null)[]> {
  const { epoch, commitment, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (epoch != null) cfg.epoch = epoch;
  if (commitment) cfg.commitment = commitment;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getInflationReward', [addresses, cfg], rest);
}
