/**
 * Slot, Epoch, Leader, Supply, Health — lightweight cluster queries.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type {
  Slot, Epoch, Commitment, EpochInfo, EpochSchedule,
  InflationRate, InflationGovernor, InflationReward, VoteAccountsResult,
  ContactInfo, PerfSample, Supply, Pubkey, RpcContext
} from '../../core/types';

// ── Slot / Epoch ────────────────────────────────────────────────
export async function getSlot(t: HttpTransport, commitment: Commitment = 'confirmed', opts: CallOptions & { minContextSlot?: number } = {}): Promise<Slot> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getSlot', [cfg], rest);
}

export async function getSlotLeader(t: HttpTransport, commitment: Commitment = 'confirmed', opts: CallOptions & { minContextSlot?: number } = {}): Promise<Pubkey> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getSlotLeader', [cfg], rest);
}

export async function getSlotLeaders(t: HttpTransport, startSlot: Slot, limit: number, opts: CallOptions = {}): Promise<Pubkey[]> {
  return t.request('getSlotLeaders', [startSlot, limit], opts);
}

export async function getEpochInfo(t: HttpTransport, commitment: Commitment = 'confirmed', opts: CallOptions & { minContextSlot?: number } = {}): Promise<EpochInfo> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getEpochInfo', [cfg], rest);
}

export async function getEpochSchedule(t: HttpTransport, opts: CallOptions = {}): Promise<EpochSchedule> {
  return t.request('getEpochSchedule', [], opts);
}

// ── Inflation ───────────────────────────────────────────────────
export async function getInflationRate(t: HttpTransport, opts: CallOptions = {}): Promise<InflationRate> {
  return t.request('getInflationRate', [], opts);
}

export async function getInflationGovernor(t: HttpTransport, commitment?: Commitment, opts: CallOptions = {}): Promise<InflationGovernor> {
  const params = commitment ? [{ commitment }] : [];
  return t.request('getInflationGovernor', params, opts);
}

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

// ── Validators / Cluster ────────────────────────────────────────
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

export async function getClusterNodes(t: HttpTransport, opts: CallOptions = {}): Promise<ContactInfo[]> {
  return t.request('getClusterNodes', [], opts);
}

// ── Supply / Performance / Health ───────────────────────────────
export async function getSupply(
  t: HttpTransport,
  opts: CallOptions & { commitment?: Commitment; excludeNonCirculatingAccountsList?: boolean } = {}
): Promise<RpcContext<Supply>> {
  const { commitment, excludeNonCirculatingAccountsList, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (excludeNonCirculatingAccountsList != null) cfg.excludeNonCirculatingAccountsList = excludeNonCirculatingAccountsList;
  return t.request('getSupply', [cfg], rest);
}

export async function getRecentPerformanceSamples(t: HttpTransport, limit = 720, opts: CallOptions = {}): Promise<PerfSample[]> {
  return t.request('getRecentPerformanceSamples', [limit], opts);
}

export async function getHealth(t: HttpTransport, opts: CallOptions = {}): Promise<string> {
  return t.request('getHealth', [], opts);
}

export async function getVersion(t: HttpTransport, opts: CallOptions = {}): Promise<{ 'solana-core': string; 'feature-set': number }> {
  return t.request('getVersion', [], opts);
}

export async function getGenesisHash(t: HttpTransport, opts: CallOptions = {}): Promise<string> {
  return t.request('getGenesisHash', [], opts);
}

export async function getIdentity(t: HttpTransport, opts: CallOptions = {}): Promise<{ identity: Pubkey }> {
  return t.request('getIdentity', [], opts);
}

export async function getMinimumBalanceForRentExemption(t: HttpTransport, dataLength: number, commitment: Commitment = 'confirmed', opts: CallOptions = {}): Promise<number> {
  return t.request('getMinimumBalanceForRentExemption', [dataLength, { commitment }], opts);
}

export async function minimumLedgerSlot(t: HttpTransport, opts: CallOptions = {}): Promise<Slot> {
  return t.request('minimumLedgerSlot', [], opts);
}

export async function getFirstAvailableBlock(t: HttpTransport, opts: CallOptions = {}): Promise<Slot> {
  return t.request('getFirstAvailableBlock', [], opts);
}

export async function getBlockCommitment(t: HttpTransport, slot: Slot, opts: CallOptions = {}): Promise<{ commitment: number[] | null; totalStake: number }> {
  return t.request('getBlockCommitment', [slot], opts);
}

export async function getHighestSnapshotSlot(t: HttpTransport, opts: CallOptions = {}): Promise<{ full: Slot; incremental?: Slot }> {
  return t.request('getHighestSnapshotSlot', [], opts);
}

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

export async function getMaxRetransmitSlot(t: HttpTransport, opts: CallOptions = {}): Promise<Slot> {
  return t.request('getMaxRetransmitSlot', [], opts);
}

export async function getMaxShredInsertSlot(t: HttpTransport, opts: CallOptions = {}): Promise<Slot> {
  return t.request('getMaxShredInsertSlot', [], opts);
}

export async function getTransactionCount(t: HttpTransport, commitment: Commitment = 'confirmed', opts: CallOptions & { minContextSlot?: number } = {}): Promise<number> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getTransactionCount', [cfg], rest);
}

export async function getStakeMinimumDelegation(t: HttpTransport, commitment: Commitment = 'confirmed', opts: CallOptions = {}): Promise<RpcContext<number>> {
  return t.request('getStakeMinimumDelegation', [{ commitment }], opts);
}

export async function getRecentPrioritizationFees(
  t: HttpTransport,
  addresses?: Pubkey[],
  opts: CallOptions = {}
): Promise<{ slot: Slot; prioritizationFee: number }[]> {
  return t.request('getRecentPrioritizationFees', addresses ? [addresses] : [], opts);
}
