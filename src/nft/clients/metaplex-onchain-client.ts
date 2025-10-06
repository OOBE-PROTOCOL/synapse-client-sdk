/**
 * Metaplex On-Chain Client
 * Direct on-chain NFT collection analysis using Solana RPC and DAS API
 * Alternative to marketplace APIs for decentralized, trustless data
 * @see https://developers.metaplex.com/
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createBaseUmi } from '@metaplex-foundation/umi';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { 
  fetchDigitalAsset,
  findMetadataPda,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import type { Umi } from '@metaplex-foundation/umi';

export interface MetaplexOnChainConfig {
  connection: Connection;
  /** Optional RPC endpoint override */
  rpcEndpoint?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable detailed logging */
  logLevel?: 'debug' | 'info' | 'error' | 'none';
  /** DAS (Digital Asset Standard) API endpoint for faster queries (Helius, Triton, etc.) */
  dasEndpoint?: string;
}

export interface OnChainCollectionMetadata {
  collectionMint: string;
  name: string;
  symbol: string;
  uri: string;
  updateAuthority: string;
  creators: Array<{
    address: string;
    verified: boolean;
    share: number;
  }>;
  sellerFeeBasisPoints: number;
  isMutable: boolean;
  collection?: {
    verified: boolean;
    key: string;
  };
}

export interface OnChainCollectionStats {
  collectionMint: string;
  totalSupply: number;
  verifiedNFTs: number;
  holders: number;
  uniqueHolders: number;
  holderDistribution: {
    whales: number;        // Holders with >10% supply
    medium: number;        // Holders with 1-10% supply
    retail: number;        // Holders with <1% supply
  };
  topHolders: Array<{
    address: string;
    count: number;
    percentage: number;
  }>;
  nftsByCreator: number;
  dataSource: 'on-chain';
  timestamp: number;
}

export interface OnChainNFT {
  mint: string;
  owner: string;
  metadata: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
  };
  collection?: string;
  verified: boolean;
}

/**
 * MetaplexOnChainClient - Direct on-chain NFT analysis
 * 
 * Provides trustless, decentralized collection statistics without
 * relying on centralized marketplace APIs. Uses Metaplex standards,
 * Solana RPC queries, and optional DAS API for faster bulk operations.
 * 
 * **Use Cases:**
 * - Collections not listed on major marketplaces
 * - Trustless verification of collection data
 * - Real-time holder distribution analysis
 * - Independent supply and holder calculations
 * 
 * **Trade-offs:**
 * - Slower than marketplace APIs (requires multiple RPC calls)
 * - No historical price data (no marketplace context)
 * - No marketplace-specific metrics (listings, sales, volume)
 * - Higher RPC costs for large collections (1000+ NFTs)
 * 
 * **Recommended:** Use with Helius DAS API for production deployments
 */
export class MetaplexOnChainClient {
  private readonly connection: Connection;
  private readonly rpcEndpoint: string;
  private readonly timeout: number;
  private readonly logLevel: 'debug' | 'info' | 'error' | 'none';
  private readonly dasEndpoint?: string;
  private readonly umi: Umi;

  constructor(config: MetaplexOnChainConfig) {
    this.connection = config.connection;
    this.rpcEndpoint = config.rpcEndpoint || this.connection.rpcEndpoint;
    this.timeout = config.timeout || 30000;
    this.logLevel = config.logLevel || 'error';
    this.dasEndpoint = config.dasEndpoint;

    // Initialize Umi with Metaplex Token Metadata plugin
    this.umi = createBaseUmi();
    this.umi.use(mplTokenMetadata());
  }

  /**
   * Get collection metadata from on-chain data using Metaplex standards
   * @param collectionMint - Collection mint address
   * @returns Collection metadata parsed from Metaplex Token Metadata
   */
  async getCollectionMetadata(collectionMint: string): Promise<OnChainCollectionMetadata> {
    this.logDebug(`Fetching on-chain metadata for collection: ${collectionMint}`);

    try {
      const mint = umiPublicKey(collectionMint);
      
      // Fetch digital asset using Metaplex library
      const digitalAsset = await fetchDigitalAsset(this.umi, mint);
      
      // Extract metadata
      const metadata = digitalAsset.metadata;
      
      // Helper to unwrap Option types from Metaplex
      const unwrapOption = <T>(option: any): T | undefined => {
        if (!option || option.__option === 'None') return undefined;
        return option.__option === 'Some' ? option.value : option;
      };

      const creators = unwrapOption<any[]>(metadata.creators) || [];
      const collection = unwrapOption<any>(metadata.collection);
      
      const result: OnChainCollectionMetadata = {
        collectionMint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        updateAuthority: metadata.updateAuthority.toString(),
        creators: creators.map((creator: any) => ({
          address: creator.address.toString(),
          verified: creator.verified,
          share: creator.share,
        })),
        sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
        isMutable: metadata.isMutable,
        collection: collection ? {
          verified: collection.verified,
          key: collection.key.toString(),
        } : undefined,
      };

      this.logInfo(`Metadata fetched: ${result.name} (${result.symbol})`);
      return result;

    } catch (error) {
      this.logError(`Failed to fetch collection metadata: ${(error as Error).message}`);
      throw new Error(`On-chain metadata fetch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get all NFTs in a collection by creator
   * Uses DAS API if available (recommended), falls back to RPC
   * @param creatorAddress - Creator/collection address
   * @param options - Query options
   * @returns Array of NFTs with owner and metadata
   */
  async getCollectionNFTs(
    creatorAddress: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<OnChainNFT[]> {
    this.logDebug(`Fetching NFTs for creator: ${creatorAddress}`);

    try {
      // Use DAS API if available (much faster for large collections)
      if (this.dasEndpoint) {
        return await this.getCollectionNFTsViaDAS(creatorAddress, options);
      }

      // Fallback to RPC queries (slower, more expensive)
      this.logInfo('WARNING: Fetching via RPC - slow for large collections. Consider using DAS API (Helius)');
      
      // For production: Implement getProgramAccounts with filters
      // This requires significant RPC calls and is expensive
      throw new Error('RPC-only collection fetching not implemented. Please provide dasEndpoint for production use.');

    } catch (error) {
      this.logError(`Failed to fetch collection NFTs: ${(error as Error).message}`);
      throw new Error(`On-chain NFT fetch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get NFTs via DAS (Digital Asset Standard) API - RECOMMENDED
   * Supports Helius, Triton, and other DAS-compatible providers
   * @private
   */
  private async getCollectionNFTsViaDAS(
    creatorAddress: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<OnChainNFT[]> {
    if (!this.dasEndpoint) {
      throw new Error('DAS endpoint not configured');
    }

    this.logDebug(`Fetching NFTs via DAS API: ${creatorAddress}`);

    try {
      const response = await fetch(this.dasEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'get-assets-by-creator',
          method: 'getAssetsByCreator',
          params: {
            creatorAddress,
            onlyVerified: true,
            page: options?.offset ? Math.floor(options.offset / 1000) + 1 : 1,
            limit: options?.limit || 1000,
          },
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`DAS API error: ${data.error.message}`);
      }

      const assets = data.result?.items || [];
      const nfts: OnChainNFT[] = assets.map((asset: any) => ({
        mint: asset.id,
        owner: asset.ownership?.owner || 'unknown',
        metadata: {
          name: asset.content?.metadata?.name || 'Unknown',
          symbol: asset.content?.metadata?.symbol || '',
          uri: asset.content?.json_uri || '',
          sellerFeeBasisPoints: asset.royalty?.basis_points || 0,
        },
        collection: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value,
        verified: asset.grouping?.find((g: any) => g.group_key === 'collection')?.verified || false,
      }));

      this.logInfo(`Fetched ${nfts.length} NFTs via DAS API (total in response)`);
      return nfts;

    } catch (error) {
      this.logError(`DAS API fetch failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Calculate on-chain collection statistics
   * Analyzes holder distribution, supply, and concentration risk
   * @param creatorAddress - Creator/collection address
   * @returns Comprehensive on-chain statistics
   */
  async calculateOnChainStats(creatorAddress: string): Promise<OnChainCollectionStats> {
    this.logDebug(`Calculating on-chain stats for: ${creatorAddress}`);

    try {
      // Fetch all NFTs in collection
      const nfts = await this.getCollectionNFTs(creatorAddress);

      // Calculate holder distribution
      const holderMap = new Map<string, number>();
      let verifiedCount = 0;

      for (const nft of nfts) {
        if (nft.owner && nft.owner !== 'unknown') {
          holderMap.set(nft.owner, (holderMap.get(nft.owner) || 0) + 1);
        }
        if (nft.verified) {
          verifiedCount++;
        }
      }

      const totalSupply = nfts.length;
      const uniqueHolders = holderMap.size;

      // Calculate holder distribution (whales/medium/retail)
      const holderCounts = Array.from(holderMap.entries());
      const distribution = {
        whales: 0,
        medium: 0,
        retail: 0,
      };

      for (const [, count] of holderCounts) {
        const percentage = (count / totalSupply) * 100;
        if (percentage > 10) {
          distribution.whales++;
        } else if (percentage >= 1) {
          distribution.medium++;
        } else {
          distribution.retail++;
        }
      }

      // Get top 10 holders
      const topHolders = holderCounts
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([address, count]) => ({
          address,
          count,
          percentage: (count / totalSupply) * 100,
        }));

      const stats: OnChainCollectionStats = {
        collectionMint: creatorAddress,
        totalSupply,
        verifiedNFTs: verifiedCount,
        holders: holderMap.size,
        uniqueHolders,
        holderDistribution: distribution,
        topHolders,
        nftsByCreator: totalSupply,
        dataSource: 'on-chain',
        timestamp: Date.now(),
      };

      this.logInfo(`Stats calculated: ${totalSupply} NFTs, ${uniqueHolders} unique holders`);
      return stats;

    } catch (error) {
      this.logError(`Failed to calculate on-chain stats: ${(error as Error).message}`);
      throw new Error(`On-chain stats calculation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get holder distribution analysis with concentration risk
   * Uses Herfindahl-Hirschman Index (HHI) for concentration measurement
   * @param creatorAddress - Creator/collection address
   * @returns Holder distribution data with risk score
   */
  async getHolderDistribution(creatorAddress: string): Promise<{
    totalHolders: number;
    distribution: Map<string, number>;
    concentrationRisk: number;  // 0-100 score (higher = more concentrated)
  }> {
    this.logDebug(`Analyzing holder distribution for: ${creatorAddress}`);

    try {
      const stats = await this.calculateOnChainStats(creatorAddress);
      const distribution = new Map<string, number>();

      stats.topHolders.forEach(holder => {
        distribution.set(holder.address, holder.count);
      });

      // Calculate concentration risk using Herfindahl-Hirschman Index
      // HHI = sum of squared market shares
      let hhi = 0;
      stats.topHolders.forEach(holder => {
        const share = holder.percentage / 100;
        hhi += share * share;
      });
      const concentrationRisk = Math.min(100, hhi * 100);

      this.logInfo(`Distribution analyzed: ${stats.uniqueHolders} holders, concentration risk: ${concentrationRisk.toFixed(2)}`);

      return {
        totalHolders: stats.uniqueHolders,
        distribution,
        concentrationRisk,
      };

    } catch (error) {
      this.logError(`Failed to analyze holder distribution: ${(error as Error).message}`);
      throw new Error(`Holder distribution analysis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get all NFTs owned by a specific wallet
   * @param ownerAddress - Wallet address
   * @returns Array of owned NFTs
   */
  async getNFTsByOwner(ownerAddress: string): Promise<OnChainNFT[]> {
    this.logDebug(`Fetching NFTs for owner: ${ownerAddress}`);

    try {
      // Use DAS API if available (fastest method)
      if (this.dasEndpoint) {
        const response = await fetch(this.dasEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'get-assets-by-owner',
            method: 'getAssetsByOwner',
            params: {
              ownerAddress,
              page: 1,
              limit: 1000,
            },
          }),
        });

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`DAS API error: ${data.error.message}`);
        }

        const assets = data.result?.items || [];

        const nfts: OnChainNFT[] = assets.map((asset: any) => ({
          mint: asset.id,
          owner: ownerAddress,
          metadata: {
            name: asset.content?.metadata?.name || 'Unknown',
            symbol: asset.content?.metadata?.symbol || '',
            uri: asset.content?.json_uri || '',
            sellerFeeBasisPoints: asset.royalty?.basis_points || 0,
          },
          collection: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value,
          verified: asset.grouping?.find((g: any) => g.group_key === 'collection')?.verified || false,
        }));

        this.logInfo(`Fetched ${nfts.length} NFTs for owner via DAS`);
        return nfts;
      }

      // Fallback to Token Program queries (slower)
      this.logInfo('Fetching NFTs via Token Program (no DAS API)');
      const owner = new PublicKey(ownerAddress);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      // Filter for NFTs (amount = 1, decimals = 0)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const parsed = account.account.data.parsed;
        return parsed.info.tokenAmount.decimals === 0 && 
               parsed.info.tokenAmount.amount === '1';
      });

      const nfts: OnChainNFT[] = nftAccounts.map(account => ({
        mint: account.account.data.parsed.info.mint,
        owner: ownerAddress,
        metadata: {
          name: 'Unknown',  // Would require additional metadata fetch
          symbol: '',
          uri: '',
          sellerFeeBasisPoints: 0,
        },
        verified: false,
      }));

      this.logInfo(`Fetched ${nfts.length} NFTs for owner via Token Program`);
      return nfts;

    } catch (error) {
      this.logError(`Failed to fetch NFTs by owner: ${(error as Error).message}`);
      throw new Error(`Owner NFT fetch failed: ${(error as Error).message}`);
    }
  }

  /**
   * Health check - verify RPC and DAS API connectivity
   * @returns True if services are accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check RPC connectivity
      await this.connection.getLatestBlockhash();
      
      // Check DAS API if configured
      if (this.dasEndpoint) {
        const response = await fetch(this.dasEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'health-check',
            method: 'getHealth',
            params: [],
          }),
        });
        
        if (!response.ok) {
          this.logError(`DAS API health check failed: ${response.status}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.logError(`Health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  // =========================================================================
  // Private Methods - Logging
  // =========================================================================

  private logDebug(message: string): void {
    if (this.logLevel === 'debug') {
      console.log(`[MetaplexOnChainClient:DEBUG] ${message}`);
    }
  }

  private logInfo(message: string): void {
    if (this.logLevel === 'debug' || this.logLevel === 'info') {
      console.log(`[MetaplexOnChainClient:INFO] ${message}`);
    }
  }

  private logError(message: string): void {
    if (this.logLevel !== 'none') {
      console.error(`[MetaplexOnChainClient:ERROR] ${message}`);
    }
  }
}
