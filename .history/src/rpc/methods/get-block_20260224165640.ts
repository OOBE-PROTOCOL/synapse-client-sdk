/**
 * @module rpc/methods/get-block
 * @description Returns a confirmed block at a given slot with transaction and reward data.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, Commitment, Encoding, TransactionDetail, TransactionMeta, UnixTimestamp, Pubkey } from '../../core/types';

/**
 * Options for {@link getBlock}.
 *
 * @since 1.0.0
 */
export interface GetBlockOpts extends CallOptions {
  encoding?: Encoding;
  transactionDetails?: TransactionDetail;
  rewards?: boolean;
  commitment?: Commitment;
  maxSupportedTransactionVersion?: number;
}

/**
 * A single block reward entry.
 *
 * @since 1.0.0
 */
export interface BlockReward {
  pubkey: Pubkey;
  lamports: number;
  postBalance: number;
  rewardType: string | null;
  commission?: number;
}

/**
 * The result shape for a confirmed block returned by {@link getBlock}.
 *
 * @since 1.0.0
 */
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

/**
 * Fetch a confirmed block at a given slot, including transactions and rewards.
 *
 * @param t - HTTP transport instance
 * @param slot - Slot number of the block to retrieve
 * @param opts - Encoding, transaction detail level, reward inclusion, and other options
 * @returns The block result, or `null` if the block is not available
 *
 * @example
 * ```ts
 * const block = await getBlock(transport, 200_000_000);
 * if (block) console.log(`Blockhash: ${block.blockhash}`);
 * ```
 *
 * @since 1.0.0
 */
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
