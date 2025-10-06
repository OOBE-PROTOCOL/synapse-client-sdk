# Utils Module

Utility functions, constants, and helper methods for Synapse Client SDK.

## Table of Contents

- [Overview](#overview)
- [Components](#components)
- [Constants](#constants)
- [Helper Functions](#helper-functions)
- [Validation](#validation)
- [Performance Monitoring](#performance-monitoring)
- [Diagnostics](#diagnostics)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Overview

The Utils module provides essential utility functions and constants used throughout the Synapse Client SDK. It includes validation helpers, performance monitoring tools, diagnostics, and common constants.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Utils Module                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Constants    │  │    Helpers      │  │   Validation    │ │
│  │  (URLs, IDs)   │  │  (Formatting)   │  │ (Address, Key)  │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Performance   │  │   Diagnostics   │  │  Rate Limiting  │ │
│  │   Monitoring   │  │   (Health)      │  │     (Info)      │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Constants

Core configuration values and endpoints.

### 2. Helper Functions

Common utility functions for formatting and conversion.

### 3. Validation

Address and API key validation methods.

### 4. Performance Monitoring

Real-time performance monitoring tools.

### 5. Diagnostics

System health checks and gateway diagnostics.

---

## Constants

### SynapseConstants

```typescript
import { SynapseConstants } from '@synapse/client-sdk/utils';

// RPC endpoints
console.log('Base URL:', SynapseConstants.BASE_URL);
console.log('WebSocket URL:', SynapseConstants.WEBSOCKET_URL);
console.log('Server URL:', SynapseConstants.SERVER_BASE_URL);

// Timeouts
console.log('Default timeout:', SynapseConstants.DEFAULT_TIMEOUT);
console.log('WebSocket ping interval:', SynapseConstants.WS_PING_INTERVAL);

// Retry configuration
console.log('Max retries:', SynapseConstants.MAX_RETRIES);
console.log('Retry delay:', SynapseConstants.RETRY_DELAY);

// Cache configuration
console.log('Cache TTL:', SynapseConstants.CACHE_TTL);
console.log('Max cache size:', SynapseConstants.MAX_CACHE_SIZE);

// Program IDs
console.log('System Program:', SynapseConstants.SYSTEM_PROGRAM_ID);
console.log('Token Program:', SynapseConstants.TOKEN_PROGRAM_ID);
console.log('Associated Token Program:', SynapseConstants.ASSOCIATED_TOKEN_PROGRAM_ID);
```

### Available Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `BASE_URL` | `string` | Default RPC endpoint |
| `WEBSOCKET_URL` | `string` | WebSocket endpoint |
| `SERVER_BASE_URL` | `string` | Server API endpoint |
| `DEFAULT_TIMEOUT` | `30000` | Default request timeout (ms) |
| `WS_PING_INTERVAL` | `30000` | WebSocket ping interval (ms) |
| `MAX_RETRIES` | `3` | Maximum retry attempts |
| `RETRY_DELAY` | `1000` | Retry delay (ms) |
| `CACHE_TTL` | `60000` | Cache time-to-live (ms) |
| `MAX_CACHE_SIZE` | `10000` | Maximum cache entries |
| `SYSTEM_PROGRAM_ID` | `11111...` | Solana System Program |
| `TOKEN_PROGRAM_ID` | `Token...` | SPL Token Program |
| `ASSOCIATED_TOKEN_PROGRAM_ID` | `ATokenG...` | Associated Token Program |

---

## Helper Functions

### SynapseUtils

```typescript
import { SynapseUtils } from '@synapse/client-sdk/utils';

// Format lamports to SOL
const sol = SynapseUtils.lamportsToSol(1_000_000_000);
console.log('Amount:', sol, 'SOL'); // 1 SOL

// Parse SOL to lamports
const lamports = SynapseUtils.solToLamports(1.5);
console.log('Lamports:', lamports); // 1500000000

// Validate Solana address
const isValid = SynapseUtils.isValidSolanaAddress(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);
console.log('Valid address:', isValid); // true

// Shorten signature for display
const shortSig = SynapseUtils.shortenSignature(
  '5j7s6NyAj9M8q2CqYv...',
  8
);
console.log('Short signature:', shortSig);

// Format timestamp
const formatted = SynapseUtils.formatTimestamp(Date.now());
console.log('Timestamp:', formatted); // "2024-01-15 14:30:25"

// Calculate transaction fee
const fee = SynapseUtils.calculateFee(signatureCount, 5000);
console.log('Fee:', fee, 'lamports');
```

### Formatting Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `lamportsToSol` | `(lamports: number) => number` | Convert lamports to SOL |
| `solToLamports` | `(sol: number) => number` | Convert SOL to lamports |
| `shortenAddress` | `(address: string, chars?: number) => string` | Shorten address for display |
| `shortenSignature` | `(sig: string, chars?: number) => string` | Shorten signature |
| `formatTimestamp` | `(timestamp: number) => string` | Format Unix timestamp |
| `formatDuration` | `(ms: number) => string` | Format duration (e.g., "2h 15m") |
| `formatBytes` | `(bytes: number) => string` | Format bytes (e.g., "1.5 MB") |
| `calculateFee` | `(signatures: number, lamportsPerSignature: number) => number` | Calculate tx fee |

---

## Validation

### Address Validation

```typescript
import { SynapseUtils } from '@synapse/client-sdk/utils';

// Validate Solana address
const isValidAddress = SynapseUtils.isValidSolanaAddress(address);
if (!isValidAddress) {
  throw new Error('Invalid Solana address');
}

// Validate multiple addresses
const addresses = ['addr1', 'addr2', 'addr3'];
const validAddresses = addresses.filter(addr => 
  SynapseUtils.isValidSolanaAddress(addr)
);

console.log('Valid addresses:', validAddresses.length);
```

### API Key Validation

```typescript
import { SynapseUtils } from '@synapse/client-sdk/utils';

const utils = new SynapseUtils(client);

// Validate API key format and authentication
const isValidKey = await utils.isValidApiKey(apiKey);
if (!isValidKey) {
  throw new Error('Invalid or expired API key');
}

console.log('API key valid:', isValidKey);
```

### Validation Rules

| Validation | Rules | Example |
|-----------|-------|---------|
| **Solana Address** | 32-44 chars, Base58 | `EPjFWdd5...` |
| **API Key** | Server-side verification | `sk_live_...` |
| **Public Key** | 44 chars, valid Base58 | `TokenkegQf...` |
| **Signature** | 88 chars, Base58 | `5j7s6NyAj...` |

---

## Performance Monitoring

### Real-Time Monitoring

```typescript
import { SynapseClient } from '@synapse/client-sdk';
import { SynapseUtils } from '@synapse/client-sdk/utils';

const client = new SynapseClient({ /* config */ });
const utils = new SynapseUtils(client);

// Monitor performance for 60 seconds
await utils.monitorPerformance(60000);

// Output:
// 🔍 Starting performance monitoring...
//  [5s] RPS: 120, Latency: 45ms, Errors: 0
//  [10s] RPS: 125, Latency: 42ms, Errors: 0
//  [15s] RPS: 130, Latency: 40ms, Errors: 1
// ...
// ✅ Performance monitoring completed
```

### Stress Testing

```typescript
// Run stress test
const results = await utils.runStressTest({
  requests: 1000,
  concurrency: 50,
  method: 'getBalance',
  params: ['YourAddressHere'],
});

console.log('Stress Test Results:');
console.log('  Total requests:', results.totalRequests);
console.log('  Successful:', results.successfulRequests);
console.log('  Average latency:', results.averageLatency, 'ms');
console.log('  RPS:', results.requestsPerSecond);
console.log('  Error rate:', results.errorRate, '%');

// Example output:
// 📈 Starting stress test: 1000 requests, 50 concurrent
// 📈 Progress: 10%
// 📈 Progress: 20%
// ...
// >> Stress Test Results:
//     Successful: 995/1000 (99.5%)
//     RPS: 250
//     Avg Latency: 42ms
//     Total Time: 4000ms
```

### Stress Test Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requests` | `number` | Required | Total number of requests |
| `concurrency` | `number` | Required | Concurrent requests |
| `method` | `string` | `'getSlot'` | RPC method to test |
| `params` | `any[]` | `[]` | Method parameters |

---

## Diagnostics

### Gateway Health Check

```typescript
// Run diagnostics
const diagnostics = await utils.diagnostics();

console.log('Gateway Health:', diagnostics.gatewayHealth ? '✅' : '❌');
console.log('Gateway Version:', diagnostics.performance.version);
console.log('Uptime:', diagnostics.performance.uptime);
console.log('Memory:', diagnostics.performance.memory);

console.log('Upstreams:');
diagnostics.upstreams.forEach(upstream => {
  console.log(`  ${upstream.url}: ${upstream.status}`);
  console.log(`    Latency: ${upstream.latency}ms`);
  console.log(`    Success rate: ${upstream.successRate}%`);
});

console.log('Client Stats:');
console.log('  Requests:', diagnostics.clientStats.requestCount);
console.log('  Errors:', diagnostics.clientStats.errorCount);
console.log('  Avg latency:', diagnostics.clientStats.averageLatency);
```

### Rate Limit Information

```typescript
// Get rate limit info
const rateLimit = await utils.getRateLimitInfo();

if (rateLimit) {
  console.log('Plan:', rateLimit.plan);
  console.log('Remaining requests:', rateLimit.remaining);
  console.log('Reset time:', new Date(rateLimit.resetTime));
  
  // Calculate time until reset
  const msUntilReset = rateLimit.resetTime - Date.now();
  console.log('Reset in:', Math.floor(msUntilReset / 1000 / 60), 'minutes');
  
  // Warn if approaching limit
  if (rateLimit.remaining < 100) {
    console.warn('⚠️ Approaching rate limit!');
  }
}
```

---

## Best Practices

### 1. Use Constants

```typescript
// ✅ Recommended: Use constants
import { SynapseConstants } from '@synapse/client-sdk/utils';

const client = new SynapseClient({
  endpoint: SynapseConstants.BASE_URL,
  timeout: SynapseConstants.DEFAULT_TIMEOUT,
});

// ❌ Not recommended: Hardcode values
const client = new SynapseClient({
  endpoint: 'https://...',
  timeout: 30000,
});
```

### 2. Validate Inputs

```typescript
// ✅ Recommended: Validate before using
import { SynapseUtils } from '@synapse/client-sdk/utils';

function getBalance(address: string) {
  if (!SynapseUtils.isValidSolanaAddress(address)) {
    throw new Error('Invalid address');
  }
  return client.call('getBalance', [address]);
}

// ❌ Not recommended: Skip validation
function getBalance(address: string) {
  return client.call('getBalance', [address]); // May fail
}
```

### 3. Monitor Performance

```typescript
// ✅ Recommended: Regular monitoring
setInterval(async () => {
  const stats = client.getStats();
  if (stats.averageLatency > 1000) {
    console.warn('High latency detected');
  }
}, 60000);

// ❌ Not recommended: No monitoring
// Issues go unnoticed
```

### 4. Use Utilities for Formatting

```typescript
// ✅ Recommended: Use utility functions
const formatted = SynapseUtils.lamportsToSol(balance);
console.log(`Balance: ${formatted} SOL`);

// ❌ Not recommended: Manual calculation
const formatted = balance / 1000000000; // Magic number
console.log(`Balance: ${formatted} SOL`);
```

---

## API Reference

### SynapseConstants

#### Properties

```typescript
BASE_URL: string
WEBSOCKET_URL: string
SERVER_BASE_URL: string
DEFAULT_TIMEOUT: number
WS_PING_INTERVAL: number
MAX_RETRIES: number
RETRY_DELAY: number
CACHE_TTL: number
MAX_CACHE_SIZE: number
SYSTEM_PROGRAM_ID: string
TOKEN_PROGRAM_ID: string
ASSOCIATED_TOKEN_PROGRAM_ID: string
```

---

### SynapseUtils

#### Constructor

```typescript
constructor(client: SynapseClient)
```

Creates a new utils instance.

---

#### Static Methods

##### isValidSolanaAddress()

```typescript
static isValidSolanaAddress(address: string): boolean
```

Validates Solana address format.

**Example:**
```typescript
const isValid = SynapseUtils.isValidSolanaAddress('EPjFWdd5...');
```

---

##### lamportsToSol()

```typescript
static lamportsToSol(lamports: number): number
```

Converts lamports to SOL.

**Example:**
```typescript
const sol = SynapseUtils.lamportsToSol(1_000_000_000); // 1
```

---

##### solToLamports()

```typescript
static solToLamports(sol: number): number
```

Converts SOL to lamports.

**Example:**
```typescript
const lamports = SynapseUtils.solToLamports(1.5); // 1500000000
```

---

##### shortenAddress()

```typescript
static shortenAddress(address: string, chars?: number): string
```

Shortens address for display.

**Example:**
```typescript
const short = SynapseUtils.shortenAddress('EPjFWdd5...', 4);
// "EPjF...t1v"
```

---

##### formatTimestamp()

```typescript
static formatTimestamp(timestamp: number): string
```

Formats Unix timestamp to readable string.

**Example:**
```typescript
const formatted = SynapseUtils.formatTimestamp(Date.now());
// "2024-01-15 14:30:25"
```

---

#### Instance Methods

##### isValidApiKey()

```typescript
async isValidApiKey(apiKey: string): Promise<boolean>
```

Validates API key with server.

**Example:**
```typescript
const isValid = await utils.isValidApiKey('sk_live_...');
```

---

##### monitorPerformance()

```typescript
async monitorPerformance(duration?: number): Promise<void>
```

Monitors client performance for specified duration.

**Parameters:**
- `duration`: Monitoring duration in milliseconds (default: 60000)

**Example:**
```typescript
await utils.monitorPerformance(60000); // 1 minute
```

---

##### runStressTest()

```typescript
async runStressTest(options: {
  requests: number;
  concurrency: number;
  method?: string;
  params?: any[];
}): Promise<{
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  requestsPerSecond: number;
  errorRate: number;
}>
```

Runs stress test on client.

**Example:**
```typescript
const results = await utils.runStressTest({
  requests: 1000,
  concurrency: 50,
});
```

---

##### diagnostics()

```typescript
async diagnostics(): Promise<{
  gatewayHealth: boolean;
  upstreams: any[];
  performance: any;
  clientStats: any;
}>
```

Gets gateway diagnostics and health.

**Example:**
```typescript
const diag = await utils.diagnostics();
console.log('Health:', diag.gatewayHealth);
```

---

##### getRateLimitInfo()

```typescript
async getRateLimitInfo(): Promise<{
  plan: string;
  remaining: number;
  resetTime: number;
} | null>
```

Gets rate limit information.

**Example:**
```typescript
const info = await utils.getRateLimitInfo();
if (info) {
  console.log('Remaining:', info.remaining);
}
```

---

## Common Use Cases

### 1. Display Balance

```typescript
const balance = await client.call('getBalance', [address]);
const formatted = SynapseUtils.lamportsToSol(balance);
console.log(`Balance: ${formatted.toFixed(4)} SOL`);
```

### 2. Validate Input

```typescript
if (!SynapseUtils.isValidSolanaAddress(address)) {
  throw new Error('Invalid address format');
}
```

### 3. Monitor Health

```typescript
const diagnostics = await utils.diagnostics();
if (!diagnostics.gatewayHealth) {
  console.error('Gateway unhealthy!');
  // Switch to backup endpoint
}
```

### 4. Check Rate Limits

```typescript
const rateLimit = await utils.getRateLimitInfo();
if (rateLimit && rateLimit.remaining < 100) {
  console.warn('Approaching rate limit');
  // Throttle requests
}
```

### 5. Stress Test Before Production

```typescript
const results = await utils.runStressTest({
  requests: 10000,
  concurrency: 100,
});

if (results.errorRate > 1) {
  console.error('High error rate in stress test');
}

if (results.averageLatency > 100) {
  console.warn('High latency detected');
}
```

---

## Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| Address Validation | <1ms | Regex check |
| Format Conversion | <1ms | Math operation |
| API Key Validation | 50-200ms | Server roundtrip |
| Diagnostics | 100-500ms | Multiple checks |
| Stress Test | Varies | Depends on config |

---

## Troubleshooting

### Issue: Invalid address validation fails

**Solution:**
```typescript
// Ensure address is trimmed and properly formatted
const address = inputAddress.trim();
const isValid = SynapseUtils.isValidSolanaAddress(address);
```

### Issue: Rate limit info returns null

**Solution:**
```typescript
// Ensure API key is provided
const client = new SynapseClient({
  endpoint: SynapseConstants.BASE_URL,
  apiKey: process.env.SYNAPSE_API_KEY, // Required
});
```

### Issue: Stress test errors

**Solution:**
```typescript
// Reduce concurrency for slower endpoints
const results = await utils.runStressTest({
  requests: 1000,
  concurrency: 10, // Reduced from 50
});
```

---

**Utils Module** - Essential utilities for Synapse SDK

Built for developer productivity and code quality

