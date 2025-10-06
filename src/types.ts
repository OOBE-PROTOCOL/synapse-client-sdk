
/**
 * Configuration options and type definitions.
 */

import { CompiledInstruction, InflationReward, ParsedAccountData, PublicKey, TokenBalance, TransactionError, TransactionInstruction } from '@solana/web3.js';

// Re-export common Solana web3 types for convenience
export type { PublicKey, Transaction, TransactionInstruction, Keypair, Signer, BlockhashWithExpiryBlockHeight, SimulatedTransactionResponse } from '@solana/web3.js';

// ====== CONFIGURATION ======
export interface SynapseConfig {
  /** Gateway endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** WebSocket endpoint (optional) */
  wsEndpoint?: string;
  /** Retry configuration */
  retry?: {
    attempts: number;
    backoff: number;
  };
}

/**
 * JSON-RPC request and response types.
 */
// ====== JSON-RPC TYPES ======
export interface RpcRequest<T = any> {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: T;
}

/**
 * JSON-RPC response type.
 */
export interface RpcResponse<T = any> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: RpcError;
}

/**
 * Comprehensive type definitions for the Synapse Client SDK, including configuration, RPC methods, AI agents, WebSocket subscriptions, performance metrics, and error handling.
 */
// ====== SOLANA RPC TYPES ======
export interface RpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 */
export interface BatchResponse<T = any[]> {
  results: RpcResponse<T>[];
  errors: RpcError[];
  timing: {
    total: number;
    average: number;
    fastest: number;
    slowest: number;
  };
}

/**
 * Commitment levels for Solana RPC requests.
 * @since 2.0.0
 */
export type Commitment = 'processed' | 'confirmed' | 'finalized';


/**
 * Options for individual RPC requests.
 * @since 2.0.0
 */
export interface RequestOptions {
  timeout?: number;
  maxRetries?: number;
  commitment?: Commitment;
  encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
  skipCache?: boolean;
  /** Internal: routing hint to gateway for upstream selection */
  routeHint?: 'rotate' | 'sticky';
  /** Internal: round-robin index to help gateway select different upstreams */
  routeIndex?: number;
}

/**
 * Types for Solana account information, blockhashes, epochs, transactions, and token accounts.
 */
export interface AccountInfo extends ParsedAccountInfo {
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch?: number;
  space: number;
}

/**
 * Parsed account information for Solana accounts.
 */
export interface ParsedAccountInfo {
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch?: number;
  space: number;
  data: ParsedAccountData;
}

/**
 * Information about a Solana blockhash.
 * @since 2.0.0
 */
export interface BlockhashInfo {
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Information about the current epoch in Solana.
 * @since 2.0.0
 */
export interface EpochInfo {
  absoluteSlot: number;
  blockHeight: number;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  transactionCount?: number;
}

/**
 * Information about a Solana transaction signature.
 */
export interface TransactionSignature {
  signature: string;
  slot: number;
  err: TransactionError | null;
  memo: string | null;
  blockTime: number | null;
  confirmationStatus?: Commitment;
}


/**
 * Full representation of a confirmed Solana transaction
 */
export interface ConfirmedTransaction {
  slot: number;
  transaction: {
    message: {
      accountKeys: PublicKey[];
      instructions: TransactionInstruction[];
      recentBlockhash: string;
    };
    signatures: string[];
  };
  meta: {
    err: TransactionError | null;
    fee: number;
    innerInstructions?: Array<{
      index: number;
      instructions: CompiledInstruction[];
    }> | null;
    logMessages?: string[] | null;
    postBalances: number[];
    postTokenBalances?: TokenBalance[] | null;
    preBalances: number[];
    preTokenBalances?: TokenBalance[] | null;
    rewards?: InflationReward[] | null;
  } | null;
  blockTime?: number | null;
}

/**
 * Information about a Solana token account.
 * @author SteveTheHead
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface TokenAccount {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number;
            uiAmountString: string;
          };
          mint: string;
          owner: string;
          state: string;
        };
        type: string;
      };
      program: string;
      space: number;
    };
    executable: boolean;
    lamports: number;
    owner: string;
    rentEpoch: number;
  };
}

/**
 * Context information for AI agent interactions.
 * @since 2.0.0
 */
export interface AIAgentContext {
  sessionId: string;
  userId?: string;
  preferences?: {
    commitment?: Commitment;
    maxRetries?: number;
    timeout?: number;
    cacheStrategy?: 'aggressive' | 'normal' | 'minimal';
  };
  tracking?: {
    requestCount: number;
    errorCount: number;
    lastActivity: number;
  };
}

/**
 * Result type for AI agent methods, including metadata and context.
 * @since 2.0.0
 */
export interface AIMethodResult<T = any> {
  data: T;
  metadata: {
    method: string;
    duration: number;
    cached: boolean;
    upstream: string;
    slot?: number;
    commitment?: Commitment;
  };
  context: {
    sessionId: string;
    requestId: string;
    timestamp: number;
  };
}

/**
 * Options for smart queries with AI optimizations.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface SmartQueryOptions {
  maxResults?: number;
  includeMetadata?: boolean;
  smartFilter?: boolean;
  aiOptimized?: boolean;
  explanation?: boolean;
}

/**
 * Configuration options for WebSocket subscriptions.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface SubscriptionConfig {
  encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
  commitment?: Commitment;
  filters?: any[];
  maxSlotsToWait?: number;
}

/**
 * Result of a WebSocket subscription, including the subscription ID and an unsubscribe function.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface SubscriptionResult {
  subscriptionId: number;
  unsubscribe: () => Promise<void>;
}

/**
 * WebSocket message format for subscription notifications.
 * @since 2.0.0
 */
export interface WebSocketMessage {
  jsonrpc: '2.0';
  method: string;
  params: {
    result: any;
    subscription: number;
  };
}

/**
 * Performance metrics for the Synapse Client SDK.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    p95Latency: number;
    requestsPerSecond: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  upstreams: {
    active: number;
    total: number;
    healthiest: string;
    averageLatency: number;
  };
  connection: {
    poolSize: number;
    activeConnections: number;
    keepAliveEnabled: boolean;
  };
}

/**
 * Statistics for the API Gateway.
 * @since 2.0.0
 */
export interface GatewayStats {
  version: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  features: {
    compression: boolean;
    connectionPooling: boolean;
    ewmaRouting: boolean;
    caching: boolean;
  };
}

/**
 * Base error type for the Synapse Client SDK.
 * @since 2.0.0
 */
export class SynapseError extends Error {
  constructor(
    message: string,
    public code?: number,
    public method?: string
  ) {
    super(message);
    this.name = 'SynapseError';
  }
}

/**
 * Error type for rate limiting scenarios.
 * @since 2.0.0
 */

export class RateLimitError extends SynapseError {
  constructor(
    public retryAfter: number,
    public quotaRemaining: number,
    requestId?: string
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, -32000);
    this.name = 'RateLimitError';
  }
}

/**
 * Error type for upstream service failures.
 * @since 2.0.0
 */
export class UpstreamError extends SynapseError {
  constructor(
    message: string,
    public upstreamName: string,
    public originalError?: any,
    requestId?: string
  ) {
    super(`Upstream ${upstreamName}: ${message}`, -32001);
    this.name = 'UpstreamError';
  }
}

/**
 * Error type for network-related failures.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export class NetworkError extends SynapseError {
  constructor(message: string, public originalError?: Error) {
    super(message, -32000);
    this.name = 'NetworkError';
  }
}

/**
 * Error type for caching-related failures (L1, L2, distributed cache).
 * @since 2.0.0
 */
export class CacheError extends SynapseError {
  constructor(
    message: string,
    public cacheLayer: 'L1' | 'L2' | 'distributed',
    public operation: 'get' | 'set' | 'delete' | 'clear',
    public originalError?: Error
  ) {
    super(`Cache ${cacheLayer} ${operation} failed: ${message}`, -32100);
    this.name = 'CacheError';
  }
}

/**
 * Error type for circuit breaker state violations.
 * @since 2.0.0
 */
export class CircuitBreakerError extends SynapseError {
  constructor(
    public state: 'open' | 'half-open',
    public failureCount: number,
    public nextRetryAt?: number
  ) {
    const retryMsg = nextRetryAt 
      ? ` Retry after ${Math.round((nextRetryAt - Date.now()) / 1000)}s`
      : '';
    super(`Circuit breaker is ${state} (${failureCount} failures).${retryMsg}`, -32101);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Error type for WebSocket connection and subscription failures.
 * @since 2.0.0
 */
export class WebSocketError extends SynapseError {
  constructor(
    message: string,
    public wsState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting',
    public subscriptionId?: number,
    public originalError?: Error
  ) {
    super(message, -32102);
    this.name = 'WebSocketError';
  }
}

/**
 * Error type for transaction batching failures.
 * @since 2.0.0
 */
export class BatchingError extends SynapseError {
  constructor(
    message: string,
    public failedJobs: string[],
    public totalJobs: number,
    public originalError?: Error
  ) {
    super(`Batching failed: ${message} (${failedJobs.length}/${totalJobs} jobs failed)`, -32103);
    this.name = 'BatchingError';
  }
}

/**
 * Error type for DeFi operations (swaps, quotes, MEV).
 * @since 2.0.0
 */
export class DeFiError extends SynapseError {
  constructor(
    message: string,
    public operation: 'quote' | 'swap' | 'mev-protection' | 'arbitrage' | 'portfolio' | 'flash-loan' | 'yield',
    public provider?: 'jupiter' | 'raydium' | 'orca' | 'unknown',
    public originalError?: Error
  ) {
    const providerMsg = provider ? ` [${provider}]` : '';
    super(`DeFi ${operation}${providerMsg}: ${message}`, -32104);
    this.name = 'DeFiError';
  }
}

/**
 * Error type for NFT operations (metadata, rarity, compressed NFTs).
 * @since 2.0.0
 */
export class NFTError extends SynapseError {
  constructor(
    message: string,
    public operation: 'metadata' | 'rarity' | 'collection' | 'compressed' | 'marketplace',
    public mint?: string,
    public originalError?: Error
  ) {
    const mintMsg = mint ? ` (${mint.slice(0, 8)}...)` : '';
    super(`NFT ${operation}${mintMsg}: ${message}`, -32105);
    this.name = 'NFTError';
  }
}

/**
 * Error type for AI module operations (PDA, Merkle, ZeroCombine).
 * @since 2.0.0
 */
export class AIError extends SynapseError {
  constructor(
    message: string,
    public module: 'pda-manager' | 'merkle-operation' | 'zero-combine-fetcher',
    public operation?: string,
    public originalError?: Error
  ) {
    const opMsg = operation ? ` ${operation}` : '';
    super(`AI ${module}${opMsg}: ${message}`, -32106);
    this.name = 'AIError';
  }
}

/**
 * Events emitted by the WebSocket connection.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface ConnectionEvents {
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'error': (error: Error) => void;
  'reconnect': (attempt: number) => void;
  'rateLimited': (retryAfter: number) => void;
  'quotaWarning': (remaining: number) => void;
}

/**
 * Client statistics and health metrics.
 * @author SteveTheHead 
 * @author 0xArmorer
 * @since 2.0.0
 */
export interface ClientStats {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  cacheHitRate: number;
  uptime: number;
  activeConnections: number;
  pendingRequests: number;
  lastError?: string;
  lastErrorTime?: number;
}



/**
 * Configuration options for the AI agent.
 * @since 2.0.0
 */
// ====== AI AGENT TYPES ======
export interface AIAgentConfig {
  /** Agent identifier */
  agentId: string;
  /** Agent description */
  description?: string;
  /** Capabilities */
  capabilities: string[];
  /** Rate limiting tier */
  tier: 'basic' | 'advanced' | 'premium';
}

/**
 * Options for performing a stress test on the Synapse Client SDK.
 * @since 2.0.0
 */
export interface StressTestOptions {
  requests: number;
  concurrency: number;
  method: string;
  params?: any[];
  timeout?: number;
}

/**
 * Result of a stress test for the Synapse Client SDK.
 * @since 2.0.0
 */
export interface StressTestResult {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  totalTime: number;
  successfulRequests: number;
  failedRequests: number;
}

/**
 * Result of diagnostics checks for the Synapse Client SDK.
 * @since 2.0.0
 * 
 */
export interface DiagnosticsResult {
  gatewayHealth: boolean;
  upstreams: Array<{
    url: string;
    healthy: boolean;
    latency?: number;
  }>;
  performance: {
    version: string;
    uptime: number;
    requestsPerSecond: number;
  };
}

