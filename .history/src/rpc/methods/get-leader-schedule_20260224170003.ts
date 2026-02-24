/**
 * @module rpc/methods/get-leader-schedule
 * @description Returns the leader schedule for an epoch.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Pubkey, Commitment } from '../../core/types';

/**
 * Fetch the leader schedule for a given epoch.
 *
 * @param t - HTTP transport instance
 * @param slot - Fetch the leader schedule for the epoch that corresponds to the provided slot. If unspecified, the leader schedule for the current epoch is fetched
 * @param opts - Optional commitment, identity filter, and call options
 * @returns A mapping of validator identities to their leader slot indices, or `null` if unavailable
 *
 * @example
 * ```ts
 * const schedule = await getLeaderSchedule(transport);
 * ```
 *
 * @since 1.0.0
 */
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
