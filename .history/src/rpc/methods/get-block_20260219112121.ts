/**
 * getBlock — fetch full block data by slot.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment, Encoding, TransactionDetail, TransactionMeta, UnixTimestamp, Pubkey } from '../../core/types';

export interface GetBlockOpts extends CallOptions {
  encoding?: Encoding;
  transactionDetails?: TransactionDetail;
  rewards?: boolean;
  commitment?: Commitment;
  maxSupportedTransactionVersion?: number;
}

export interface BlockReward {
  pubkey: Pubkey;
  lamports: number;
  postBalance: number;
  rewardType: string | null;
  commission?: number;
}

export interface BlockResult {
  blockhash: string;
  previousBlockhash: string;
  parentSlot: Slot;
  blockHeight: number | null;
  blockTime: UnixTimestamp | null;
  transactions?: { transaction: unknown; meta: TransactionMeta | null; version?: number | 'legacy' }[];
  signatures?: string[];
  rewards?: BlockReward[];
}

export async function getBlock(
  t: HttpTransport,
  slot: Slot,
  opts: GetBlockOpts = {}
): Promise<BlockResult | null> {
  const { encoding, transactionDetails, rewards, commitment, maxSupportedTransactionVersion, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (transactionDetails) cfg.transactionDetails = transactionDetails;
  if (rewards !== undefined) cfg.rewards = rewards;
  if (commitment) cfg.commitment = commitment;
  if (maxSupportedTransactionVersion != null) cfg.maxSupportedTransactionVersion = maxSupportedTransactionVersion;
  return t.request('getBlock', [slot, cfg], rest);
}
