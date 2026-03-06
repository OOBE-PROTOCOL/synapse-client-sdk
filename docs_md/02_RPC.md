# 02 — RPC: JSON-RPC, WebSocket, gRPC

> **Imports**: `@…/synapse-client-sdk/rpc`, `/websocket`, `/grpc`  
> **Source**: `src/rpc/`, `src/websocket/`, `src/grpc/`  
> **Prerequisites**: [01_CORE.md](./01_CORE.md) — you need a `SynapseClient` or `HttpTransport` instance.

---

## Overview

Synapse provides three transport protocols for interacting with Solana validators:

| Protocol | Use case | Methods |
|----------|----------|---------|
| **JSON-RPC** | Request/response queries | 53 fully typed methods |
| **WebSocket** | Real-time push notifications | 6 subscription types |
| **gRPC** | High-throughput streaming | Geyser account/slot/tx streams |

---

## JSON-RPC — 53 Typed Methods

### Usage

```ts
// Via SynapseClient (recommended — lazy loaded)
const slot = await client.rpc.getSlot();

// Or as standalone functions (if you only need a few methods)
import { getSlot, getBalance } from '@oobe-protocol-labs/synapse-client-sdk/rpc';

const slot = await getSlot(transport);
const balance = await getBalance(transport, Pubkey('So111...'));
```

### Complete Method Reference

#### Accounts

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getAccountInfo` | `pubkey, opts?` | `RpcContext<AccountInfo \| null>` | Returns `null` if account doesn't exist |
| `getBalance` | `pubkey, opts?` | `RpcContext<Lamports>` | Balance in lamports (1 SOL = 1e9) |
| `getMultipleAccounts` | `pubkeys[], opts?` | `RpcContext<(AccountInfo \| null)[]>` | Up to 100 accounts per call |
| `getProgramAccounts` | `programId, opts?` | `ProgramAccount[]` | ⚠️ Can be slow — use filters |
| `getLargestAccounts` | `opts?` | `RpcContext<LargestAccount[]>` | Top accounts by balance |
| `getMinimumBalanceForRentExemption` | `dataLength, opts?` | `Lamports` | Rent-exempt minimum |
| `getTokenAccountBalance` | `pubkey, opts?` | `RpcContext<TokenAmount>` | SPL Token balance |
| `getTokenAccountsByDelegate` | `delegate, opts?` | `RpcContext<TokenAccount[]>` | Delegated token accounts |
| `getTokenAccountsByOwner` | `owner, opts?` | `RpcContext<TokenAccount[]>` | All token accounts for a wallet |
| `getTokenLargestAccounts` | `mint, opts?` | `RpcContext<TokenAmount[]>` | Largest holders of a token |
| `getTokenSupply` | `mint, opts?` | `RpcContext<TokenAmount>` | Total supply of a token |

#### Blocks & Slots

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getBlock` | `slot, opts?` | `Block` | Full block with transactions |
| `getBlockCommitment` | `slot` | `BlockCommitment` | Commitment level for a block |
| `getBlockHeight` | `opts?` | `number` | Current block height |
| `getBlockProduction` | `opts?` | `RpcContext<BlockProduction>` | Leader slots and blocks |
| `getBlockTime` | `slot` | `UnixTimestamp \| null` | Estimated production time |
| `getBlocks` | `startSlot, endSlot?, opts?` | `Slot[]` | Confirmed blocks in range |
| `getBlocksWithLimit` | `startSlot, limit, opts?` | `Slot[]` | Up to `limit` blocks |
| `getSlot` | `opts?` | `Slot` | Current slot |
| `getSlotLeader` | `opts?` | `Pubkey` | Current slot leader |
| `getSlotLeaders` | `startSlot, limit` | `Pubkey[]` | Future slot leaders |
| `getFirstAvailableBlock` | `()` | `Slot` | Oldest available block |
| `getHighestSnapshotSlot` | `()` | `{ full, incremental? }` | Latest snapshot slot |
| `minimumLedgerSlot` | `()` | `Slot` | Lowest slot with data |

#### Transactions

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getTransaction` | `signature, opts?` | `ConfirmedTransaction \| null` | Full transaction details |
| `getTransactionCount` | `opts?` | `number` | Total transaction count |
| `getSignatureStatuses` | `signatures[], opts?` | `RpcContext<(SignatureStatus \| null)[]>` | Batch status check |
| `getSignaturesForAddress` | `address, opts?` | `SignatureInfo[]` | Transaction history |
| `getRecentPrioritizationFees` | `addresses?` | `PrioritizationFee[]` | Recent priority fees |
| `sendTransaction` | `tx, opts?` | `Signature` | Submit signed transaction |
| `simulateTransaction` | `tx, opts?` | `SimulateResult` | Dry-run without submitting |
| `requestAirdrop` | `pubkey, lamports, opts?` | `Signature` | Devnet/testnet only |

#### Epoch & Inflation

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getEpochInfo` | `opts?` | `EpochInfo` | Current epoch details |
| `getEpochSchedule` | `()` | `EpochSchedule` | Epoch length configuration |
| `getInflationGovernor` | `opts?` | `InflationGovernor` | Inflation parameters |
| `getInflationRate` | `()` | `InflationRate` | Current inflation rate |
| `getInflationReward` | `addresses[], opts?` | `(InflationReward \| null)[]` | Staking rewards |

#### Validators & Network

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getClusterNodes` | `()` | `ContactInfo[]` | All cluster validators |
| `getVoteAccounts` | `opts?` | `VoteAccountsResult` | Current + delinquent |
| `getHealth` | `()` | `string` | Node health status |
| `getIdentity` | `()` | `{ identity: Pubkey }` | Node public key |
| `getVersion` | `()` | `{ solana-core, feature-set }` | Software version |
| `getGenesisHash` | `()` | `string` | Genesis block hash |
| `getSupply` | `opts?` | `RpcContext<Supply>` | Circulating / non-circulating SOL |
| `getLeaderSchedule` | `slot?, opts?` | `LeaderSchedule \| null` | Leader schedule for epoch |
| `getMaxRetransmitSlot` | `()` | `Slot` | Max retransmit slot |
| `getMaxShredInsertSlot` | `()` | `Slot` | Max shred insert slot |
| `getRecentPerformanceSamples` | `limit?` | `PerfSample[]` | TPS and slot stats |

#### Staking

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getStakeActivation` | `pubkey, opts?` | `StakeActivation` | Delegation status |
| `getStakeMinimumDelegation` | `opts?` | `RpcContext<Lamports>` | Minimum stake |

#### Utility

| Method | Parameters | Returns | Notes |
|--------|-----------|---------|-------|
| `getLatestBlockhash` | `opts?` | `RpcContext<Blockhash>` | For transaction signing |
| `isBlockhashValid` | `blockhash, opts?` | `RpcContext<boolean>` | Check blockhash expiry |
| `getFeeForMessage` | `message, opts?` | `RpcContext<number \| null>` | Fee estimate |

### Common Patterns

#### Get a wallet's SOL balance

```ts
const { value: lamports } = await client.rpc.getBalance(
  Pubkey('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'),
  { commitment: 'confirmed' },
);

const sol = Number(lamports) / 1e9;
console.log(`Balance: ${sol} SOL`);
```

#### Get all token accounts for a wallet

```ts
const { value: accounts } = await client.rpc.getTokenAccountsByOwner(
  Pubkey('WalletAddress...'),
  { programId: Pubkey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') },
  { encoding: 'jsonParsed' },
);

for (const { pubkey, account } of accounts) {
  console.log(`Token account: ${pubkey}, balance: ${account.data.parsed.info.tokenAmount.uiAmount}`);
}
```

#### Send a transaction

```ts
const signature = await client.rpc.sendTransaction(
  serializedTxBase64,
  {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  },
);
console.log('Transaction sent:', signature);
```

#### Batch multiple queries

```ts
// One HTTP request → multiple RPC calls
const [balance, slot, epoch] = await client.batch<[
  { context: { slot: number }; value: number },
  number,
  EpochInfo,
]>([
  { method: 'getBalance', params: [walletAddress] },
  { method: 'getSlot' },
  { method: 'getEpochInfo' },
]);
```

#### Poll for transaction confirmation

```ts
async function waitForConfirmation(sig: Signature, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await client.rpc.getSignatureStatuses([sig]);
    const status = value[0];
    if (status?.confirmationStatus === 'finalized') return status;
    if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Confirmation timeout');
}
```

---

## WebSocket — 6 Subscription Types

For real-time data, use WebSocket subscriptions instead of polling.

### Setup

```ts
// Via client (recommended)
client.ws.onSlotChange((n) => console.log('Slot:', n.slot));

// Or standalone
import { WsClient } from '@oobe-protocol-labs/synapse-client-sdk/websocket';

const ws = new WsClient({
  endpoint:             'wss://rpc.synapse.com',
  reconnect:            true,     // auto-reconnect on disconnect
  reconnectInterval:    2000,     // ms between reconnect attempts
  maxReconnectAttempts: 10,
  pingInterval:         30_000,   // keep-alive ping interval
});
```

### Subscription Methods

| Method | Callback receives | Use case |
|--------|-------------------|----------|
| `onAccountChange(pubkey, cb)` | `AccountNotification` | Watch a wallet or account for changes |
| `onProgramChange(programId, cb)` | `ProgramNotification` | Watch all accounts owned by a program |
| `onLogs(filter, cb)` | `LogsNotification` | Program log messages |
| `onSignature(signature, cb)` | `SignatureNotification` | Transaction confirmation |
| `onSlotChange(cb)` | `SlotNotification` | New slot produced |
| `onRootChange(cb)` | `RootNotification` | Root slot updates |

### Usage

Every subscription returns an **unsubscribe function**:

```ts
// Watch for balance changes
const unsub = client.ws.onAccountChange(
  Pubkey('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'),
  (notification) => {
    console.log('Balance changed:', notification.result.value.lamports);
  },
);

// Stop watching
unsub();
```

```ts
// Watch for transaction confirmation
client.ws.onSignature(
  Sig('5VERv8NMhGvR....'),
  (notification) => {
    if (notification.result.value.err) {
      console.error('Transaction failed');
    } else {
      console.log('Transaction confirmed!');
    }
  },
);
```

```ts
// Watch all token transfers for a program
client.ws.onProgramChange(
  Pubkey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  (notification) => {
    console.log('Token account changed:', notification.result.value.pubkey);
  },
);
```

### Features

- **Auto-reconnect**: Restores all active subscriptions after disconnect
- **Ping/pong keep-alive**: Prevents idle timeouts
- **Cross-platform**: Uses native `WebSocket` in browser/Deno/Bun, `ws` package in Node.js

### Configuration

```ts
interface WsConfig {
  endpoint:              string;     // wss:// URL
  reconnect?:            boolean;    // default: true
  reconnectInterval?:    number;     // ms, default: 2000
  maxReconnectAttempts?: number;     // default: 10
  pingInterval?:         number;     // ms, default: 30_000
}
```

---

## gRPC — Geyser Streaming

For high-throughput, low-latency streaming of on-chain data.

### Setup

```ts
import { GrpcTransport } from '@oobe-protocol-labs/synapse-client-sdk/grpc';

const grpc = new GrpcTransport({
  endpoint: 'https://grpc.synapse.com',
  token:    'geyser-token',
});
```

### Streaming accounts

```ts
// Stream all account updates for a program
for await (const update of grpc.subscribeAccount(programId)) {
  console.log('Account update:', update.pubkey, update.lamports);
}
```

### Geyser parser

Decodes raw Geyser protobuf messages into typed TypeScript objects:

```ts
import { GeyserParser } from '@oobe-protocol-labs/synapse-client-sdk/grpc';

const parsed = GeyserParser.parseAccountUpdate(rawProtobuf);
// → { pubkey, lamports, owner, data, slot, writeVersion }
```

> **Note**: gRPC requires the `@grpc/grpc-js` package (not bundled). Install it if you need Geyser streaming.

---

## Commitment Levels — When to Use What

| Level | Finality | Speed | Use case |
|-------|----------|-------|----------|
| `processed` | None — may be rolled back | ~400ms | Real-time UIs, price feeds |
| `confirmed` | 66%+ stake voted | ~1s | Most queries, balance checks |
| `finalized` | 31+ confirmations | ~12s | Payments, settlement, anything with money |

```ts
// Default is "confirmed" for most methods
const balance = await client.rpc.getBalance(pubkey);

// Use "finalized" for payments
const balance = await client.rpc.getBalance(pubkey, { commitment: 'finalized' });
```

---

## Performance Tips

### 1. Use `getMultipleAccounts` instead of N separate calls

```ts
// ❌ 10 HTTP requests
const results = await Promise.all(
  pubkeys.map((pk) => client.rpc.getAccountInfo(pk)),
);

// ✅ 1 HTTP request
const { value } = await client.rpc.getMultipleAccounts(pubkeys);
```

### 2. Use `batch()` for different method calls

```ts
// ❌ 3 sequential requests
const slot = await client.rpc.getSlot();
const height = await client.rpc.getBlockHeight();
const epoch = await client.rpc.getEpochInfo();

// ✅ 1 request
const [slot, height, epoch] = await client.batch([
  { method: 'getSlot' },
  { method: 'getBlockHeight' },
  { method: 'getEpochInfo' },
]);
```

### 3. Add `dataSlice` to reduce payload size

```ts
// Only fetch the first 32 bytes of account data
const info = await client.rpc.getAccountInfo(pubkey, {
  dataSlice: { offset: 0, length: 32 },
  encoding: 'base64',
});
```

### 4. Filter `getProgramAccounts` to avoid timeouts

```ts
// ❌ Fetches ALL program accounts — extremely slow
const all = await client.rpc.getProgramAccounts(programId);

// ✅ Filter by data size + memcmp
const filtered = await client.rpc.getProgramAccounts(programId, {
  filters: [
    { dataSize: 165 },  // SPL Token accounts are 165 bytes
    { memcmp: { offset: 32, bytes: ownerPubkey } },
  ],
});
```

### 5. Use WebSocket instead of polling

```ts
// ❌ Polling — wastes bandwidth and adds latency
setInterval(async () => {
  const slot = await client.rpc.getSlot();
}, 1000);

// ✅ WebSocket — instant notifications
client.ws.onSlotChange((n) => console.log(n.slot));
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `TimeoutError` on `getProgramAccounts` | Too many accounts | Add `filters` and increase `timeout` |
| `RpcMethodNotFoundError` | Method not supported by endpoint | Try a different RPC provider |
| WebSocket disconnects frequently | Network instability | Increase `reconnectInterval`, check firewall |
| `getBlock` returns `null` | Block pruned from ledger | Use a node with full history |
| `sendTransaction` returns error | Invalid transaction | Use `simulateTransaction` first to debug |

---

## Next Steps

- **[03_AI_TOOLS.md](./03_AI_TOOLS.md)** — Turn these 53 methods into LangChain agent tools
- **[01_CORE.md](./01_CORE.md)** — Decoders and instruction builders for on-chain data
