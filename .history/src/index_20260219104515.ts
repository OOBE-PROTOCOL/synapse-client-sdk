// Core exports
export { SynapseClient } from './client';
export * from './enterprise/index';
// TODO: SolanaRpcMethods uses deprecated 'call()' method - use SynapseClient direct methods instead
// export { SolanaRpcMethods } from './methods/solana-rpc';
export { SynapseUtils } from './utils/helpers';

// Sequential Batch - Intelligent Pair-Based Batching
export { 
  SequentialBatchProcessor,
  createSequentialPair,
  SEQUENTIAL_BATCH_METHOD_COMPATIBILITY,
  isCompatibleMethod,
  canChainMethods,
  getSuggestedChainConfig
} from './batch-sequential';
export type {
  SequentialBatchRequest,
  SequentialBatchPair,
  SequentialBatchInput,
  SequentialBatchConfig,
  SequentialBatchResponse,
  MethodCompatibility,
  CompatibleMethod
} from './batch-sequential';

// Advanced enterprise features
export * from './advanced/index';

// WebSocket real-time features  
export * from './websocket/index';

// AI engines - Export AI modules separately to avoid type conflicts
export {
  PDAManager,
  ZeroCombineFetcher,
  MerkleOperation,
} from './ai/index';
export type {
  PDAConfig,
  UserPDAs,
  ZeroChunk,
  SignatureInfo,
  ProofRecord,
  FetchConfig,
  ZeroCombineResult,
  MerkleLeaf,
  MerkleProof,
  MerkleValidationResult,
  ChunkInfo,
  InscriptionResult,
  OOBECompatibleAgent,
  AgentTradeSuggestion,
  AgentRiskReport,
  AgentAdapter,
  // AIAgentConfig is exported from types
  AIContext,
  AIResponse,
  TradeExecution,
  MultiChainSignal,
  AutoTradingStrategy,
} from './ai/index';

// DeFi utilities
export * from './defi/index';

// NFT & cNFT utilities
export * from './nft/index';

// Types
export * from './types';
// Re-export commonly used Solana types from the public package surface
export type { PublicKey, Transaction, TransactionInstruction, Keypair, Signer, BlockhashWithExpiryBlockHeight, SimulatedTransactionResponse } from './types';

// Supreme orchestrator
// export { SynapseMasterClient } from './master-client';

import { SynapseClient } from './client';
import { SynapseUtils } from './utils/helpers';
import type { SynapseConfig } from './types';

/**
 * @name Synapse
 * @description The main entry point for the Synapse SDK
 */
export class Synapse {
  public client: SynapseClient;
  public utils: SynapseUtils;

  constructor(config: SynapseConfig) {
    this.client = new SynapseClient(config);
    this.utils = new SynapseUtils(this.client);

    if (config.debug) {
      console.log(' Synapse SDK initialized successfully');
    }
  }
}

/**
 * Quick factory functions for developers
 */
export function createSynapseClient(endpoint: string, apiKey: string, debug = false): Synapse {
  return new Synapse({ endpoint, apiKey, debug });
}

/**
 * Default export for easy imports
 */
export default Synapse;

