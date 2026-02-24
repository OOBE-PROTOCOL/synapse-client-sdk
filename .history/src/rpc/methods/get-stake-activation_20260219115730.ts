/**
 * getStakeActivation — returns epoch activation information for a stake account.
 * @deprecated Deprecated in solana-core v2.0. Use alternative approach:
 * https://github.com/solana-developers/solana-rpc-get-stake-activation
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment } from '../../core/types';

export async function getStakeActivation(
  t: HttpTransport,
  stakeAccount: Pubkey,
  opts: CallOptions & { commitment?: Commitment; epoch?: number; minContextSlot?: number } = {}
): Promise<{ state: 'active' | 'inactive' | 'activating' | 'deactivating'; active: number; inactive: number }> {
  const { commitment, epoch, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (epoch != null) cfg.epoch = epoch;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getStakeActivation', [stakeAccount, cfg], rest);
}
