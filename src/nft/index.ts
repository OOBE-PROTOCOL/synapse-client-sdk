/**
 * @file nft/index.ts
 * @module SolanaNFT
 * @description Complete NFT toolkit for Solana: metadata, rarity, collection analytics,
 *              marketplace aggregation, and AI-powered investment recommendations.
 * @author Keepeeto
 * @license MIT
 */

// Core NFT engine
export { NFTEngine } from './utils';

// Advanced features
export {
  CollectionAnalytics,
  MarketplaceAggregator,
  AIRarityCalculator,
  AIInvestmentAdvisor,
} from './advanced-features';

// Core types
export * from './types.nft';

// Advanced types
export type {
  CollectionStats,
  CollectionTrends,
  MarketplaceListing,
  MarketplaceFloorPrices,
  RarityScore,
  RarityAlgorithmConfig,
  InvestmentRecommendation,
} from './advanced-features';
