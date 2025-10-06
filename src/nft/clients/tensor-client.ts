/**
 * Tensor API Client
 * Production-ready integration with Tensor marketplace API
 * @see https://docs.tensor.trade/tensorswap-api
 */

import {
  TensorCollectionStats,
  TensorListing,
  TensorSale,
  TensorErrorResponse,
  MarketplaceClientConfig,
} from '../types.nft';

export interface TensorClientConfig {
  baseUrl?: string;
  apiKey?: string;
  rateLimit?: number; // requests per second
  timeout?: number;
  fetch?: typeof fetch;
  logLevel?: 'debug' | 'info' | 'error' | 'none';
}

interface RateLimiter {
  lastRequest: number;
  minInterval: number;
}

/**
 * TensorClient - Tensor API integration
 * Handles rate limiting, error handling, and response validation
 */
export class TensorClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logLevel: 'debug' | 'info' | 'error' | 'none';
  private readonly rateLimiter: RateLimiter;

  constructor(config?: TensorClientConfig) {
    this.baseUrl = config?.baseUrl || 'https://api.tensor.so';
    this.apiKey = config?.apiKey;
    this.timeout = config?.timeout || 10000;
    this.logLevel = config?.logLevel || 'error';

    // Rate limiter: default 10 req/s = 100ms between requests
    const rateLimit = config?.rateLimit || 10;
    this.rateLimiter = {
      lastRequest: 0,
      minInterval: 1000 / rateLimit,
    };

    // Cross-platform fetch support
    if (config?.fetch) {
      this.fetchImpl = config.fetch;
    } else if (typeof globalThis.fetch !== 'undefined') {
      this.fetchImpl = globalThis.fetch.bind(globalThis);
    } else {
      // Node <18 requires fetch polyfill
      throw new Error(
        'fetch is not available. Please provide a fetch implementation via config.fetch or upgrade to Node 18+'
      );
    }
  }

  /**
   * Get collection statistics from Tensor
   * @param slug - Collection slug (e.g. "mad_lads")
   * @returns Collection statistics including floor price, volume, sales
   */
  async getCollectionStats(slug: string): Promise<TensorCollectionStats> {
    this.logDebug(`Fetching collection stats for: ${slug}`);

    const url = `${this.baseUrl}/api/v1/collections/${slug}/stats`;
    const response = await this.makeRequest<TensorCollectionStats>(url);

    this.logInfo(`Collection stats fetched: ${slug} - Floor: ${response.floorPrice / 1e9} SOL`);
    return response;
  }

  /**
   * Get current floor price for a collection
   * @param slug - Collection slug
   * @returns Floor price in lamports
   */
  async getFloorPrice(slug: string): Promise<number> {
    const stats = await this.getCollectionStats(slug);
    return stats.floorPrice;
  }

  /**
   * Get active listings for a collection
   * @param slug - Collection slug
   * @param options - Pagination and filter options
   * @returns Array of active listings
   */
  async getListings(
    slug: string,
    options?: {
      limit?: number;
      page?: number;
      sortBy?: 'price' | 'listedAt';
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<TensorListing[]> {
    this.logDebug(`Fetching listings for: ${slug}`);

    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.page) params.append('page', options.page.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortDirection) params.append('sortDirection', options.sortDirection);

    const url = `${this.baseUrl}/api/v1/collections/${slug}/listings?${params.toString()}`;
    const response = await this.makeRequest<{ listings: TensorListing[] }>(url);

    this.logInfo(`Fetched ${response.listings.length} listings for: ${slug}`);
    return response.listings;
  }

  /**
   * Get recent sales for a collection
   * @param slug - Collection slug
   * @param options - Pagination options
   * @returns Array of recent sales
   */
  async getSales(
    slug: string,
    options?: {
      limit?: number;
      page?: number;
    }
  ): Promise<TensorSale[]> {
    this.logDebug(`Fetching sales for: ${slug}`);

    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.page) params.append('page', options.page.toString());

    const url = `${this.baseUrl}/api/v1/collections/${slug}/sales?${params.toString()}`;
    const response = await this.makeRequest<{ sales: TensorSale[] }>(url);

    this.logInfo(`Fetched ${response.sales.length} sales for: ${slug}`);
    return response.sales;
  }

  /**
   * Get listing for a specific NFT mint
   * @param mint - NFT mint address
   * @returns Listing information or null if not listed
   */
  async getMintListing(mint: string): Promise<TensorListing | null> {
    this.logDebug(`Fetching listing for mint: ${mint}`);

    const url = `${this.baseUrl}/api/v1/mints/${mint}/listing`;
    try {
      const response = await this.makeRequest<TensorListing>(url);
      this.logInfo(`Listing found for mint: ${mint}`);
      return response;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.logDebug(`No listing found for mint: ${mint}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Health check - verify Tensor API is accessible
   * @returns True if API is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try fetching a popular collection as health check
      await this.getCollectionStats('okay_bears');
      return true;
    } catch (error) {
      this.logError(`Tensor API health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private async makeRequest<T>(url: string): Promise<T> {
    // Rate limiting
    await this.enforceRateLimit();

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      this.logDebug(`Request: GET ${url}`);

      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Tensor API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson: TensorErrorResponse = JSON.parse(errorBody);
          errorMessage = `Tensor API error: ${errorJson.message || errorJson.error}`;
        } catch {
          errorMessage += ` - ${errorBody.substring(0, 200)}`;
        }

        throw new Error(errorMessage);
      }

      // Parse JSON response
      const data = await response.json();
      this.logDebug(`Response: ${response.status} - ${JSON.stringify(data).substring(0, 100)}...`);

      return data as T;

    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new Error(`Tensor API request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiter.lastRequest;

    if (timeSinceLastRequest < this.rateLimiter.minInterval) {
      const waitTime = this.rateLimiter.minInterval - timeSinceLastRequest;
      this.logDebug(`Rate limit: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.lastRequest = Date.now();
  }

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes('404') || error.message.includes('not found'))
    );
  }

  private logDebug(message: string): void {
    if (this.logLevel === 'debug') {
      console.log(`[TensorClient:DEBUG] ${message}`);
    }
  }

  private logInfo(message: string): void {
    if (this.logLevel === 'debug' || this.logLevel === 'info') {
      console.log(`[TensorClient:INFO] ${message}`);
    }
  }

  private logError(message: string): void {
    if (this.logLevel !== 'none') {
      console.error(`[TensorClient:ERROR] ${message}`);
    }
  }
}
