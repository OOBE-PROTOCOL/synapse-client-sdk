/**
 * @module rpc/methods/get-vote-accounts
 * @description Returns the account info and associated stake for all voting accounts.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, VoteAccountsResult } from '../../core/types';

/**
 * Fetch the account info and associated stake for all voting accounts.
 *
 * @param t - HTTP transport instance
 * @param opts - Commitment, vote-pubkey filter, delinquent options, and call options
 * @returns Object containing current and delinquent vote account arrays
 *
 * @example
 * ```ts
 * const result = await getVoteAccounts(transport);
 * console.log(result.current.length, result.delinquent.length);
 * ```
 *
 * @since 1.0.0
 */
export async function getVoteAccounts(
  t: HttpTransport,
  opts: CallOptions & {
    commitment?: Commitment;
    votePubkey?: Pubkey;
    keepUnstakedDelinquents?: boolean;
    delinquentSlotDistance?: number;
  } = {}
): Promise<VoteAccountsResult> {
  const { commitment, votePubkey, keepUnstakedDelinquents, delinquentSlotDistance, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (votePubkey) cfg.votePubkey = votePubkey;
  if (keepUnstakedDelinquents != null) cfg.keepUnstakedDelinquents = keepUnstakedDelinquents;
  if (delinquentSlotDistance != null) cfg.delinquentSlotDistance = delinquentSlotDistance;
  return t.request('getVoteAccounts', [cfg], rest);
}
