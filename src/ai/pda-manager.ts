/**
 * PDA Manager - Synapse SDK Implementation
 *
 * Professional PDA (Program Derived Address) manager inspired by OOBE Protocol
 * but implemented using Synapse SDK's modular architecture and batch methods.
 * No Raydium dependencies - pure Solana Web3.js integration.
 *
 * @module PDAManager
 * @author Synapse Gateway Team
 */

import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { SynapseClient } from '../client';
import type { BatchOptionRequest } from './types.ai';
import * as crypto from 'crypto';
import { SolanaRpcMethods } from '../methods/solana-rpc';
/**
 * Configuration for PDA derivation seeds
 */
export interface PDAConfig {
  /** Seed for Merkle database PDA */
  merkleDbSeed?: string;
  /** Seed for Merkle root PDA */
  merkleRootSeed?: string;
  /** Seed for personality database PDA */
  personalityDbSeed?: string;
  /** Seed for personality root PDA */
  personalityRootSeed?: string;
}

/**
 * Default PDA seeds configuration
 */
export const DEFAULT_PDA_CONFIG: Required<PDAConfig> = {
  merkleDbSeed: 'merkle_db',
  merkleRootSeed: 'merkle_root',
  personalityDbSeed: 'personality_db',
  personalityRootSeed: 'personality_root',
};

/**
 * PDAs result structure
 */
export interface UserPDAs {
  /** Leaf/Database PDA for storing merkle data */
  leafPDA: PublicKey;
  /** Root PDA for storing merkle roots and proofs */
  rootPDA: PublicKey;
  /** Bump seed for leaf PDA */
  leafBump: number;
  /** Bump seed for root PDA */
  rootBump: number;
}

/**
 * PDAManager - manages Program Derived Addresses for Merkle storage
 *
 * This class provides utilities to derive and manage PDAs used for storing
 * large amounts of transaction data on-chain using a Merkle tree approach.
 * Compatible with OOBE Protocol patterns but using pure Solana libraries.
 */
export class PDAManager {
  private client: SynapseClient;
  private wallet: PublicKey;
  private config: Required<PDAConfig>;
  private programId: PublicKey;
  private rpcMethods: SolanaRpcMethods;
  private batchConfig: BatchOptionRequest;

  /**
   * Create a new PDAManager instance
   * @param client - Synapse client for RPC calls
   * @param walletAddress - User wallet address
   * @param config - Optional PDA configuration
   * @param programId - Optional program ID (defaults to System Program)
   * @param batchConfig - Optional batch processing configuration
   */
  constructor(
    client: SynapseClient,
    walletAddress: string,
    config?: PDAConfig,
    programId?: string,
    batchConfig?: BatchOptionRequest
  ) {
    this.client = client;
    this.wallet = new PublicKey(walletAddress);
    this.config = { ...DEFAULT_PDA_CONFIG, ...config };
    this.programId = programId ? new PublicKey(programId) : SystemProgram.programId;
    this.rpcMethods = new SolanaRpcMethods(client);
    this.batchConfig = {
      batchSize: 100,
      delayMs: 500,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...batchConfig,
    };
  }

  /**
   * Generate a deterministic seed buffer from a string seed and wallet
   * Uses SHA-256 hashing for deterministic derivation (OOBE-compatible)
   * @param seed - Base seed string
   * @param wallet - Wallet public key
   * @returns 32-byte seed buffer
   */
  private generateSeed(seed: string, wallet: PublicKey): Buffer {
    const combined = `${seed}@${wallet.toBase58()}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    // Take first 32 bytes (64 hex chars) as seed
    return Buffer.from(hash.slice(0, 64), 'hex');
  }

  /**
   * Get user PDAs for Merkle data storage
   * Derives two PDAs: one for storing leaf/chunk data, one for roots
   * @param customConfig - Optional custom seed configuration
   * @returns UserPDAs with leaf and root addresses + bumps
   */
  public getUserPDAs(customConfig?: PDAConfig): UserPDAs {
    const config = { ...this.config, ...customConfig };

    // Derive Leaf/DB PDA
    const leafSeed = this.generateSeed(config.merkleDbSeed, this.wallet);
    const [leafPDA, leafBump] = PublicKey.findProgramAddressSync(
      [leafSeed],
      this.programId
    );

    // Derive Root PDA
    const rootSeed = this.generateSeed(config.merkleRootSeed, this.wallet);
    const [rootPDA, rootBump] = PublicKey.findProgramAddressSync(
      [rootSeed],
      this.programId
    );

    return {
      leafPDA,
      rootPDA,
      leafBump,
      rootBump,
    };
  }

  /**
   * Get user PDAs for Personality storage (OOBE Agent personality system)
   * Similar to getUserPDAs but uses personality-specific seeds
   * @returns UserPDAs for personality data
   */
  public getUserPersonalityPDAs(): UserPDAs {
    const { personalityDbSeed, personalityRootSeed } = this.config;

    // Derive Personality Leaf PDA
    const leafSeed = this.generateSeed(personalityDbSeed, this.wallet);
    const [leafPDA, leafBump] = PublicKey.findProgramAddressSync(
      [leafSeed],
      this.programId
    );

    // Derive Personality Root PDA
    const rootSeed = this.generateSeed(personalityRootSeed, this.wallet);
    const [rootPDA, rootBump] = PublicKey.findProgramAddressSync(
      [rootSeed],
      this.programId
    );

    return {
      leafPDA,
      rootPDA,
      leafBump,
      rootBump,
    };
  }

  /**
   * Check if PDA accounts exist on-chain
   * Uses Synapse client's batch() for optimal performance
   * @param pdas - UserPDAs to check
   * @returns Object indicating which PDAs exist
   */
  public async checkPDAExistence(
    pdas: UserPDAs
  ): Promise<{ leafExists: boolean; rootExists: boolean }> {
    try {
      // Use batch() for parallel account checks
      const results = await this.client.batch([
        {
          method: 'getAccountInfo',
          params: [pdas.leafPDA.toBase58(), { commitment: 'confirmed', encoding: 'base64' }],
        },
        {
          method: 'getAccountInfo',
          params: [pdas.rootPDA.toBase58(), { commitment: 'confirmed', encoding: 'base64' }],
        },
      ]);

      return {
        leafExists: results[0]?.value !== null,
        rootExists: results[1]?.value !== null,
      };
    } catch (error) {
      return { leafExists: false, rootExists: false };
    }
  }

  /**
   * Get PDA account info using Synapse client
   * @param pda - PDA public key
   * @returns Account info or null
   */
  public async getPDAAccountInfo(pda: PublicKey) {
    try {
      return await this.rpcMethods.getAccountInfo(
        pda.toBase58(),
        { commitment: 'confirmed', encoding: 'base64' }
      );
    } catch {
      return null;
    }
  }

  /**
   * Get multiple PDA account infos using batch for optimal performance
   * @param pdas - Array of PDA public keys
   * @returns Array of account infos (null if not found)
   */
  public async getBatchPDAAccountInfo(pdas: PublicKey[]) {
    if (pdas.length === 0) return [];

    try {
      // Use batch() for parallel requests
      const requests = pdas.map((pda) => ({
        method: 'getAccountInfo',
        params: [pda.toBase58(), { commitment: 'confirmed', encoding: 'base64' }],
      }));

      const results = await this.client.batch(requests);
      return results.map((res: any) => res?.value || null);
    } catch {
      return pdas.map(() => null);
    }
  }

  /**
   * Validate PDA derivation (utility for debugging)
   * @param pda - PDA to validate
   * @param seeds - Seeds used for derivation
   * @returns true if PDA matches expected derivation
   */
  public validatePDA(pda: PublicKey, seeds: Buffer[]): boolean {
    try {
      const [derived] = PublicKey.findProgramAddressSync(seeds, this.programId);
      return derived.equals(pda);
    } catch {
      return false;
    }
  }

  /**
   * Get all PDAs for a wallet (convenience method)
   * Returns both standard and personality PDAs
   */
  public getAllUserPDAs() {
    return {
      standard: this.getUserPDAs(),
      personality: this.getUserPersonalityPDAs(),
    };
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
}
