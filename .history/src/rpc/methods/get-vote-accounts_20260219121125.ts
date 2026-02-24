/**
 * getVoteAccounts — returns the account info and associated stake for all voting accounts.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, VoteAccountsResult } from '../../core/types';

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
