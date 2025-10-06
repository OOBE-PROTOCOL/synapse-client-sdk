import { Commitment, Connection } from "@solana/web3.js";

export interface SynapseLikeClient {
  connection: Connection;
  // Optional helpers your client may provide
  fetch?: typeof fetch;
}

export interface NFTConfig {
  client: SynapseLikeClient; // must expose a web3.js Connection
  defaultCommitment?: Commitment;

  // HTTP fetcher override (defaults to global fetch)
  fetch?: typeof fetch;

  // Optional DAS (Digital Asset Standard) endpoint for compressed NFTs
  das?: {
    baseUrl: string; // e.g. 
    getAssetPath?: string; // default: "/v0/assets"
    getAssetByIdPath?: string; // default: "/v0/assets/byId"
    getAssetProofPath?: string; // default: "/v0/assets/proof"
    headers?: Record<string, string>;
  };
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
  rarity?: number;
}

export interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  attributes?: NFTAttribute[];
  external_url?: string;
  properties?: any;
  collection?: { name?: string; family?: string; verified?: boolean } | null;
  symbol?: string;
}

export interface NFTInfo {
  mint: string; // mint address (standard) or asset id (compressed)
  owner?: string; // owner pubkey for standard NFTs
  metadata: NFTMetadata;
  compressed: boolean;
  collection?: { address?: string; verified?: boolean; name?: string } | null;
  model?: 'token' | 'programmableNFT' | 'compressed';
  creators?: Array<{ address: string; verified: boolean; share: number }>;
  updateAuthority?: string | null;
  edition?: { isMaster: boolean; number?: number } | null;
}

export interface CompressedNFTInfo extends NFTInfo {
  tree?: string;
  leaf?: string | number;
  proof?: string[];
}

export interface AIRarityAnalysis {
  overallRarity: number; // 0-100 suggested scale
  traitRarities: Record<string, number>;
}

// ============================================================================
// Marketplace Client Configuration
// ============================================================================

export interface MarketplaceClientConfig {
  /** Tensor API configuration */
  tensor?: {
    baseUrl?: string; // default: https://api.tensor.so
    apiKey?: string; // optional API key for higher rate limits
    rateLimit?: number; // requests per second, default: 10
  };
  /** Magic Eden API configuration */
  magicEden?: {
    baseUrl?: string; // default: https://api-mainnet.magiceden.dev/v2
    apiKey?: string; // optional API key
    rateLimit?: number; // default: 10 req/s
  };
  /** Helius DAS configuration for compressed NFTs */
  helius?: {
    apiKey: string;
    cluster?: 'mainnet-beta' | 'devnet';
  };
  /** Cross-platform fetch implementation */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds */
  timeout?: number; // default: 10000
  /** Enable detailed logging */
  logLevel?: 'debug' | 'info' | 'error' | 'none';
}

// ============================================================================
// Tensor API Types
// ============================================================================

/**
 * Tensor Collection Statistics Response
 * @see https://docs.tensor.trade/tensorswap-api
 */
export interface TensorCollectionStats {
  /** Collection slug/identifier */
  slug: string;
  /** Collection name */
  name: string;
  /** Current floor price in lamports */
  floorPrice: number;
  /** Listed count */
  numListed: number;
  /** 24h volume in lamports */
  volume24h: number;
  /** 7d volume in lamports */
  volume7d: number;
  /** 30d volume in lamports */
  volume30d: number;
  /** All-time volume in lamports */
  volumeAll: number;
  /** 24h sales count */
  sales24h: number;
  /** Total supply */
  totalSupply: number;
  /** Market cap in lamports (floor * supply) */
  marketCap: number;
  /** Average price in lamports */
  avgPrice24h?: number;
  /** 24h floor price change percentage */
  floorChange24h?: number;
  /** Royalty percentage (basis points) */
  royaltyBps?: number;
  /** Verified creator addresses */
  creators?: string[];
}

/**
 * Tensor Active Listing
 */
export interface TensorListing {
  /** Transaction signature */
  txId: string;
  /** NFT mint address */
  mint: string;
  /** Seller wallet address */
  seller: string;
  /** Listing price in lamports */
  price: number;
  /** Listing timestamp (Unix seconds) */
  listedAt: number;
  /** Listing source */
  source: 'tensor' | 'tensorswap';
  /** Optional listing URL */
  url?: string;
}

/**
 * Tensor Sale Activity
 */
export interface TensorSale {
  /** Transaction signature */
  txId: string;
  /** NFT mint address */
  mint: string;
  /** Seller wallet */
  seller: string;
  /** Buyer wallet */
  buyer: string;
  /** Sale price in lamports */
  price: number;
  /** Sale timestamp (Unix seconds) */
  timestamp: number;
  /** Marketplace source */
  source: string;
}

/**
 * Tensor API Error Response
 */
export interface TensorErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// ============================================================================
// Magic Eden API Types
// ============================================================================

/**
 * Magic Eden Collection Statistics Response
 * @see https://api.magiceden.dev/v2/collections/{symbol}/stats
 */
export interface MagicEdenCollectionStats {
  /** Collection symbol */
  symbol: string;
  /** Floor price in SOL (not lamports) */
  floorPrice: number;
  /** Listed count */
  listedCount: number;
  /** Average price in last 24h (SOL) */
  avgPrice24hr: number;
  /** 24h volume in SOL */
  volumeAll: number;
  /** Volume change in last 24h */
  volume24hr: number;
  /** Volume change (delta) */
  volume24hrChange?: number;
}

/**
 * Magic Eden Collection Info
 */
export interface MagicEdenCollection {
  /** Collection symbol */
  symbol: string;
  /** Collection name */
  name: string;
  /** Description */
  description?: string;
  /** Image URL */
  image?: string;
  /** Twitter handle */
  twitter?: string;
  /** Discord URL */
  discord?: string;
  /** Website URL */
  website?: string;
  /** Total items */
  totalItems?: number;
  /** Is derivative */
  isDerived?: boolean;
  /** Categories */
  categories?: string[];
}

/**
 * Magic Eden Listing Response
 */
export interface MagicEdenListing {
  /** Price in lamports */
  price: number;
  /** Price tag (formatted, deprecated field) */
  priceTag?: string;
  /** Token mint address */
  tokenMint: string;
  /** Token address (PDA) */
  tokenAddress: string;
  /** Seller address */
  seller: string;
  /** Seller referral (optional) */
  sellerReferral?: string;
  /** NFT token size */
  tokenSize: number;
  /** PDA address */
  pdaAddress: string;
  /** Expiry timestamp */
  expiry?: number;
  /** ATA (Associated Token Account) */
  auctionHouse?: string;
  /** Listing receipt */
  receipt?: string;
}

/**
 * Magic Eden Activity (Sales/Listings)
 */
export interface MagicEdenActivity {
  /** Transaction signature */
  signature: string;
  /** Activity type */
  type: 'buyNow' | 'list' | 'delist' | 'bid' | 'cancelBid';
  /** NFT mint */
  tokenMint: string;
  /** Collection symbol */
  collection: string;
  /** Collection name */
  collectionName?: string;
  /** Price in lamports */
  price: number;
  /** Seller wallet */
  seller?: string;
  /** Buyer wallet */
  buyer?: string;
  /** Block time (Unix seconds) */
  blockTime: number;
  /** Slot number */
  slot: number;
}

/**
 * Magic Eden API Error Response
 */
export interface MagicEdenErrorResponse {
  error: string;
  statusCode: number;
}

// ============================================================================
// Normalized Marketplace Data
// ============================================================================

/**
 * Unified collection statistics aggregated from multiple marketplaces
 */
export interface AggregatedCollectionStats {
  /** Collection identifier */
  collectionAddress: string;
  /** Collection name */
  name?: string;
  /** Floor price in SOL (lowest across marketplaces) */
  floorPrice: number;
  /** Floor price source */
  floorPriceSource: 'tensor' | 'magiceden' | 'aggregated';
  /** Total supply */
  totalSupply: number;
  /** Listed count */
  listed: number;
  /** Listed percentage */
  listedPercent: number;
  /** 24h volume in SOL */
  volume24h: number;
  /** 7d volume in SOL */
  volume7d: number;
  /** 30d volume in SOL */
  volume30d?: number;
  /** 24h sales count */
  sales24h: number;
  /** Average sale price in last 24h (SOL) */
  avgPrice24h: number;
  /** Unique holders count */
  uniqueHolders?: number;
  /** Holder count */
  holders?: number;
  /** Floor price change 24h (percentage) */
  floorChange24h?: number;
  /** Data sources used */
  sources: {
    tensor: boolean;
    magicEden: boolean;
  };
  /** Timestamp of data aggregation */
  timestamp: number;
}

/**
 * Normalized marketplace listing (unified format)
 */
export interface NormalizedMarketplaceListing {
  /** Marketplace source */
  marketplace: 'tensor' | 'magiceden' | 'solanart' | 'opensea' | 'hyperspace';
  /** NFT mint address */
  mint: string;
  /** Listing price in SOL */
  price: number;
  /** Listing price in lamports */
  priceLamports: number;
  /** Seller wallet address */
  seller: string;
  /** Listing URL */
  listingUrl: string;
  /** Listed timestamp (Unix seconds) */
  timestamp: number;
  /** Optional attributes */
  attributes?: Record<string, string | number>;
}