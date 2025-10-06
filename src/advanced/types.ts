/**
 * 🚀 SYNAPSE ADVANCED SDK - ADVANCED TYPES
 * Enterprise-grade type definitions
 */

import type { Commitment } from '../types';

/**
 * @name AdvancedTypes
 * @module advanced/types
 * @description Type declarations for advanced client modules such as smart caching, circuit breaker, load balancing, and batch processing.
 */
// ====== ADVANCED CLIENT TYPES ======

export interface AdvancedClientConfig {
  endpoint: string;
  apiKey: string;
  wsEndpoint?: string;
  features?: {
    smartCaching?: boolean;
    circuitBreaker?: boolean;
    loadBalancing?: boolean;
    batchOptimization?: boolean;
    retryStrategies?: boolean;
    securityChecks?: boolean;
    advancedMetrics?: boolean;
    aiOptimizations?: boolean;
  };
  performance?: {
    maxConcurrency?: number;
    timeout?: number;
    retryAttempts?: number;
    cacheSize?: number;
    compressionLevel?: number;
  };
  security?: {
    enableSignatureVerification?: boolean;
    enableRateLimitBackoff?: boolean;
    enableQuotaMonitoring?: boolean;
    enableThreatDetection?: boolean;
  };
}

// ====== SMART CACHING TYPES ======

export interface SmartCacheConfig {
  strategy: 'aggressive' | 'balanced' | 'conservative' | 'custom';
  ttlMultiplier?: number;
  maxSize?: number;
  enablePredictive?: boolean;
  enableDistributed?: boolean;
  compressionLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  size: number;
  compressed: boolean;
  tags: string[];
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  averageLatency: number;
  memoryUsage: number;
  compressionRatio: number;
}

// ====== CIRCUIT BREAKER TYPES ======

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  retryInterval: number;
  monitorWindow: number;
  enableFallback: boolean;
}

export interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  successCount: number;
  totalRequests: number;
}

// ====== LOAD BALANCER TYPES ======

export interface LoadBalancerConfig {
  strategy: 'round-robin' | 'weighted' | 'least-latency' | 'health-based' | 'adaptive';
  healthCheckInterval: number;
  enableStickySessions: boolean;
  enableGeoRouting: boolean;
}

export interface UpstreamHealth {
  endpoint: string;
  healthy: boolean;
  latency: number;
  lastCheck: number;
  errorRate: number;
  throughput: number;
  weight: number;
}

// ====== TRANSACTION BATCHER TYPES ======

export interface BatcherConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  enablePriority: boolean;
  enableOptimization: boolean;
}

export interface BatchJob {
  id: string;
  method: string;
  params: any[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export interface BatchResult {
  batchId: string;
  results: any[];
  errors: any[];
  timing: {
    queued: number;
    executed: number;
    total: number;
  };
  optimization: {
    originalRequests: number;
    batchedRequests: number;
    savedRequests: number;
    efficiency: number;
  };
}

// ====== RETRY STRATEGY TYPES ======

export interface RetryConfig {
  strategy: 'exponential' | 'linear' | 'fibonacci' | 'custom';
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  enableCircuitBreaker: boolean;
}

export interface RetryAttempt {
  attempt: number;
  error: Error;
  delay: number;
  timestamp: number;
}

// ====== PERFORMANCE OPTIMIZER TYPES ======

export interface PerformanceConfig {
  enableConnectionPooling: boolean;
  enableCompression: boolean;
  enableRequestOptimization: boolean;
  enableResponseOptimization: boolean;
  memoryThreshold: number;
  cpuThreshold: number;
}

export interface AdvancedPerformanceMetrics {
  throughput: {
    rps: number;
    peakRps: number;
    averageRps: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  memory: {
    used: number;
    free: number;
    peak: number;
  };
  cpu: {
    usage: number;
    peak: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

// ====== SECURITY MANAGER TYPES ======

export interface SecurityConfig {
  enableThreatDetection: boolean;
  enableRateLimitProtection: boolean;
  enableSignatureValidation: boolean;
  enableEncryption: boolean;
  maxRequestsPerSecond: number;
  blacklist: string[];
  whitelist: string[];
}

export interface SecurityThreat {
  type: 'rate-limit' | 'malformed-request' | 'suspicious-pattern' | 'blacklisted-ip';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  source: string;
}

// ====== ADVANCED METRICS TYPES ======

export interface MetricsConfig {
  enableRealTime: boolean;
  enableHistorical: boolean;
  retention: number;
  aggregationInterval: number;
  enableAlerts: boolean;
}

export interface AdvancedMetricsData {
  performance: AdvancedPerformanceMetrics;
  security: {
    threatsDetected: number;
    requestsBlocked: number;
    securityScore: number;
  };
  reliability: {
    uptime: number;
    errorRate: number;
    successRate: number;
    mttr: number; // Mean Time To Recovery
  };
  business: {
    apiCallsToday: number;
    quotaUsage: number;
    costOptimization: number;
    efficiency: number;
  };
}

// ====== EVENT TYPES ======

export interface AdvancedEvents {
  'performance-warning': (data: AdvancedPerformanceMetrics) => void;
  'security-threat': (threat: SecurityThreat) => void;
  'circuit-breaker-open': (upstream: string) => void;
  'cache-optimization': (stats: CacheStats) => void;
  'batch-completed': (result: BatchResult) => void;
  'retry-exhausted': (error: Error, attempts: RetryAttempt[]) => void;
  'quota-warning': (remaining: number) => void;
  'upstream-degraded': (upstream: UpstreamHealth) => void;
}
