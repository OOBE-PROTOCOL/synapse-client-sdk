/**
 * SolanaRpc — typed facade over all JSON-RPC methods.
 * Each method delegates to its standalone function (tree-shakeable when used individually).
 */
import type { HttpTransport, CallOptions } from '../core/transport';
import type {
  Pubkey, Signature, Slot, Epoch, Commitment, Encoding,
  RpcContext, AccountInfo, DataSlice, ConfirmedTransaction,
  SignatureInfo, SignatureStatus, EpochInfo, EpochSchedule,
  InflationRate, InflationGovernor, InflationReward, VoteAccountsResult,
  ContactInfo, PerfSample, Supply, TokenAccount, TokenAmount,
  BlockProduction, AccountFilter
} from '../core/types';

import * as m from './methods/index';

export class SolanaRpc {
  constructor(private readonly t: HttpTransport) {}

  // ── Account ────────────────────────────────────────────────────
  getAccountInfo<D = string>(pubkey: Pubkey, opts?: m.GetAccountInfoOpts) { return m.getAccountInfo<D>(this.t, pubkey, opts); }
  getBalance(pubkey: Pubkey, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getBalance(this.t, pubkey, commitment, opts); }
  getMultipleAccounts<D = string>(pubkeys: Pubkey[], opts?: m.GetMultipleAccountsOpts) { return m.getMultipleAccounts<D>(this.t, pubkeys, opts); }
  getProgramAccounts<D = string>(programId: Pubkey, opts?: m.GetProgramAccountsOpts) { return m.getProgramAccounts<D>(this.t, programId, opts); }

  // ── Block ──────────────────────────────────────────────────────
  getBlock(slot: Slot, opts?: m.GetBlockOpts) { return m.getBlock(this.t, slot, opts); }
  getBlockHeight(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getBlockHeight(this.t, commitment, opts); }
  getBlockTime(slot: Slot, opts?: CallOptions) { return m.getBlockTime(this.t, slot, opts); }
  getBlockProduction(opts?: m.GetBlockProductionOpts) { return m.getBlockProduction(this.t, opts); }
  getBlocks(startSlot: Slot, endSlot?: Slot, commitment?: Commitment, opts?: CallOptions) { return m.getBlocks(this.t, startSlot, endSlot, commitment, opts); }
  getBlocksWithLimit(startSlot: Slot, limit: number, commitment?: Commitment, opts?: CallOptions) { return m.getBlocksWithLimit(this.t, startSlot, limit, commitment, opts); }
  getBlockCommitment(slot: Slot, opts?: CallOptions) { return m.getBlockCommitment(this.t, slot, opts); }

  // ── Transaction ────────────────────────────────────────────────
  getTransaction(signature: Signature, opts?: m.GetTransactionOpts) { return m.getTransaction(this.t, signature, opts); }
  getSignaturesForAddress(address: Pubkey, opts?: m.GetSignaturesOpts) { return m.getSignaturesForAddress(this.t, address, opts); }
  getSignatureStatuses(signatures: Signature[], opts?: m.GetSignatureStatusesOpts) { return m.getSignatureStatuses(this.t, signatures, opts); }
  sendTransaction(signedTx: string, opts?: m.SendTransactionOpts) { return m.sendTransaction(this.t, signedTx, opts); }
  simulateTransaction(tx: string, opts?: m.SimulateTransactionOpts) { return m.simulateTransaction(this.t, tx, opts); }
  requestAirdrop(pubkey: Pubkey, lamports: number, commitment?: Commitment, opts?: CallOptions) { return m.requestAirdrop(this.t, pubkey, lamports, commitment, opts); }

  // ── Blockhash ──────────────────────────────────────────────────
  getLatestBlockhash(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getLatestBlockhash(this.t, commitment, opts); }
  isBlockhashValid(blockhash: string, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.isBlockhashValid(this.t, blockhash, commitment, opts); }

  // ── Cluster / Epoch ────────────────────────────────────────────
  getSlot(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getSlot(this.t, commitment, opts); }
  getSlotLeader(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getSlotLeader(this.t, commitment, opts); }
  getSlotLeaders(startSlot: Slot, limit: number, opts?: CallOptions) { return m.getSlotLeaders(this.t, startSlot, limit, opts); }
  getEpochInfo(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getEpochInfo(this.t, commitment, opts); }
  getEpochSchedule(opts?: CallOptions) { return m.getEpochSchedule(this.t, opts); }
  getInflationGovernor(commitment?: Commitment, opts?: CallOptions) { return m.getInflationGovernor(this.t, commitment, opts); }
  getInflationRate(opts?: CallOptions) { return m.getInflationRate(this.t, opts); }
  getInflationReward(addresses: Pubkey[], opts?: Parameters<typeof m.getInflationReward>[2]) { return m.getInflationReward(this.t, addresses, opts); }
  getVoteAccounts(opts?: Parameters<typeof m.getVoteAccounts>[1]) { return m.getVoteAccounts(this.t, opts); }
  getClusterNodes(opts?: CallOptions) { return m.getClusterNodes(this.t, opts); }
  getSupply(opts?: Parameters<typeof m.getSupply>[1]) { return m.getSupply(this.t, opts); }
  getRecentPerformanceSamples(limit?: number, opts?: CallOptions) { return m.getRecentPerformanceSamples(this.t, limit, opts); }
  getHealth(opts?: CallOptions) { return m.getHealth(this.t, opts); }
  getVersion(opts?: CallOptions) { return m.getVersion(this.t, opts); }
  getGenesisHash(opts?: CallOptions) { return m.getGenesisHash(this.t, opts); }
  getIdentity(opts?: CallOptions) { return m.getIdentity(this.t, opts); }
  getMinimumBalanceForRentExemption(dataLength: number, commitment?: Commitment, opts?: CallOptions) { return m.getMinimumBalanceForRentExemption(this.t, dataLength, commitment, opts); }
  minimumLedgerSlot(opts?: CallOptions) { return m.minimumLedgerSlot(this.t, opts); }
  getFirstAvailableBlock(opts?: CallOptions) { return m.getFirstAvailableBlock(this.t, opts); }
  getHighestSnapshotSlot(opts?: CallOptions) { return m.getHighestSnapshotSlot(this.t, opts); }
  getLeaderSchedule(slot?: Slot, opts?: Parameters<typeof m.getLeaderSchedule>[2]) { return m.getLeaderSchedule(this.t, slot, opts); }
  getMaxRetransmitSlot(opts?: CallOptions) { return m.getMaxRetransmitSlot(this.t, opts); }
  getMaxShredInsertSlot(opts?: CallOptions) { return m.getMaxShredInsertSlot(this.t, opts); }
  getTransactionCount(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getTransactionCount(this.t, commitment, opts); }
  getStakeMinimumDelegation(commitment?: Commitment, opts?: CallOptions) { return m.getStakeMinimumDelegation(this.t, commitment, opts); }
  getRecentPrioritizationFees(addresses?: Pubkey[], opts?: CallOptions) { return m.getRecentPrioritizationFees(this.t, addresses, opts); }

  // ── Token ──────────────────────────────────────────────────────
  getTokenAccountBalance(tokenAccount: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenAccountBalance(this.t, tokenAccount, commitment, opts); }
  getTokenAccountsByOwner(owner: Pubkey, filter: { mint: Pubkey } | { programId: Pubkey }, opts?: Parameters<typeof m.getTokenAccountsByOwner>[3]) { return m.getTokenAccountsByOwner(this.t, owner, filter, opts); }
  getTokenAccountsByDelegate(delegate: Pubkey, filter: { mint: Pubkey } | { programId: Pubkey }, opts?: Parameters<typeof m.getTokenAccountsByDelegate>[3]) { return m.getTokenAccountsByDelegate(this.t, delegate, filter, opts); }
  getTokenLargestAccounts(mint: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenLargestAccounts(this.t, mint, commitment, opts); }
  getTokenSupply(mint: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenSupply(this.t, mint, commitment, opts); }
  getLargestAccounts(opts?: Parameters<typeof m.getLargestAccounts>[1]) { return m.getLargestAccounts(this.t, opts); }
  /** @deprecated Deprecated in solana-core v2.0 */
  getStakeActivation(stakeAccount: Pubkey, opts?: Parameters<typeof m.getStakeActivation>[2]) { return m.getStakeActivation(this.t, stakeAccount, opts); }
  getFeeForMessage(message: string, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getFeeForMessage(this.t, message, commitment, opts); }
}
