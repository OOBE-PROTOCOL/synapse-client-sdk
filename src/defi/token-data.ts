/**
 * @file defi/token-data.ts
 * @module SolanaDeFi/TokenData
 * @author Keepeeto
 * @license MIT
 * @description Real Solana token data integration using Synapse RPC client.
 *              SPL token accounts, balances, supply, and holder information.
 */

import { EventEmitter } from 'eventemitter3';
import type { SynapseClient } from '../client';
import { DeFiError } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface TokenAccountInfo {
  pubkey: string; // Token account address
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  delegate?: string;
  delegatedAmount?: string;
  isNative: boolean;
  rentExemptReserve?: string;
  closeAuthority?: string;
}

export interface TokenSupply {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

export interface TokenLargestAccount {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

// ============================================================================
// Token Data Integration
// ============================================================================

/**
 * Token Data Integration
 * Real Solana token data using Synapse RPC client
 * 
 * @example
 * ```typescript
 * const tokenData = new TokenDataIntegration(client);
 * 
 * // Get all SPL tokens for wallet
 * const tokens = await tokenData.getTokenAccountsByOwner('wallet...');
 * 
 * // Get SOL balance
 * const balance = await tokenData.getBalance('wallet...');
 * ```
 */
export class TokenDataIntegration extends EventEmitter {
  constructor(private client: SynapseClient) {
    super();
  }

  /**
   * Get SPL token accounts for wallet
   */
  async getTokenAccountsByOwner(
    ownerAddress: string,
    programId: string = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  ): Promise<TokenAccountInfo[]> {
    try {
      this.emit('token-accounts-fetch-start', { owner: ownerAddress });

      const response: { value: Array<{ pubkey: string; account: any }> } = await this.client.call('getTokenAccountsByOwner', [
        ownerAddress,
        { programId },
        { encoding: 'jsonParsed' },
      ]);

      const accounts: TokenAccountInfo[] = response.value.map((item: any) => {
        const parsed = item.account.data.parsed.info;
        return {
          pubkey: item.pubkey,
          mint: parsed.mint,
          owner: parsed.owner,
          amount: parsed.tokenAmount.amount,
          decimals: parsed.tokenAmount.decimals,
          uiAmount: parsed.tokenAmount.uiAmount,
          delegate: parsed.delegate,
          delegatedAmount: parsed.delegatedAmount?.amount,
          isNative: parsed.isNative,
          rentExemptReserve: parsed.rentExemptReserve,
          closeAuthority: parsed.closeAuthority,
        };
      });

      this.emit('token-accounts-fetch-complete', { count: accounts.length });
      return accounts;

    } catch (error) {
      this.emit('token-accounts-fetch-error', error);
      throw new DeFiError(
        `Failed to fetch token accounts: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get token supply
   */
  async getTokenSupply(mintAddress: string): Promise<TokenSupply> {
    try {
      const response = await this.client.call('getTokenSupply', [mintAddress]);
      return response.value;
    } catch (error) {
      throw new DeFiError(
        `Failed to get token supply: ${(error as Error).message}`,
        'quote',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get token largest accounts
   */
  async getTokenLargestAccounts(mintAddress: string, limit: number = 20): Promise<TokenLargestAccount[]> {
    try {
      const response = await this.client.call('getTokenLargestAccounts', [
        mintAddress,
        { commitment: 'confirmed' },
      ]);

      return response.value.slice(0, limit).map((account: any) => ({
        address: account.address,
        amount: account.amount,
        decimals: account.decimals,
        uiAmount: account.uiAmount,
      }));

    } catch (error) {
      throw new DeFiError(
        `Failed to get largest accounts: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get multiple token accounts
   */
  async getMultipleTokenAccounts(addresses: string[]): Promise<Array<TokenAccountInfo | null>> {
    try {
      const response = await this.client.call('getMultipleAccounts', [
        addresses,
        { encoding: 'jsonParsed' },
      ]);

      return response.value.map((account: any, index: number) => {
        if (!account) return null;
        
        const parsed = account.data?.parsed?.info;
        if (!parsed) return null;

        return {
          pubkey: addresses[index],
          mint: parsed.mint,
          owner: parsed.owner,
          amount: parsed.tokenAmount.amount,
          decimals: parsed.tokenAmount.decimals,
          uiAmount: parsed.tokenAmount.uiAmount,
          delegate: parsed.delegate,
          delegatedAmount: parsed.delegatedAmount?.amount,
          isNative: parsed.isNative,
        };
      });

    } catch (error) {
      throw new DeFiError(
        `Failed to get multiple accounts: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get SOL balance
   */
  async getBalance(address: string): Promise<number> {
    try {
      const lamports = await this.client.call<number>('getBalance', [address]);
      return lamports / 1e9; // Convert to SOL
    } catch (error) {
      throw new DeFiError(
        `Failed to get balance: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get account info with parsed data
   */
  async getAccountInfo(address: string): Promise<any> {
    try {
      return await this.client.call('getAccountInfo', [
        address,
        { encoding: 'jsonParsed' },
      ]);
    } catch (error) {
      throw new DeFiError(
        `Failed to get account info: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get token accounts by mint
   */
  async getTokenAccountsByMint(mint: string): Promise<TokenAccountInfo[]> {
    try {
      const response = await this.client.call('getProgramAccounts', [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        {
          encoding: 'jsonParsed',
          filters: [
            {
              dataSize: 165,
            },
            {
              memcmp: {
                offset: 0,
                bytes: mint,
              },
            },
          ],
        },
      ]);

      return response.map((item: any) => {
        const parsed = item.account.data.parsed.info;
        return {
          pubkey: item.pubkey,
          mint: parsed.mint,
          owner: parsed.owner,
          amount: parsed.tokenAmount.amount,
          decimals: parsed.tokenAmount.decimals,
          uiAmount: parsed.tokenAmount.uiAmount,
          delegate: parsed.delegate,
          isNative: parsed.isNative,
        };
      });

    } catch (error) {
      throw new DeFiError(
        `Failed to get token accounts by mint: ${(error as Error).message}`,
        'portfolio',
        undefined,
        error as Error
      );
    }
  }
}
