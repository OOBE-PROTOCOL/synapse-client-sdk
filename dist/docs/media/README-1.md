# WebSocket Client Module

Real-time Solana blockchain data streaming with intelligent reconnection, subscription management, and enterprise-grade reliability.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│            WebSocket Client Architecture              │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Application Layer                                    │
│  ├─ Account Subscriptions                            │
│  ├─ Slot Subscriptions                               │
│  ├─ Program Subscriptions                            │
│  └─ Transaction Subscriptions                        │
│                    │                                  │
│                    ▼                                  │
│  Subscription Manager                                 │
│  ├─ ID Mapping                                       │
│  ├─ Callback Registry                                │
│  ├─ Filter Management                                │
│  └─ Priority Queue                                   │
│                    │                                  │
│                    ▼                                  │
│  Connection Manager                                   │
│  ├─ Auto-reconnect (exponential backoff)            │
│  ├─ Heartbeat monitoring                            │
│  ├─ Message buffering                               │
│  └─ State tracking                                   │
│                    │                                  │
│                    ▼                                  │
│  WebSocket Layer (ws)                               │
│  └─ Binary protocol with compression                │
│                                                       │
├──────────────────────────────────────────────────────┤
│            Solana RPC Gateway (WSS)                  │
└──────────────────────────────────────────────────────┘
```

## Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Auto-reconnect** | Exponential backoff with configurable max attempts | Production |
| **Subscription Management** | Track and restore subscriptions on reconnect | Production |
| **Message Buffering** | Queue messages during disconnection | Production |
| **Smart Filtering** | Client-side filtering with custom predicates | Production |
| **Circuit Breaker** | Automatic failure protection | Production |
| **Smart Caching** | Cache subscription data | Production |
| **Compression** | WebSocket compression support | Production |
| **Heartbeat** | Connection health monitoring | Production |

## Installation

```bash
npm install @oobe-protocol-labs/synapse-client-sdk
```

## Quick Start

```typescript
import { WebSocketClient } from '@oobe-protocol-labs/synapse-client-sdk/websocket';

const wsClient = new WebSocketClient({
  endpoint: 'wss://your-synapse-gateway.com',
  apiKey: process.env.SYNAPSE_API_KEY,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000,
  enableSmartCaching: true,
  enableCircuitBreaker: true,
});

// Connect
await wsClient.connect();

// Subscribe to account changes
const subId = await wsClient.accountSubscribe(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
  (accountInfo) => {
    console.log('Account updated:', accountInfo);
  },
  {
    commitment: 'confirmed',
    encoding: 'jsonParsed',
  }
);

// Unsubscribe
await wsClient.accountUnsubscribe(subId);

// Cleanup
await wsClient.disconnect();
```

## Configuration

```typescript
interface WebSocketConfig {
  endpoint: string;                  // WSS endpoint URL
  apiKey?: string;                   // Optional API key
  autoReconnect?: boolean;           // Enable auto-reconnect (default: true)
  maxReconnectAttempts?: number;     // Max reconnection attempts (default: 10)
  reconnectDelay?: number;           // Initial reconnect delay ms (default: 5000)
  heartbeatInterval?: number;        // Heartbeat interval ms (default: 30000)
  enableCompression?: boolean;       // Enable compression (default: true)
  enableSmartCaching?: boolean;      // Enable caching (default: true)
  enableCircuitBreaker?: boolean;    // Enable circuit breaker (default: true)
  maxSubscriptions?: number;         // Max concurrent subscriptions (default: 1000)
  bufferSize?: number;               // Message buffer size bytes (default: 16MB)
}
```

## Subscription Methods

### Account Subscribe

Monitor account changes in real-time.

```typescript
const subId = await wsClient.accountSubscribe(
  accountAddress,
  (accountInfo) => {
    console.log('Account data:', accountInfo.data);
    console.log('Lamports:', accountInfo.lamports);
    console.log('Owner:', accountInfo.owner);
  },
  {
    commitment: 'confirmed',
    encoding: 'jsonParsed',
    enableCache: true,
    enableFiltering: false,
  }
);
```

#### Options

```typescript
interface SubscriptionOptions {
  commitment?: 'processed' | 'confirmed' | 'finalized';
  encoding?: 'base58' | 'base64' | 'jsonParsed';
  enableCache?: boolean;           // Cache subscription data
  enableFiltering?: boolean;       // Apply custom filters
  customFilters?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
  resilient?: boolean;             // Auto-restore on reconnect
}
```

### Program Subscribe

Subscribe to all accounts owned by a program.

```typescript
const subId = await wsClient.programSubscribe(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
  (accountInfo) => {
    console.log('Token account updated:', accountInfo);
  },
  {
    commitment: 'confirmed',
    encoding: 'jsonParsed',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: 'mint_address_here',
        },
      },
    ],
  }
);
```

### Slot Subscribe

Monitor slot changes for block production tracking.

```typescript
const subId = await wsClient.slotSubscribe((slotInfo) => {
  console.log('Slot:', slotInfo.slot);
  console.log('Parent:', slotInfo.parent);
  console.log('Root:', slotInfo.root);
});
```

### Signature Subscribe

Track transaction confirmation status.

```typescript
const subId = await wsClient.signatureSubscribe(
  transactionSignature,
  (result) => {
    if (result.err) {
      console.error('Transaction failed:', result.err);
    } else {
      console.log('Transaction confirmed!');
    }
  },
  {
    commitment: 'confirmed',
  }
);
```

### Logs Subscribe

Subscribe to transaction logs for specific accounts.

```typescript
const subId = await wsClient.logsSubscribe(
  {
    mentions: [accountAddress], // Filter by account
  },
  (logs) => {
    console.log('Logs:', logs.logs);
    console.log('Signature:', logs.signature);
  },
  {
    commitment: 'confirmed',
  }
);
```

## Advanced Features

### Smart Filtering

Apply custom filters on the client side to reduce callback overhead.

```typescript
const subId = await wsClient.accountSubscribe(
  tokenMintAddress,
  (accountInfo) => {
    console.log('High-value account:', accountInfo);
  },
  {
    commitment: 'confirmed',
    enableFiltering: true,
    customFilters: {
      // Only trigger callback if lamports > 1 SOL
      'account.lamports': { min: 1_000_000_000 },
      // Only trigger if owner matches
      'account.owner': { equals: 'specific_program_id' },
    },
  }
);
```

### Priority Subscriptions

Prioritize critical subscriptions for faster delivery.

```typescript
// High-priority subscription (processed first)
const criticalSub = await wsClient.accountSubscribe(
  criticalAccountAddress,
  handleCriticalUpdate,
  {
    priority: 'high',
    resilient: true,
  }
);

// Low-priority subscription
const monitorSub = await wsClient.accountSubscribe(
  monitorAccountAddress,
  handleMonitorUpdate,
  {
    priority: 'low',
  }
);
```

### Resilient Subscriptions

Automatically restore subscriptions after reconnection.

```typescript
const subId = await wsClient.accountSubscribe(
  accountAddress,
  callback,
  {
    resilient: true, // Automatically resubscribe on reconnect
  }
);

// On reconnection, subscription is automatically restored
wsClient.on('reconnected', () => {
  console.log('All resilient subscriptions restored');
});
```

## Event System

```typescript
// Connection events
wsClient.on('connected', () => {
  console.log('WebSocket connected');
});

wsClient.on('disconnected', ({ code, reason }) => {
  console.log('WebSocket disconnected:', code, reason);
});

wsClient.on('reconnecting', ({ attempt, maxAttempts }) => {
  console.log(`Reconnecting: ${attempt}/${maxAttempts}`);
});

wsClient.on('reconnected', () => {
  console.log('WebSocket reconnected successfully');
});

wsClient.on('reconnect-failed', () => {
  console.error('Reconnection failed after max attempts');
});

// Subscription events
wsClient.on('subscription-added', ({ id, method }) => {
  console.log(`Subscription added: ${method} (${id})`);
});

wsClient.on('subscription-removed', ({ id }) => {
  console.log(`Subscription removed: ${id}`);
});

wsClient.on('subscription-error', ({ id, error }) => {
  console.error(`Subscription error: ${id}`, error);
});

// Error events
wsClient.on('error', (error) => {
  console.error('WebSocket error:', error);
});

wsClient.on('message-error', ({ message, error }) => {
  console.error('Message parsing error:', error);
});

// Metrics events
wsClient.on('metrics-update', (metrics) => {
  console.log('WebSocket metrics:', metrics);
});
```

## Metrics

```typescript
const metrics = wsClient.getMetrics();

console.log('WebSocket Metrics:', {
  messagesReceived: metrics.messagesReceived,
  messagesSent: metrics.messagesSent,
  subscriptionsActive: metrics.subscriptionsActive,
  reconnectCount: metrics.reconnectCount,
  lastLatency: metrics.lastLatency,
  averageLatency: metrics.averageLatency,
});
```

## Best Practices

### 1. Connection Management

```typescript
// ✅ Good: Singleton pattern
class WebSocketService {
  private static instance: WebSocketClient;
  
  static getInstance(): WebSocketClient {
    if (!this.instance) {
      this.instance = new WebSocketClient({
        endpoint: process.env.WS_ENDPOINT!,
        apiKey: process.env.SYNAPSE_API_KEY,
        autoReconnect: true,
      });
    }
    return this.instance;
  }
}

// ❌ Bad: Multiple connections
function subscribeToAccount(address: string) {
  const ws = new WebSocketClient({ endpoint: '...' }); // Don't do this
  ws.accountSubscribe(address, callback);
}
```

### 2. Subscription Cleanup

```typescript
// ✅ Good: Always unsubscribe
const subId = await wsClient.accountSubscribe(address, callback);

// When done
await wsClient.accountUnsubscribe(subId);

// Or unsubscribe all
await wsClient.unsubscribeAll();

// ❌ Bad: Leaving subscriptions open
wsClient.accountSubscribe(address, callback); // Memory leak
```

### 3. Error Handling

```typescript
// ✅ Good: Handle errors gracefully
wsClient.on('error', async (error) => {
  console.error('WebSocket error:', error);
  
  // Implement fallback
  if (error.code === 'CONNECTION_FAILED') {
    await useHttpFallback();
  }
});

wsClient.on('subscription-error', async ({ id, error }) => {
  console.error(`Subscription ${id} failed:`, error);
  
  // Retry or cleanup
  await wsClient.accountUnsubscribe(id);
});
```

### 4. Reconnection Strategy

```typescript
// ✅ Good: Exponential backoff with max attempts
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  autoReconnect: true,
  maxReconnectAttempts: 10,      // Limit attempts
  reconnectDelay: 5000,          // Start with 5s
});

// Monitor reconnection
wsClient.on('reconnecting', ({ attempt, maxAttempts }) => {
  if (attempt > 5) {
    console.warn('Multiple reconnection attempts');
    // Alert monitoring system
  }
});

wsClient.on('reconnect-failed', async () => {
  console.error('Reconnection failed');
  // Switch to HTTP fallback
  await switchToHttpMode();
});
```

### 5. Subscription Limits

```typescript
// ✅ Good: Respect limits
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  maxSubscriptions: 1000,
});

// Track active subscriptions
const activeSubscriptions = new Set<number>();

async function subscribe(address: string) {
  if (activeSubscriptions.size >= 1000) {
    console.warn('Subscription limit reached');
    // Unsubscribe oldest or least important
    const oldestSub = activeSubscriptions.values().next().value;
    await wsClient.accountUnsubscribe(oldestSub);
    activeSubscriptions.delete(oldestSub);
  }
  
  const subId = await wsClient.accountSubscribe(address, callback);
  activeSubscriptions.add(subId);
}
```

## Performance Optimization

### Batching Subscriptions

```typescript
// ✅ Efficient: Batch related subscriptions
const subscriptions = await Promise.all([
  wsClient.accountSubscribe(addr1, callback1),
  wsClient.accountSubscribe(addr2, callback2),
  wsClient.accountSubscribe(addr3, callback3),
]);

// ❌ Inefficient: Sequential subscriptions
const sub1 = await wsClient.accountSubscribe(addr1, callback1);
const sub2 = await wsClient.accountSubscribe(addr2, callback2);
const sub3 = await wsClient.accountSubscribe(addr3, callback3);
```

### Enable Caching

```typescript
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  enableSmartCaching: true,      // Cache subscription data
});

// Cached subscriptions reduce redundant updates
const subId = await wsClient.accountSubscribe(
  address,
  callback,
  {
    enableCache: true,
    cacheTTL: 30000,              // 30-second cache
  }
);
```

### Use Filters Wisely

```typescript
// ✅ Efficient: Filter on server side (Solana RPC)
const subId = await wsClient.programSubscribe(
  programId,
  callback,
  {
    filters: [
      { dataSize: 165 },          // Only token accounts
      { memcmp: { offset: 0, bytes: mint } }, // Specific mint
    ],
  }
);

// ❌ Inefficient: Filter on client side
const subId = await wsClient.programSubscribe(
  programId,
  (account) => {
    if (account.data.length === 165 && account.mint === mint) {
      callback(account);
    }
  }
);
```

## Troubleshooting

### Connection Timeout

**Problem:** WebSocket fails to connect

**Solution:**
```typescript
// Increase timeout
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  timeout: 30000, // 30 seconds
});

// Check endpoint
console.log('Connecting to:', wsClient.endpoint);

// Enable debug logging
wsClient.on('connecting', () => {
  console.log('Connection attempt...');
});
```

### Frequent Disconnections

**Problem:** WebSocket disconnects frequently

**Solution:**
```typescript
// Reduce heartbeat interval
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  heartbeatInterval: 15000, // 15 seconds instead of 30
});

// Monitor connection state
wsClient.on('disconnected', ({ code, reason }) => {
  console.log('Disconnect reason:', code, reason);
});

// Check network stability
setInterval(() => {
  const metrics = wsClient.getMetrics();
  if (metrics.reconnectCount > 5) {
    console.warn('Unstable connection detected');
  }
}, 60000);
```

### High Memory Usage

**Problem:** Memory consumption grows over time

**Solution:**
```typescript
// Limit subscriptions
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  maxSubscriptions: 500, // Reduce from default 1000
});

// Unsubscribe unused subscriptions
await wsClient.unsubscribeAll();

// Monitor memory
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memory usage: ${Math.round(used)} MB`);
}, 60000);
```

### Subscription Not Receiving Updates

**Problem:** Callback not triggered despite account changes

**Solution:**
```typescript
// Check subscription ID
const subId = await wsClient.accountSubscribe(address, callback);
console.log('Subscription ID:', subId);

// Verify subscription is active
wsClient.on('subscription-added', ({ id, method }) => {
  console.log(`Active: ${method} (${id})`);
});

// Check filters
const subId = await wsClient.accountSubscribe(
  address,
  callback,
  {
    commitment: 'confirmed', // Try 'processed' for faster updates
    enableFiltering: false,  // Disable custom filters temporarily
  }
);

// Monitor for errors
wsClient.on('subscription-error', ({ id, error }) => {
  if (id === subId) {
    console.error('Subscription error:', error);
  }
});
```

## Integration Examples

### Track Token Transfers

```typescript
const wsClient = new WebSocketClient({
  endpoint: process.env.WS_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY,
});

await wsClient.connect();

// Subscribe to token account
const subId = await wsClient.accountSubscribe(
  tokenAccountAddress,
  (accountInfo) => {
    const tokenAmount = accountInfo.data.parsed.info.tokenAmount.uiAmount;
    console.log('Token balance:', tokenAmount);
    
    // Trigger notifications
    if (tokenAmount < lowBalanceThreshold) {
      sendLowBalanceAlert(tokenAmount);
    }
  },
  {
    commitment: 'confirmed',
    encoding: 'jsonParsed',
  }
);
```

### Monitor NFT Sales

```typescript
// Subscribe to marketplace program
const subId = await wsClient.programSubscribe(
  magicEdenProgramId,
  (accountInfo) => {
    const listingData = parseListingData(accountInfo.data);
    
    if (listingData.type === 'sale') {
      console.log('NFT Sold:', {
        mint: listingData.mint,
        price: listingData.price,
        buyer: listingData.buyer,
      });
      
      // Update database
      updateNFTSaleHistory(listingData);
    }
  },
  {
    commitment: 'confirmed',
    filters: [
      { dataSize: 200 }, // Listing account size
    ],
  }
);
```

### Real-time Block Explorer

```typescript
// Subscribe to slots for block updates
const slotSub = await wsClient.slotSubscribe((slotInfo) => {
  console.log(`New slot: ${slotInfo.slot}`);
  updateBlockExplorer(slotInfo);
});

// Subscribe to logs for all transactions
const logsSub = await wsClient.logsSubscribe(
  'all', // All transactions
  (logs) => {
    console.log(`Transaction: ${logs.signature}`);
    addTransactionToExplorer(logs);
  },
  {
    commitment: 'confirmed',
  }
);
```

## API Reference

### Constructor

```typescript
new WebSocketClient(config: WebSocketConfig)
```

### Connection Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `connect()` | - | `Promise<void>` | Establish WebSocket connection |
| `disconnect()` | - | `Promise<void>` | Close connection and cleanup |
| `reconnect()` | - | `Promise<void>` | Force reconnection |

### Subscription Methods

| Method | Parameters | Return | Description |
|--------|------------|--------|-------------|
| `accountSubscribe` | `address, callback, options?` | `Promise<number>` | Subscribe to account |
| `accountUnsubscribe` | `subscriptionId` | `Promise<void>` | Unsubscribe from account |
| `programSubscribe` | `programId, callback, options?` | `Promise<number>` | Subscribe to program accounts |
| `programUnsubscribe` | `subscriptionId` | `Promise<void>` | Unsubscribe from program |
| `slotSubscribe` | `callback` | `Promise<number>` | Subscribe to slots |
| `slotUnsubscribe` | `subscriptionId` | `Promise<void>` | Unsubscribe from slots |
| `signatureSubscribe` | `signature, callback, options?` | `Promise<number>` | Subscribe to signature |
| `signatureUnsubscribe` | `subscriptionId` | `Promise<void>` | Unsubscribe from signature |
| `logsSubscribe` | `filter, callback, options?` | `Promise<number>` | Subscribe to logs |
| `logsUnsubscribe` | `subscriptionId` | `Promise<void>` | Unsubscribe from logs |
| `unsubscribeAll` | - | `Promise<void>` | Unsubscribe from all |

### Utility Methods

| Method | Return | Description |
|--------|--------|-------------|
| `getMetrics()` | `Metrics` | Get connection metrics |
| `isConnected()` | `boolean` | Check connection status |
| `getActiveSubscriptions()` | `number[]` | Get active subscription IDs |

---

## License

MIT License - See [LICENSE](../../LICENSE) for details.

---

**WebSocket Client Module** - Real-time Solana blockchain streaming
