/**
 * @file defi/jito.ts
 * @module SolanaDeFi/Jito
 * @author Keepeeto
 * @license MIT
 * @description Real Jito Block Engine API integration for MEV-protected transactions.
 *              Complete implementation with bundle submission, status tracking, and tip management.
 */

import { EventEmitter } from 'eventemitter3';
import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import type { SynapseClient } from '../client';
import { DeFiError } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface JitoTipAccount {
  address: string;
  region: 'mainnet' | 'ny' | 'amsterdam' | 'frankfurt' | 'tokyo';
}

export interface JitoBundleParams {
  transactions: string[]; // base64 encoded transactions
  tipLamports?: number;
  tipAccount?: string;
}

export interface JitoBundleResult {
  bundleId: string;
  status: 'accepted' | 'pending' | 'landed' | 'failed';
  slot?: number;
  confirmations?: number;
  landedTipLamports?: number;
}

export interface JitoBundleStatus {
  bundleId: string;
  transactions: string[];
  slot?: number;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
  err?: any;
}

// ============================================================================
// Jito Integration
// ============================================================================

/**
 * Jito Block Engine Integration
 * Real Jito API for MEV-protected transaction bundles
 * 
 * @example
 * ```typescript
 * const jito = new JitoIntegration(client);
 * 
 * // Get tip account
 * const tipAccount = jito.getTipAccount('mainnet');
 * 
 * // Submit bundle
 * const bundle = await jito.submitBundle({
 *   transactions: [serializedTx1, serializedTx2],
 *   tipLamports: 1_000_000,
 * });
 * 
 * // Check status
 * const status = await jito.getBundleStatus(bundle.bundleId);
 * ```
 */
export class JitoIntegration extends EventEmitter {
  private client: SynapseClient;
  private blockEngineUrl: string;
  
  // Official Jito tip accounts
  private readonly tipAccounts: JitoTipAccount[] = [
    { address: '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', region: 'mainnet' },
    { address: 'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe', region: 'ny' },
    { address: 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY', region: 'amsterdam' },
    { address: 'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49', region: 'frankfurt' },
    { address: 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', region: 'tokyo' },
    { address: 'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt', region: 'mainnet' },
    { address: '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT', region: 'mainnet' },
    { address: 'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL', region: 'mainnet' },
  ];

  constructor(client: SynapseClient, customUrl?: string) {
    super();
    this.client = client;
    this.blockEngineUrl = customUrl || 'https://mainnet.block-engine.jito.wtf';
  }

  /**
   * Get recommended tip account based on region
   */
  getTipAccount(region: JitoTipAccount['region'] = 'mainnet'): string {
    const accounts = this.tipAccounts.filter((acc) => acc.region === region);
    if (accounts.length === 0) {
      return this.tipAccounts[0].address;
    }
    // Return random account from region for load balancing
    return accounts[Math.floor(Math.random() * accounts.length)].address;
  }

  /**
   * Get all tip accounts for a specific region
   */
  getTipAccountsByRegion(region: JitoTipAccount['region']): string[] {
    return this.tipAccounts
      .filter((acc) => acc.region === region)
      .map((acc) => acc.address);
  }

  /**
   * Create tip instruction
   */
  createTipInstruction(
    from: PublicKey,
    tipLamports: number,
    tipAccount?: string
  ): TransactionInstruction {
    const tipAccountPubkey = new PublicKey(
      tipAccount || this.getTipAccount('mainnet')
    );

    return SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: tipAccountPubkey,
      lamports: tipLamports,
    });
  }

  /**
   * Submit bundle to Jito
   */
  async submitBundle(params: JitoBundleParams): Promise<JitoBundleResult> {
    try {
      this.emit('jito-bundle-submit', { txCount: params.transactions.length });

      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [params.transactions],
        }),
      });

      if (!response.ok) {
        throw new Error(`Jito bundle submission failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Bundle submission failed');
      }

      const bundleId = data.result;

      this.emit('jito-bundle-submitted', { bundleId });

      return {
        bundleId,
        status: 'accepted',
      };

    } catch (error) {
      this.emit('jito-bundle-error', error);
      throw new DeFiError(
        `Jito bundle submission failed: ${(error as Error).message}`,
        'mev-protection',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get bundle status
   */
  async getBundleStatus(bundleId: string): Promise<JitoBundleResult> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get bundle status: ${response.status}`);
      }

      const data = await response.json();
      const bundleStatus = data.result?.value?.[0];

      if (!bundleStatus) {
        return {
          bundleId,
          status: 'pending',
        };
      }

      return {
        bundleId,
        status: bundleStatus.confirmation_status || 'pending',
        slot: bundleStatus.slot,
        confirmations: bundleStatus.confirmations,
        landedTipLamports: bundleStatus.landed_tips_lamports,
      };

    } catch (error) {
      throw new DeFiError(
        `Failed to get bundle status: ${(error as Error).message}`,
        'mev-protection',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get bundle statuses (batch)
   */
  async getBundleStatuses(bundleIds: string[]): Promise<JitoBundleResult[]> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [bundleIds],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get bundle statuses: ${response.status}`);
      }

      const data = await response.json();
      const statuses = data.result?.value || [];

      return bundleIds.map((bundleId, index) => {
        const status = statuses[index];
        if (!status) {
          return { bundleId, status: 'pending' as const };
        }

        return {
          bundleId,
          status: status.confirmation_status || 'pending',
          slot: status.slot,
          confirmations: status.confirmations,
          landedTipLamports: status.landed_tips_lamports,
        };
      });

    } catch (error) {
      throw new DeFiError(
        `Failed to get bundle statuses: ${(error as Error).message}`,
        'mev-protection',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get inflight bundle statuses
   */
  async getInflightBundleStatuses(bundleIds: string[]): Promise<JitoBundleResult[]> {
    try {
      const response = await fetch(`${this.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getInflightBundleStatuses',
          params: [bundleIds],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get inflight statuses: ${response.status}`);
      }

      const data = await response.json();
      const statuses = data.result?.value || [];

      return statuses.map((status: any) => ({
        bundleId: status.bundle_id,
        status: status.status || 'pending',
        slot: status.slot,
        confirmations: status.confirmations,
      }));

    } catch (error) {
      throw new DeFiError(
        `Failed to get inflight statuses: ${(error as Error).message}`,
        'mev-protection',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get tip accounts
   */
  getTipAccounts(): JitoTipAccount[] {
    return [...this.tipAccounts];
  }

  /**
   * Get tip accounts by region (convenience method)
   */
  getAllTipAccountsByRegion(): Map<string, string[]> {
    const byRegion = new Map<string, string[]>();
    
    for (const account of this.tipAccounts) {
      const existing = byRegion.get(account.region) || [];
      existing.push(account.address);
      byRegion.set(account.region, existing);
    }

    return byRegion;
  }

  /**
   * Wait for bundle confirmation
   */
  async waitForBundleConfirmation(
    bundleId: string,
    options?: {
      timeout?: number;
      pollingInterval?: number;
      confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
    }
  ): Promise<JitoBundleResult> {
    const timeout = options?.timeout || 60000; // 60s default
    const pollingInterval = options?.pollingInterval || 2000; // 2s default
    const targetStatus = options?.confirmationStatus || 'confirmed';

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getBundleStatus(bundleId);

      if (status.status === 'landed' || status.status === 'failed') {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }

    throw new DeFiError(
      `Bundle confirmation timeout after ${timeout}ms`,
      'mev-protection',
      undefined
    );
  }

  /**
   * Update block engine URL
   */
  setBlockEngineUrl(url: string): void {
    this.blockEngineUrl = url;
  }

  /**
   * Get current block engine URL
   */
  getBlockEngineUrl(): string {
    return this.blockEngineUrl;
  }

  /**
   * Get recommended tip amount based on priority
   */
  getRecommendedTip(priority: 'low' | 'medium' | 'high' | 'turbo'): number {
    const tips = {
      low: 10_000, // 0.00001 SOL
      medium: 100_000, // 0.0001 SOL
      high: 1_000_000, // 0.001 SOL
      turbo: 10_000_000, // 0.01 SOL
    };
    return tips[priority];
  }
}
