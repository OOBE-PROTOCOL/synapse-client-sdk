/**
 * getLeaderSchedule — returns the leader schedule for an epoch.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey, Commitment } from '../../core/types';

export async function getLeaderSchedule(
  t: HttpTransport,
  slot?: Slot,
  opts: CallOptions & { commitment?: Commitment; identity?: Pubkey } = {}
): Promise<Record<Pubkey, number[]> | null> {
  const { commitment, identity, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (identity) cfg.identity = identity;
  return t.request('getLeaderSchedule', [slot ?? null, cfg], rest);
}
