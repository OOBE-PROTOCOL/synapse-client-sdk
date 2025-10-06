/**
 * @file defi/index.ts
 * @module SolanaDeFi
 * @description Modular DeFi toolkit for Solana with real integrations.
 *              Each protocol has its own dedicated module for scalability.
 * @author Keepeeto
 * @license MIT
 */

// ============================================================================
// REAL INTEGRATIONS - Production Ready
// ============================================================================

// Jupiter V6 Aggregator
export { JupiterIntegration } from './jupiter';
export type {
  JupiterQuoteParams,
  JupiterQuoteResponse,
  JupiterSwapResponse,
  JupiterSwapOptions,
  JupiterTokenPrice,
} from './jupiter';

// Jito Block Engine (MEV Protection)
export { JitoIntegration } from './jito';
export type {
  JitoTipAccount,
  JitoBundleParams,
  JitoBundleResult,
  JitoBundleStatus,
} from './jito';

// Token Data (SPL Tokens)
export { TokenDataIntegration } from './token-data';
export type {
  TokenAccountInfo,
  TokenSupply,
  TokenLargestAccount,
} from './token-data';

// Price Feed (Multi-source)
export { PriceFeedIntegration } from './price-feed';
export type {
  PriceData,
  BirdeyeTokenPrice,
} from './price-feed';

// ============================================================================
// ADVANCED FEATURES
// ============================================================================

// MEV Protection (High-level wrapper)
export { MEVProtection } from './unstable-features';
export type {
  MEVProtectionConfig,
  MEVProtectionResult,
} from './unstable-features';

// Arbitrage Detection
export { ArbitrageDetector } from './unstable-features';
export type {
  ArbitrageOpportunity,
} from './unstable-features';

// Portfolio Analytics
export { PortfolioAnalytics } from './unstable-features';
export type {
  TokenHolding,
  PortfolioMetrics,
} from './unstable-features';

// Flash Loan Simulator
export { FlashLoanSimulator } from './unstable-features';
export type {
  FlashLoanSimulation,
  FlashLoanAction,
} from './unstable-features';

// Yield Farming Finder
export { YieldFarmingFinder } from './unstable-features';
export type {
  YieldOpportunity,
} from './unstable-features';

// ============================================================================
// LEGACY - Core DeFi Engine (will be deprecated)
// ============================================================================

export { SynapseSolanaEngine } from './utils';
export type {
  DeFiConfig,
  TokenInfo,
  QuoteRequestCommon,
  JupiterQuoteRequest,
  RaydiumQuoteRequest,
  QuoteResponse,
  BuildSwapTxResult,
  ExecuteSwapParams,
  RaydiumBuildSwapParams,
  RiskTolerance,
} from './utils';



