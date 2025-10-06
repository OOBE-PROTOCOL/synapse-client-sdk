# Advanced Features Module

Enterprise-grade resilience, performance optimization, and intelligent caching for production Solana applications.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│              Advanced Features Layer                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Circuit Breaker  │  │  Smart Caching   │                │
│  │  • Failure Track │  │  • L1 Memory     │                │
│  │  • State Machine │  │  • L2 Extended   │                │
│  │  • Auto Recovery │  │  • L3 Redis      │                │
│  │  • Fallback      │  │  • ML Prediction │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Load Balancer   │  │    Metrics       │                │
│  │  • Round Robin   │  │  • Latency       │                │
│  │  • Weighted      │  │  • Hit Rate      │                │
│  │  • Least Conn    │  │  • Throughput    │                │
│  │  • IP Hash       │  │  • Errors        │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Components

| Component | Purpose | Complexity | Production Ready |
|-----------|---------|------------|------------------|
| **CircuitBreaker** | Prevent cascade failures | High | Yes |
| **SmartCaching** | Multi-layer ML caching | High | Yes |
| **LoadBalancer** | Distribute requests | Medium | Yes |

---

## Circuit Breaker

Automatically detect and prevent cascading failures with intelligent recovery.

### State Machine

```
┌──────────┐  failure_threshold   ┌──────────┐
│  CLOSED  │ ───────────────────> │   OPEN   │
│ (normal) │                      │ (failing)│
└──────────┘                      └──────────┘
     ^                                  │
     │                                  │ retry_interval
     │                                  │
     │                                  v
     │                            ┌──────────┐
     │      success_count > N     │   HALF   │
     └─────────────────────────── │   OPEN   │
                                  │ (testing)│
                                  └──────────┘
```

### States

| State | Description | Behavior |
|-------|-------------|----------|
| **CLOSED** | Normal operation | All requests pass through |
| **OPEN** | Failure threshold exceeded | Requests fail fast or use fallback |
| **HALF-OPEN** | Testing recovery | Limited requests allowed |

### Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;    // Failed requests before opening
  timeout: number;             // Circuit stays open (ms)
  retryInterval: number;       // Time before half-open (ms)
  monitorWindow: number;       // Sliding window for failures (ms)
  enableFallback: boolean;     // Use fallback on open
}
```

### Implementation

```typescript
import { CircuitBreaker } from '@synapse/client-sdk/advanced';

const breaker = new CircuitBreaker({
  failureThreshold: 5,         // Open after 5 failures
  timeout: 60000,              // Stay open for 60s
  retryInterval: 30000,        // Test recovery after 30s
  monitorWindow: 60000,        // Track failures in 60s window
  enableFallback: true,        // Use fallback when open
});

// Execute operation with circuit breaker protection
const result = await breaker.execute(
  // Primary operation
  async () => {
    return await client.call('getAccountInfo', [address]);
  },
  // Fallback (optional)
  async () => {
    return await getCachedAccountInfo(address);
  }
);
```

### Event Monitoring

```typescript
breaker.on('circuit-opened', ({ reason }) => {
  console.log('Circuit opened:', reason);
  // Alert monitoring system
});

breaker.on('circuit-closed', () => {
  console.log('Circuit closed - recovered');
  // Log recovery
});

breaker.on('circuit-half-opened', () => {
  console.log('Circuit testing recovery...');
});

breaker.on('fallback-used', () => {
  console.log('Using fallback operation');
  // Track fallback usage
});
```

### Statistics

```typescript
const state = breaker.getState();

console.log('Circuit Breaker State:', {
  state: state.state,                    // 'closed' | 'open' | 'half-open'
  failures: state.failures,              // Current failure count
  successCount: state.successCount,      // Success count in current state
  totalRequests: state.totalRequests,    // Total requests processed
  lastFailureTime: state.lastFailureTime,// Last failure timestamp
});
```

### Best Practices

1. **Set Appropriate Thresholds**
   ```typescript
   // For critical services
   const criticalBreaker = new CircuitBreaker({
     failureThreshold: 3,    // Fail fast
     timeout: 120000,        // Longer recovery
     retryInterval: 60000,   // Conservative retry
   });
   
   // For non-critical services
   const standardBreaker = new CircuitBreaker({
     failureThreshold: 10,   // More tolerant
     timeout: 30000,         // Shorter recovery
     retryInterval: 15000,   // Faster retry
   });
   ```

2. **Always Provide Fallbacks**
   ```typescript
   await breaker.execute(
     () => fetchFromPrimary(),
     () => fetchFromCache() // Always provide fallback
   );
   ```

3. **Monitor Circuit State**
   ```typescript
   setInterval(() => {
     const state = breaker.getState();
     if (state.state === 'open') {
       metrics.increment('circuit_breaker.open');
     }
   }, 30000);
   ```

---

## Smart Caching

Multi-layer intelligent caching with ML-driven optimization and predictive loading.

### Cache Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Cache Hierarchy                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  L1 Cache (Memory - LRU)                                │
│  ├─ Max Size: 10,000 entries                            │
│  ├─ TTL: 60s (default)                                  │
│  ├─ Hit Ratio: ~95%                                     │
│  └─ Latency: <1ms                                       │
│                        │                                │
│                        │ miss                           │
│                        ▼                                │
│  L2 Cache (Extended Memory)                             │
│  ├─ Max Size: 50,000 entries                            │
│  ├─ TTL: 300s (default)                                 │
│  ├─ Hit Ratio: ~80%                                     │
│  └─ Latency: <2ms                                       │
│                        │                                │
│                        │ miss                           │
│                        ▼                                │
│  L3 Cache (Distributed - Redis)                         │
│  ├─ Size: Unlimited                                     │
│  ├─ TTL: Configurable                                   │
│  ├─ Hit Ratio: ~60%                                     │
│  └─ Latency: <10ms                                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration

```typescript
interface SmartCacheConfig {
  maxSize?: number;              // L1 cache size (default: 10000)
  enableL2?: boolean;            // Enable L2 cache (default: true)
  enableDistributed?: boolean;   // Enable Redis L3 (default: false)
  redisUrl?: string;             // Redis connection URL
  ttl?: number;                  // Default TTL in ms (default: 60000)
  enableCompression?: boolean;   // Compress values (default: true)
  enablePredictive?: boolean;    // ML predictive loading (default: true)
  compressionThreshold?: number; // Compress if >N bytes (default: 1024)
}
```

### Implementation

```typescript
import { SmartCaching } from '@synapse/client-sdk/advanced';

const cache = new SmartCaching({
  maxSize: 10000,
  enableL2: true,
  enableDistributed: true,
  redisUrl: 'redis://localhost:6379',
  ttl: 60000,
  enableCompression: true,
  enablePredictive: true,
  compressionThreshold: 1024,
});

// Get from cache with automatic layer traversal
const accountInfo = await cache.get<AccountInfo>(
  `account:${address}`,
  true // Enable predictive loading
);

if (accountInfo) {
  console.log('Cache hit:', accountInfo);
} else {
  // Fetch from RPC
  const fresh = await client.call('getAccountInfo', [address]);
  
  // Store in cache with custom TTL
  await cache.set(
    `account:${address}`,
    fresh,
    { ttl: 120000, compress: true }
  );
}
```

### Cache Patterns

#### 1. Read-Through Pattern

```typescript
async function getAccountInfo(address: string): Promise<AccountInfo> {
  const cacheKey = `account:${address}`;
  
  // Try cache first
  let data = await cache.get<AccountInfo>(cacheKey);
  
  if (!data) {
    // Cache miss - fetch from source
    data = await client.call('getAccountInfo', [address]);
    
    // Store in cache
    await cache.set(cacheKey, data, { ttl: 60000 });
  }
  
  return data;
}
```

#### 2. Write-Through Pattern

```typescript
async function updateAccount(address: string, data: AccountInfo): Promise<void> {
  const cacheKey = `account:${address}`;
  
  // Update source
  await updateAccountInDB(address, data);
  
  // Update cache immediately
  await cache.set(cacheKey, data, { ttl: 60000 });
}
```

#### 3. Cache-Aside Pattern

```typescript
async function getTokenPrice(mint: string): Promise<number> {
  const cacheKey = `price:${mint}`;
  
  // Check cache
  const cached = await cache.get<number>(cacheKey);
  if (cached !== null) return cached;
  
  // Fetch from API
  const price = await fetchPriceFromAPI(mint);
  
  // Store in cache (don't await - fire and forget)
  cache.set(cacheKey, price, { ttl: 30000 }).catch(console.error);
  
  return price;
}
```

### Predictive Loading

The cache uses ML to predict which keys will be accessed next:

```typescript
// Automatic predictive loading
const account1 = await cache.get('account:1', true);

// Cache automatically loads:
// - account:2 (sequential access pattern)
// - account:1:tokens (related data pattern)
// - account:1:transactions (related data pattern)
```

### Cache Statistics

```typescript
const stats = cache.getAdvancedStats();

console.log('Cache Performance:', {
  hitRate: stats.hitRate,                 // 95.5%
  missRate: stats.missRate,               // 4.5%
  totalHits: stats.totalHits,             // 10,000
  totalMisses: stats.totalMisses,         // 500
  averageLatency: stats.averageLatency,   // 0.8ms
  memoryUsage: {
    raw: stats.memoryUsage.raw,           // 150MB
    compressed: stats.memoryUsage.compressed, // 45MB
  },
  compressionRatio: stats.compressionRatio, // 0.3 (70% savings)
});

// Layer-specific stats
console.log('L1 Stats:', {
  size: stats.l1.size,
  hits: stats.l1.hits,
  hitRate: stats.l1.hitRate,
});

console.log('L2 Stats:', {
  size: stats.l2.size,
  hits: stats.l2.hits,
  hitRate: stats.l2.hitRate,
});
```

### Cache Invalidation

```typescript
// Invalidate single key
await cache.delete('account:address1');

// Invalidate by pattern
await cache.deleteByPattern('account:*');

// Invalidate by tag
await cache.deleteByTag('user:123');

// Clear entire cache
await cache.clear();

// Invalidate with event
cache.on('invalidation', ({ key, reason }) => {
  console.log(`Cache invalidated: ${key} (${reason})`);
});
```

### Best Practices

1. **Use Appropriate TTLs**
   ```typescript
   // Static data - long TTL
   cache.set('token:metadata', metadata, { ttl: 3600000 }); // 1 hour
   
   // Dynamic data - short TTL
   cache.set('token:price', price, { ttl: 30000 }); // 30 seconds
   
   // Real-time data - very short TTL
   cache.set('account:balance', balance, { ttl: 5000 }); // 5 seconds
   ```

2. **Enable Compression for Large Data**
   ```typescript
   // Compress large objects
   await cache.set(key, largeObject, {
     ttl: 60000,
     compress: true,
     compressionThreshold: 1024, // Compress if >1KB
   });
   ```

3. **Use Cache Tags for Bulk Invalidation**
   ```typescript
   // Set with tags
   await cache.set(key, value, {
     ttl: 60000,
     tags: ['user:123', 'collection:abc'],
   });
   
   // Invalidate all user data at once
   await cache.deleteByTag('user:123');
   ```

4. **Monitor Cache Performance**
   ```typescript
   setInterval(() => {
     const stats = cache.getAdvancedStats();
     
     if (stats.hitRate < 0.8) {
       console.warn('Cache hit rate below 80%');
       // Adjust TTLs or cache size
     }
     
     if (stats.memoryUsage.raw > 500 * 1024 * 1024) {
       console.warn('Cache memory usage above 500MB');
       // Increase compression or reduce maxSize
     }
   }, 60000);
   ```

---

## Load Balancer

Distribute requests across multiple RPC endpoints using various strategies.

### Load Balancing Strategies

| Strategy | Algorithm | Use Case | Complexity |
|----------|-----------|----------|------------|
| **Round Robin** | Sequential rotation | Equal servers | Low |
| **Weighted** | Capacity-based | Unequal servers | Medium |
| **Least Connections** | Minimum active | Dynamic load | Medium |
| **IP Hash** | Client affinity | Session persistence | Low |
| **EWMA** | Exponential weighted | Latency-aware | High |

### Configuration

```typescript
interface LoadBalancerConfig {
  endpoints: string[];                    // RPC endpoints
  strategy: 'round-robin' | 'weighted' | 'least-connections' | 'ip-hash' | 'ewma';
  weights?: Record<string, number>;       // Endpoint weights
  healthCheckInterval?: number;           // Health check frequency (ms)
  timeout?: number;                       // Request timeout (ms)
  maxRetriesPerEndpoint?: number;         // Retries per endpoint
}
```

### Implementation

```typescript
import { LoadBalancer } from '@synapse/client-sdk/advanced';

const balancer = new LoadBalancer({
  endpoints: [
    'https://rpc1.synapse.com',
    'https://rpc2.synapse.com',
    'https://rpc3.synapse.com',
  ],
  strategy: 'ewma',                    // Latency-aware
  healthCheckInterval: 30000,          // Check every 30s
  timeout: 10000,                      // 10s timeout
  maxRetriesPerEndpoint: 2,            // Retry twice per endpoint
});

// Get next endpoint
const endpoint = balancer.getNextEndpoint();
console.log('Using endpoint:', endpoint);

// Execute with automatic failover
const result = await balancer.execute(async (endpoint) => {
  return await fetch(`${endpoint}/rpc`, {
    method: 'POST',
    body: JSON.stringify(rpcRequest),
  });
});
```

### Strategy Examples

#### Round Robin

```typescript
const roundRobin = new LoadBalancer({
  endpoints: ['rpc1', 'rpc2', 'rpc3'],
  strategy: 'round-robin',
});

// Distributes evenly:
// Request 1 → rpc1
// Request 2 → rpc2
// Request 3 → rpc3
// Request 4 → rpc1 (cycle repeats)
```

#### Weighted

```typescript
const weighted = new LoadBalancer({
  endpoints: ['rpc1', 'rpc2', 'rpc3'],
  strategy: 'weighted',
  weights: {
    'rpc1': 50,  // 50% of traffic
    'rpc2': 30,  // 30% of traffic
    'rpc3': 20,  // 20% of traffic
  },
});
```

#### Least Connections

```typescript
const leastConn = new LoadBalancer({
  endpoints: ['rpc1', 'rpc2', 'rpc3'],
  strategy: 'least-connections',
});

// Automatically routes to endpoint with fewest active connections
```

#### EWMA (Recommended)

```typescript
const ewma = new LoadBalancer({
  endpoints: ['rpc1', 'rpc2', 'rpc3'],
  strategy: 'ewma',
});

// Routes based on exponential weighted moving average of latency
// Automatically avoids slow endpoints
```

### Health Checks

```typescript
balancer.on('health-check', ({ endpoint, healthy, latency }) => {
  console.log(`Health check: ${endpoint}`, {
    healthy,
    latency,
  });
});

balancer.on('endpoint-down', ({ endpoint }) => {
  console.log(`Endpoint down: ${endpoint}`);
  // Alert monitoring system
});

balancer.on('endpoint-recovered', ({ endpoint }) => {
  console.log(`Endpoint recovered: ${endpoint}`);
  // Log recovery
});
```

### Statistics

```typescript
const stats = balancer.getStats();

console.log('Load Balancer Stats:', {
  totalRequests: stats.totalRequests,
  endpointStats: stats.endpoints.map(e => ({
    url: e.url,
    requests: e.requests,
    errors: e.errors,
    averageLatency: e.averageLatency,
    healthy: e.healthy,
  })),
});
```

---

## Complete Integration Example

```typescript
import {
  SmartCaching,
  CircuitBreaker,
  LoadBalancer,
} from '@synapse/client-sdk/advanced';

// Initialize components
const cache = new SmartCaching({
  maxSize: 10000,
  enableL2: true,
  enablePredictive: true,
});

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 60000,
  retryInterval: 30000,
  enableFallback: true,
});

const balancer = new LoadBalancer({
  endpoints: [
    'https://rpc1.synapse.com',
    'https://rpc2.synapse.com',
    'https://rpc3.synapse.com',
  ],
  strategy: 'ewma',
  healthCheckInterval: 30000,
});

// Execute request with all features
async function getAccountInfo(address: string): Promise<AccountInfo> {
  const cacheKey = `account:${address}`;
  
  // 1. Check cache first
  const cached = await cache.get<AccountInfo>(cacheKey);
  if (cached) return cached;
  
  // 2. Execute with circuit breaker
  const result = await breaker.execute(
    // Primary: Use load balancer
    async () => {
      const endpoint = balancer.getNextEndpoint();
      const response = await fetch(`${endpoint}/rpc`, {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [address],
        }),
      });
      return await response.json();
    },
    // Fallback: Try cache or throw
    async () => {
      const stale = await cache.get<AccountInfo>(cacheKey, false);
      if (stale) return stale;
      throw new Error('No fallback available');
    }
  );
  
  // 3. Store in cache
  await cache.set(cacheKey, result, { ttl: 60000 });
  
  return result;
}
```

---

## Performance Metrics

| Component | Operation | Latency | Throughput |
|-----------|-----------|---------|------------|
| **Circuit Breaker** | Execute | <1ms | 100k ops/s |
| **Smart Caching** | L1 Get | <1ms | 1M ops/s |
| **Smart Caching** | L2 Get | <2ms | 500k ops/s |
| **Smart Caching** | L3 Get | <10ms | 50k ops/s |
| **Load Balancer** | Get Next | <0.1ms | 10M ops/s |
| **Load Balancer** | Health Check | <50ms | N/A |

---

## Best Practices Summary

1. **Always use Circuit Breaker for external calls**
2. **Implement multi-layer caching for frequently accessed data**
3. **Use EWMA load balancing for optimal latency**
4. **Monitor metrics and adjust thresholds**
5. **Provide fallbacks for critical operations**
6. **Enable compression for large cached objects**
7. **Set appropriate TTLs based on data volatility**
8. **Use cache tags for efficient bulk invalidation**

---

## Troubleshooting

### Circuit Breaker Stuck Open

**Problem:** Circuit remains open despite healthy service

**Solution:**
```typescript
// Reduce failure threshold
breaker.config.failureThreshold = 3;

// Reduce retry interval
breaker.config.retryInterval = 15000;

// Manually reset
breaker.reset();
```

### Low Cache Hit Rate

**Problem:** Cache hit rate below 80%

**Solution:**
```typescript
// Increase cache size
cache.config.maxSize = 20000;

// Enable L2 cache
cache.config.enableL2 = true;

// Increase TTL for stable data
cache.set(key, value, { ttl: 300000 });

// Enable predictive loading
cache.config.enablePredictive = true;
```

### Load Balancer Uneven Distribution

**Problem:** One endpoint receiving most traffic

**Solution:**
```typescript
// Use weighted strategy
balancer.config.strategy = 'weighted';
balancer.config.weights = {
  'rpc1': 33,
  'rpc2': 33,
  'rpc3': 34,
};

// Or use EWMA for automatic optimization
balancer.config.strategy = 'ewma';
```

---

## License

MIT License - See [LICENSE](../../LICENSE) for details.

---

**Advanced Features Module** - Enterprise-grade resilience and performance
