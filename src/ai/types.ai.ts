/**
 * AI module types - OOBE Protocol compatible
 *
 * Types and interfaces for AI agents compatible with the OOBE Protocol
 * (https://github.com/CryptoFamilyNFT/oobe-protocol). These types support
 * LangChain StructuredTool patterns, multi-LLM providers, and Agent-based
 * dependency injection.
 *
 * NOTE: LangChain types are declared as 'any' here since @langchain packages
 * are peer dependencies. Install @langchain/core for full type safety.
 */

/**
 * Minimal Agent interface compatible with OOBE Protocol Agent class.
 * Real implementations should use the full oobe-protocol Agent.
 */
export interface OOBECompatibleAgent {
  getCurrentLLM(): Promise<any>; // BaseChatModel from @langchain/core
  switchLLMProvider?(config: any): Promise<any>;
  walletAddress?: string;
  logger?: any;
  executeAction?(actionName: string, input: Record<string, any>): Promise<any>;
}

/**
 * Market analysis suggestion from an AI agent
 */
export interface AgentTradeSuggestion {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  confidence?: number;
  reasoning?: string;
  metadata?: Record<string, any>;
}

/**
 * Risk assessment report from an AI agent
 */
export interface AgentRiskReport {
  score: number;
  level?: 'low' | 'medium' | 'high' | 'critical';
  reasons?: string[];
  details?: Record<string, any>;
}

/**
 * AgentAdapter interface for pluggable intelligence.
 * Implement this to integrate LangChain, Langraph, or custom AI logic.
 */
export interface AgentAdapter {
  analyzeMarket(context: {
    pairs: string[];
    client: any;
    agent?: OOBECompatibleAgent;
  }): Promise<AgentTradeSuggestion[]>;
  evaluateRisk?(context: {
    client: any;
    agent?: OOBECompatibleAgent;
  }): Promise<AgentRiskReport>;
  proposeStrategies?(context: {
    client: any;
    agent?: OOBECompatibleAgent;
  }): Promise<any>;
}

/**
 * AI agent configuration
 */
export interface AIAgentConfig {
  agentId: string;
  description?: string;
  capabilities: string[];
  tier: 'basic' | 'advanced' | 'premium';
  oobeAgent?: OOBECompatibleAgent;
}

/**
 * Blockchain context for AI operations
 */
export interface AIContext {
  currentSlot?: number;
  epochInfo?: any;
  networkStatus: 'healthy' | 'degraded' | 'unhealthy';
  availableMethods: string[];
}

/**
 * Batch operation configuration
 */
export interface BatchOptionRequest {
  batchSize: number;
  delayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Standard AI response wrapper
 */
export interface AIResponse<T = any> {
  data: T;
  context: AIContext;
  metadata: {
    latency: number;
    cacheHit: boolean;
    upstreamUsed: string;
    timestamp: string;
  };
}

/**
 * Market prediction from quantum/AI analysis
 */
export interface QuantumPrediction {
  asset: string;
  timeframe: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  priceTarget: number;
  supportLevels?: number[];
  resistanceLevels?: number[];
  signals?: string[];
}

/**
 * Trade execution record
 */
export interface TradeExecution {
  id: string;
  source: string;
  type: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  timestamp: string;
  status: 'pending' | 'filled' | 'failed' | 'cancelled';
  expectedProfit?: number;
  actualProfit?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Multi-chain signal analysis
 */
export interface MultiChainSignal {
  chain: string;
  signal: string;
  strength: number;
  impact: 'positive' | 'negative' | 'neutral';
  crossChainCorrelation: number;
  arbitrageOpportunities: Array<{
    fromChain: string;
    toChain: string;
    asset: string;
    profitPotential: number;
  }>;
}

/**
 * Trading strategy metadata
 */
export interface AutoTradingStrategy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  riskScore: number;
  expectedReturn: number;
  maxDrawdown: number;
  winRate: number;
  averageHoldTime: string;
  signals: string[];
  performance: {
    totalTrades: number;
    profitableTrades: number;
    totalPnL: number;
    sharpeRatio: number;
  };
}
