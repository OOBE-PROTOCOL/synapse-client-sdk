/**
 * SYNAPSE CLIENT SDK - SOLANA RPC METHODS
 * Tutti i metodi RPC Solana ottimizzati per performance
 */

import type { SynapseClient } from '../client';
import type {
  RequestOptions,
  AccountInfo,
  BlockhashInfo,
  EpochInfo,
  TransactionSignature,
  ConfirmedTransaction,
  Transaction,
  RpcResponse
} from '../types.js';

export class SolanaRpcMethods {
  constructor(private client: SynapseClient) { }

  // ====== ACCOUNT METHODS ======

  /**
   * Get account info - Heavy for large accounts
   */
  async getAccountInfo(
    pubkey: string,
    options: RequestOptions & { encoding?: 'base58' | 'base64' | 'jsonParsed' } = {}
  ): Promise<AccountInfo | null> {
    return this.client.call('getAccountInfo', [pubkey, options]);
  }

  /**
   * Get balance - Light method
   */
  async getBalance(
    pubkey: string,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<number> {
    const result = await this.client.call('getBalance', [pubkey, { commitment }]);
    return result?.value || 0;
  }

  /**
   * Get multiple accounts - VERY HEAVY
   */
  async getMultipleAccounts(
    pubkeys: string[],
    options: RequestOptions & { encoding?: string } = {}
  ): Promise<(AccountInfo | null)[]> {
    return this.client.call('getMultipleAccounts', [pubkeys, options]);
  }

  /**
   * Confirm transaction (DEPRECATED: use getSignatureStatuses instead)
   * This method is kept for backward compatibility but internally uses getSignatureStatuses.
   */
  async confirmTransaction(
    params: { signature: string; blockhash: string; lastValidBlockHeight: number },
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<{
    slot: number;
    confirmations: number | null;
    err: object | null;
    status: object;
    confirmationStatus: string | null;
  }[] | null[]> {
    // Use getSignatureStatuses to check confirmation
    const statuses = await this.getSignatureStatuses([params.signature]);
    return statuses;
  }


  /**
   * Get program accounts - EXTREMELY HEAVY
   */
  async getProgramAccounts(
    programId: string,
    options: RequestOptions & {
      encoding?: string;
      dataSlice?: { offset: number; length: number };
      filters?: any[];
    } = {}
  ): Promise<any[]> {
    return this.client.call('getProgramAccounts', [programId, options]);
  }

  // ====== BLOCK METHODS ======

  /**
   * Get block - HEAVY method
   */
  async getBlock(
    slot: number,
    options: RequestOptions & {
      encoding?: string;
      transactionDetails?: 'full' | 'accounts' | 'signatures' | 'none';
      rewards?: boolean;
      maxSupportedTransactionVersion?: number;
    } = {}
  ): Promise<any> {
    return this.client.call('getBlock', [slot, options]);
  }

  /**
   * Get block commitment
   */
  async getBlockCommitment(slot: number): Promise<any> {
    return this.client.call('getBlockCommitment', [slot]);
  }

  /**
   * Get block production
   */
  async getBlockProduction(
    config: (RequestOptions & {
      range?: { firstSlot: number; lastSlot?: number };
      identity?: string;
    }) = {}
  ): Promise<any> {
    return this.client.call('getBlockProduction', [config]);
  }

  /**
   * Get blocks - VERY HEAVY
   */
  async getBlocks(
    startSlot: number,
    endSlot?: number,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<number[]> {
    const params = endSlot ? [startSlot, endSlot, { commitment }] : [startSlot, { commitment }];
    return this.client.call('getBlocks', params);
  }

  /**
   * Get blocks with limit
   */
  async getBlocksWithLimit(
    startSlot: number,
    limit: number,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<number[]> {
    return this.client.call('getBlocksWithLimit', [startSlot, limit, { commitment }]);
  }

  /**
   * Get block height - Light method
   */
  async getBlockHeight(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<number> {
    return this.client.call('getBlockHeight', [{ commitment }]);
  }

  /**
   * Get block time
   */
  async getBlockTime(slot: number): Promise<number | null> {
    return this.client.call('getBlockTime', [slot]);
  }

  /**
   * Get cluster nodes
   */
  async getClusterNodes(): Promise<any[]> {
    return this.client.call('getClusterNodes', []);
  }

  // ====== TRANSACTION METHODS ======

  /**
   * Get signatures for address - EXTREMELY HEAVY
   */
  async getSignaturesForAddress(
    address: string,
    options: RequestOptions & {
      limit?: number;
      before?: string;
      until?: string;
    } = {}
  ): Promise<TransactionSignature[]> {
    // Auto-pagination with safety guards. Respect before/until and overall limit.
    const {
      limit = 100,
      before: initialBefore,
      until,
      timeout,
      ...rpcOpts
    } = options || {};

    const results: TransactionSignature[] = [];
    let remaining = limit;
    let before = initialBefore;
    const maxPerRequest = 1000; // Solana RPC cap
    const maxPages = 50; // safety guard
    const perRequestTimeout = Math.max(timeout ?? 0, 60_000); // heavy call

    for (let page = 0; page < maxPages && remaining > 0; page++) {
      const pageLimit = Math.min(remaining, maxPerRequest);
      const pageResults = await this.client.call<TransactionSignature[]>(
        'getSignaturesForAddress',
        [address, { ...rpcOpts, limit: pageLimit, before, until }],
        { ...rpcOpts, timeout: perRequestTimeout }
      );

      if (!Array.isArray(pageResults) || pageResults.length === 0) break;

      results.push(...pageResults);
      remaining -= pageResults.length;
      before = pageResults[pageResults.length - 1]?.signature;

      // If fewer than requested returned, no more pages available
      if (pageResults.length < pageLimit) break;
    }

    return results;
  }

  /**
   * Get transaction - HEAVY method
   */
  async getTransaction(
    signature: string,
    options: RequestOptions & {
      encoding?: string;
      maxSupportedTransactionVersion?: number;
    } = {}
  ): Promise<ConfirmedTransaction | null> {
    return this.client.call('getTransaction', [signature, options]);
  }

  /**
   * Get signature statuses
   * Returns an array of RpcResponse<object> (null or object with slot, confirmations, err, status, confirmationStatus).
   * If the last element has confirmationStatus, returns it; otherwise, returns the full array.
   */
  async getSignatureStatuses(
    signatures: string[],
    options: { searchTransactionHistory?: boolean } = {}
  ): Promise<{
    slot: number;
    confirmations: number | null;
    err: object | null;
    status: object;
    confirmationStatus: string | null;
  }[] | null[]> {
    const result = await this.client.call('getSignatureStatuses', [signatures, options]);
    if (Array.isArray(result) && result.length > 0) {
      const last = result[result.length - 1];
      if (last && typeof last === 'object' && 'confirmationStatus' in last) {
        return last;
      }
    }
    return result;
  }

  // ====== SLOT & EPOCH METHODS ======

  /**
   * Get slot - Light method
   */
  async getSlot(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<number> {
    return this.client.call('getSlot', [{ commitment }]);
  }

  /**
   * Get epoch info - Light method
   */
  async getEpochInfo(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<EpochInfo> {
    return this.client.call('getEpochInfo', [{ commitment }]);
  }

  /**
   * Get epoch schedule
   */
  async getEpochSchedule(): Promise<any> {
    return this.client.call('getEpochSchedule', []);
  }

  /**
   * Get leader schedule
   */
  async getLeaderSchedule(slotOrEpoch: number | null = null, identity?: string): Promise<any> {
    const params: any[] = [];
    if (slotOrEpoch !== null) params.push(slotOrEpoch);
    if (identity) params.push(identity);
    return this.client.call('getLeaderSchedule', params);
  }

  /**
   * Get slot leaders - HEAVY method
   */
  async getSlotLeaders(startSlot: number, limit: number): Promise<string[]> {
    return this.client.call('getSlotLeaders', [startSlot, limit]);
  }

  /**
   * Get slot leader
   */
  async getSlotLeader(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<string> {
    return this.client.call('getSlotLeader', [{ commitment }]);
  }

  // ====== TOKEN METHODS ======

  /**
   * Get token accounts by owner - VERY HEAVY
   */
  async getTokenAccountsByOwner(
    ownerPubkey: string,
    filter: { mint: string } | { programId: string },
    options: RequestOptions & { encoding?: string } = {}
  ): Promise<any> {
    return this.client.call('getTokenAccountsByOwner', [ownerPubkey, filter, options]);
  }

  /**
   * Get token accounts by delegate
   */
  async getTokenAccountsByDelegate(
    delegate: string,
    filter: { mint: string } | { programId: string },
    options: RequestOptions & { encoding?: string } = {}
  ): Promise<any> {
    return this.client.call('getTokenAccountsByDelegate', [delegate, filter, options]);
  }

  /**
   * Get token supply
   */
  async getTokenSupply(
    mint: string,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<any> {
    return this.client.call('getTokenSupply', [mint, { commitment }]);
  }

  /**
   * Get token account balance
   */
  async getTokenAccountBalance(
    account: string,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<any> {
    return this.client.call('getTokenAccountBalance', [account, { commitment }]);
  }

  /**
   * Get token largest accounts
   */
  async getTokenLargestAccounts(
    mint: string,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<any> {
    return this.client.call('getTokenLargestAccounts', [mint, { commitment }]);
  }

  // ====== UTILITY METHODS ======

  /**
   * Get latest blockhash - Light method
   */
  async getLatestBlockhash(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<BlockhashInfo> {
    const result = await this.client.call('getLatestBlockhash', [{ commitment }]);
    return result.value;
  }

  /**
   * Check if blockhash is valid
   */
  async isBlockhashValid(blockhash: string, commitment: RequestOptions['commitment'] = 'confirmed'): Promise<boolean> {
    const result = await this.client.call('isBlockhashValid', [blockhash, { commitment }]);
    return result?.value ?? false;
  }

  /**
   * Get fee for message (base64-encoded message)
   */
  async getFeeForMessage(message: string, commitment: RequestOptions['commitment'] = 'confirmed'): Promise<any> {
    return this.client.call('getFeeForMessage', [message, { commitment }]);
  }

  /**
   * Get first available block
   */
  async getFirstAvailableBlock(): Promise<number> {
    return this.client.call('getFirstAvailableBlock', []);
  }

  /**
   * Get genesis hash
   */
  async getGenesisHash(): Promise<string> {
    return this.client.call('getGenesisHash', []);
  }

  /**
   * Get highest snapshot slot
   */
  async getHighestSnapshotSlot(): Promise<{ full: number; incremental: number | null }> {
    return this.client.call('getHighestSnapshotSlot', []);
  }

  /**
   * Get identity
   */
  async getIdentity(): Promise<{ identity: string }> {
    return this.client.call('getIdentity', []);
  }

  /**
   * Get inflation governor
   */
  async getInflationGovernor(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<any> {
    return this.client.call('getInflationGovernor', [{ commitment }]);
  }

  /**
   * Get inflation rate
   */
  async getInflationRate(): Promise<any> {
    return this.client.call('getInflationRate', []);
  }

  /**
   * Get inflation reward
   */
  async getInflationReward(
    addresses: string[],
    options: (RequestOptions & { epoch?: number }) = {}
  ): Promise<any> {
    const { commitment, epoch } = options || {};
    return this.client.call('getInflationReward', [addresses, { commitment, epoch }]);
  }

  /**
   * Get largest accounts
   */
  async getLargestAccounts(
    commitment: RequestOptions['commitment'] = 'confirmed',
    filter?: 'circulating' | 'nonCirculating'
  ): Promise<any> {
    const config: any = { commitment };
    if (filter) config.filter = filter;
    return this.client.call('getLargestAccounts', [config]);
  }

  /**
   * Get max retransmit slot
   */
  async getMaxRetransmitSlot(): Promise<number> {
    return this.client.call('getMaxRetransmitSlot', []);
  }

  /**
   * Get max shred insert slot
   */
  async getMaxShredInsertSlot(): Promise<number> {
    return this.client.call('getMaxShredInsertSlot', []);
  }

  /**
   * Get minimum balance for rent exemption
   */
  async getMinimumBalanceForRentExemption(
    dataLength: number,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<number> {
    return this.client.call('getMinimumBalanceForRentExemption', [dataLength, { commitment }]);
  }

  /**
   * Get recent performance samples
   */
  async getRecentPerformanceSamples(limit?: number): Promise<any[]> {
    const params = typeof limit === 'number' ? [limit] : [];
    return this.client.call('getRecentPerformanceSamples', params);
  }

  /**
   * Get recent prioritization fees
   */
  async getRecentPrioritizationFees(addresses?: string[]): Promise<any[]> {
    const params = Array.isArray(addresses) && addresses.length > 0 ? [addresses] : [];
    return this.client.call('getRecentPrioritizationFees', params);
  }

  /**
   * Get stake minimum delegation
   */
  async getStakeMinimumDelegation(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<number> {
    return this.client.call('getStakeMinimumDelegation', [{ commitment }]);
  }

  /**
   * Get supply
   */
  async getSupply(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<any> {
    return this.client.call('getSupply', [{ commitment }]);
  }

  /**
   * Get transaction count
   */
  async getTransactionCount(commitment: RequestOptions['commitment'] = 'confirmed'): Promise<number> {
    return this.client.call('getTransactionCount', [{ commitment }]);
  }

  /**
   * Get vote accounts
   */
  async getVoteAccounts(
    options: (RequestOptions & {
      votePubkey?: string;
      keepUnstakedDelinquents?: boolean;
      delinquentSlotDistance?: number;
    }) = {}
  ): Promise<any> {
    return this.client.call('getVoteAccounts', [options]);
  }

  /**
   * Minimum ledger slot
   */
  async minimumLedgerSlot(): Promise<number> {
    return this.client.call('minimumLedgerSlot', []);
  }

  /**
   * Request airdrop
   */
  async requestAirdrop(
    toPubkey: string,
    lamports: number,
    commitment: RequestOptions['commitment'] = 'confirmed'
  ): Promise<string> {
    return this.client.call('requestAirdrop', [toPubkey, lamports, { commitment }]);
  }

  /**
   * Send transaction (base64-encoded)
   */
  async sendTransaction(
    transaction: Transaction,
    options: (RequestOptions & {
      skipPreflight?: boolean;
      preflightCommitment?: RequestOptions['commitment'];
      maxRetries?: number;
      minContextSlot?: number;
    }) = {}
  ): Promise<string> {
    return this.client.call('sendTransaction', [transaction, options]);
  }

  /**
   * Simulate transaction (base64-encoded)
   */
  async simulateTransaction(
    transaction: Transaction,
    options: (RequestOptions & {
      sigVerify?: boolean;
      replaceRecentBlockhash?: boolean;
      accounts?: { encoding?: string; addresses: string[] };
      minContextSlot?: number;
    }) = {}
  ): Promise<any> {
    return this.client.call('simulateTransaction', [transaction, options]);
  }

  /**
   * Get version
   */
  async getVersion(): Promise<any> {
    return this.client.call('getVersion', []);
  }

  /**
   * Get health
   */
  async getHealth(): Promise<string> {
    return this.client.call('getHealth', []);
  }
}

// ---------------------------------------------------------------------------
// Named convenience exports
// These wrappers instantiate SolanaRpcMethods and delegate to the corresponding
// method. They make it possible to import functions directly from the package
// without creating an instance of the class.
// ---------------------------------------------------------------------------

export async function getAccountInfo(client: SynapseClient, pubkey: string, options: any = {}): Promise<AccountInfo | null> {
  return new SolanaRpcMethods(client).getAccountInfo(pubkey, options);
}

export async function getBalance(client: SynapseClient, pubkey: string, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getBalance(pubkey, commitment);
}

export async function getMultipleAccounts(client: SynapseClient, pubkeys: string[], options: any = {}): Promise<(AccountInfo | null)[]> {
  return new SolanaRpcMethods(client).getMultipleAccounts(pubkeys, options);
}

export async function getProgramAccounts(client: SynapseClient, programId: string, options: any = {}): Promise<any[]> {
  return new SolanaRpcMethods(client).getProgramAccounts(programId, options);
}

export async function getBlock(client: SynapseClient, slot: number, options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getBlock(slot, options);
}

export async function getBlockCommitment(client: SynapseClient, slot: number): Promise<any> {
  return new SolanaRpcMethods(client).getBlockCommitment(slot);
}

export async function getBlocks(client: SynapseClient, startSlot: number, endSlot?: number, commitment: any = 'confirmed'): Promise<number[]> {
  return new SolanaRpcMethods(client).getBlocks(startSlot, endSlot, commitment);
}

export async function getBlocksWithLimit(client: SynapseClient, startSlot: number, limit: number, commitment: any = 'confirmed'): Promise<number[]> {
  return new SolanaRpcMethods(client).getBlocksWithLimit(startSlot, limit, commitment);
}

export async function getBlockHeight(client: SynapseClient, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getBlockHeight(commitment);
}

export async function getBlockTime(client: SynapseClient, slot: number): Promise<number | null> {
  return new SolanaRpcMethods(client).getBlockTime(slot);
}

export async function getClusterNodes(client: SynapseClient): Promise<any[]> {
  return new SolanaRpcMethods(client).getClusterNodes();
}

export async function getSignaturesForAddress(client: SynapseClient, address: string, options: any = {}): Promise<TransactionSignature[]> {
  return new SolanaRpcMethods(client).getSignaturesForAddress(address, options);
}

export async function getTransaction(client: SynapseClient, signature: string, options: any = {}): Promise<ConfirmedTransaction | null> {
  return new SolanaRpcMethods(client).getTransaction(signature, options);
}

export async function getSignatureStatuses(client: SynapseClient, signatures: string[], options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getSignatureStatuses(signatures, options);
}

export async function getSlot(client: SynapseClient, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getSlot(commitment);
}

export async function getEpochInfo(client: SynapseClient, commitment: any = 'confirmed'): Promise<EpochInfo> {
  return new SolanaRpcMethods(client).getEpochInfo(commitment);
}

export async function getEpochSchedule(client: SynapseClient): Promise<any> {
  return new SolanaRpcMethods(client).getEpochSchedule();
}

export async function getLeaderSchedule(client: SynapseClient, slotOrEpoch: number | null = null, identity?: string): Promise<any> {
  return new SolanaRpcMethods(client).getLeaderSchedule(slotOrEpoch, identity);
}

export async function getSlotLeaders(client: SynapseClient, startSlot: number, limit: number): Promise<string[]> {
  return new SolanaRpcMethods(client).getSlotLeaders(startSlot, limit);
}

export async function getSlotLeader(client: SynapseClient, commitment: any = 'confirmed'): Promise<string> {
  return new SolanaRpcMethods(client).getSlotLeader(commitment);
}

export async function getTokenAccountsByOwner(client: SynapseClient, ownerPubkey: string, filter: any, options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getTokenAccountsByOwner(ownerPubkey, filter, options);
}

export async function getTokenAccountsByDelegate(client: SynapseClient, delegate: string, filter: any, options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getTokenAccountsByDelegate(delegate, filter, options);
}

export async function getTokenSupply(client: SynapseClient, mint: string, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getTokenSupply(mint, commitment);
}

export async function getTokenAccountBalance(client: SynapseClient, account: string, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getTokenAccountBalance(account, commitment);
}

export async function getTokenLargestAccounts(client: SynapseClient, mint: string, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getTokenLargestAccounts(mint, commitment);
}

export async function getLatestBlockhash(client: SynapseClient, commitment: any = 'confirmed'): Promise<BlockhashInfo> {
  return new SolanaRpcMethods(client).getLatestBlockhash(commitment);
}

export async function isBlockhashValid(client: SynapseClient, blockhash: string, commitment: any = 'confirmed'): Promise<boolean> {
  return new SolanaRpcMethods(client).isBlockhashValid(blockhash, commitment);
}

export async function getFeeForMessage(client: SynapseClient, message: string, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getFeeForMessage(message, commitment);
}

export async function getFirstAvailableBlock(client: SynapseClient): Promise<number> {
  return new SolanaRpcMethods(client).getFirstAvailableBlock();
}

export async function getGenesisHash(client: SynapseClient): Promise<string> {
  return new SolanaRpcMethods(client).getGenesisHash();
}

export async function getHighestSnapshotSlot(client: SynapseClient): Promise<{ full: number; incremental: number | null }> {
  return new SolanaRpcMethods(client).getHighestSnapshotSlot();
}

export async function getIdentity(client: SynapseClient): Promise<{ identity: string }> {
  return new SolanaRpcMethods(client).getIdentity();
}

export async function getInflationGovernor(client: SynapseClient, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getInflationGovernor(commitment);
}

export async function getInflationRate(client: SynapseClient): Promise<any> {
  return new SolanaRpcMethods(client).getInflationRate();
}

export async function getInflationReward(client: SynapseClient, addresses: string[], options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getInflationReward(addresses, options);
}

export async function getLargestAccounts(client: SynapseClient, commitment: any = 'confirmed', filter?: 'circulating' | 'nonCirculating'): Promise<any> {
  return new SolanaRpcMethods(client).getLargestAccounts(commitment, filter);
}

export async function getMinimumBalanceForRentExemption(client: SynapseClient, dataLength: number, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getMinimumBalanceForRentExemption(dataLength, commitment);
}

export async function getRecentPerformanceSamples(client: SynapseClient, limit?: number): Promise<any[]> {
  return new SolanaRpcMethods(client).getRecentPerformanceSamples(limit);
}

export async function getStakeMinimumDelegation(client: SynapseClient, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getStakeMinimumDelegation(commitment);
}

export async function getSupply(client: SynapseClient, commitment: any = 'confirmed'): Promise<any> {
  return new SolanaRpcMethods(client).getSupply(commitment);
}

export async function getTransactionCount(client: SynapseClient, commitment: any = 'confirmed'): Promise<number> {
  return new SolanaRpcMethods(client).getTransactionCount(commitment);
}

export async function getVoteAccounts(client: SynapseClient, options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).getVoteAccounts(options);
}

export async function minimumLedgerSlot(client: SynapseClient): Promise<number> {
  return new SolanaRpcMethods(client).minimumLedgerSlot();
}

export async function requestAirdrop(client: SynapseClient, toPubkey: string, lamports: number, commitment: any = 'confirmed'): Promise<string> {
  return new SolanaRpcMethods(client).requestAirdrop(toPubkey, lamports, commitment);
}

export async function sendTransaction(client: SynapseClient, transaction: Transaction, options: any = {}): Promise<string> {
  return new SolanaRpcMethods(client).sendTransaction(transaction, options);
}

export async function simulateTransaction(client: SynapseClient, transaction: Transaction, options: any = {}): Promise<any> {
  return new SolanaRpcMethods(client).simulateTransaction(transaction, options);
}

export async function getVersion(client: SynapseClient): Promise<any> {
  return new SolanaRpcMethods(client).getVersion();
}

export async function getHealth(client: SynapseClient): Promise<string> {
  return new SolanaRpcMethods(client).getHealth();
}
