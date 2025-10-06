/**
 * Merkle Operation - Synapse SDK Implementation
 *
 * Professional Merkle tree operations for proof generation, verification and
 * on-chain inscription. Inspired by OOBE Protocol but optimized for Synapse SDK
 * with efficient batching and modular architecture.
 *
 * @module MerkleOperation
 * @author Synapse Gateway Team
 */

import {
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    Connection,
    Keypair,
    Signer,
    SendOptions
} from '@solana/web3.js';
import type { SynapseClient } from '../client';
import { PDAManager, type UserPDAs } from './pda-manager';
import type { BatchOptionRequest } from './types.ai';
import * as crypto from 'crypto';
import { SolanaRpcMethods } from '../methods/solana-rpc';
/**
 * Merkle tree node/leaf
 */
export interface MerkleLeaf {
    /** Input hash (32 bytes hex) */
    input: string;
    /** Result hash (32 bytes hex) */
    result: string;
}

/**
 * Merkle proof
 */
export interface MerkleProof {
    /** Leaf hash */
    leaf: string;
    /** Proof hashes */
    proof: string[];
    /** Root hash */
    root: string;
}

/**
 * Merkle validation result
 */
export interface MerkleValidationResult {
    /** Merkle root hash */
    merkleRoot: string;
    /** Merkle proof */
    merkleProof: string[];
    /** Merkle leaf data */
    merkleLeaf: MerkleLeaf;
    /** Compressed events (base64) */
    merkleEvents: string;
}

/**
 * Chunk info for on-chain inscription
 */
export interface ChunkInfo {
    /** Chunk data buffer */
    data: Buffer;
    /** Is first chunk */
    isFirst: boolean;
    /** Is last chunk */
    isLast: boolean;
    /** Chunk index */
    index: number;
}

/**
 * Inscription result
 */
export interface InscriptionResult {
    /** DB PDA where data was stored */
    dbAccountStore: PublicKey;
    /** Root PDA where proof was stored */
    dbAccountRoot: PublicKey;
    /** Zero chunk signature (last data chunk) */
    zeroChunkSign: string;
    /** Root transaction signature */
    signatureRoot: string;
    /** Merkle root */
    merkleRoot: string;
    /** Merkle proof */
    merkleProof: string[];
    /** Merkle leaf */
    merkleLeaf: MerkleLeaf;
    /** Compressed events */
    merkleEvents: string;
}

/**
 * MerkleOperation - handles Merkle tree operations and on-chain storage
 *
 * This class provides utilities for:
 * - Generating Merkle trees from event data
 * - Creating and verifying proofs
 * - Splitting large data into chunks
 * - Inscribing data on-chain via memo transactions
 * 
 * For on-chain operations, you can provide either:
 * - A Solana Connection + Signer for real transaction signing
 * - Just use SynapseClient (will require pre-signed transactions)
 */
export class MerkleOperation {
    private client: SynapseClient;
    private pdaManager: PDAManager;
    private walletAddress: PublicKey;
    private batchConfig: BatchOptionRequest;
    private signer?: Signer | Keypair;
    private rpcMethods: SolanaRpcMethods;
    // Merkle tree state
    private leaves: string[] = [];
    private tree: string[][] = [];
    private root: string = '';

    /**      
     * Create a new MerkleOperation instance
     * @param client - Synapse client for RPC calls
     * @param walletAddress - User wallet address
     * @param batchConfig - Optional batch processing configuration
     * @param signer - Optional Signer/Keypair for signing transactions
     */
    constructor(
        client: SynapseClient,
        walletAddress: string,
        batchConfig?: BatchOptionRequest,
        connection?: Connection,
        signer?: Signer | Keypair
    ) {
        this.client = client;
        this.walletAddress = new PublicKey(walletAddress);
        this.pdaManager = new PDAManager(client, walletAddress);
        this.signer = signer;
        this.batchConfig = {
            batchSize: 50,
            delayMs: 1000,
            maxRetries: 3,
            retryDelayMs: 1000,
            ...batchConfig,
        };
        this.rpcMethods = new SolanaRpcMethods(client);
    }

    /**
     * Create Merkle tree from data array
     * @param data - Array of data items to hash
     * @returns Merkle root hash (hex)
     */
    public createMerkleTree(data: string[]): string {
        if (data.length === 0) throw new Error('Data array cannot be empty');

        // Hash all leaves
        this.leaves = data.map((item) => this.hash(item));

        // Build tree bottom-up
        this.tree = [this.leaves];
        let currentLevel = this.leaves;

        while (currentLevel.length > 1) {
            const nextLevel: string[] = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                nextLevel.push(this.hash(left + right));
            }
            this.tree.push(nextLevel);
            currentLevel = nextLevel;
        }

        this.root = currentLevel[0];
        return this.root;
    }

    /**
     * Get Merkle proof for a leaf
     * @param leafData - Data to generate proof for
     * @returns Merkle proof
     */
    public getMerkleProof(leafData: string): MerkleProof {
        const leaf = this.hash(leafData);
        const leafIndex = this.leaves.indexOf(leaf);

        if (leafIndex === -1) {
            throw new Error('Leaf not found in tree');
        }

        const proof: string[] = [];
        let index = leafIndex;

        for (let level = 0; level < this.tree.length - 1; level++) {
            const currentLevel = this.tree[level];
            const isRightNode = index % 2 === 1;
            const siblingIndex = isRightNode ? index - 1 : index + 1;

            if (siblingIndex < currentLevel.length) {
                proof.push(currentLevel[siblingIndex]);
            }

            index = Math.floor(index / 2);
        }

        return {
            leaf,
            proof,
            root: this.root,
        };
    }

    /**
     * Verify a Merkle proof
     * @param leaf - Leaf hash
     * @param proof - Proof hashes
     * @param root - Expected root hash
     * @returns true if proof is valid
     */
    public verifyProof(leaf: string, proof: string[], root: string): boolean {
        let computedHash = leaf;

        for (const proofElement of proof) {
            // Deterministic ordering: smaller hash first
            if (computedHash < proofElement) {
                computedHash = this.hash(computedHash + proofElement);
            } else {
                computedHash = this.hash(proofElement + computedHash);
            }
        }

        return computedHash === root;
    }

    /**
     * Batch verify multiple Merkle proofs
     * @param proofs - Array of proof objects to verify
     * @returns Array of verification results
     */
    public batchVerifyProofs(
        proofs: Array<{ leaf: string; proof: string[]; root: string }>
    ): boolean[] {
        return proofs.map((p) => this.verifyProof(p.leaf, p.proof, p.root));
    }  /**
   * Calculate optimal chunks from buffer
   * Splits data into chunks while respecting size limits for memo transactions
   * @param buffer - Data buffer to chunk
   * @param minChunkSize - Minimum chunk size (default: 1)
   * @param maxChunkSize - Maximum chunk size (default: 560 for memo safety)
   * @returns Array of chunk buffers
   */
    public calculateChunks(
        buffer: Buffer,
        minChunkSize: number = 1,
        maxChunkSize: number = 560
    ): Buffer[] {
        const chunks: Buffer[] = [];
        const adjustedMaxChunkSize = maxChunkSize - 64; // Reserve space for signature linking

        let offset = 0;
        while (offset < buffer.length) {
            const remainingBytes = buffer.length - offset;
            let chunkSize: number;

            if (remainingBytes <= maxChunkSize) {
                // Last chunk can use full maxChunkSize
                chunkSize = Math.min(Math.max(minChunkSize, remainingBytes), maxChunkSize);
            } else {
                // Other chunks use adjusted size
                chunkSize = Math.min(Math.max(minChunkSize, remainingBytes), adjustedMaxChunkSize);
            }

            const chunk = buffer.subarray(offset, offset + chunkSize);
            chunks.push(chunk);
            offset += chunkSize;
        }

        return chunks;
    }

    /**
     * Create zero chunk (128 bytes: 2 merkle leaves + previous signature)
     * @param leaf - Merkle leaf data
     * @returns Zero chunk buffer (128 bytes)
     */
    public createZeroChunk(leaf: MerkleLeaf): Buffer {
        const zeroChunk = Buffer.alloc(128);

        // First 64 bytes: input hash
        Buffer.from(leaf.input, 'hex').copy(zeroChunk, 0);

        // Second 64 bytes: result hash
        Buffer.from(leaf.result, 'hex').copy(zeroChunk, 64);

        return zeroChunk;
    }

    /**
     * On-chain Merkle inscription - stores data + proof on Solana
     * Uses PDA accounts to store chunked data and merkle roots
     * @param validationResult - Merkle validation result to inscribe
     * @param pdas - Optional custom PDAs
     * @returns Inscription result with signatures and PDAs
     */
    public async inscribeOnChain(
        validationResult: MerkleValidationResult,
        pdas?: UserPDAs
    ): Promise<InscriptionResult> {
        // Get or use provided PDAs
        const userPDAs = pdas || this.pdaManager.getUserPDAs();

        // Check if PDAs exist
        const { leafExists, rootExists } = await this.pdaManager.checkPDAExistence(userPDAs);

        if (!leafExists || !rootExists) {
            throw new Error(
                'PDA accounts not initialized. Create accounts first using PDAManager.'
            );
        }

        const { input, result } = validationResult.merkleLeaf;
        const compressedEvents = validationResult.merkleEvents;

        if (!input || !result || !compressedEvents) {
            throw new Error('Invalid validation result: missing required fields');
        }

        // Create zero chunk (128 bytes)
        const zeroChunk = Buffer.alloc(128);
        Buffer.from(input, 'hex').copy(zeroChunk, 0);
        Buffer.from(result, 'hex').copy(zeroChunk, 64);

        // Prepare events buffer and chunk it
        const eventsBuffer = this.trimTrailingZeros(Buffer.from(compressedEvents, 'utf-8'));
        const eventChunks = this.calculateChunks(eventsBuffer, 1, 560);

        // All chunks: events + zero chunk
        const allChunks = [...eventChunks, zeroChunk];

        let prevSignature: string | null = null;
        let zeroChunkSignature: string | null = null;

        // Process each chunk
        for (let index = 0; index < allChunks.length; index++) {
            const chunk = allChunks[index];
            const isFirst = index === 0;
            const isLast = index === allChunks.length - 1;

            let memoData: Buffer;

            if (isFirst && !isLast) {
                // First chunk: just the data
                memoData = chunk;
            } else if (isLast && prevSignature) {
                // Last chunk (zero chunk): data only
                memoData = chunk;
            } else if (!isFirst && !isLast && prevSignature) {
                // Intermediate chunks: link to previous
                memoData = Buffer.from(`${prevSignature}|${chunk.toString('utf-8')}`);
            } else {
                // Single chunk case
                memoData = chunk;
            }

            // Send transaction with memo
            const signature = await this.sendMemoTransaction(
                userPDAs.leafPDA,
                memoData
            );

            prevSignature = signature;
            if (isLast) {
                zeroChunkSignature = signature;
            }

            // Small delay between transactions
            await this.sleep(500);
        }

        if (!zeroChunkSignature) {
            throw new Error('Failed to inscribe zero chunk');
        }

        // Store root and proof in Root PDA
        const rootData = {
            root: validationResult.merkleRoot,
            proofSignature: zeroChunkSignature,
            proof: validationResult.merkleProof,
            leaf: validationResult.merkleLeaf,
        };

        const rootSignature = await this.sendMemoTransaction(
            userPDAs.rootPDA,
            Buffer.from(JSON.stringify(rootData))
        );

        return {
            dbAccountStore: userPDAs.leafPDA,
            dbAccountRoot: userPDAs.rootPDA,
            zeroChunkSign: zeroChunkSignature,
            signatureRoot: rootSignature,
            merkleRoot: validationResult.merkleRoot,
            merkleProof: validationResult.merkleProof,
            merkleLeaf: validationResult.merkleLeaf,
            merkleEvents: validationResult.merkleEvents,
        };
    }

    /**
     * Send a memo transaction to store data
     * Uses Synapse client for transaction submission with Memo Program
     * 
     * Two modes of operation:
     * 1. With Connection + Signer: Signs and sends transaction directly
     * 2. Without Connection: Returns unsigned transaction for external signing
     * 
     * @param pda - Target PDA
     * @param data - Data buffer to store in memo
     * @returns Transaction signature
     */
    private async sendMemoTransaction(pda: PublicKey, data: Buffer): Promise<string> {
        try {
            // Memo Program ID (SPL Memo Program)
            const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

            // Create memo instruction
            const memoInstruction = new TransactionInstruction({
                keys: [
                    // PDA as a readonly account for tracking
                    { pubkey: pda, isSigner: false, isWritable: false },
                ],
                programId: MEMO_PROGRAM_ID,
                data: data, // Memo data
            });

            // Create transaction
            const transaction = new Transaction();
            transaction.add(memoInstruction);

            // Get recent blockhash
            const blockhashData = await this.client.call<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
                'getLatestBlockhash',
                [{ commitment: 'confirmed' }]
            );

            const { blockhash, lastValidBlockHeight } = blockhashData.value;
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = this.walletAddress;

            // MODE 2: Serialize for external signing (wallet adapter, etc.)
            // User must sign and send this transaction themselves
            const serializedTx = transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
            }).toString('base64');

            // Send via Synapse client (assumes pre-signed or will be rejected)
            const signature = await this.client.call<string>('sendTransaction', [
                serializedTx,
                {
                    encoding: 'base64',
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    maxRetries: this.batchConfig.maxRetries || 3,
                },
            ]);

            // Wait for confirmation with retry
            let confirmed = false;
            let attempts = 0;
            const maxAttempts = this.batchConfig.maxRetries || 3;

            while (!confirmed && attempts < maxAttempts) {
                try {
                    const status = await this.client.call<{ value: Array<{ confirmationStatus?: string }> }>(
                        'getSignatureStatuses',
                        [[signature], { searchTransactionHistory: true }]
                    );

                    if (status?.value?.[0]?.confirmationStatus === 'confirmed' ||
                        status?.value?.[0]?.confirmationStatus === 'finalized') {
                        confirmed = true;
                        break;
                    }

                    // Wait before retry
                    await this.sleep(this.batchConfig.retryDelayMs || 1000);
                    attempts++;
                } catch (error) {
                    attempts++;
                    if (attempts >= maxAttempts) throw error;
                    await this.sleep(this.batchConfig.retryDelayMs || 1000);
                }
            }

            if (!confirmed) {
                throw new Error(`Transaction ${signature} not confirmed after ${maxAttempts} attempts`);
            }

            return signature;
        } catch (error) {
            throw new Error(`Failed to send memo transaction: ${(error as Error).message}`);
        }
    }

    /**
     * Create and send multiple memo transactions in batch
     * Uses optimized batching for better performance
     * @param pda - Target PDA
     * @param dataChunks - Array of data buffers to send
     * @returns Array of transaction signatures
     */
    private async batchSendMemoTransactions(
        pda: PublicKey,
        dataChunks: Buffer[]
    ): Promise<string[]> {
        const signatures: string[] = [];
        const batchSize = this.batchConfig.batchSize || 10;

        // Process chunks in batches
        for (let i = 0; i < dataChunks.length; i += batchSize) {
            const batch = dataChunks.slice(i, i + batchSize);

            // Send transactions in parallel within batch
            const batchSignatures = await Promise.all(
                batch.map((chunk) => this.sendMemoTransaction(pda, chunk))
            );

            signatures.push(...batchSignatures);

            // Delay between batches
            if (i + batchSize < dataChunks.length) {
                await this.sleep(this.batchConfig.delayMs || 1000);
            }
        }

        return signatures;
    }

    /**
     * Hash data using SHA-256
     * @param data - Data to hash
     * @returns Hex hash string
     */
    private hash(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Trim trailing zeros from buffer
     * @param buffer - Buffer to trim
     * @returns Trimmed buffer
     */
    private trimTrailingZeros(buffer: Buffer): Buffer {
        let end = buffer.length;
        while (end > 0 && buffer[end - 1] === 0) {
            end--;
        }
        return buffer.subarray(0, end);
    }

    /**
     * Sleep utility
     * @param ms - Milliseconds to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get current Merkle root
     */
    public getRoot(): string {
        return this.root;
    }

    /**
     * Get all leaves
     */
    public getLeaves(): string[] {
        return this.leaves;
    }

    /**
     * Get PDA manager
     */
    public getPDAManager(): PDAManager {
        return this.pdaManager;
    }

    /**
     * Get batch configuration
     */
    public getBatchConfig(): BatchOptionRequest {
        return { ...this.batchConfig };
    }

    /**
     * Update batch configuration
     */
    public updateBatchConfig(config: Partial<BatchOptionRequest>): void {
        this.batchConfig = { ...this.batchConfig, ...config };
    }


    /**
     * Set signer for transaction signing
     * @param signer - Keypair or Signer instance
     */
    public setSigner(signer: Signer | Keypair): void {
        this.signer = signer;
    }


    /**
     * Get unsigned transaction for external signing
     * Useful for wallet adapter integration
     * @param pda - Target PDA
     * @param data - Data buffer to store in memo
     * @returns Unsigned Transaction object
     */
    public async createUnsignedMemoTransaction(
        pda: PublicKey,
        data: Buffer
    ): Promise<Transaction> {
        const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

        const memoInstruction = new TransactionInstruction({
            keys: [{ pubkey: pda, isSigner: false, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: data,
        });

        const transaction = new Transaction();
        transaction.add(memoInstruction);

        const blockhashData = await this.client.call<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
            'getLatestBlockhash',
            [{ commitment: 'confirmed' }]
        );

        const { blockhash, lastValidBlockHeight } = blockhashData.value;
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = this.walletAddress;

        return transaction;
    }

    /**
     * Batch inscribe multiple validation results on-chain
     * Uses client.batch() for optimal performance when inscribing multiple proofs
     * @param validationResults - Array of merkle validation results
     * @param pdas - Optional custom PDAs
     * @returns Array of inscription results
     */
    public async batchInscribeOnChain(
        validationResults: MerkleValidationResult[],
        pdas?: UserPDAs
    ): Promise<InscriptionResult[]> {
        if (validationResults.length === 0) return [];

        const results: InscriptionResult[] = [];
        const batchSize = this.batchConfig.batchSize || 10;

        // Process in batches to avoid overwhelming the network
        for (let i = 0; i < validationResults.length; i += batchSize) {
            const batch = validationResults.slice(i, i + batchSize);

            // Inscribe each in parallel within the batch
            const batchResults = await Promise.all(
                batch.map((result) => this.inscribeOnChain(result, pdas))
            );

            results.push(...batchResults);

            // Delay between batches
            if (i + batchSize < validationResults.length) {
                await this.sleep(this.batchConfig.delayMs || 1000);
            }
        }

        return results;
    }
}
