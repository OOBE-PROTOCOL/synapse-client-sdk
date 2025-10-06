/**
 * Zero Combine Fetcher - Synapse SDK Implementation
 *
 * Professional implementation of the OOBE Protocol's ZeroCombine pattern for
 * fetching and reconstructing large transaction datasets split across multiple
 * on-chain memo chunks. Uses Synapse SDK's batch capabilities for efficiency.
 *
 * @module ZeroCombineFetcher
 * @author SteveTheHead
 */

import { PublicKey } from '@solana/web3.js';
import type { SynapseClient } from '../client';
import { PDAManager, type UserPDAs } from './pda-manager';
import type { BatchOptionRequest } from './types.ai';
import * as crypto from 'crypto';


/**
 * Zero Chunk structure (128 bytes: 2 merkle leaves + previous signature)
 */
export interface ZeroChunk {
  /** First 64 bytes - Merkle Leaf 1 */
  leaf1: string;
  /** Second 64 bytes - Merkle Leaf 2 */
  leaf2: string;
  /** Remaining bytes - Previous transaction signature */
  prevSign: string;
}

/**
 * Confirmed signature info (simplified)
 */
export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  memo: string | null;
  err: any;
  confirmationStatus?: string;
}

/**
 * Proof record - complete reconstructed transaction proof
 */
export interface ProofRecord {
  /** Merkle root hash */
  root: string;
  /** Signature of the proof transaction */
  proofSignature: string;
  /** Original zero chunk transaction */
  transaction: {
    signature: string;
    slot: number;
    memo: ZeroChunk;
  };
  /** First chunk content */
  firstChunkContent: {
    prev_chunk_sign: string;
    content: string;
  };
  /** All cycled content chunks */
  cycledContent: Array<{
    prev_chunk_sign?: string;
    content?: string;
    leaf1?: string;
    leaf2?: string;
    prevSign?: string;
    result?: string;
  }>;
}

/**
 * Batch configuration for fetching
 * Includes all batch processing options
 */
export interface FetchConfig {
  batchSize: number;
  delayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Zero Combine Fetcher Result
 */
export interface ZeroCombineResult {
  tools: ProofRecord[];
}

/**
 * ZeroCombineFetcher - fetches and reconstructs large transaction datasets
 *
 * This class implements the OOBE Protocol pattern for storing large data on-chain
 * by splitting it across multiple memo transactions and linking them via signatures.
 * Uses Synapse SDK's efficient batching for optimal performance.
 */
export class ZeroCombineFetcher {
  private client: SynapseClient;
  private pdaManager: PDAManager;
  private config: Required<FetchConfig>;

  /**
   * Create a new ZeroCombineFetcher instance
   * @param client - Synapse client for RPC calls
   * @param walletAddress - User wallet address
   * @param fetchConfig - Optional fetch configuration
   */
  constructor(
    client: SynapseClient,
    walletAddress: string,
    fetchConfig?: FetchConfig
  ) {
    this.client = client;
    this.pdaManager = new PDAManager(client, walletAddress);
    this.config = {
      batchSize: 100,
      delayMs: 2000,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...fetchConfig,
    };
  }

  /**
   * Execute the full fetch and reconstruction process
   * @param pdas - Optional custom PDAs (if null, will derive from wallet)
   * @returns ZeroCombineResult with all reconstructed proof records
   */
  public async execute(pdas?: UserPDAs | null): Promise<ZeroCombineResult> {
    // Get or use provided PDAs
    const userPDAs = pdas || this.pdaManager.getUserPDAs();

    // Fetch root transactions
    const rootTransactions = await this.getRootTransactions(userPDAs.rootPDA);
    if (rootTransactions.length === 0) {
      throw new Error('No transactions found in Root PDA');
    }

    // Fetch and structure DB transactions
    const { zeroTransactions, allDbTransactions } = await this.getDbTransactions(
      userPDAs.leafPDA,
      rootTransactions
    );

    // Process in batches
    const allProofRecords: ProofRecord[] = [];
    for (let i = 0; i < zeroTransactions.length; i += this.config.batchSize) {
      const batch = zeroTransactions.slice(i, i + this.config.batchSize);

      // Fetch first chunk content for batch
      const withFirstChunk = await this.fetchFirstChunkBatch(batch, allDbTransactions);

      // Resolve all memo chunks
      const fullRecords = await this.resolveMemoChunksBatch(
        withFirstChunk,
        allDbTransactions
      );

      allProofRecords.push(...fullRecords);

      // Delay between batches to avoid rate limiting
      if (i + this.config.batchSize < zeroTransactions.length) {
        await this.sleep(this.config.delayMs);
      }
    }

    return {
      tools: allProofRecords,
    };
  }

  /**
   * Fetch all transactions from Root PDA
   * Root PDA contains merkle roots and proof signatures
   * Uses optimized batch fetching for maximum performance
   * @param rootPDA - Root PDA public key
   * @returns Array of signature info with decoded memos
   */
  private async getRootTransactions(rootPDA: PublicKey): Promise<SignatureInfo[]> {
    const signatures: SignatureInfo[] = [];
    let lastSignature: string | null = null;

    // Paginate through all transactions using getSignaturesForAddress
    while (true) {
      const batch: any[] = await this.client.call('getSignaturesForAddress', [
        rootPDA.toBase58(),
        {
          limit: 1000,
          before: lastSignature || undefined,
        },
      ]);

      if (batch.length === 0) break;

      // Process batch: fetch transaction details for all signatures in parallel
      const txRequests = batch.map((sig: any) => ({
        method: 'getTransaction',
        params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
      }));

      const txDetails = await this.client.batch(txRequests);

      // Extract and decode memos from transaction details
      const valid: SignatureInfo[] = batch
        .map((sig: any, index: number) => {
          const tx = txDetails[index];
          const memo = this.extractMemoFromTransaction(tx);
          
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            memo: memo ? this.decodeMemo(memo) : null,
            err: sig.err,
            confirmationStatus: sig.confirmationStatus,
          };
        })
        .filter((sig: SignatureInfo) => sig.signature && sig.memo);

      signatures.push(...valid);
      lastSignature = batch[batch.length - 1].signature;

      if (batch.length < 1000) break;

      // Small delay to avoid rate limiting (use configured delay)
      await this.sleep(this.config.delayMs || 500);
    }

    return signatures;
  }

  /**
   * Fetch and structure transactions from DB/Leaf PDA
   * Uses optimized batch fetching for maximum performance
   * @param leafPDA - Leaf PDA public key
   * @param rootTransactions - Root transactions to match against
   * @returns Zero transactions and all DB transactions
   */
  private async getDbTransactions(
    leafPDA: PublicKey,
    rootTransactions: SignatureInfo[]
  ): Promise<{ zeroTransactions: any[]; allDbTransactions: SignatureInfo[] }> {
    // Fetch all DB transactions with batch optimization
    const allDbTransactions: SignatureInfo[] = [];
    let lastSignature: string | null = null;

    while (true) {
      const batch: any[] = await this.client.call('getSignaturesForAddress', [
        leafPDA.toBase58(),
        {
          limit: 1000,
          before: lastSignature || undefined,
        },
      ]);

      if (batch.length === 0) break;

      // Batch fetch transaction details for all signatures
      const txRequests = batch.map((sig: any) => ({
        method: 'getTransaction',
        params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
      }));

      const txDetails = await this.client.batch(txRequests);

      // Extract memos and build signature info
      const valid: SignatureInfo[] = batch
        .map((sig: any, index: number) => {
          const tx = txDetails[index];
          const memo = this.extractMemoFromTransaction(tx);
          
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            memo: memo ? this.decodeMemo(memo) : null,
            err: sig.err,
          };
        })
        .filter((sig: SignatureInfo) => sig.signature && sig.memo);

      allDbTransactions.push(...valid);
      lastSignature = batch[batch.length - 1].signature;

      if (batch.length < 1000) break;

      // Small delay to avoid rate limiting (use configured delay)
      await this.sleep(this.config.delayMs || 500);
    }

    // Filter zero chunk transactions (128 bytes: 64+64+64)
    const zeroTransactions = allDbTransactions
      .filter((sig) => {
        if (!sig.memo) return false;
        const cleaned = sig.memo.replace(/\[\\d+\]\s*/, '').replace(/\\|\s+/g, '');
        const parts = cleaned.split('|');
        return (
          parts.length === 3 &&
          parts[0].length === 64 &&
          parts[1].length === 64 &&
          parts[2].length >= 64
        );
      })
      .map((sig) => {
        const parts = sig.memo!.split('|');
        return {
          signature: sig.signature,
          slot: sig.slot,
          memo: {
            leaf1: parts[0],
            leaf2: parts[1],
            prevSign: parts[2],
          } as ZeroChunk,
        };
      });

    // Match zero transactions with root transactions
    const matched: any[] = [];
    for (const rootTx of rootTransactions) {
      if (!rootTx.memo) continue;

      let rootMemo: any;
      try {
        rootMemo = JSON.parse(rootTx.memo);
      } catch {
        continue;
      }

      if (!rootMemo.proofSignature) continue;

      const matchingZero = zeroTransactions.find(
        (zero) => zero.signature === rootMemo.proofSignature
      );

      if (matchingZero) {
        matched.push({
          root: rootMemo.root,
          proofSignature: rootMemo.proofSignature,
          transaction: matchingZero,
        });
      }
    }

    return { zeroTransactions: matched, allDbTransactions };
  }

  /**
   * Fetch first chunk content for a batch of transactions
   * @param batch - Batch of transactions to process
   * @param allTransactions - All DB transactions for lookup
   * @returns Transactions enriched with first chunk content
   */
  private async fetchFirstChunkBatch(
    batch: any[],
    allTransactions: SignatureInfo[]
  ): Promise<any[]> {
    return await Promise.all(
      batch.map(async (tx) => {
        const firstSignature = tx.transaction.memo.prevSign;
        const firstTx = allTransactions.find((t) => t.signature === firstSignature);

        if (!firstTx || !firstTx.memo) {
          return { ...tx, firstChunkContent: null };
        }

        let memo = firstTx.memo;
        if (!memo.includes('|')) {
          memo = `single|${memo}`;
        }

        const parts = memo.split('|');
        return {
          ...tx,
          firstChunkContent: {
            prev_chunk_sign: parts[0],
            content: parts.slice(1).join('|').replace(/\\+/g, '').replace(/^"|"$/g, ''),
          },
        };
      })
    );
  }

  /**
   * Resolve all memo chunks by following prev_chunk_sign links
   * @param transactions - Transactions with first chunk
   * @param allTransactions - All DB transactions for lookup
   * @returns Complete proof records with all chunks resolved
   */
  private async resolveMemoChunksBatch(
    transactions: any[],
    allTransactions: SignatureInfo[]
  ): Promise<ProofRecord[]> {
    return await Promise.all(
      transactions.map(async (tx) => {
        if (!tx.firstChunkContent) return null;

        const { prev_chunk_sign, content } = tx.firstChunkContent;
        const chunks: any[] = [{ prev_chunk_sign, content }];
        let prevSign = prev_chunk_sign;

        // Follow the chain of previous signatures
        while (prevSign && prevSign !== 'single') {
          const prevTx = allTransactions.find((t) => t.signature === prevSign);
          if (!prevTx || !prevTx.memo) break;

          let memo = prevTx.memo;
          if (!memo.includes('|')) {
            memo = `single|${memo}`;
          }

          const parts = memo.split('|');
          const chunkData = {
            prev_chunk_sign: parts[0],
            content: parts.slice(1).join('|').replace(/\\+/g, '').replace(/^"|"$/g, ''),
          };

          chunks.push(chunkData);
          prevSign = chunkData.prev_chunk_sign;
        }

        // Reconstruct final content
        const finalContent = chunks
          .reverse()
          .map((c) => c.content)
          .join('');

        const cycledContent = [
          { result: finalContent },
          {
            leaf1: tx.transaction.memo.leaf1,
            leaf2: tx.transaction.memo.leaf2,
            prevSign: tx.transaction.memo.prevSign,
          },
          ...chunks,
        ];

        return {
          root: tx.root,
          proofSignature: tx.proofSignature,
          transaction: tx.transaction,
          firstChunkContent: tx.firstChunkContent,
          cycledContent,
        } as ProofRecord;
      })
    ).then((records) => records.filter((r) => r !== null) as ProofRecord[]);
  }

  /**
   * Extract memo from transaction details
   * @param tx - Transaction object
   * @returns Memo string or null
   */
  private extractMemoFromTransaction(tx: any): string | null {
    if (!tx || !tx.transaction) return null;

    try {
      // Look for memo program in instructions
      const instructions = tx.transaction.message?.instructions || [];
      const memoInstruction = instructions.find(
        (ix: any) =>
          ix.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' ||
          ix.program === 'spl-memo'
      );

      if (memoInstruction && memoInstruction.data) {
        return memoInstruction.data;
      }

      // Fallback: check meta.logMessages for memo
      const logs = tx.meta?.logMessages || [];
      for (const log of logs) {
        if (log.startsWith('Program log: Memo (len')) {
          const match = log.match(/: "(.+)"$/);
          if (match) return match[1];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decode memo from base64 or raw string
   * @param memo - Memo to decode
   * @returns Decoded memo string
   */
  private decodeMemo(memo: string): string {
    try {
      // Try base64 decode
      return Buffer.from(memo, 'base64').toString('utf-8');
    } catch {
      // Return as-is if not base64
      return memo;
    }
  }

  /**
   * Sleep utility for batch delays
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get PDA manager instance (for advanced usage)
   */
  public getPDAManager(): PDAManager {
    return this.pdaManager;
  }

  /**
   * Get batch configuration
   */
  public getBatchConfig(): FetchConfig {
    return { ...this.config };
  }

  /**
   * Update batch configuration
   */
  public updateBatchConfig(config: Partial<FetchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Batch fetch multiple proof records for different wallets
   * Uses optimized batching for parallel fetching
   * @param walletAddresses - Array of wallet addresses to fetch for
   * @returns Map of wallet address to their proof records
   */
  public async batchExecuteForWallets(
    walletAddresses: string[]
  ): Promise<Map<string, ZeroCombineResult>> {
    const results = new Map<string, ZeroCombineResult>();
    const batchSize = this.config.batchSize || 10;

    // Process wallets in batches
    for (let i = 0; i < walletAddresses.length; i += batchSize) {
      const batch = walletAddresses.slice(i, i + batchSize);

      // Fetch in parallel within batch
      const batchResults = await Promise.all(
        batch.map(async (address) => {
          try {
            const pdaManager = new PDAManager(this.client, address);
            const pdas = pdaManager.getUserPDAs();
            const result = await this.execute(pdas);
            return { address, result };
          } catch (error) {
            return { address, result: { tools: [] } };
          }
        })
      );

      // Store results
      batchResults.forEach(({ address, result }) => {
        results.set(address, result);
      });

      // Delay between batches
      if (i + batchSize < walletAddresses.length) {
        await this.sleep(this.config.delayMs || 2000);
      }
    }

    return results;
  }
}
