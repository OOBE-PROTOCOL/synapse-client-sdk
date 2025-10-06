/**
 * SYNAPSE 
 */

export { SmartCaching } from './smart-caching';
export { CircuitBreaker } from './circuit-breaker';
export { LoadBalancer } from './load-balancer';

// Specific type exports to avoid conflicts
export type { 
  AdvancedClientConfig,
  SmartCacheConfig,
  CircuitBreakerConfig,
  LoadBalancerConfig,
  BatcherConfig,
  AdvancedMetricsData,
  AdvancedEvents,
  // Export types referenced in documentation
  AdvancedPerformanceMetrics,
  CacheStats,
  BatchResult,
  RetryAttempt,
  SecurityThreat,
  UpstreamHealth
} from './types';
