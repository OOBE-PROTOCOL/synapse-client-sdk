/**
 * @module rpc/solana-rpc
 * @description Typed facade over all Solana JSON-RPC methods.
 * Each method delegates to its standalone function, making individual
 * methods tree-shakeable when imported directly from `./methods`.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../core/transport';
import type {
  Pubkey, Signature, Slot, Commitment,
} from '../core/types';

import * as m from './methods/index';

/**
 * Typed wrapper around the full Solana JSON-RPC API surface.
 *
 * Every method is a thin one-liner that delegates to the corresponding
 * standalone function in `./methods`, keeping this class easy to maintain
 * and the standalone functions tree-shakeable.
 *
 * @example
 * ```ts
 * const rpc = new SolanaRpc(transport);
 * const balance = await rpc.getBalance('So11...');
 * const block = await rpc.getBlock(123456);
 * ```
 * @since 1.0.0
 */
export class SolanaRpc {
  /** @param t - The HTTP transport used for all JSON-RPC calls. @since 1.0.0 */
  constructor(private readonly t: HttpTransport) {}

  // ── Account ────────────────────────────────────────────────────
  /** Fetch account information for a public key. @since 1.0.0 */
  getAccountInfo<D = string>(pubkey: Pubkey, opts?: m.GetAccountInfoOpts) { return m.getAccountInfo<D>(this.t, pubkey, opts); }
  /** Fetch the SOL balance for a public key. @since 1.0.0 */
  getBalance(pubkey: Pubkey, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getBalance(this.t, pubkey, commitment, opts); }
  /** Fetch account information for multiple public keys in one request. @since 1.0.0 */
  getMultipleAccounts<D = string>(pubkeys: Pubkey[], opts?: m.GetMultipleAccountsOpts) { return m.getMultipleAccounts<D>(this.t, pubkeys, opts); }
  /** Fetch all accounts owned by a program. @since 1.0.0 */
  getProgramAccounts<D = string>(programId: Pubkey, opts?: m.GetProgramAccountsOpts) { return m.getProgramAccounts<D>(this.t, programId, opts); }

  // ── Block ──────────────────────────────────────────────────────
  /** Fetch a confirmed block by slot number. @since 1.0.0 */
  getBlock(slot: Slot, opts?: m.GetBlockOpts) { return m.getBlock(this.t, slot, opts); }
  /** Get the current block height of the node. @since 1.0.0 */
  getBlockHeight(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getBlockHeight(this.t, commitment, opts); }
  /** Get the estimated production time of a block. @since 1.0.0 */
  getBlockTime(slot: Slot, opts?: CallOptions) { return m.getBlockTime(this.t, slot, opts); }
  /** Get recent block production information. @since 1.0.0 */
  getBlockProduction(opts?: m.GetBlockProductionOpts) { return m.getBlockProduction(this.t, opts); }
  /** Get a list of confirmed blocks between two slots. @since 1.0.0 */
  getBlocks(startSlot: Slot, endSlot?: Slot, commitment?: Commitment, opts?: CallOptions) { return m.getBlocks(this.t, startSlot, endSlot, commitment, opts); }
  /** Get confirmed blocks starting from a slot, with a limit. @since 1.0.0 */
  getBlocksWithLimit(startSlot: Slot, limit: number, commitment?: Commitment, opts?: CallOptions) { return m.getBlocksWithLimit(this.t, startSlot, limit, commitment, opts); }
  /** Get the commitment for a particular block. @since 1.0.0 */
  getBlockCommitment(slot: Slot, opts?: CallOptions) { return m.getBlockCommitment(this.t, slot, opts); }

  // ── Transaction ────────────────────────────────────────────────
  /** Fetch a confirmed transaction by its signature. @since 1.0.0 */
  getTransaction(signature: Signature, opts?: m.GetTransactionOpts) { return m.getTransaction(this.t, signature, opts); }
  /** Get confirmed signatures for transactions involving an address. @since 1.0.0 */
  getSignaturesForAddress(address: Pubkey, opts?: m.GetSignaturesOpts) { return m.getSignaturesForAddress(this.t, address, opts); }
  /** Get the statuses of a list of transaction signatures. @since 1.0.0 */
  getSignatureStatuses(signatures: Signature[], opts?: m.GetSignatureStatusesOpts) { return m.getSignatureStatuses(this.t, signatures, opts); }
  /** Submit a signed transaction to the cluster for processing. @since 1.0.0 */
  sendTransaction(signedTx: string, opts?: m.SendTransactionOpts) { return m.sendTransaction(this.t, signedTx, opts); }
  /** Simulate a transaction without submitting it to the cluster. @since 1.0.0 */
  simulateTransaction(tx: string, opts?: m.SimulateTransactionOpts) { return m.simulateTransaction(this.t, tx, opts); }
  /** Request an airdrop of lamports to a public key (devnet/testnet only). @since 1.0.0 */
  requestAirdrop(pubkey: Pubkey, lamports: number, commitment?: Commitment, opts?: CallOptions) { return m.requestAirdrop(this.t, pubkey, lamports, commitment, opts); }

  // ── Blockhash ──────────────────────────────────────────────────
  /** Get the latest blockhash. @since 1.0.0 */
  getLatestBlockhash(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getLatestBlockhash(this.t, commitment, opts); }
  /** Check whether a blockhash is still valid. @since 1.0.0 */
  isBlockhashValid(blockhash: string, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.isBlockhashValid(this.t, blockhash, commitment, opts); }

  // ── Cluster / Epoch ────────────────────────────────────────────
  /** Get the current slot the node is processing. @since 1.0.0 */
  getSlot(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getSlot(this.t, commitment, opts); }
  /** Get the current slot leader. @since 1.0.0 */
  getSlotLeader(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getSlotLeader(this.t, commitment, opts); }
  /** Get the slot leaders for a range of slots. @since 1.0.0 */
  getSlotLeaders(startSlot: Slot, limit: number, opts?: CallOptions) { return m.getSlotLeaders(this.t, startSlot, limit, opts); }
  /** Get information about the current epoch. @since 1.0.0 */
  getEpochInfo(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getEpochInfo(this.t, commitment, opts); }
  /** Get the epoch schedule. @since 1.0.0 */
  getEpochSchedule(opts?: CallOptions) { return m.getEpochSchedule(this.t, opts); }
  /** Get the current inflation governor parameters. @since 1.0.0 */
  getInflationGovernor(commitment?: Commitment, opts?: CallOptions) { return m.getInflationGovernor(this.t, commitment, opts); }
  /** Get the specific inflation values for the current epoch. @since 1.0.0 */
  getInflationRate(opts?: CallOptions) { return m.getInflationRate(this.t, opts); }
  /** Get inflation / staking rewards for a list of addresses. @since 1.0.0 */
  getInflationReward(addresses: Pubkey[], opts?: Parameters<typeof m.getInflationReward>[2]) { return m.getInflationReward(this.t, addresses, opts); }
  /** Get account info and associated stake for all voting accounts. @since 1.0.0 */
  getVoteAccounts(opts?: Parameters<typeof m.getVoteAccounts>[1]) { return m.getVoteAccounts(this.t, opts); }
  /** Get information about all the nodes participating in the cluster. @since 1.0.0 */
  getClusterNodes(opts?: CallOptions) { return m.getClusterNodes(this.t, opts); }
  /** Get information about the current supply of SOL. @since 1.0.0 */
  getSupply(opts?: Parameters<typeof m.getSupply>[1]) { return m.getSupply(this.t, opts); }
  /** Get a list of recent performance samples. @since 1.0.0 */
  getRecentPerformanceSamples(limit?: number, opts?: CallOptions) { return m.getRecentPerformanceSamples(this.t, limit, opts); }
  /** Check the health of the node ("ok" if healthy). @since 1.0.0 */
  getHealth(opts?: CallOptions) { return m.getHealth(this.t, opts); }
  /** Get the current Solana version running on the node. @since 1.0.0 */
  getVersion(opts?: CallOptions) { return m.getVersion(this.t, opts); }
  /** Get the genesis hash. @since 1.0.0 */
  getGenesisHash(opts?: CallOptions) { return m.getGenesisHash(this.t, opts); }
  /** Get the identity public key for the current node. @since 1.0.0 */
  getIdentity(opts?: CallOptions) { return m.getIdentity(this.t, opts); }
  /** Get the minimum balance required to make an account rent-exempt. @since 1.0.0 */
  getMinimumBalanceForRentExemption(dataLength: number, commitment?: Commitment, opts?: CallOptions) { return m.getMinimumBalanceForRentExemption(this.t, dataLength, commitment, opts); }
  /** Get the lowest slot that the node has information about in its ledger. @since 1.0.0 */
  minimumLedgerSlot(opts?: CallOptions) { return m.minimumLedgerSlot(this.t, opts); }
  /** Get the slot of the lowest confirmed block not yet purged from the ledger. @since 1.0.0 */
  getFirstAvailableBlock(opts?: CallOptions) { return m.getFirstAvailableBlock(this.t, opts); }
  /** Get the highest slot information that the node has snapshots for. @since 1.0.0 */
  getHighestSnapshotSlot(opts?: CallOptions) { return m.getHighestSnapshotSlot(this.t, opts); }
  /** Get the leader schedule for an epoch. @since 1.0.0 */
  getLeaderSchedule(slot?: Slot, opts?: Parameters<typeof m.getLeaderSchedule>[2]) { return m.getLeaderSchedule(this.t, slot, opts); }
  /** Get the max slot seen from retransmit stage. @since 1.0.0 */
  getMaxRetransmitSlot(opts?: CallOptions) { return m.getMaxRetransmitSlot(this.t, opts); }
  /** Get the max slot seen from after shred insert. @since 1.0.0 */
  getMaxShredInsertSlot(opts?: CallOptions) { return m.getMaxShredInsertSlot(this.t, opts); }
  /** Get the current transaction count from the ledger. @since 1.0.0 */
  getTransactionCount(commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getTransactionCount(this.t, commitment, opts); }
  /** Get the stake minimum delegation in lamports. @since 1.0.0 */
  getStakeMinimumDelegation(commitment?: Commitment, opts?: CallOptions) { return m.getStakeMinimumDelegation(this.t, commitment, opts); }
  /** Get a list of recent prioritization fees observed by the node. @since 1.0.0 */
  getRecentPrioritizationFees(addresses?: Pubkey[], opts?: CallOptions) { return m.getRecentPrioritizationFees(this.t, addresses, opts); }

  // ── Token ──────────────────────────────────────────────────────
  /** Get the token balance of an SPL Token account. @since 1.0.0 */
  getTokenAccountBalance(tokenAccount: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenAccountBalance(this.t, tokenAccount, commitment, opts); }
  /** Get all SPL Token accounts by token owner. @since 1.0.0 */
  getTokenAccountsByOwner(owner: Pubkey, filter: { mint: Pubkey } | { programId: Pubkey }, opts?: Parameters<typeof m.getTokenAccountsByOwner>[3]) { return m.getTokenAccountsByOwner(this.t, owner, filter, opts); }
  /** Get all SPL Token accounts by approved delegate. @since 1.0.0 */
  getTokenAccountsByDelegate(delegate: Pubkey, filter: { mint: Pubkey } | { programId: Pubkey }, opts?: Parameters<typeof m.getTokenAccountsByDelegate>[3]) { return m.getTokenAccountsByDelegate(this.t, delegate, filter, opts); }
  /** Get the 20 largest accounts of a particular SPL Token type. @since 1.0.0 */
  getTokenLargestAccounts(mint: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenLargestAccounts(this.t, mint, commitment, opts); }
  /** Get the total supply of an SPL Token type. @since 1.0.0 */
  getTokenSupply(mint: Pubkey, commitment?: Commitment, opts?: CallOptions) { return m.getTokenSupply(this.t, mint, commitment, opts); }
  /** Get the 20 largest accounts by lamport balance. @since 1.0.0 */
  getLargestAccounts(opts?: Parameters<typeof m.getLargestAccounts>[1]) { return m.getLargestAccounts(this.t, opts); }
  /** @deprecated Deprecated in solana-core v2.0. @since 1.0.0 */
  getStakeActivation(stakeAccount: Pubkey, opts?: Parameters<typeof m.getStakeActivation>[2]) { return m.getStakeActivation(this.t, stakeAccount, opts); }
  /** Get the fee the network will charge for a particular message. @since 1.0.0 */
  getFeeForMessage(message: string, commitment?: Commitment, opts?: CallOptions & { minContextSlot?: number }) { return m.getFeeForMessage(this.t, message, commitment, opts); }
}
