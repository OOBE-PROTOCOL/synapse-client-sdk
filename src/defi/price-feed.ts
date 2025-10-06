/**
 * @file defi/price-feed.ts
 * @module SolanaDeFi/PriceFeed
 * @author Keepeeto
 * @license MIT
 * @description Real-time price feed integration aggregating from Jupiter, Birdeye, and other sources.
 */

import { EventEmitter } from 'eventemitter3';
import type { SynapseClient } from '../client';
import { DeFiError } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface PriceData {
  mint: string;
  symbol?: string;
  price: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdate: number;
}

export interface BirdeyeTokenPrice {
  value: number;
  updateUnixTime: number;
  priceChange24h?: number;
}

// ============================================================================
// Price Feed Integration
// ============================================================================

/**
 * Price Feed Integration
 * Real-time price aggregation from multiple sources
 * 
 * @example
 * ```typescript
 * const priceFeed = new PriceFeedIntegration(client);
 * 
 * // Get prices from Jupiter
 * const prices = await priceFeed.getJupiterPrices(['SOL_MINT', 'USDC_MINT']);
 * 
 * // Get aggregated price
 * const solPrice = await priceFeed.getAggregatedPrice('SOL_MINT');
 * ```
 */
export class PriceFeedIntegration extends EventEmitter {
  constructor(private client: SynapseClient) {
    super();
  }

  /**
   * Get token prices from Jupiter
   */
  async getJupiterPrices(mints: string[], vsToken: string = 'SOL'): Promise<Map<string, PriceData>> {
    try {
      const ids = mints.join(',');
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${ids}&vsToken=${vsToken}`);
      
      if (!response.ok) {
        throw new Error(`Jupiter price API failed: ${response.status}`);
      }

      const data = await response.json();
      const priceMap = new Map<string, PriceData>();

      for (const [mint, priceInfo] of Object.entries(data.data as Record<string, any>)) {
        priceMap.set(mint, {
          mint,
          symbol: priceInfo.mintSymbol,
          price: priceInfo.price,
          lastUpdate: Date.now(),
        });
      }

      return priceMap;

    } catch (error) {
      throw new DeFiError(
        `Failed to get Jupiter prices: ${(error as Error).message}`,
        'quote',
        'jupiter',
        error as Error
      );
    }
  }

  /**
   * Get token price from Birdeye
   */
  async getBirdeyePrice(mint: string, apiKey?: string): Promise<PriceData> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['X-API-KEY'] = apiKey;
      }

      const response = await fetch(
        `https://public-api.birdeye.so/defi/price?address=${mint}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Birdeye API failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        mint,
        price: data.data.value,
        priceChange24h: data.data.priceChange24h,
        lastUpdate: data.data.updateUnixTime * 1000,
      };

    } catch (error) {
      throw new DeFiError(
        `Failed to get Birdeye price: ${(error as Error).message}`,
        'quote',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get aggregated price from multiple sources
   */
  async getAggregatedPrice(mint: string, sources: string[] = ['jupiter', 'birdeye']): Promise<PriceData> {
    const prices: number[] = [];
    let finalData: PriceData = {
      mint,
      price: 0,
      lastUpdate: Date.now(),
    };

    for (const source of sources) {
      try {
        if (source === 'jupiter') {
          const jupPrices = await this.getJupiterPrices([mint]);
          const price = jupPrices.get(mint);
          if (price) {
            prices.push(price.price);
            finalData.symbol = price.symbol;
          }
        } else if (source === 'birdeye') {
          const price = await this.getBirdeyePrice(mint);
          prices.push(price.price);
          finalData.priceChange24h = price.priceChange24h;
        }
      } catch (error) {
        // Continue with other sources
        this.emit('price-source-error', { source, error });
      }
    }

    if (prices.length === 0) {
      throw new DeFiError('No price data available from any source', 'quote');
    }

    // Calculate median price
    prices.sort((a, b) => a - b);
    finalData.price = prices[Math.floor(prices.length / 2)];

    return finalData;
  }

  /**
   * Get multiple token prices (batch)
   */
  async getMultiplePrices(mints: string[], vsToken: string = 'USDC'): Promise<Map<string, PriceData>> {
    return this.getJupiterPrices(mints, vsToken);
  }

  /**
   * Stream price updates (polling-based)
   */
  startPriceStream(
    mints: string[],
    callback: (prices: Map<string, PriceData>) => void,
    intervalMs: number = 10000
  ): () => void {
    const interval = setInterval(async () => {
      try {
        const prices = await this.getJupiterPrices(mints);
        callback(prices);
        this.emit('price-update', prices);
      } catch (error) {
        this.emit('price-stream-error', error);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }
}
