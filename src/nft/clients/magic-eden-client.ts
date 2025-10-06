/**
 * Magic Eden API Client
 * Integration with Magic Eden marketplace API
 * @see https://api.magiceden.dev/
 * @see https://docs.magiceden.io/
 */

import {
  MagicEdenCollectionStats,
  MagicEdenCollection,
  MagicEdenListing,
  MagicEdenActivity,
  MagicEdenErrorResponse,
} from '../types.nft';

export interface MagicEdenClientConfig {
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
 * MagicEdenClient - Production-ready Magic Eden API integration
 * Handles rate limiting, error handling, and response validation
 */
export class MagicEdenClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logLevel: 'debug' | 'info' | 'error' | 'none';
  private readonly rateLimiter: RateLimiter;

  constructor(config?: MagicEdenClientConfig) {
    this.baseUrl = config?.baseUrl || 'https://api-mainnet.magiceden.dev/v2';
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
   * Get collection statistics from Magic Eden
   * @param symbol - Collection symbol (e.g. "okay_bears")
   * @returns Collection statistics including floor price, volume
   */
  async getCollectionStats(symbol: string): Promise<MagicEdenCollectionStats> {
    this.logDebug(`Fetching collection stats for: ${symbol}`);

    const url = `${this.baseUrl}/collections/${symbol}/stats`;
    const response = await this.makeRequest<MagicEdenCollectionStats>(url);

    this.logInfo(`Collection stats fetched: ${symbol} - Floor: ${response.floorPrice} SOL`);
    return response;
  }

  /**
   * Get collection information
   * @param symbol - Collection symbol
   * @returns Collection metadata and info
   */
  async getCollectionInfo(symbol: string): Promise<MagicEdenCollection> {
    this.logDebug(`Fetching collection info for: ${symbol}`);

    const url = `${this.baseUrl}/collections/${symbol}`;
    const response = await this.makeRequest<MagicEdenCollection>(url);

    this.logInfo(`Collection info fetched: ${symbol} - ${response.name}`);
    return response;
  }

  /**
   * Get current floor price for a collection
   * @param symbol - Collection symbol
   * @returns Floor price in SOL (not lamports)
   */
  async getFloorPrice(symbol: string): Promise<number> {
    const stats = await this.getCollectionStats(symbol);
    return stats.floorPrice;
  }

  /**
   * Get active listings for a collection
   * @param symbol - Collection symbol
   * @param options - Pagination options
   * @returns Array of active listings
   */
  async getListings(
    symbol: string,
    options?: {
      offset?: number;
      limit?: number;
    }
  ): Promise<MagicEdenListing[]> {
    this.logDebug(`Fetching listings for: ${symbol}`);

    const params = new URLSearchParams();
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `${this.baseUrl}/collections/${symbol}/listings?${params.toString()}`;
    const response = await this.makeRequest<MagicEdenListing[]>(url);

    this.logInfo(`Fetched ${response.length} listings for: ${symbol}`);
    return response;
  }

  /**
   * Get collection activities (sales, listings, etc.)
   * @param symbol - Collection symbol
   * @param options - Pagination options
   * @returns Array of activities
   */
  async getCollectionActivities(
    symbol: string,
    options?: {
      offset?: number;
      limit?: number;
    }
  ): Promise<MagicEdenActivity[]> {
    this.logDebug(`Fetching activities for: ${symbol}`);

    const params = new URLSearchParams();
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `${this.baseUrl}/collections/${symbol}/activities?${params.toString()}`;
    const response = await this.makeRequest<MagicEdenActivity[]>(url);

    this.logInfo(`Fetched ${response.length} activities for: ${symbol}`);
    return response;
  }

  /**
   * Get listing for a specific NFT token
   * @param mintAddress - NFT mint address
   * @returns Listing information or null if not listed
   */
  async getTokenListing(mintAddress: string): Promise<MagicEdenListing | null> {
    this.logDebug(`Fetching listing for token: ${mintAddress}`);

    const url = `${this.baseUrl}/tokens/${mintAddress}/listings`;
    try {
      const response = await this.makeRequest<MagicEdenListing[]>(url);
      
      if (response.length === 0) {
        this.logDebug(`No listing found for token: ${mintAddress}`);
        return null;
      }

      // Return the first (active) listing
      this.logInfo(`Listing found for token: ${mintAddress}`);
      return response[0];
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.logDebug(`No listing found for token: ${mintAddress}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Get recent sales for a collection
   * @param symbol - Collection symbol
   * @param options - Pagination options
   * @returns Array of recent sales (filtered buyNow activities)
   */
  async getSales(
    symbol: string,
    options?: {
      offset?: number;
      limit?: number;
    }
  ): Promise<MagicEdenActivity[]> {
    const activities = await this.getCollectionActivities(symbol, options);
    // Filter for sales only (buyNow type)
    return activities.filter((activity) => activity.type === 'buyNow');
  }

  /**
   * Search for collections by name
   * @param query - Search query
   * @param limit - Maximum results
   * @returns Array of matching collections
   */
  async searchCollections(query: string, limit = 20): Promise<MagicEdenCollection[]> {
    this.logDebug(`Searching collections: ${query}`);

    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const url = `${this.baseUrl}/collections?${params.toString()}`;
    const response = await this.makeRequest<MagicEdenCollection[]>(url);

    this.logInfo(`Found ${response.length} collections for: ${query}`);
    return response;
  }

  /**
   * Health check - verify Magic Eden API is accessible
   * @returns True if API is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try fetching a popular collection as health check
      await this.getCollectionStats('okay_bears');
      return true;
    } catch (error) {
      this.logError(`Magic Eden API health check failed: ${(error as Error).message}`);
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
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
        let errorMessage = `Magic Eden API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson: MagicEdenErrorResponse = JSON.parse(errorBody);
          errorMessage = `Magic Eden API error: ${errorJson.error}`;
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
        throw new Error(`Magic Eden API request timeout after ${this.timeout}ms`);
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
      console.log(`[MagicEdenClient:DEBUG] ${message}`);
    }
  }

  private logInfo(message: string): void {
    if (this.logLevel === 'debug' || this.logLevel === 'info') {
      console.log(`[MagicEdenClient:INFO] ${message}`);
    }
  }

  private logError(message: string): void {
    if (this.logLevel !== 'none') {
      console.error(`[MagicEdenClient:ERROR] ${message}`);
    }
  }
}
