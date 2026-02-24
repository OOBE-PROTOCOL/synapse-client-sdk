/**
 * @module rpc/methods/get-stake-activation
 * @description Returns epoch activation information for a stake account.
 * @deprecated Deprecated in solana-core v2.0. Use the alternative approach at
 * {@link https://github.com/solana-developers/solana-rpc-get-stake-activation}.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment } from '../../core/types';

/**
 * Fetch epoch activation information for a stake account.
 *
 * @deprecated Deprecated in solana-core v2.0.
 *
 * @param t - HTTP transport instance
 * @param stakeAccount - Base-58 encoded stake account public key
 * @param opts - Commitment, epoch, and call options
 * @returns Object containing activation state, active, and inactive balances
 *
 * @example
 * ```ts
 * const info = await getStakeActivation(transport, stakeAccountPubkey);
 * console.log(info.state); // 'active' | 'inactive' | 'activating' | 'deactivating'
 * ```
 *
 * @since 1.0.0
 */
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
