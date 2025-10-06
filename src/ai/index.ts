/**
 * AI Module - OOBE Protocol Compatible
 *
 * AI modules compatible with OOBE Protocol agents.
 * Includes PDA management, Merkle operations, and data fetching utilities
 * with optimized batch processing support.
 */

// PDA Management
export { PDAManager } from './pda-manager';
export type { PDAConfig, UserPDAs } from './pda-manager';

// Zero Combine Fetcher for large datasets
export { ZeroCombineFetcher } from './zero-combine-fetcher';
export type {
  ZeroChunk,
  SignatureInfo,
  ProofRecord,
  FetchConfig,
  ZeroCombineResult,
} from './zero-combine-fetcher';

// Merkle Operations
export { MerkleOperation } from './merkle-operation';
export type {
  MerkleLeaf,
  MerkleProof,
  MerkleValidationResult,
  ChunkInfo,
  InscriptionResult,
} from './merkle-operation';

// AI Types (OOBE compatible)
export type {
  OOBECompatibleAgent,
  AgentTradeSuggestion,
  AgentRiskReport,
  AgentAdapter,
  AIAgentConfig,
  AIContext,
  AIResponse,
  TradeExecution,
  MultiChainSignal,
  AutoTradingStrategy,
  BatchOptionRequest, // Export batch options for external use
} from './types.ai';
