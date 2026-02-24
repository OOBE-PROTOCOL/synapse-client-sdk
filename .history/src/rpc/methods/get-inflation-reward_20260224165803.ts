/**
 * @module rpc/methods/get-inflation-reward
 * @description Returns the inflation / staking reward for a list of addresses for an epoch.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Epoch, Slot, Commitment, InflationReward } from '../../core/types';

/**
 * Fetch inflation / staking rewards for a list of addresses for an epoch.
 *
 * @param t - HTTP transport instance
 * @param addresses - Array of base-58 encoded public keys to query rewards for
 * @param opts - Epoch, commitment, minContextSlot, and other call options
 * @returns Array of inflation reward objects (or `null` for addresses with no reward)
 *
 * @example
 * ```ts
 * const rewards = await getInflationReward(transport, [validator1, validator2]);
 * rewards.forEach(r => r && console.log(`Reward: ${r.amount} lamports`));
 * ```
 *
 * @since 1.0.0
 */
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
