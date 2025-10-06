# NFT Module - Production-Ready Implementation

Enterprise-grade NFT toolkit for Solana blockchain with real-time marketplace integration, collection analytics, rarity calculation, and investment analysis. Built on Tensor and Magic Eden APIs for accurate, production-ready data.

## Table of Contents

- [Architecture](#architecture)
- [Marketplace Clients](#marketplace-clients)
- [Features](#features)
- [Components](#components)
- [Implementation Guide](#implementation-guide)
- [Collection Analytics](#collection-analytics)
- [Marketplace Aggregation](#marketplace-aggregation)
- [AI Rarity Calculator](#ai-rarity-calculator)
- [Investment Advisor](#investment-advisor)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Performance Metrics](#performance-metrics)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NFT Module Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │   NFT Engine     │  │  Collection      │  │   Marketplace      │  │
│  │   (Core Layer)   │→ │  Analytics       │→ │   Aggregator       │  │
│  │                  │  │                  │  │                    │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘  │
│                                                         ↓               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  AI Rarity       │  │  Investment      │  │  Marketplace       │  │
│  │  Calculator      │  │  Advisor         │  │  API Clients       │  │
│  │  (Statistical)   │  │  (Data-driven)   │  │                    │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────┘  │
│                                                         ↓               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Marketplace API Clients                       │  │
│  ├─────────────────────────────────────────────────────────────────┤  │
│  │  TensorClient        │  MagicEdenClient      │  Future Clients  │  │
│  │  - getStats()        │  - getStats()         │  - Solanart      │  │
│  │  - getFloorPrice()   │  - getFloorPrice()    │  - Hyperspace    │  │
│  │  - getListings()     │  - getListings()      │  - OpenSea       │  │
│  │  - getSales()        │  - getActivities()    │                  │  │
│  │  - Rate Limiting     │  - Rate Limiting      │                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                         ↓               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      Solana RPC Layer                            │  │
│  │         (Metadata, On-chain Data, Transaction History)          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Marketplace Clients

The NFT module integrates with production-ready marketplace API clients for real-time data access.

### TensorClient

Production-ready client for Tensor marketplace API integration.

**Features:**
- Real-time floor price tracking
- Collection statistics aggregation
- Active listings retrieval
- Sales history analysis
- Built-in rate limiting (10 req/s default)
- Automatic retry logic
- Cross-platform fetch support (Node.js 18+, browser)

**API Endpoints:**
- `https://api.tensor.so/api/v1/collections/{slug}/stats`
- `https://api.tensor.so/api/v1/collections/{slug}/listings`
- `https://api.tensor.so/api/v1/collections/{slug}/sales`
- `https://api.tensor.so/api/v1/mints/{mint}/listing`

### MagicEdenClient

Production-ready client for Magic Eden marketplace API integration.

**Features:**
- Collection statistics and metadata
- Real-time listing data
- Activity tracking (sales, bids, listings)
- Collection search functionality
- Built-in rate limiting (10 req/s default)
- Automatic error handling
- Cross-platform fetch support

**API Endpoints:**
- `https://api-mainnet.magiceden.dev/v2/collections/{symbol}/stats`
- `https://api-mainnet.magiceden.dev/v2/collections/{symbol}/listings`
- `https://api-mainnet.magiceden.dev/v2/collections/{symbol}/activities`
- `https://api-mainnet.magiceden.dev/v2/tokens/{mint}/listings`

### MetaplexOnChainClient

On-chain NFT analysis client using Solana RPC and DAS API for trustless, decentralized data.

**Features:**
- Direct on-chain data queries (no marketplace dependency)
- Holder distribution analysis with concentration risk (HHI)
- Collection supply verification
- Wallet NFT portfolio retrieval
- DAS API support (Helius, Triton) for fast bulk operations
- Metaplex standard compliance
- Zero centralized API dependencies

**Use Cases:**
- Collections not listed on marketplaces
- Trustless data verification
- Real-time holder analysis
- Decentralized applications requiring on-chain proof
- Supply and holder count validation
- Whale detection and distribution metrics

**Data Sources:**
- Primary: DAS API (Digital Asset Standard) - Helius, Triton, etc.
- Fallback: Solana RPC direct queries (slower, more expensive)
- Standard: Metaplex Token Metadata program

**Trade-offs:**
- **Pros:** Trustless, decentralized, no API keys required, real holder data
- **Cons:** No price history, no marketplace metrics, slower than centralized APIs, higher RPC costs for large collections

### Client Configuration

Both clients support optional API keys for higher rate limits and custom configurations.

```typescript
import { TensorClient, MagicEdenClient } from '@synapse/client-sdk/nft/clients';

// Tensor client configuration
const tensorClient = new TensorClient({
  baseUrl: 'https://api.tensor.so',      // Optional: custom endpoint
  apiKey: process.env.TENSOR_API_KEY,    // Optional: for higher limits
  rateLimit: 10,                          // Requests per second
  timeout: 10000,                         // Request timeout (ms)
  logLevel: 'error',                      // 'debug' | 'info' | 'error' | 'none'
});

// Magic Eden client configuration
const magicEdenClient = new MagicEdenClient({
  baseUrl: 'https://api-mainnet.magiceden.dev/v2',
  apiKey: process.env.MAGIC_EDEN_API_KEY,
  rateLimit: 10,
  timeout: 10000,
  logLevel: 'error',
});
```

---

## Features

### Core Capabilities

| Feature | Description | Status | Dependencies |
|---------|-------------|--------|--------------|
| **Metadata Parsing** | NFT metadata retrieval from Arweave/IPFS | Production | Solana RPC |
| **Collection Analytics** | Real-time floor price, volume, trends | Production | Tensor, Magic Eden |
| **Marketplace Aggregation** | Multi-marketplace listing comparison | Production | Tensor, Magic Eden |
| **AI Rarity Calculation** | Statistical rarity scoring | Production | On-chain data |
| **Investment Analysis** | Data-driven investment recommendations | Production | All APIs |
| **Price Tracking** | Historical price data aggregation | Production | Marketplace APIs |
| **Holder Analysis** | Distribution and whale detection | Production | On-chain analysis |
| **Trend Detection** | Momentum and market sentiment | Production | Marketplace APIs |

### Supported Marketplaces

| Marketplace | Status | API Client | Features Available |
|-------------|--------|------------|-------------------|
| **Tensor** | Production | `TensorClient` | Floor price, listings, sales, statistics |
| **Magic Eden** | Production | `MagicEdenClient` | Floor price, listings, activities, search |
| **Solanart** | Planned | N/A | Future integration |
| **Hyperspace** | Planned | N/A | Future integration |
| **OpenSea** | Planned | N/A | Cross-chain support |

---

## Components

### 1. NFT Engine

Core NFT operations and metadata handling using Solana RPC and Metaplex standards.

```typescript
import { NFTEngine } from '@synapse/client-sdk/nft';

const nft = new NFTEngine(client);

// Retrieve NFT metadata from on-chain and off-chain sources
const metadata = await nft.getNFTMetadata('mintAddress');
console.log('Name:', metadata.name);
console.log('Attributes:', metadata.attributes);
console.log('Collection:', metadata.collection);
```

### 2. Collection Analytics

Real-time collection statistics using Tensor and Magic Eden API clients.

```typescript
import { CollectionAnalytics } from '@synapse/client-sdk/nft';

const analytics = new CollectionAnalytics(client);

// Fetch collection statistics (aggregates data from Tensor and Magic Eden)
const stats = await analytics.getStats('collectionMint');
console.log('Floor price:', stats.floorPrice, 'SOL');
console.log('24h Volume:', stats.volume24h, 'SOL');
console.log('Total holders:', stats.uniqueHolders);
console.log('Listed percentage:', stats.listedPercent.toFixed(2), '%');
```

**Data Sources:**
- Primary: Tensor API (floor price, volume, sales)
- Secondary: Magic Eden API (listings, activities)
- Fallback: On-chain data aggregation

### 3. Marketplace Aggregator

Multi-marketplace price comparison using TensorClient and MagicEdenClient.

```typescript
import { MarketplaceAggregator } from '@synapse/client-sdk/nft';

const aggregator = new MarketplaceAggregator(client);

// Find best price across Tensor and Magic Eden
const prices = await aggregator.compareFloorPrices('mintAddress');
console.log('Lowest price:', prices.lowestPrice, 'SOL');
console.log('Best marketplace:', prices.bestMarketplace);
console.log('Price difference:', prices.priceDifference, 'SOL');
console.log('Savings percentage:', prices.savings.toFixed(2), '%');
```

### 4. AI Rarity Calculator

Statistical rarity calculation based on trait distribution analysis.

```typescript
import { AIRarityCalculator } from '@synapse/client-sdk/nft';

const rarityCalc = new AIRarityCalculator(client);

// Calculate rarity score using statistical analysis
const rarity = await rarityCalc.calculateRarity('mintAddress', 'collectionAddress');
console.log('Overall rarity:', rarity.overallRarity.toFixed(2), '/100');
console.log('Statistical rarity:', rarity.statisticalRarity);
console.log('AI-enhanced rarity:', rarity.aiEnhancedRarity);
console.log('Estimated value:', rarity.valueEstimate, 'SOL');
```

### 5. AI Investment Advisor

Data-driven investment recommendations based on market metrics.

```typescript
import { AIInvestmentAdvisor } from '@synapse/client-sdk/nft';

const advisor = new AIInvestmentAdvisor(client);

// Generate investment recommendation
const recommendation = await advisor.getRecommendation(
  'mintAddress',
  'collectionAddress',
  2.5 // current price in SOL
);

console.log('Recommendation:', recommendation.recommendation);
console.log('Confidence:', recommendation.confidence, '%');
console.log('Target price:', recommendation.targetPrice, 'SOL');
console.log('Reasoning:', recommendation.reasoning);
console.log('Risks:', recommendation.risks);
console.log('Time horizon:', recommendation.timeHorizon);
```

---

## Implementation Guide

### Basic Setup

```typescript
import { SynapseClient } from '@synapse/client-sdk';
import { 
  NFTEngine,
  CollectionAnalytics,
  MarketplaceAggregator,
  AIRarityCalculator 
} from '@synapse/client-sdk/nft';

// Initialize Synapse client
const client = new SynapseClient({
  endpoint: process.env.SYNAPSE_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY,
});

// Initialize NFT components
const nft = new NFTEngine(client);
const analytics = new CollectionAnalytics(client);
const aggregator = new MarketplaceAggregator(client);
const rarityCalc = new AIRarityCalculator(client);
```

### Complete Workflow Example

```typescript
// Step 1: Retrieve NFT metadata
const metadata = await nft.getNFTMetadata('mintAddress');
console.log('NFT:', metadata.name);
console.log('Collection:', metadata.collection);

// Step 2: Get collection statistics (uses Tensor + Magic Eden)
const stats = await analytics.getStats(metadata.collection);
console.log('Floor price:', stats.floorPrice, 'SOL');
console.log('24h Volume:', stats.volume24h, 'SOL');
console.log('Total supply:', stats.totalSupply);
console.log('Listed:', stats.listed, '/', stats.totalSupply);

// Step 3: Calculate rarity
const rarity = await rarityCalc.calculateRarity('mintAddress', metadata.collection);
console.log('Rarity score:', rarity.overallRarity.toFixed(2));
console.log('Value estimate:', rarity.valueEstimate, 'SOL');

// Step 4: Compare marketplace prices
const prices = await aggregator.compareFloorPrices('mintAddress');
console.log('Lowest price:', prices.lowestPrice, 'SOL on', prices.bestMarketplace);
console.log('Available on', prices.prices.length, 'marketplaces');

// Output marketplace comparison table
console.table(prices.prices);
```

---

## Collection Analytics

### Using Tensor and Magic Eden APIs

The `CollectionAnalytics` class automatically aggregates data from multiple marketplace APIs.

```typescript
const analytics = new CollectionAnalytics(client);

// Data is fetched from:
// 1. TensorClient.getCollectionStats() - Primary source for Solana NFTs
// 2. MagicEdenClient.getCollectionStats() - Secondary/fallback source
// 3. Aggregation logic combines best data from both sources

const stats = await analytics.getStats('collectionAddress');
```

### Collection Statistics Interface

```typescript
interface CollectionStats {
  collectionAddress: string;
  totalSupply: number;          // From Tensor or Magic Eden
  holders: number;              // Estimated from on-chain data
  floorPrice: number;           // Lowest floor price (SOL)
  volume24h: number;            // 24h trading volume (SOL)
  volume7d: number;             // 7d trading volume (SOL)
  volume30d: number;            // 30d trading volume (SOL)
  avgPrice24h: number;          // Average sale price in 24h (SOL)
  sales24h: number;             // Number of sales in 24h
  listed: number;               // Current listings count
  listedPercent: number;        // Percentage of supply listed
  uniqueHolders: number;        // Unique holder addresses
  holderDistribution: {
    whales: number;             // Holders with >10% supply
    medium: number;             // Holders with 1-10% supply
    retail: number;             // Holders with <1% supply
  };
  priceHistory: Array<{
    timestamp: number;
    floorPrice: number;
    volume: number;
  }>;
  topSales: Array<{
    mint: string;
    price: number;
    timestamp: number;
    buyer?: string;
    seller?: string;
  }>;
}
```

### Trend Analysis

```typescript
interface CollectionTrends {
  trending: 'up' | 'down' | 'stable';
  volumeChange24h: number;      // Percentage change
  priceChange24h: number;       // Percentage change
  momentum: number;             // Score from -100 to 100
  sentiment: 'bullish' | 'bearish' | 'neutral';
  signals: string[];            // Market signals
}

// Analyze trends using aggregated marketplace data
const trends = await analytics.analyzeTrends('collectionMint');

console.log('Market Analysis:');
console.log('  Trend direction:', trends.trending);
console.log('  Volume change:', trends.volumeChange24h.toFixed(2), '%');
console.log('  Price change:', trends.priceChange24h.toFixed(2), '%');
console.log('  Market momentum:', trends.momentum);
console.log('  Sentiment:', trends.sentiment);
console.log('  Signals:', trends.signals.join(', '));
```

### Collection Comparison

```typescript
// Compare multiple collections using marketplace APIs
const comparison = await analytics.compareCollections([
  'collection1',
  'collection2',
  'collection3',
]);

// Display rankings
console.log('Rankings by 24h Volume:');
comparison.rankings.byVolume.forEach((addr, index) => {
  const coll = comparison.collections.find(c => c.collectionAddress === addr);
  console.log(`  ${index + 1}. ${coll?.name || addr}`);
  console.log(`     Volume: ${coll?.volume24h.toFixed(2)} SOL`);
});

console.log('\nRankings by Floor Price:');
comparison.rankings.byFloorPrice.forEach((addr, index) => {
  const coll = comparison.collections.find(c => c.collectionAddress === addr);
  console.log(`  ${index + 1}. ${coll?.name || addr}`);
  console.log(`     Floor: ${coll?.floorPrice.toFixed(2)} SOL`);
});

console.log('\nRankings by Momentum:');
comparison.rankings.byMomentum.forEach((addr, index) => {
  const coll = comparison.collections.find(c => c.collectionAddress === addr);
  console.log(`  ${index + 1}. ${coll?.name || addr}`);
  console.log(`     Momentum: ${coll?.trends.momentum}/100`);
});
```

---

## Marketplace Aggregation

### TensorClient and MagicEdenClient Integration

The `MarketplaceAggregator` uses both marketplace clients to find the best prices.

```typescript
import { MarketplaceAggregator } from '@synapse/client-sdk/nft';

const aggregator = new MarketplaceAggregator(client);

// Automatically queries:
// - TensorClient.getMintListing(mint) for Tensor marketplace
// - MagicEdenClient.getTokenListing(mint) for Magic Eden marketplace

const listings = await aggregator.findListings('mintAddress');
```

### Marketplace Listing Interface

```typescript
interface MarketplaceListing {
  marketplace: 'tensor' | 'magiceden' | 'solanart' | 'opensea' | 'hyperspace';
  mint: string;              // NFT mint address
  price: number;             // Listing price (SOL)
  seller: string;            // Seller wallet address
  listingUrl: string;        // Direct marketplace URL
  timestamp: number;         // Listing timestamp (Unix)
  royalties?: number;        // Royalty percentage
  attributes?: Record<string, string>;
}
```

### Price Comparison

```typescript
interface MarketplaceFloorPrices {
  mint: string;
  prices: Array<{
    marketplace: string;     // 'tensor' or 'magiceden'
    price: number;           // Price in SOL
    url: string;             // Direct listing URL
  }>;
  lowestPrice: number;       // Best available price
  bestMarketplace: string;   // Marketplace with lowest price
  priceDifference: number;   // Highest - lowest price
  savings: number;           // Percentage saved at best marketplace
}

// Compare prices across marketplaces
const comparison = await aggregator.compareFloorPrices('mintAddress');

console.log('\nMarketplace Price Comparison:');
console.log('─'.repeat(60));
comparison.prices.forEach(({ marketplace, price, url }) => {
  console.log(`${marketplace.padEnd(15)} ${price.toFixed(4)} SOL`);
  console.log(`${''.padEnd(15)} ${url}`);
});
console.log('─'.repeat(60));
console.log(`Best price: ${comparison.lowestPrice} SOL on ${comparison.bestMarketplace}`);
console.log(`Save ${comparison.savings.toFixed(1)}% vs highest price`);
```

### Finding All Listings

```typescript
// Fetch all available listings from Tensor and Magic Eden
const allListings = await aggregator.findListings('mintAddress', {
  marketplaces: ['tensor', 'magiceden'],
  maxPrice: 5.0,  // Optional: filter by maximum price
});

// Sort by price ascending (automatically done)
console.log('\nAll Available Listings:');
allListings.forEach((listing, index) => {
  console.log(`\n${index + 1}. ${listing.marketplace.toUpperCase()}`);
  console.log(`   Price: ${listing.price.toFixed(4)} SOL`);
  console.log(`   Seller: ${listing.seller.substring(0, 8)}...`);
  console.log(`   URL: ${listing.listingUrl}`);
});
```

---

## AI Rarity Calculator

### Statistical Rarity Analysis

The `AIRarityCalculator` performs trait-based statistical analysis to calculate rarity scores.

```typescript
interface RarityScore {
  mint: string;
  overallRarity: number;        // 0-100 composite score
  rank?: number;                // Rank within collection
  traits: Array<{
    trait: string;              // Trait category
    value: string;              // Trait value
    rarity: number;             // Rarity score for this trait
    occurrence: number;         // Frequency in collection
  }>;
  statisticalRarity: number;    // Pure statistical calculation
  aiEnhancedRarity: number;     // ML-weighted calculation
  valueEstimate: number;        // Estimated value in SOL
}
```

### Algorithm Configuration

```typescript
interface RarityAlgorithmConfig {
  algorithm: 'statistical' | 'trait-normalized' | 'ai-enhanced' | 'hybrid';
  weights?: {
    traitRarity?: number;       // Weight for trait rarity (default: 0.6)
    traitCount?: number;        // Weight for trait count (default: 0.2)
    aesthetic?: number;         // Weight for aesthetic score (default: 0.2)
  };
}

// Configure calculator with custom algorithm
const rarityCalc = new AIRarityCalculator(client, {
  algorithm: 'hybrid',
  weights: {
    traitRarity: 0.6,
    traitCount: 0.2,
    aesthetic: 0.2,
  },
});
```

### Calculate Rarity

```typescript
// Calculate rarity for a single NFT
const rarity = await rarityCalc.calculateRarity('mintAddress', 'collectionAddress');

console.log('\nRarity Analysis:');
console.log('─'.repeat(60));
console.log('Overall Rarity Score:', rarity.overallRarity.toFixed(2), '/100');
console.log('Statistical Rarity:', rarity.statisticalRarity.toFixed(2));
console.log('AI-Enhanced Rarity:', rarity.aiEnhancedRarity.toFixed(2));
console.log('Estimated Value:', rarity.valueEstimate.toFixed(4), 'SOL');

if (rarity.rank) {
  console.log('Collection Rank: #', rarity.rank);
}

console.log('\nTrait Breakdown:');
rarity.traits.forEach(trait => {
  console.log(`  ${trait.trait}: ${trait.value}`);
  console.log(`    Rarity: ${trait.rarity.toFixed(2)}`);
  console.log(`    Occurrence: ${trait.occurrence} in collection`);
});
```

### Batch Rarity Calculation

```typescript
// Calculate rarity for multiple NFTs efficiently
const mints = ['mint1', 'mint2', 'mint3', 'mint4'];
const rarityScores = await rarityCalc.batchCalculateRarity(
  mints,
  'collectionAddress'
);

// Results are automatically ranked
rarityScores.forEach((score, index) => {
  console.log(`\n${index + 1}. Rank #${score.rank}`);
  console.log(`   Mint: ${score.mint.substring(0, 8)}...`);
  console.log(`   Rarity: ${score.overallRarity.toFixed(2)}/100`);
  console.log(`   Value Estimate: ${score.valueEstimate.toFixed(4)} SOL`);
});
```

---

## Investment Advisor

### Investment Recommendation Interface

```typescript
interface InvestmentRecommendation {
  mint: string;
  collectionAddress: string;
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  confidence: number;           // 0-100 confidence score
  targetPrice: number;          // Target price in SOL
  reasoning: string[];          // List of reasoning points
  metrics: {
    rarityScore: number;        // 0-100
    volumeTrend: number;        // Percentage
    priceMomentum: number;      // Percentage
    holderQuality: number;      // 0-100
  };
  risks: string[];              // Identified risks
  timeHorizon: 'short' | 'medium' | 'long';
}
```

### Generate Recommendation

```typescript
const advisor = new AIInvestmentAdvisor(client);

// Generate data-driven investment recommendation
const recommendation = await advisor.getRecommendation(
  'mintAddress',
  'collectionAddress',
  2.5  // current price in SOL
);

console.log('\nInvestment Analysis:');
console.log('─'.repeat(60));
console.log('Recommendation:', recommendation.recommendation.toUpperCase());
console.log('Confidence:', recommendation.confidence, '%');
console.log('Target Price:', recommendation.targetPrice.toFixed(4), 'SOL');
console.log('Time Horizon:', recommendation.timeHorizon);

console.log('\nKey Metrics:');
console.log('  Rarity Score:', recommendation.metrics.rarityScore.toFixed(2), '/100');
console.log('  Volume Trend:', recommendation.metrics.volumeTrend.toFixed(2), '%');
console.log('  Price Momentum:', recommendation.metrics.priceMomentum.toFixed(2), '%');
console.log('  Holder Quality:', recommendation.metrics.holderQuality.toFixed(2), '/100');

console.log('\nReasoning:');
recommendation.reasoning.forEach((reason, index) => {
  console.log(`  ${index + 1}. ${reason}`);
});

if (recommendation.risks.length > 0) {
  console.log('\nRisks:');
  recommendation.risks.forEach((risk, index) => {
    console.log(`  ${index + 1}. ${risk}`);
  });
}
```

### Investment Metrics

The investment advisor analyzes multiple data sources:

| Metric | Source | Weight | Description |
|--------|--------|--------|-------------|
| **Rarity Score** | AIRarityCalculator | 30% | Statistical trait rarity |
| **Volume Trend** | Tensor + Magic Eden | 20% | 24h volume change |
| **Price Momentum** | Tensor + Magic Eden | 20% | Price direction and strength |
| **Holder Quality** | On-chain Analysis | 30% | Distribution and whale ratio |

---

## Configuration

### NFT Module Configuration

```typescript
interface NFTConfig {
  client: SynapseLikeClient;
  defaultCommitment?: Commitment;
  fetch?: typeof fetch;
  das?: {
    baseUrl: string;
    getAssetPath?: string;
    getAssetByIdPath?: string;
    getAssetProofPath?: string;
    headers?: Record<string, string>;
  };
  marketplaces?: MarketplaceClientConfig;
}

interface MarketplaceClientConfig {
  tensor?: {
    baseUrl?: string;
    apiKey?: string;
    rateLimit?: number;
  };
  magicEden?: {
    baseUrl?: string;
    apiKey?: string;
    rateLimit?: number;
  };
  helius?: {
    apiKey: string;
    cluster?: 'mainnet-beta' | 'devnet';
  };
  fetch?: typeof fetch;
  timeout?: number;
  logLevel?: 'debug' | 'info' | 'error' | 'none';
}
```

### Complete Configuration Example

```typescript
import { SynapseClient } from '@synapse/client-sdk';
import { NFTEngine } from '@synapse/client-sdk/nft';

const client = new SynapseClient({
  endpoint: process.env.SYNAPSE_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY,
});

const nft = new NFTEngine({
  client,
  defaultCommitment: 'confirmed',
  
  // Compressed NFT support (optional)
  das: {
    baseUrl: 'https://mainnet.helius-rpc.com',
    headers: {
      'Authorization': `Bearer ${process.env.HELIUS_API_KEY}`,
    },
  },
  
  // Marketplace API configurations (optional)
  marketplaces: {
    tensor: {
      baseUrl: 'https://api.tensor.so',
      apiKey: process.env.TENSOR_API_KEY,
      rateLimit: 10,  // requests per second
    },
    magicEden: {
      baseUrl: 'https://api-mainnet.magiceden.dev/v2',
      apiKey: process.env.MAGIC_EDEN_API_KEY,
      rateLimit: 10,
    },
    timeout: 10000,  // 10 seconds
    logLevel: 'error',
  },
});
```

### Environment Variables

```bash
# Synapse Gateway
SYNAPSE_ENDPOINT=https://api.synapse.example.com
SYNAPSE_API_KEY=your_synapse_api_key

# Marketplace APIs (optional - for higher rate limits)
TENSOR_API_KEY=your_tensor_api_key
MAGIC_EDEN_API_KEY=your_magic_eden_api_key

# Helius (for compressed NFTs)
HELIUS_API_KEY=your_helius_api_key
```

---

## Best Practices

### 1. Caching Strategy

Implement caching to reduce API calls and improve performance.

```typescript
const cache = new Map<string, { stats: CollectionStats; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

async function getCollectionStatsCached(collection: string) {
  const cached = cache.get(collection);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Cache hit for', collection);
    return cached.stats;
  }
  
  console.log('Fetching fresh data for', collection);
  const stats = await analytics.getStats(collection);
  cache.set(collection, { stats, timestamp: Date.now() });
  return stats;
}
```

### 2. Event-Driven Updates

Use event emitters for real-time monitoring.

```typescript
// Monitor collection statistics updates
analytics.on('collection-stats-complete', (stats) => {
  console.log('Stats updated:', stats.collectionAddress);
  console.log('Floor price:', stats.floorPrice, 'SOL');
});

analytics.on('collection-stats-error', (error) => {
  console.error('Failed to fetch stats:', error);
});

// Monitor marketplace searches
aggregator.on('listings-search-start', ({ mint }) => {
  console.log('Searching marketplaces for:', mint);
});

aggregator.on('listings-search-complete', ({ found }) => {
  console.log('Found', found, 'listings');
});
```

### 3. Error Handling

Implement robust error handling for marketplace failures.

```typescript
async function safeGetFloorPrice(collection: string): Promise<number> {
  try {
    const stats = await analytics.getStats(collection);
    return stats.floorPrice;
  } catch (error) {
    console.error('Primary API failed:', error);
    
    // Fallback to direct Tensor API
    try {
      const TensorClient = (await import('@synapse/client-sdk/nft/clients')).TensorClient;
      const tensorClient = new TensorClient({ logLevel: 'error' });
      const tensorStats = await tensorClient.getCollectionStats(collection);
      return tensorStats.floorPrice / 1e9;
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
      throw new Error('All marketplace APIs unavailable');
    }
  }
}
```

### 4. Batch Operations

Process multiple operations efficiently.

```typescript
// Efficient: Single API call for comparison
const comparison = await analytics.compareCollections([
  'collection1',
  'collection2',
  'collection3',
]);

// Inefficient: Multiple separate calls
// DON'T DO THIS:
const stats1 = await analytics.getStats('collection1');
const stats2 = await analytics.getStats('collection2');
const stats3 = await analytics.getStats('collection3');
```

### 5. Rate Limit Awareness

Both TensorClient and MagicEdenClient implement automatic rate limiting.

```typescript
// Clients automatically enforce rate limits
const tensorClient = new TensorClient({
  rateLimit: 10,  // 10 requests per second (default)
});

const magicEdenClient = new MagicEdenClient({
  rateLimit: 10,  // 10 requests per second (default)
});

// No need for manual rate limiting - clients handle it automatically
```

### 6. Marketplace Fallback Strategy

```typescript
async function getFloorPriceWithFallback(symbol: string): Promise<number> {
  const errors: string[] = [];
  
  // Try Tensor first (primary for Solana NFTs)
  try {
    const tensorClient = new TensorClient({ logLevel: 'error' });
    return await tensorClient.getFloorPrice(symbol);
  } catch (error) {
    errors.push(`Tensor: ${(error as Error).message}`);
  }
  
  // Fallback to Magic Eden
  try {
    const magicEdenClient = new MagicEdenClient({ logLevel: 'error' });
    return await magicEdenClient.getFloorPrice(symbol);
  } catch (error) {
    errors.push(`MagicEden: ${(error as Error).message}`);
  }
  
  throw new Error(`All marketplaces failed: ${errors.join(', ')}`);
}
```

---

## API Reference

### TensorClient

Production-ready Tensor marketplace API client.

#### getCollectionStats()

```typescript
async getCollectionStats(slug: string): Promise<TensorCollectionStats>
```

Retrieves comprehensive collection statistics from Tensor API.

**Parameters:**
- `slug` - Collection slug identifier (e.g., "mad_lads")

**Returns:** `TensorCollectionStats` object containing floor price, volume, sales data

**Example:**
```typescript
const tensorClient = new TensorClient();
const stats = await tensorClient.getCollectionStats('okay_bears');
console.log('Floor:', stats.floorPrice / 1e9, 'SOL');
console.log('24h Volume:', stats.volume24h / 1e9, 'SOL');
```

#### getFloorPrice()

```typescript
async getFloorPrice(slug: string): Promise<number>
```

Retrieves current floor price for a collection.

**Returns:** Floor price in lamports

#### getListings()

```typescript
async getListings(
  slug: string,
  options?: {
    limit?: number;
    page?: number;
    sortBy?: 'price' | 'listedAt';
    sortDirection?: 'asc' | 'desc';
  }
): Promise<TensorListing[]>
```

Retrieves active listings for a collection with pagination support.

**Returns:** Array of `TensorListing` objects

#### getSales()

```typescript
async getSales(
  slug: string,
  options?: {
    limit?: number;
    page?: number;
  }
): Promise<TensorSale[]>
```

Retrieves recent sales for a collection.

**Returns:** Array of `TensorSale` objects

#### getMintListing()

```typescript
async getMintListing(mint: string): Promise<TensorListing | null>
```

Retrieves listing information for a specific NFT mint.

**Returns:** `TensorListing` object or null if not listed

#### healthCheck()

```typescript
async healthCheck(): Promise<boolean>
```

Verifies Tensor API connectivity and accessibility.

**Returns:** `true` if API is healthy, `false` otherwise

---

### MagicEdenClient

Production-ready Magic Eden marketplace API client.

#### getCollectionStats()

```typescript
async getCollectionStats(symbol: string): Promise<MagicEdenCollectionStats>
```

Retrieves collection statistics from Magic Eden API.

**Parameters:**
- `symbol` - Collection symbol (e.g., "okay_bears")

**Returns:** `MagicEdenCollectionStats` object with floor price and volume data

**Example:**
```typescript
const magicEdenClient = new MagicEdenClient();
const stats = await magicEdenClient.getCollectionStats('okay_bears');
console.log('Floor:', stats.floorPrice, 'SOL');
console.log('24h Volume:', stats.volume24hr, 'SOL');
```

#### getCollectionInfo()

```typescript
async getCollectionInfo(symbol: string): Promise<MagicEdenCollection>
```

Retrieves collection metadata and information.

**Returns:** `MagicEdenCollection` object with metadata

#### getFloorPrice()

```typescript
async getFloorPrice(symbol: string): Promise<number>
```

Retrieves current floor price for a collection.

**Returns:** Floor price in SOL (not lamports)

#### getListings()

```typescript
async getListings(
  symbol: string,
  options?: {
    offset?: number;
    limit?: number;
  }
): Promise<MagicEdenListing[]>
```

Retrieves active listings with pagination support.

**Returns:** Array of `MagicEdenListing` objects

#### getCollectionActivities()

```typescript
async getCollectionActivities(
  symbol: string,
  options?: {
    offset?: number;
    limit?: number;
  }
): Promise<MagicEdenActivity[]>
```

Retrieves collection activities (sales, listings, bids).

**Returns:** Array of `MagicEdenActivity` objects

#### getTokenListing()

```typescript
async getTokenListing(mintAddress: string): Promise<MagicEdenListing | null>
```

Retrieves listing information for a specific NFT token.

**Returns:** `MagicEdenListing` object or null if not listed

#### getSales()

```typescript
async getSales(
  symbol: string,
  options?: {
    offset?: number;
    limit?: number;
  }
): Promise<MagicEdenActivity[]>
```

Retrieves recent sales (filtered buyNow activities).

**Returns:** Array of sale activities

#### searchCollections()

```typescript
async searchCollections(query: string, limit?: number): Promise<MagicEdenCollection[]>
```

Searches for collections by name.

**Returns:** Array of matching collections

#### healthCheck()

```typescript
async healthCheck(): Promise<boolean>
```

Verifies Magic Eden API connectivity and accessibility.

**Returns:** `true` if API is healthy, `false` otherwise

---

### CollectionAnalytics

#### getStats()

```typescript
async getStats(
  collectionAddress: string,
  options?: { useCache?: boolean }
): Promise<CollectionStats>
```

Retrieves comprehensive collection statistics aggregated from Tensor and Magic Eden.

**Parameters:**
- `collectionAddress` - Collection mint address or slug
- `options.useCache` - Use cached data if available (default: true)

**Returns:** `CollectionStats` object with aggregated marketplace data

**Data Sources:**
- Primary: TensorClient (floor price, volume, sales)
- Secondary: MagicEdenClient (listings, activities)
- Aggregation: Combines best data from both sources

#### analyzeTrends()

```typescript
async analyzeTrends(collectionAddress: string): Promise<CollectionTrends>
```

Analyzes collection market trends and momentum.

**Returns:** `CollectionTrends` object with trend analysis

#### compareCollections()

```typescript
async compareCollections(collectionAddresses: string[]): Promise<{
  collections: Array<CollectionStats & { trends: CollectionTrends }>;
  rankings: {
    byVolume: string[];
    byFloorPrice: string[];
    byMomentum: string[];
  };
}>
```

Compares multiple collections side-by-side.

**Returns:** Comparison data with rankings by various metrics

---

### MarketplaceAggregator

#### findListings()

```typescript
async findListings(mint: string, options?: {
  marketplaces?: string[];
  maxPrice?: number;
}): Promise<MarketplaceListing[]>
```

Finds all listings for an NFT across Tensor and Magic Eden marketplaces.

**Parameters:**
- `mint` - NFT mint address
- `options.marketplaces` - List of marketplaces to search (default: ['tensor', 'magiceden'])
- `options.maxPrice` - Maximum price filter in SOL

**Returns:** Array of listings sorted by price (ascending)

**Marketplace Integration:**
- Calls TensorClient.getMintListing() for Tensor marketplace
- Calls MagicEdenClient.getTokenListing() for Magic Eden marketplace
- Parallel execution with individual error handling

#### compareFloorPrices()

```typescript
async compareFloorPrices(mint: string): Promise<MarketplaceFloorPrices>
```

Compares floor prices across all available marketplaces.

**Returns:** `MarketplaceFloorPrices` object with price comparison data

---

### AIRarityCalculator

#### calculateRarity()

```typescript
async calculateRarity(
  mint: string,
  collectionAddress?: string
): Promise<RarityScore>
```

Calculates NFT rarity score using statistical analysis.

**Parameters:**
- `mint` - NFT mint address
- `collectionAddress` - Collection address for ranking (optional)

**Returns:** `RarityScore` object with detailed trait analysis

#### batchCalculateRarity()

```typescript
async batchCalculateRarity(
  mints: string[],
  collectionAddress?: string
): Promise<RarityScore[]>
```

Calculates rarity for multiple NFTs efficiently with automatic ranking.

**Returns:** Array of `RarityScore` objects sorted by rarity

---

### AIInvestmentAdvisor

#### getRecommendation()

```typescript
async getRecommendation(
  mint: string,
  collectionAddress: string,
  currentPrice: number
): Promise<InvestmentRecommendation>
```

Generates data-driven investment recommendation for an NFT.

**Parameters:**
- `mint` - NFT mint address
- `collectionAddress` - Collection address
- `currentPrice` - Current price in SOL

**Returns:** `InvestmentRecommendation` object with analysis and metrics

**Analysis Components:**
- Rarity analysis from AIRarityCalculator
- Collection statistics from CollectionAnalytics
- Trend analysis with momentum calculation
- Holder quality assessment

---

## Performance Metrics

### API Response Times

| Operation | Average Latency | Cache Hit Rate | Notes |
|-----------|----------------|----------------|-------|
| **TensorClient.getCollectionStats()** | 150-300ms | N/A | Direct API call |
| **MagicEdenClient.getCollectionStats()** | 200-400ms | N/A | Direct API call |
| **CollectionAnalytics.getStats()** | 200-600ms | 70% | Aggregates both APIs |
| **MarketplaceAggregator.findListings()** | 300-800ms | 60% | Parallel marketplace queries |
| **AIRarityCalculator.calculateRarity()** | 100-500ms | 90% | Metadata + computation |
| **AIInvestmentAdvisor.getRecommendation()** | 500-1500ms | 50% | Multiple API calls + analysis |

### Rate Limits

| Client | Default Rate Limit | With API Key | Burst Tolerance |
|--------|-------------------|--------------|-----------------|
| **TensorClient** | 10 req/s | 20 req/s | 20 requests |
| **MagicEdenClient** | 10 req/s | 20 req/s | 20 requests |

**Note:** Both clients implement automatic rate limiting to prevent API throttling.

### Caching Strategy

| Component | Default TTL | Cache Key | Invalidation |
|-----------|------------|-----------|--------------|
| **Collection Stats** | 5 minutes | Collection address | Time-based |
| **Rarity Scores** | 24 hours | Mint address | Manual |
| **Marketplace Listings** | 1 minute | Mint address | Time-based |

---

## Troubleshooting

### TensorClient Issues

#### Error: "Tensor API request timeout"

**Cause:** Request exceeded timeout limit (default: 10s)

**Solution:**
```typescript
const tensorClient = new TensorClient({
  timeout: 20000,  // Increase to 20 seconds
});
```

#### Error: "Tensor API error: 429"

**Cause:** Rate limit exceeded

**Solution:**
```typescript
const tensorClient = new TensorClient({
  rateLimit: 5,  // Reduce to 5 req/s
  apiKey: process.env.TENSOR_API_KEY,  // Use API key for higher limits
});
```

#### Error: "Collection not found"

**Cause:** Invalid collection slug or collection not indexed on Tensor

**Solution:**
- Verify collection slug is correct (use collection symbol, not address)
- Try Magic Eden as fallback
- Check if collection is listed on Tensor marketplace

---

### MagicEdenClient Issues

#### Error: "Magic Eden API error: 404"

**Cause:** Collection symbol not found

**Solution:**
```typescript
// Try searching for the collection first
const magicEdenClient = new MagicEdenClient();
const results = await magicEdenClient.searchCollections('collection name');
console.log('Found symbols:', results.map(r => r.symbol));
```

#### Error: "No listings found"

**Cause:** NFT not currently listed on Magic Eden

**Solution:**
- Check Tensor marketplace as alternative
- Verify mint address is correct
- Check if NFT exists and is not burned

---

### CollectionAnalytics Issues

#### Issue: "Failed to fetch collection stats from all marketplaces"

**Cause:** Both Tensor and Magic Eden APIs failed

**Solution:**
```typescript
try {
  const stats = await analytics.getStats(collection);
} catch (error) {
  console.error('All marketplaces failed:', error);
  
  // Try individual clients with extended timeouts
  const tensorClient = new TensorClient({ timeout: 30000 });
  const stats = await tensorClient.getCollectionStats(collection);
}
```

#### Issue: Inaccurate floor price

**Cause:** Price discrepancy between marketplaces or stale cache

**Solution:**
```typescript
// Force fresh data fetch
const stats = await analytics.getStats(collection, { useCache: false });

// Or compare prices directly
const aggregator = new MarketplaceAggregator(client);
const prices = await aggregator.compareFloorPrices(mint);
console.log('Tensor floor:', prices.prices.find(p => p.marketplace === 'tensor')?.price);
console.log('Magic Eden floor:', prices.prices.find(p => p.marketplace === 'magiceden')?.price);
```

---

### MarketplaceAggregator Issues

#### Issue: Empty listings array

**Cause:** NFT not listed on any marketplace

**Solution:**
```typescript
const listings = await aggregator.findListings(mint);
if (listings.length === 0) {
  console.log('NFT is not currently listed');
  // Check floor price from collection stats instead
  const stats = await analytics.getStats(collection);
  console.log('Collection floor price:', stats.floorPrice, 'SOL');
}
```

---

### General Best Practices

1. **Enable debug logging during development:**
```typescript
const tensorClient = new TensorClient({ logLevel: 'debug' });
const magicEdenClient = new MagicEdenClient({ logLevel: 'debug' });
```

2. **Implement health checks:**
```typescript
const tensorHealthy = await tensorClient.healthCheck();
const magicEdenHealthy = await magicEdenClient.healthCheck();

if (!tensorHealthy && !magicEdenHealthy) {
  console.error('All marketplace APIs are down');
}
```

3. **Use fallback strategies:**
```typescript
async function getFloorPriceRobust(collection: string): Promise<number> {
  try {
    return await tensorClient.getFloorPrice(collection);
  } catch (error) {
    console.warn('Tensor failed, trying Magic Eden:', error);
    return await magicEdenClient.getFloorPrice(collection);
  }
}
```

---

## Summary

The NFT Module provides production-ready integration with Tensor and Magic Eden marketplaces through:

- **TensorClient:** High-performance Solana NFT marketplace data
- **MagicEdenClient:** Comprehensive marketplace listings and activities
- **Automatic Aggregation:** Best price discovery across multiple sources
- **Built-in Rate Limiting:** Prevents API throttling
- **Robust Error Handling:** Automatic fallback strategies
- **Type Safety:** Full TypeScript support with comprehensive interfaces

**Recommended Usage:**
1. Use `CollectionAnalytics` for collection-level statistics (auto-aggregates Tensor + Magic Eden)
2. Use `MarketplaceAggregator` for price comparison and listing discovery
3. Use direct clients (`TensorClient`, `MagicEdenClient`) for specific marketplace features
4. Implement caching for frequently accessed data
5. Enable error logging in development, disable in production

---

**NFT Module v2.0.0** - Production-Ready Marketplace Integration

Built with enterprise-grade reliability for professional NFT trading applications.
