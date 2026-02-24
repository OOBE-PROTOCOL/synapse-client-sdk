# Solana RPC Methods Module

Type-safe wrapper for 70+ Solana RPC methods with performance optimization and intelligent batching for Synapse Client SDK.

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Method Categories](#method-categories)
- [Implementation](#implementation)
- [Performance Characteristics](#performance-characteristics)
- [Advanced Usage](#advanced-usage)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  Solana RPC Methods Wrapper                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │    Account     │  │     Block       │  │  Transaction    │    │
│  │    Methods     │  │    Methods      │  │    Methods      │    │
│  │   (10 APIs)    │  │   (8 APIs)      │  │   (5 APIs)      │    │
│  └────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │     Token      │  │   Slot/Epoch    │  │    Network      │    │
│  │    Methods     │  │    Methods      │  │    Methods      │    │
│  │   (8 APIs)     │  │   (7 APIs)      │  │   (6 APIs)      │    │
│  └────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │    Utility     │  │  Subscription   │  │    Validator    │    │
│  │    Methods     │  │    Methods      │  │    Methods      │    │
│  │   (12 APIs)    │  │   (6 APIs)      │  │   (8 APIs)      │    │
│  └────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    SynapseClient Core                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **Type Safety** | Full TypeScript definitions for all methods | Production |
| **Auto-Pagination** | Automatic pagination for large result sets | Production |
| **Error Handling** | Comprehensive error handling with retries | Production |
| **Performance Hints** | Method weight annotations (Light/Heavy/Very Heavy) | Production |
| **Batch Support** | Efficient batching of multiple calls | Production |
| **Commitment Levels** | Support for processed/confirmed/finalized | Production |
| **Encoding Options** | Multiple encoding formats (base58/base64/jsonParsed) | Production |
| **Backward Compatibility** | Legacy method support with deprecation warnings | Production |

---

## Method Categories

### 1. Account Methods

Query account information and balances.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getAccountInfo` | Heavy | Yes | Get account data and metadata |
| `getBalance` | Light | Yes | Get SOL balance for address |
| `getMultipleAccounts` | Very Heavy | Yes | Bulk account data retrieval |
| `getProgramAccounts` | Extremely Heavy | Yes | Query all accounts owned by program |

### 2. Block Methods

Retrieve block information and production data.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getBlock` | Heavy | No | Get complete block with transactions |
| `getBlockHeight` | Light | Yes | Get current block height |
| `getBlockTime` | Light | No | Get estimated production time |
| `getBlocks` | Very Heavy | Yes | Get list of blocks in range |
| `getBlocksWithLimit` | Heavy | Yes | Get blocks with result limit |
| `getBlockCommitment` | Light | No | Get commitment for specific block |
| `getBlockProduction` | Medium | Yes | Get validator block production stats |

### 3. Transaction Methods

Transaction retrieval and status checking.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getTransaction` | Heavy | No | Get transaction details |
| `getSignaturesForAddress` | Extremely Heavy | Yes | Get all transaction signatures for address |
| `getSignatureStatuses` | Light | No | Get confirmation status for signatures |
| `sendTransaction` | Medium | No | Submit transaction to cluster |
| `simulateTransaction` | Medium | Yes | Simulate transaction without sending |

### 4. Token Methods 

 Token account queries.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getTokenAccountsByOwner` | Very Heavy | Yes | Get all token accounts for owner |
| `getTokenAccountsByDelegate` | Very Heavy | Yes | Get token accounts by delegate |
| `getTokenSupply` | Light | Yes | Get total token supply |
| `getTokenAccountBalance` | Light | Yes | Get token account balance |
| `getTokenLargestAccounts` | Medium | Yes | Get largest token holders |

### 5. Slot & Epoch Methods

Slot and epoch information.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getSlot` | Light | Yes | Get current slot |
| `getEpochInfo` | Light | Yes | Get epoch information |
| `getEpochSchedule` | Light | No | Get epoch schedule configuration |
| `getSlotLeader` | Light | Yes | Get current slot leader |
| `getSlotLeaders` | Heavy | No | Get slot leaders for range |
| `getLeaderSchedule` | Heavy | No | Get leader schedule for epoch |

### 6. Network Methods

Network status and node information.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getClusterNodes` | Light | No | Get all cluster nodes |
| `getHealth` | Light | No | Get node health status |
| `getVersion` | Light | No | Get node software version |
| `getIdentity` | Light | No | Get node identity public key |
| `getInflationGovernor` | Light | No | Get inflation parameters |
| `getInflationRate` | Light | No | Get current inflation rate |

### 7. Utility Methods

Utility functions for transactions and blockhashes.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getLatestBlockhash` | Light | Yes | Get latest blockhash for transactions |
| `isBlockhashValid` | Light | Yes | Check if blockhash is still valid |
| `getFeeForMessage` | Light | Yes | Calculate transaction fee |
| `getMinimumBalanceForRentExemption` | Light | No | Get rent-exempt minimum balance |
| `getFirstAvailableBlock` | Light | No | Get oldest available block |
| `getGenesisHash` | Light | No | Get genesis block hash |
| `getHighestSnapshotSlot` | Light | No | Get highest snapshot slot |
| `getRecentPerformanceSamples` | Light | No | Get recent performance metrics |
| `getRecentPrioritizationFees` | Light | No | Get recent priority fees |

### 8. Validator Methods

Validator and voting information.

| Method | Weight | Commitment | Description |
|--------|--------|-----------|-------------|
| `getVoteAccounts` | Medium | Yes | Get all vote accounts |
| `getStakeActivation` | Light | Yes | Get stake account activation info |
| `getStakeMinimumDelegation` | Light | No | Get minimum stake delegation |
| `getInflationReward` | Medium | No | Get inflation rewards for addresses |

---

## Implementation

### Basic Usage

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { SolanaRpcMethods } from '@oobe-protocol-labs/synapse-client-sdk/methods';

// Initialize client
const client = new SynapseClient({
  endpoint: process.env.SYNAPSE_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY,
});

// Create methods wrapper
const rpc = new SolanaRpcMethods(client);

// Get account balance
const balance = await rpc.getBalance('YourPublicKeyHere');
console.log('Balance:', balance / 1e9, 'SOL');

// Get account info with commitment
const accountInfo = await rpc.getAccountInfo(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
  {
    commitment: 'confirmed',
    encoding: 'jsonParsed',
  }
);
console.log('Account owner:', accountInfo?.owner);
```

### Advanced Usage

```typescript
// Get multiple accounts efficiently
const accounts = await rpc.getMultipleAccounts(
  [
    'address1',
    'address2',
    'address3',
  ],
  {
    commitment: 'confirmed',
    encoding: 'base64',
  }
);

// Get block with full transaction details
const blockHeight = await rpc.getBlockHeight();
const block = await rpc.getBlock(blockHeight, {
  encoding: 'jsonParsed',
  transactionDetails: 'full',
  rewards: true,
  maxSupportedTransactionVersion: 0,
});

console.log('Block transactions:', block.transactions.length);
console.log('Block rewards:', block.rewards);

// Get transaction history for address (auto-paginated)
const signatures = await rpc.getSignaturesForAddress(
  'YourAddressHere',
  {
    limit: 100,
    commitment: 'confirmed',
  }
);

console.log('Total signatures:', signatures.length);

// Check transaction status
const statuses = await rpc.getSignatureStatuses(
  [signatures[0].signature],
  { searchTransactionHistory: true }
);

console.log('Transaction status:', statuses[0]);
```

---

## Performance Characteristics

### Method Performance Table

| Category | P50 Latency | P95 Latency | Cache Hit Rate | Notes |
|----------|-------------|-------------|----------------|-------|
| **Light Methods** | 8ms | 20ms | 60% | Balance, slot, epoch |
| **Medium Methods** | 50ms | 150ms | 40% | Token supply, vote accounts |
| **Heavy Methods** | 200ms | 500ms | 20% | Block data, transactions |
| **Very Heavy** | 500ms | 1500ms | 10% | Multiple accounts, token accounts |
| **Extremely Heavy** | 1000ms+ | 5000ms+ | 5% | Program accounts, signatures |

### Optimization Strategies

#### 1. Use Commitment Levels Wisely

```typescript
// ✅ Fast: Use 'processed' for non-critical reads
const balance = await rpc.getBalance('address', 'processed');

// ⚖️ Balanced: Use 'confirmed' for most operations
const balance = await rpc.getBalance('address', 'confirmed');

// 🐌 Slow: Use 'finalized' only when necessary
const balance = await rpc.getBalance('address', 'finalized');
```

#### 2. Batch Multiple Calls

```typescript
// ✅ Efficient: Batch related calls
const [balance, accountInfo, slot] = await Promise.all([
  rpc.getBalance('address'),
  rpc.getAccountInfo('address'),
  rpc.getSlot(),
]);

// Or use client batch method
const results = await client.batch([
  { method: 'getBalance', params: ['address'] },
  { method: 'getAccountInfo', params: ['address'] },
  { method: 'getSlot', params: [] },
]);

// ❌ Inefficient: Sequential calls
const balance = await rpc.getBalance('address');
const accountInfo = await rpc.getAccountInfo('address');
const slot = await rpc.getSlot();
```

#### 3. Use Filters for Heavy Methods

```typescript
// ✅ Efficient: Use filters to reduce data
const accounts = await rpc.getProgramAccounts(
  'programId',
  {
    encoding: 'base64',
    dataSlice: { offset: 0, length: 32 }, // Only get first 32 bytes
    filters: [
      { dataSize: 165 }, // Only accounts with specific size
      { memcmp: { offset: 0, bytes: 'base58string' } }, // Filter by data
    ],
  }
);

// ❌ Inefficient: No filters (retrieves all data)
const accounts = await rpc.getProgramAccounts('programId');
```

#### 4. Leverage Caching

```typescript
// ✅ Recommended: Cache static or slow-changing data
const cache = new Map<string, any>();

async function getAccountInfoCached(address: string) {
  if (cache.has(address)) {
    return cache.get(address);
  }
  
  const info = await rpc.getAccountInfo(address);
  cache.set(address, info);
  
  // Invalidate after 1 minute
  setTimeout(() => cache.delete(address), 60000);
  
  return info;
}

// ❌ Not recommended: Fetch every time
const info = await rpc.getAccountInfo(address);
```

---

## Best Practices

### 1. Error Handling

```typescript
import { SynapseError, NetworkError, TimeoutError } from '@oobe-protocol-labs/synapse-client-sdk';

async function safeGetAccount(address: string) {
  try {
    return await rpc.getAccountInfo(address);
  } catch (error) {
    if (error instanceof NetworkError) {
      console.error('Network error:', error.statusCode);
      // Retry logic
    } else if (error instanceof TimeoutError) {
      console.error('Request timeout');
      // Use cached data or fallback
    } else if (error instanceof SynapseError) {
      console.error('RPC error:', error.code, error.message);
      // Handle specific RPC errors
    }
    throw error;
  }
}
```

### 2. Rate Limiting

```typescript
// ✅ Recommended: Implement rate limiting
import pLimit from 'p-limit';

const limit = pLimit(10); // Max 10 concurrent requests

const balances = await Promise.all(
  addresses.map(address =>
    limit(() => rpc.getBalance(address))
  )
);

// ❌ Not recommended: Unlimited concurrent requests
const balances = await Promise.all(
  addresses.map(address => rpc.getBalance(address))
);
```

### 3. Auto-Pagination Handling

```typescript
// ✅ Recommended: Use built-in auto-pagination
const signatures = await rpc.getSignaturesForAddress(
  'address',
  { limit: 1000 } // Automatically handles pagination
);

// ❌ Not recommended: Manual pagination
let allSignatures = [];
let before = undefined;
while (true) {
  const batch = await rpc.getSignaturesForAddress(
    'address',
    { limit: 1000, before }
  );
  if (batch.length === 0) break;
  allSignatures.push(...batch);
  before = batch[batch.length - 1].signature;
}
```

### 4. Transaction Confirmation

```typescript
// ✅ Recommended: Use getSignatureStatuses
async function confirmTransaction(signature: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const statuses = await rpc.getSignatureStatuses([signature]);
    const status = statuses[0];
    
    if (status?.confirmationStatus === 'confirmed' || 
        status?.confirmationStatus === 'finalized') {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Transaction confirmation timeout');
}

// ❌ Deprecated: Using confirmTransaction method
const status = await rpc.confirmTransaction({
  signature,
  blockhash,
  lastValidBlockHeight,
});
```

### 5. Token Account Queries

```typescript
// ✅ Efficient: Query specific token accounts
const usdcAccounts = await rpc.getTokenAccountsByOwner(
  'ownerAddress',
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, // USDC
  { encoding: 'jsonParsed' }
);

// ⚠️ Heavy: Query all token accounts
const allAccounts = await rpc.getTokenAccountsByOwner(
  'ownerAddress',
  { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
  { encoding: 'jsonParsed' }
);
```

---

## API Reference

### Account Methods

#### getAccountInfo()

```typescript
async getAccountInfo(
  pubkey: string,
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'jsonParsed';
  }
): Promise<AccountInfo | null>
```

Get account information including data, owner, and lamports.

**Example:**
```typescript
const info = await rpc.getAccountInfo('address', {
  commitment: 'confirmed',
  encoding: 'jsonParsed',
});
console.log('Owner:', info?.owner);
console.log('Lamports:', info?.lamports);
```

---

#### getBalance()

```typescript
async getBalance(
  pubkey: string,
  commitment?: 'processed' | 'confirmed' | 'finalized'
): Promise<number>
```

Get SOL balance for an address in lamports.

**Example:**
```typescript
const balance = await rpc.getBalance('address', 'confirmed');
console.log('Balance:', balance / 1e9, 'SOL');
```

---

#### getMultipleAccounts()

```typescript
async getMultipleAccounts(
  pubkeys: string[],
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'jsonParsed';
  }
): Promise<(AccountInfo | null)[]>
```

Get multiple account infos in a single call. Maximum 100 accounts per request.

**Example:**
```typescript
const accounts = await rpc.getMultipleAccounts(
  ['address1', 'address2', 'address3'],
  { encoding: 'base64' }
);
accounts.forEach((acc, i) => {
  console.log(`Account ${i}:`, acc?.lamports);
});
```

---

#### getProgramAccounts()

```typescript
async getProgramAccounts(
  programId: string,
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'jsonParsed';
    dataSlice?: { offset: number; length: number };
    filters?: Array<
      | { dataSize: number }
      | { memcmp: { offset: number; bytes: string } }
    >;
  }
): Promise<any[]>
```

Get all accounts owned by a program. Use filters to reduce data transfer.

**Example:**
```typescript
const accounts = await rpc.getProgramAccounts('programId', {
  encoding: 'base64',
  dataSlice: { offset: 0, length: 32 },
  filters: [
    { dataSize: 165 },
    { memcmp: { offset: 8, bytes: 'base58string' } },
  ],
});
```

---

### Block Methods

#### getBlock()

```typescript
async getBlock(
  slot: number,
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'json' | 'jsonParsed' | 'base64';
    transactionDetails?: 'full' | 'accounts' | 'signatures' | 'none';
    rewards?: boolean;
    maxSupportedTransactionVersion?: number;
  }
): Promise<Block>
```

Get a confirmed block with transactions and metadata.

**Example:**
```typescript
const block = await rpc.getBlock(250_000_000, {
  encoding: 'jsonParsed',
  transactionDetails: 'full',
  rewards: true,
  maxSupportedTransactionVersion: 0,
});
console.log('Transactions:', block.transactions.length);
```

---

#### getBlockHeight()

```typescript
async getBlockHeight(
  commitment?: 'processed' | 'confirmed' | 'finalized'
): Promise<number>
```

Get current block height.

**Example:**
```typescript
const height = await rpc.getBlockHeight('confirmed');
console.log('Current block:', height);
```

---

### Transaction Methods

#### getTransaction()

```typescript
async getTransaction(
  signature: string,
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'json' | 'jsonParsed' | 'base64';
    maxSupportedTransactionVersion?: number;
  }
): Promise<ConfirmedTransaction | null>
```

Get transaction details by signature.

**Example:**
```typescript
const tx = await rpc.getTransaction('signature', {
  encoding: 'jsonParsed',
  maxSupportedTransactionVersion: 0,
});
console.log('Status:', tx?.meta?.err ? 'Failed' : 'Success');
```

---

#### getSignaturesForAddress()

```typescript
async getSignaturesForAddress(
  address: string,
  options?: {
    limit?: number;
    before?: string;
    until?: string;
    commitment?: 'processed' | 'confirmed' | 'finalized';
  }
): Promise<TransactionSignature[]>
```

Get transaction signatures for an address. Auto-paginated up to specified limit.

**Example:**
```typescript
const signatures = await rpc.getSignaturesForAddress('address', {
  limit: 100,
  commitment: 'confirmed',
});
console.log('Signatures:', signatures.length);
```

---

#### getSignatureStatuses()

```typescript
async getSignatureStatuses(
  signatures: string[],
  options?: {
    searchTransactionHistory?: boolean;
  }
): Promise<SignatureStatus[]>
```

Get confirmation status for transaction signatures.

**Example:**
```typescript
const statuses = await rpc.getSignatureStatuses(['sig1', 'sig2']);
statuses.forEach((status, i) => {
  console.log(`Signature ${i}:`, status?.confirmationStatus);
});
```

---

### Token Methods

#### getTokenAccountsByOwner()

```typescript
async getTokenAccountsByOwner(
  ownerPubkey: string,
  filter: { mint: string } | { programId: string },
  options?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'jsonParsed';
  }
): Promise<TokenAccount[]>
```

Get all token accounts for an owner, filtered by mint or program.

**Example:**
```typescript
// Get USDC accounts
const usdcAccounts = await rpc.getTokenAccountsByOwner(
  'ownerAddress',
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { encoding: 'jsonParsed' }
);

// Get all SPL token accounts
const allTokenAccounts = await rpc.getTokenAccountsByOwner(
  'ownerAddress',
  { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
  { encoding: 'jsonParsed' }
);
```

---

#### getTokenSupply()

```typescript
async getTokenSupply(
  mint: string,
  commitment?: 'processed' | 'confirmed' | 'finalized'
): Promise<TokenAmount>
```

Get total supply for an SPL token.

**Example:**
```typescript
const supply = await rpc.getTokenSupply('mintAddress');
console.log('Supply:', supply.value.uiAmount);
console.log('Decimals:', supply.value.decimals);
```

---

### Utility Methods

#### getLatestBlockhash()

```typescript
async getLatestBlockhash(
  commitment?: 'processed' | 'confirmed' | 'finalized'
): Promise<BlockhashInfo>
```

Get latest blockhash for transaction construction.

**Example:**
```typescript
const { blockhash, lastValidBlockHeight } = await rpc.getLatestBlockhash();
console.log('Blockhash:', blockhash);
console.log('Valid until block:', lastValidBlockHeight);
```

---

#### isBlockhashValid()

```typescript
async isBlockhashValid(
  blockhash: string,
  commitment?: 'processed' | 'confirmed' | 'finalized'
): Promise<boolean>
```

Check if a blockhash is still valid for transactions.

**Example:**
```typescript
const isValid = await rpc.isBlockhashValid(blockhash);
if (!isValid) {
  console.log('Blockhash expired, getting new one...');
  const { blockhash: newBlockhash } = await rpc.getLatestBlockhash();
}
```

---

## Troubleshooting

### Issue: "Account not found" errors

**Solutions:**
- Verify the address is correct
- Check the account exists on the cluster
- Use correct commitment level (`finalized` for older data)

```typescript
const info = await rpc.getAccountInfo(address, {
  commitment: 'finalized' // Try finalized for older accounts
});
```

---

### Issue: Slow getProgramAccounts queries

**Solutions:**
- Use dataSlice to reduce data transfer
- Apply filters to limit results
- Consider using caching

```typescript
const accounts = await rpc.getProgramAccounts('programId', {
  dataSlice: { offset: 0, length: 32 },
  filters: [{ dataSize: 165 }],
});
```

---

### Issue: Rate limiting errors

**Solutions:**
- Implement request throttling
- Use batch operations
- Increase API plan limits

```typescript
import pLimit from 'p-limit';
const limit = pLimit(10);

const results = await Promise.all(
  addresses.map(addr => limit(() => rpc.getBalance(addr)))
);
```

---

**Solana RPC Methods Module** - Type-safe Solana blockchain queries

Built for production-grade Solana development
