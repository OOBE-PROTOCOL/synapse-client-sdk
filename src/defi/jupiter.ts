/**
 * @file defi/jupiter.ts
 * @module SolanaDeFi/Jupiter
 * @author Keepeeto
 * @license MIT
 * @description Real Jupiter V6 API integration for best swap routes on Solana.
 *              Complete implementation with quote, swap, and price endpoints.
 */

import { EventEmitter } from 'eventemitter3';
import { VersionedTransaction } from '@solana/web3.js';
import type { SynapseClient } from '../client';
import { DeFiError } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number;
  maxAccounts?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  } | null;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface JupiterSwapOptions {
  wrapUnwrapSOL?: boolean;
  feeAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useSharedAccounts?: boolean;
  dynamicComputeUnitLimit?: boolean;
}

export interface JupiterTokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  price: number;
}

// ============================================================================
// Jupiter Integration
// ============================================================================

/**
 * Jupiter Aggregator V6 Integration
 * Real Jupiter API integration for best swap routes across Solana DEXes
 * 
 * @example
 * ```typescript
 * const jupiter = new JupiterIntegration(client);
 * 
 * const quote = await jupiter.getQuote({
 *   inputMint: 'So11111111111111111111111111111111111111112',
 *   outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
 *   amount: 1_000_000_000,
 *   slippageBps: 50,
 * });
 * ```
 */
export class JupiterIntegration extends EventEmitter {
  private client: SynapseClient;
  private baseUrl: string;

  constructor(client: SynapseClient, customUrl?: string) {
    super();
    this.client = client;
    this.baseUrl = customUrl || 'https://quote-api.jup.ag/v6';
  }

  /**
   * Get quote from Jupiter aggregator
   */
  async getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
    try {
      this.emit('jupiter-quote-start', params);

      const queryParams = new URLSearchParams({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: (params.slippageBps || 50).toString(),
        swapMode: params.swapMode || 'ExactIn',
        onlyDirectRoutes: params.onlyDirectRoutes ? 'true' : 'false',
        asLegacyTransaction: params.asLegacyTransaction ? 'true' : 'false',
        ...(params.maxAccounts && { maxAccounts: params.maxAccounts.toString() }),
        ...(params.platformFeeBps && { platformFeeBps: params.platformFeeBps.toString() }),
      });

      const response = await fetch(`${this.baseUrl}/quote?${queryParams.toString()}`);

      if (!response.ok) {
        const error = await response.text();
        throw new DeFiError(
          `Jupiter quote failed: ${response.status} ${error}`,
          'quote',
          'jupiter'
        );
      }

      const quote = await response.json() as JupiterQuoteResponse;
      
      this.emit('jupiter-quote-complete', {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
      });

      return quote;

    } catch (error) {
      this.emit('jupiter-quote-error', error);
      throw new DeFiError(
        `Jupiter quote failed: ${(error as Error).message}`,
        'quote',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getSwapTransaction(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
    options?: JupiterSwapOptions
  ): Promise<JupiterSwapResponse> {
    try {
      this.emit('jupiter-swap-tx-start', { user: userPublicKey });

      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: options?.wrapUnwrapSOL ?? true,
          useSharedAccounts: options?.useSharedAccounts ?? true,
          feeAccount: options?.feeAccount,
          computeUnitPriceMicroLamports: options?.computeUnitPriceMicroLamports,
          prioritizationFeeLamports: options?.prioritizationFeeLamports,
          asLegacyTransaction: options?.asLegacyTransaction ?? false,
          dynamicComputeUnitLimit: options?.dynamicComputeUnitLimit ?? true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new DeFiError(
          `Jupiter swap transaction failed: ${response.status} ${error}`,
          'swap',
          'jupiter'
        );
      }

      const swapData = await response.json() as JupiterSwapResponse;
      
      this.emit('jupiter-swap-tx-complete', {
        txSize: swapData.swapTransaction.length,
        priorityFee: swapData.prioritizationFeeLamports,
      });

      return swapData;

    } catch (error) {
      this.emit('jupiter-swap-tx-error', error);
      throw new DeFiError(
        `Jupiter swap transaction failed: ${(error as Error).message}`,
        'swap',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Execute complete swap (quote + swap + send)
   */
  async executeSwap(
    params: JupiterQuoteParams,
    userPublicKey: string,
    options?: {
      signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
      sendOptions?: { skipPreflight?: boolean; maxRetries?: number };
      swapOptions?: JupiterSwapOptions;
    }
  ): Promise<{
    signature: string;
    quote: JupiterQuoteResponse;
    success: boolean;
  }> {
    try {
      // Step 1: Get quote
      const quote = await this.getQuote(params);

      // Step 2: Get swap transaction
      const swapData = await this.getSwapTransaction(quote, userPublicKey, options?.swapOptions);

      // Step 3: Deserialize and sign transaction
      const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
      let transaction = VersionedTransaction.deserialize(txBuffer);

      if (options?.signTransaction) {
        transaction = await options.signTransaction(transaction);
      } else {
        throw new DeFiError(
          'signTransaction callback required for executeSwap',
          'swap',
          'jupiter'
        );
      }

      // Step 4: Send transaction via Synapse RPC
      const signature = await this.client.call<string>(
        'sendTransaction',
        [
          Buffer.from(transaction.serialize()).toString('base64'),
          {
            skipPreflight: options?.sendOptions?.skipPreflight ?? false,
            maxRetries: options?.sendOptions?.maxRetries ?? 3,
            encoding: 'base64',
          },
        ]
      );

      this.emit('jupiter-swap-complete', { signature });

      return {
        signature,
        quote,
        success: true,
      };

    } catch (error) {
      this.emit('jupiter-swap-error', error);
      throw new DeFiError(
        `Jupiter swap execution failed: ${(error as Error).message}`,
        'swap',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Get token price from Jupiter
   */
  async getTokenPrice(mintAddress: string, vsToken: string = 'USDC'): Promise<JupiterTokenPrice> {
    try {
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${mintAddress}&vsToken=${vsToken}`);
      
      if (!response.ok) {
        throw new Error(`Price API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data[mintAddress];

    } catch (error) {
      throw new DeFiError(
        `Failed to get token price: ${(error as Error).message}`,
        'quote',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Get token prices (batch)
   */
  async getTokenPrices(mintAddresses: string[], vsToken: string = 'USDC'): Promise<Map<string, JupiterTokenPrice>> {
    try {
      const ids = mintAddresses.join(',');
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${ids}&vsToken=${vsToken}`);
      
      if (!response.ok) {
        throw new Error(`Price API failed: ${response.status}`);
      }

      const data = await response.json();
      const priceMap = new Map<string, JupiterTokenPrice>();

      for (const [mint, priceInfo] of Object.entries(data.data as Record<string, any>)) {
        priceMap.set(mint, priceInfo);
      }

      return priceMap;

    } catch (error) {
      throw new DeFiError(
        `Failed to get token prices: ${(error as Error).message}`,
        'quote',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Get supported tokens list
   */
  async getTokenList(): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    tags?: string[];
  }>> {
    try {
      const response = await fetch('https://token.jup.ag/all');
      
      if (!response.ok) {
        throw new Error(`Token list API failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      throw new DeFiError(
        `Failed to get token list: ${(error as Error).message}`,
        'quote',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Update base URL for custom Jupiter instance
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
