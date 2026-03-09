# Synapse Client SDK — Agent Skills Reference

> **Package**: `@oobe-protocol-labs/synapse-client-sdk`  
> **Version**: 2.0.0  
> **Runtime**: Node.js ≥ 18 · TypeScript ≥ 5.0  
> **License**: MIT

You are an AI agent with access to the Synapse Client SDK — a comprehensive Solana blockchain toolkit. This document defines every capability available to you. Use it to select the right function, import path, and parameters for any user request related to Solana.

### IMPORTANT — First-Run Checklist

**Immediately after the user installs the SDK, you MUST:**

1. **Ask the user for their OOBE Protocol API key.** Without it, RPC calls will be rejected. The key is provided after sign-up at the OOBE Protocol dashboard.
2. **Ask the user if they need Jupiter integration** (swaps, quotes, DCA, limit orders). If yes, ask them for their **Jupiter API key** as well (obtainable at https://station.jup.ag).
3. Store the keys in environment variables or pass them directly in code. Never hard-code keys in committed source files.

The API key is appended as a **query parameter** on the endpoint URL:

```
https://us-1-mainnet.oobeprotocol.ai?api_key=YOUR_OOBE_API_KEY
```

All SDK methods, WebSocket connections, and gRPC streams use this authenticated URL automatically once you pass it as the endpoint.

---

## Table of Contents

1. [Installation & API Keys](#1-installation--api-keys)
2. [Endpoints](#2-endpoints)
3. [Client Setup](#3-client-setup)
4. [Branded Types](#4-branded-types)
5. [RPC Methods (53)](#5-rpc-methods-53)
6. [DAS Methods (11)](#6-das--digital-asset-standard-methods-11)
7. [WebSocket Subscriptions (7)](#7-websocket-subscriptions-7)
8. [Account Readers (8)](#8-account-readers-8)
9. [Decoders (10)](#9-decoders-10)
10. [Programs / Instruction Builders (26)](#10-programs--instruction-builders-26)
11. [Utilities (26)](#11-utilities-26)
12. [AI Tools — LangChain (53 RPC + 86 Protocol)](#12-ai-tools--langchain)
13. [Plugin System — SynapseAgentKit (110 tools)](#13-plugin-system--synapseagentkit-110-tools)
14. [MCP — Model Context Protocol](#14-mcp--model-context-protocol)
15. [Agent Commerce Gateway](#15-agent-commerce-gateway)
16. [x402 Payment Protocol](#16-x402-payment-protocol)
17. [Intents System](#17-intents-system)
18. [SAP — Synapse Agent Protocol](#18-sap--synapse-agent-protocol)
19. [Solana Actions & Blinks](#19-solana-actions--blinks)
20. [Persistence](#20-persistence)
21. [Context / IoC Container](#21-context--ioc-container)
22. [gRPC / Geyser Parser](#22-grpc--geyser-parser)
23. [@solana/kit Bridge](#23-solanakit-bridge)
24. [Next.js Integration](#24-nextjs-integration)
25. [Common Patterns](#25-common-patterns)

---

## 1. Installation & API Keys

### Install

```bash
npm i @oobe-protocol-labs/synapse-client-sdk
```

Peer dependencies (install if using AI tools):
```bash
npm i @langchain/core zod
```

### API Key Configuration

**OOBE Protocol API Key** (required for all RPC access):

Append `?api_key=` to the endpoint URL. This is the **only** authentication method:

```ts
// ✅ Correct — API key as query param
const ENDPOINT = 'https://us-1-mainnet.oobeprotocol.ai?api_key=YOUR_OOBE_API_KEY';

// Use the authenticated URL everywhere
const client = new SynapseClient({ endpoint: ENDPOINT });
```

Or via environment variable (recommended):

```bash
# .env
OOBE_API_KEY=your-api-key-here
JUPITER_API_KEY=your-jupiter-key-here   # optional, only if using Jupiter tools
```

```ts
const ENDPOINT = `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}`;
const client = new SynapseClient({ endpoint: ENDPOINT });
```

**Jupiter API Key** (optional — required only for Jupiter swap/quote/DCA tools):

If the user wants to use Jupiter DeFi tools (swap, quote, limit orders, DCA), they need a separate Jupiter API key. Pass it when creating Jupiter tools:

```ts
import { createJupiterTools } from '@oobe-protocol-labs/synapse-client-sdk/ai/tools';

const { tools } = createJupiterTools({
  apiUrl: `https://quote-api.jup.ag/v6`,
  apiKey: process.env.JUPITER_API_KEY, // Jupiter-specific key
});
```

> **Agent rule:** If the user has not provided their OOBE API key yet, **ask for it before running any SDK operation**. If they request Jupiter-related features, ask for the Jupiter API key too.

---

## 2. Endpoints

### Production Endpoints

| Region | URL | Use Case |
|--------|-----|----------|
| **US Mainnet** | `https://us-1-mainnet.oobeprotocol.ai?api_key=KEY` | Production — US region (lowest latency for Americas) |
| **EU Mainnet** | `https://staging.oobeprotocol.ai?api_key=KEY` | Production — EU region (lowest latency for Europe) |

All endpoints expose:
- **RPC**: `https://<host>` — JSON-RPC 2.0
- **WebSocket**: `wss://<host>/ws` — PubSub subscriptions
- **gRPC**: `https://<host>/grpc` — Yellowstone/Geyser streaming
- **gRPC native**: `grpc://<host>/grpc-native` — native gRPC transport

### Endpoint Resolution

```ts
import { SynapseNetwork, SynapseRegion, resolveEndpoint } from '@oobe-protocol-labs/synapse-client-sdk';

// Resolve US mainnet
const us = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);
// → { rpc: 'https://us-1-mainnet.oobeprotocol.ai', wss: 'wss://...', grpc: '...' }

// Resolve EU mainnet
const eu = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);
// → { rpc: 'https://staging.oobeprotocol.ai', wss: 'wss://...', grpc: '...' }

// Auto-select fastest region
const fastest = await autoSelectRegion(SynapseNetwork.Mainnet);
```

---

## 3. Client Setup

### Direct endpoint

```ts
import { SynapseClient, Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';

const ENDPOINT = `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}`;

const client = new SynapseClient({
  endpoint: ENDPOINT,
});

const balance = await client.rpc.getBalance(Pubkey('So11111111111111111111111111111111'));
```

### From endpoint registry

```ts
import { SynapseClient, SynapseNetwork, SynapseRegion } from '@oobe-protocol-labs/synapse-client-sdk';

const client = SynapseClient.fromEndpoint({
  network: SynapseNetwork.Mainnet,
  region: SynapseRegion.US,
  apiKey: process.env.OOBE_API_KEY, // appended as ?api_key= automatically
});
```

### Factory function

```ts
import { createSynapse } from '@oobe-protocol-labs/synapse-client-sdk';

const client = createSynapse({
  endpoint: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}`,
});
```

### Configuration Options

```ts
interface SynapseClientConfig {
  endpoint: string;          // RPC endpoint URL with ?api_key= (required)
  apiKey?: string;           // API key (auto-appended as ?api_key= if not in URL)
  timeout?: number;          // Request timeout in ms (default: 30000)
  maxRetries?: number;       // Retry attempts on failure (default: 3)
  debug?: boolean;           // Enable debug logging
  headers?: Record<string, string>; // Extra HTTP headers
  wsEndpoint?: string;       // WebSocket endpoint (auto-derived if omitted)
  grpcEndpoint?: string;     // gRPC endpoint (auto-derived if omitted)
}
```

### Sub-clients (lazy-loaded)

```ts
client.rpc       // SolanaRpc — 53 JSON-RPC methods
client.das       // DasClient — 11 DAS methods
client.ws        // WsClient — WebSocket subscriptions
client.grpc      // GrpcTransport — gRPC/Geyser streaming
client.accounts  // AccountsClient — typed account fetchers
client.transport // HttpTransport — raw RPC transport
client.kitRpc    // @solana/kit native RPC client
```

---

## 4. Branded Types

Zero-cost nominal types enforced at compile time. **These are NOT plain strings/numbers** — passing a raw `string` where `Pubkey` is expected will cause a TypeScript error.

```ts
import { Pubkey, Sig, Slot, Epoch, Lamports, UnixTs } from '@oobe-protocol-labs/synapse-client-sdk';

const pk  = Pubkey('So11111111111111111111111111111111111111112');
const sig = Sig('5eykt4Uu...');
const s   = Slot(250_000_000);
const e   = Epoch(600);
const l   = Lamports(1_000_000_000n);  // = 1 SOL
const ts  = UnixTs(1709740800);
```

### ⚠️ Strict-Mode Rules (MUST follow)

1. **Never pass raw strings where branded types are expected.**
   ```ts
   // ❌ WRONG — TypeScript error in strict mode
   const balance = await client.rpc.getBalance('So111...');

   // ✅ CORRECT — wrap with Pubkey()
   const balance = await client.rpc.getBalance(Pubkey('So111...'));
   ```

2. **Always wrap user-supplied wallet addresses with `Pubkey()`.**
   When the user gives you an address as a plain string, immediately brand it:
   ```ts
   const userWallet = Pubkey(userInput);  // brand it once, use everywhere
   ```

3. **Cast singletons and factory returns to `SynapseClient`.**
   `createSingleton()` and other factories may return a generic type. In strict Next.js builds, cast explicitly:
   ```ts
   import { SynapseClient, createSingleton } from '@oobe-protocol-labs/synapse-client-sdk';

   const getClient = createSingleton(
     () => new SynapseClient({ endpoint: ENDPOINT }),
     { key: 'synapse-client' },
   );

   // ✅ Cast to SynapseClient — avoids 'unknown' type in app router
   const client = getClient() as SynapseClient;
   ```

4. **Branded types are assignable to their base type** (e.g. `Pubkey` → `string` works), but **not the reverse**. If an external library expects `string`, you can pass a `Pubkey` directly.

---

## 5. RPC Methods (53)

Access via `client.rpc.*` or standalone functions.

### Account Methods (5)
| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `getAccountInfo(pubkey, opts?)` | `Pubkey, { commitment?, encoding? }` | Account data or null | Fetch account data |
| `getBalance(pubkey, opts?)` | `Pubkey, { commitment? }` | `{ value: Lamports }` | SOL balance in lamports |
| `getMultipleAccounts(pubkeys, opts?)` | `Pubkey[]` | Account data array | Batch fetch accounts |
| `getProgramAccounts(program, opts?)` | `Pubkey, filters?` | Program accounts | All accounts owned by program |
| `getLargestAccounts(opts?)` | `{ filter?, commitment? }` | Top 20 accounts | Largest lamport balances |

### Block Methods (7)
| Method | Description |
|--------|-------------|
| `getBlock(slot, opts?)` | Confirmed block by slot |
| `getBlockHeight(opts?)` | Current block height |
| `getBlockTime(slot)` | Estimated production time |
| `getBlockProduction(opts?)` | Recent block production info |
| `getBlocks(startSlot, endSlot?)` | Block list between slots |
| `getBlocksWithLimit(startSlot, limit)` | Blocks from slot with limit |
| `getBlockCommitment(slot)` | Block commitment |

### Transaction Methods (6)
| Method | Description |
|--------|-------------|
| `getTransaction(sig, opts?)` | Confirmed transaction by signature |
| `getSignaturesForAddress(addr, opts?)` | Signatures for an address |
| `getSignatureStatuses(sigs, opts?)` | Batch signature statuses |
| `sendTransaction(tx, opts?)` | Submit signed transaction |
| `simulateTransaction(tx, opts?)` | Simulate without submitting |
| `requestAirdrop(pubkey, lamports)` | Airdrop (devnet/testnet only) |

### Blockhash Methods (2)
| Method | Description |
|--------|-------------|
| `getLatestBlockhash(opts?)` | Latest blockhash + last valid block height |
| `isBlockhashValid(blockhash, opts?)` | Check blockhash validity |

### Slot / Epoch Methods (5)
| Method | Description |
|--------|-------------|
| `getSlot(opts?)` | Current slot |
| `getSlotLeader(opts?)` | Current slot leader |
| `getSlotLeaders(startSlot, limit)` | Slot leaders for range |
| `getEpochInfo(opts?)` | Current epoch info |
| `getEpochSchedule()` | Epoch schedule parameters |

### Inflation Methods (3)
| Method | Description |
|--------|-------------|
| `getInflationGovernor(opts?)` | Inflation governor params |
| `getInflationRate()` | Current epoch inflation |
| `getInflationReward(addresses, opts?)` | Staking rewards per address |

### Cluster / Network Methods (8)
| Method | Description |
|--------|-------------|
| `getVoteAccounts(opts?)` | All vote accounts + stake |
| `getClusterNodes()` | Cluster node info |
| `getSupply(opts?)` | SOL supply breakdown |
| `getRecentPerformanceSamples(limit?)` | Performance samples |
| `getHealth()` | Node health status |
| `getVersion()` | Solana version |
| `getGenesisHash()` | Genesis hash |
| `getIdentity()` | Node identity pubkey |

### Rent / Ledger Methods (5)
| Method | Description |
|--------|-------------|
| `getMinimumBalanceForRentExemption(size)` | Minimum lamports for rent-exempt |
| `minimumLedgerSlot()` | Lowest slot in ledger |
| `getFirstAvailableBlock()` | First non-purged block |
| `getHighestSnapshotSlot()` | Highest snapshot slot |
| `getLeaderSchedule(opts?)` | Leader schedule |

### Staking Methods (2)
| Method | Description |
|--------|-------------|
| `getStakeMinimumDelegation(opts?)` | Minimum delegation |
| `getStakeActivation(pubkey, opts?)` | Stake activation state *(deprecated)* |

### Token / SPL Methods (5)
| Method | Description |
|--------|-------------|
| `getTokenAccountBalance(pubkey)` | SPL token balance |
| `getTokenAccountsByOwner(owner, opts)` | All token accounts for owner |
| `getTokenAccountsByDelegate(delegate, opts)` | Token accounts by delegate |
| `getTokenLargestAccounts(mint)` | Top 20 for token mint |
| `getTokenSupply(mint)` | Total supply for mint |

### Fee / Misc Methods (5)
| Method | Description |
|--------|-------------|
| `getTransactionCount(opts?)` | Ledger transaction count |
| `getFeeForMessage(message)` | Network fee for message |
| `getRecentPrioritizationFees(pubkeys?)` | Recent priority fees |
| `getMaxRetransmitSlot()` | Max retransmit slot |
| `getMaxShredInsertSlot()` | Max shred insert slot |

---

## 6. DAS — Digital Asset Standard Methods (11)

Access via `client.das.*`. Used for NFTs, compressed NFTs (cNFTs), and digital assets.

```ts
const asset = await client.das.getAsset({ id: 'AssetPubkeyHere...' });
const nfts  = await client.das.getAssetsByOwner({ ownerAddress: 'WalletPubkey...' });
```

| Method | Params | Description |
|--------|--------|-------------|
| `getAsset({ id })` | Asset pubkey | Single digital asset |
| `getAssetProof({ id })` | Asset pubkey | Merkle proof for compressed asset |
| `getAssetBatch({ ids })` | Pubkey array | Batch fetch assets |
| `getAssetProofBatch({ ids })` | Pubkey array | Batch Merkle proofs |
| `getAssetsByOwner({ ownerAddress, ... })` | Owner wallet | All assets owned by wallet |
| `getAssetsByGroup({ groupKey, groupValue })` | Group (e.g. collection) | Assets in a group |
| `getAssetsByCreator({ creatorAddress })` | Creator pubkey | Assets by creator |
| `getAssetsByAuthority({ authorityAddress })` | Authority pubkey | Assets by authority |
| `searchAssets({ ... })` | Flexible filters | Search with criteria |
| `getSignaturesForAsset({ id })` | Asset pubkey | Transaction signatures for asset |
| `getTokenAccounts({ owner? , mint? })` | Owner or mint | Token accounts |

### ⚠️ DAS Strict-Type Pitfall — Collection Gating

`GetAssetsByOwnerParams` does **NOT** include `groupKey`/`groupValue` filter fields in the official type. If you need to check whether a wallet holds an NFT from a specific collection, you **cannot** filter at the DAS query level. Instead:

1. Fetch all assets for the owner.
2. Manually inspect the `grouping` array in each returned asset.

```ts
// ✅ CORRECT — fetch then filter client-side
const { items } = await client.das.getAssetsByOwner({
  ownerAddress: walletAddress,
  page: 1,
  limit: 1000,
});

const REQUIRED_COLLECTION = 'YourCollectionMintPubkey...';

const hasNft = items.some((asset) =>
  asset.grouping?.some(
    (g) => g.group_key === 'collection' && g.group_value === REQUIRED_COLLECTION,
  ),
);

if (!hasNft) throw new Error('Wallet does not hold an NFT from the required collection');
```

> **Do NOT** try to pass `{ groupKey: 'collection', groupValue: '...' }` into `getAssetsByOwner()` — it is not in the type and will cause a TypeScript error in strict mode. Use `getAssetsByGroup()` instead if you want to query by collection directly (but that returns ALL holders, not filtered to one wallet).

---

## 7. WebSocket Subscriptions (7)

Access via `client.ws.*`.

```ts
const subId = await client.ws.onAccountChange(
  Pubkey('So111...'),
  (account) => console.log('Updated:', account),
);

// Later
await client.ws.unsubscribe(subId);
```

| Method | Description |
|--------|-------------|
| `onAccountChange(pubkey, callback, opts?)` | Account data changes |
| `onProgramAccountChange(program, callback, opts?)` | All accounts for a program |
| `onLogs(filter, callback, opts?)` | Transaction logs (`'all'`, `'allWithVotes'`, or mentions `Pubkey`) |
| `onSignature(sig, callback, opts?)` | Transaction confirmation |
| `onSlotChange(callback)` | Slot changes |
| `onRootChange(callback)` | Root slot changes |
| `unsubscribe(subId)` | Remove subscription |
| `close()` | Close connection + clear all |

---

## 8. Account Readers (8)

Access via `client.accounts.*`. Fetch + decode in one call.

```ts
const tokenAcct = await client.accounts.fetchTokenAccount(transport, Pubkey('...'));
const mint      = await client.accounts.fetchMint(transport, Pubkey('...'));
const stake     = await client.accounts.fetchStakeAccount(transport, Pubkey('...'));
```

| Method | Description |
|--------|-------------|
| `fetchTokenAccount(transport, pubkey)` | SPL Token account (auto-detects Token vs Token-2022) |
| `fetchMint(transport, pubkey)` | Token mint (auto-detects) |
| `fetchTokenAccountsByOwner(transport, owner, mint?)` | All token accounts for owner |
| `fetchStakeAccount(transport, pubkey)` | Stake account |
| `fetchNonceAccount(transport, pubkey)` | Durable nonce account |
| `fetchLookupTable(transport, pubkey)` | Address Lookup Table |
| `fetchDecoded(transport, pubkey, decoder)` | Any account + custom decoder |
| `fetchDecodedBatch(transport, pubkeys, decoder)` | Batch + custom decoder |

---

## 9. Decoders (10)

Pure functions — decode raw bytes with zero I/O. Import from root or `decoders`.

```ts
import { decodeTokenAccount, decodeMint } from '@oobe-protocol-labs/synapse-client-sdk';
```

| Function | Description |
|----------|-------------|
| `decodeTokenAccount(data)` | SPL Token v1 account |
| `decodeMint(data)` | SPL Token v1 mint |
| `decodeToken2022Account(data)` | Token-2022 account (with extensions) |
| `decodeToken2022Mint(data)` | Token-2022 mint (with extensions) |
| `decodeStakeAccount(data)` | Stake account |
| `decodeNonceAccount(data)` | Durable nonce account |
| `decodeLookupTable(data)` | Address Lookup Table |
| `decodeMultisig(data)` | SPL Token multisig |
| `AccountReader` | Low-level DataView byte reader class |
| `encodeBase58(bytes)` | Encode bytes to base58 |

**Constants**: `TOKEN_PROGRAM_ID`, `TOKEN_2022_PROGRAM_ID`, `SYSTEM_PROGRAM_ID`, `STAKE_PROGRAM_ID`, `LOOKUP_TABLE_PROGRAM_ID`, `TOKEN_ACCOUNT_SIZE`, `MINT_SIZE`, `NONCE_ACCOUNT_SIZE`, `MULTISIG_SIZE`.

---

## 10. Programs / Instruction Builders (26)

Create transaction instructions without external deps.

```ts
import { SystemProgram, SplToken, AssociatedToken, ComputeBudget, Memo } from '@oobe-protocol-labs/synapse-client-sdk';
```

### SystemProgram (5)
| Method | Description |
|--------|-------------|
| `SystemProgram.transfer(params)` | Transfer SOL |
| `SystemProgram.createAccount(params)` | Create account |
| `SystemProgram.assign(params)` | Assign to program |
| `SystemProgram.createWithSeed(params)` | Create with seed derivation |
| `SystemProgram.allocate(params)` | Allocate space |

### SplToken (11)
| Method | Description |
|--------|-------------|
| `SplToken.transfer(params)` | Transfer tokens |
| `SplToken.transferChecked(params)` | Transfer with decimal check |
| `SplToken.approve(params)` | Approve delegate |
| `SplToken.revoke(params)` | Revoke delegate |
| `SplToken.mintTo(params)` | Mint tokens |
| `SplToken.mintToChecked(params)` | Mint with decimal check |
| `SplToken.burn(params)` | Burn tokens |
| `SplToken.closeAccount(params)` | Close token account |
| `SplToken.freezeAccount(params)` | Freeze account |
| `SplToken.thawAccount(params)` | Thaw account |
| `SplToken.syncNative(params)` | Sync wrapped SOL |

### AssociatedToken (2)
| Method | Description |
|--------|-------------|
| `AssociatedToken.create(params)` | Create ATA |
| `AssociatedToken.createIdempotent(params)` | Create ATA (no-op if exists) |

### ComputeBudget (3)
| Method | Description |
|--------|-------------|
| `ComputeBudget.setComputeUnitLimit(params)` | Set CU limit |
| `ComputeBudget.setComputeUnitPrice(params)` | Set priority fee |
| `ComputeBudget.requestHeapFrame(params)` | Request heap memory |

### Memo (2)
| Method | Description |
|--------|-------------|
| `Memo.v1(message)` | Memo Program v1 |
| `Memo.v2(message, signers?)` | Memo Program v2 |

### Utility
| Function | Description |
|----------|-------------|
| `createToken(params)` | High-level: create mint + ATA + mint-to in one call |

---

## 11. Utilities (26)

```ts
import { lamportsToSol, solToLamports, isValidPubkey, sleep, retry, chunk } from '@oobe-protocol-labs/synapse-client-sdk';
```

### Conversion & Validation
| Function | Description |
|----------|-------------|
| `lamportsToSol(lamports)` | Lamports → SOL (÷ 1e9) |
| `solToLamports(sol)` | SOL → branded `Lamports` (× 1e9) |
| `isValidPubkey(str)` | Validate base58 public key |
| `isValidSignature(str)` | Validate base58 signature |

### Async Helpers
| Function | Description |
|----------|-------------|
| `sleep(ms)` | Async sleep for ms |
| `retry(fn, opts?)` | Retry with exponential backoff |
| `chunk(array, size)` | Split array into chunks |

### Serialization
| Function | Description |
|----------|-------------|
| `toJsonSafe(value)` | BigInt-safe JSON conversion |
| `bigIntReplacer` | `JSON.stringify` replacer for BigInt |

### Environment
| Function | Description |
|----------|-------------|
| `isBrowser()` | `true` in browser |
| `isServer()` | `true` on server |
| `getEnvironment()` | `'browser'` or `'server'` |
| `SDK_USER_AGENT` | User-agent string |

### Endpoint Management
| Function | Description |
|----------|-------------|
| `resolveEndpoint(network, region?)` | Resolve RPC/WSS/gRPC URLs |
| `listEndpoints(network?)` | List all endpoints |
| `listRegions(network)` | Available regions |
| `listNetworks()` | Available networks |
| `autoSelectRegion(network)` | Fastest region by latency |
| `probeLatency(endpoint)` | Ping endpoint |
| `toClientConfig(endpoint, opts?)` | Endpoint → client config |
| `createSingleton(factory, opts?)` | HMR-safe singleton (Next.js/Vite) |

### Pre-resolved Endpoints
| Constant | Value |
|----------|-------|
| `SYNAPSE_MAINNET_US` | `https://us-1-mainnet.oobeprotocol.ai` |
| `SYNAPSE_MAINNET_EU` | `https://staging.oobeprotocol.ai` |
| `SYNAPSE_DEVNET_US` | Devnet US endpoint |
| `SYNAPSE_DEVNET_EU` | Devnet EU endpoint |

---

## 12. AI Tools — LangChain

### RPC Tools (53 methods)

```ts
import { createSolanaTools } from '@oobe-protocol-labs/synapse-client-sdk/ai/tools';

const client = new SynapseClient({ endpoint: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` });
const { tools, toolMap } = createSolanaTools(client);

// All 53 RPC methods as LangChain StructuredTool[]
// Each tool has a Zod schema for input validation
```

### Protocol Tools (86 methods)

```ts
import {
  createJupiterTools,       // 20 tools — swap, quote, route, limit orders, DCA, price
  createRaydiumTools,       // 16 tools — pools, liquidity, farming, swaps
  createMetaplexTools,      // 12 tools — NFT mint, update, verify, burn, collections
  createJupiterOnchainTools, // on-chain Jupiter interactions
  createRaydiumOnchainTools, // on-chain Raydium interactions
  createSolanaProgramsTools, // program-level tools
  createProtocolTools,       // all protocol tools at once
} from '@oobe-protocol-labs/synapse-client-sdk/ai/tools';

const { tools } = createJupiterTools({ apiUrl: 'https://...' });
```

---

## 13. Plugin System — SynapseAgentKit (110 tools)

The modular plugin architecture. Compose exactly the tools you need via `.use()`.

### Setup

```ts
import { SynapseAgentKit } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token';
import { NFTPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft';
import { DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi';
import { MiscPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc';
import { BlinksPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks';

const kit = new SynapseAgentKit({
  rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}`,
  walletPubkey: 'YourWalletPubkey...',  // optional
})
  .use(TokenPlugin)
  .use(NFTPlugin)
  .use(DeFiPlugin)
  .use(MiscPlugin)
  .use(BlinksPlugin);
```

### SynapseAgentKit API

| Method | Returns | Description |
|--------|---------|-------------|
| `.use(plugin)` | `this` | Install a plugin (chainable) |
| `.getTools()` | `StructuredTool[]` | All tools as LangChain StructuredTool |
| `.getVercelAITools()` | Vercel AI format | All tools for Vercel AI SDK |
| `.getMcpToolDescriptors()` | `McpToolDescriptor[]` | MCP-compatible descriptors |
| `.getToolMap()` | `Map<string, Tool>` | Name → tool lookup |
| `.summary()` | object | Installed plugins, tool count, protocol list |
| `.destroy()` | void | Cleanup resources |

### TokenPlugin — 22 tools

Import: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token`

**spl-token** (11 tools):
| Tool | Description |
|------|-------------|
| `deployToken` | Deploy a new SPL token mint |
| `transfer` | Transfer SPL tokens between wallets |
| `transferSol` | Transfer native SOL |
| `getBalance` | Get token balance for a wallet |
| `getTokenAccounts` | List all token accounts for owner |
| `mintTo` | Mint tokens to an account |
| `burn` | Burn tokens from an account |
| `freezeAccount` | Freeze a token account |
| `thawAccount` | Unfreeze a token account |
| `closeAccount` | Close a token account |
| `rugCheck` | Run a rug-pull risk analysis on a token |

**staking** (7 tools):
| Tool | Description |
|------|-------------|
| `stakeSOL` | Native SOL staking |
| `unstakeSOL` | Unstake native SOL |
| `getStakeAccounts` | List stake accounts |
| `stakeJupSOL` | Stake via Jupiter (JupSOL) |
| `unstakeJupSOL` | Unstake JupSOL |
| `stakeSolayer` | Stake via Solayer |
| `unstakeSolayer` | Unstake Solayer |

**bridging** (4 tools):
| Tool | Description |
|------|-------------|
| `bridgeWormhole` | Cross-chain bridge via Wormhole |
| `bridgeWormholeStatus` | Check Wormhole bridge status |
| `bridgeDeBridge` | Cross-chain bridge via deBridge |
| `bridgeDeBridgeStatus` | Check deBridge bridge status |

### NFTPlugin — 19 tools

Import: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft`

**metaplex-nft** (9 tools):
| Tool | Description |
|------|-------------|
| `deployCollection` | Create a new NFT collection |
| `mintNFT` | Mint a single NFT |
| `updateMetadata` | Update NFT metadata |
| `verifyCreator` | Verify creator on NFT |
| `verifyCollection` | Verify collection on NFT |
| `setAndVerifyCollection` | Set + verify collection |
| `delegateAuthority` | Delegate authority |
| `revokeAuthority` | Revoke authority |
| `configureRoyalties` | Configure royalty settings |

**3land** (5 tools):
| Tool | Description |
|------|-------------|
| `createCollection` | Create collection on 3Land |
| `mintAndList` | Mint + list for sale |
| `listForSale` | List existing NFT for sale |
| `cancelListing` | Cancel a listing |
| `buyNFT` | Purchase listed NFT |

**das** (5 tools):
| Tool | Description |
|------|-------------|
| `getAsset` | Fetch a digital asset |
| `getAssetsByOwner` | Assets owned by wallet |
| `getAssetsByCreator` | Assets by creator |
| `getAssetsByCollection` | Assets in collection |
| `searchAssets` | Search with filters |

### DeFiPlugin — 43 tools

Import: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi`

**pump** (2): `launchToken`, `trade`
**raydium-pools** (5): `createCPMM`, `createCLMM`, `createAMMv4`, `addLiquidity`, `removeLiquidity`
**orca** (5): `getWhirlpool`, `swap`, `openPosition`, `closePosition`, `collectFees`
**manifest** (4): `createMarket`, `placeLimitOrder`, `cancelOrder`, `getOrderbook`
**meteora** (5): `createDynamicPool`, `createDLMMPool`, `addDLMMLiquidity`, `removeDLMMLiquidity`, `createAlphaVault`
**openbook** (3): `createMarket`, `placeOrder`, `cancelOrder`
**drift** (7): `deposit`, `withdraw`, `openPerpPosition`, `closePerpPosition`, `getPositions`, `lend`, `borrow`
**adrena** (5): `openPosition`, `closePosition`, `addCollateral`, `removeCollateral`, `getPositions`
**lulo** (4): `deposit`, `withdraw`, `getBestRates`, `getPositions`
**jito** (3): `sendBundle`, `getBundleStatus`, `getTipEstimate`

### MiscPlugin — 20 tools

Import: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc`

**sns** (3): `registerDomain`, `resolveDomain`, `reverseLookup` — Bonfida .sol domains
**alldomains** (3): `registerDomain`, `resolveDomain`, `getOwnedDomains`
**pyth** (3): `getPrice`, `getPriceHistory`, `listPriceFeeds` — real-time oracle prices
**coingecko** (6): `getTokenPrice`, `getTrending`, `getTopGainersLosers`, `getTokenInfo`, `getPoolsByToken`, `getOHLCV`
**gibwork** (3): `createBounty`, `listBounties`, `submitWork`
**send-arcade** (2): `listGames`, `playGame`

### BlinksPlugin — 6 tools

Import: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks`

| Tool | Description |
|------|-------------|
| `getAction` | Fetch a Solana Action by URL |
| `executeAction` | Execute an action |
| `confirmAction` | Confirm execution |
| `resolveBlinkUrl` | Resolve shortened blink URL |
| `validateActionsJson` | Validate actions.json |
| `buildActionUrl` | Build a proper action URL |

Pure HTTP — no RPC transport needed.

---

## 14. MCP — Model Context Protocol

Zero-dependency MCP implementation (spec 2024-11-05). Works as both server AND client.

### MCP Server

Exposes your SynapseAgentKit tools to any MCP client (Claude Desktop, Cursor, VS Code, Cline).

```ts
import { SynapseAgentKit, TokenPlugin, DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { SynapseMcpServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(TokenPlugin)
  .use(DeFiPlugin);

// stdio mode (Claude Desktop, Cursor)
const server = new SynapseMcpServer(kit, {
  name: 'synapse-solana',
  version: '2.0.0',
  instructions: 'Solana blockchain tools for AI agents.',
});
await server.start(); // reads stdin, writes stdout

// SSE mode (web clients)
const sseServer = new SynapseMcpServer(kit, {
  transport: 'sse',
  ssePort: 3001,
  ssePath: '/mcp',
});
await sseServer.start(); // HTTP server on port 3001
```

**Claude Desktop config** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "synapse-solana": {
      "command": "npx",
      "args": ["synapse-mcp-server"],
      "env": {
        "SYNAPSE_RPC_URL": "https://us-1-mainnet.oobeprotocol.ai",
        "OOBE_API_KEY": "YOUR_OOBE_API_KEY"
      }
    }
  }
}
```

**Cursor config** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "synapse-solana": {
      "command": "npx",
      "args": ["synapse-mcp-server"],
      "env": {
        "SYNAPSE_RPC_URL": "https://us-1-mainnet.oobeprotocol.ai",
        "OOBE_API_KEY": "YOUR_OOBE_API_KEY"
      }
    }
  }
}
```

### SynapseMcpServer API

| Method | Description |
|--------|-------------|
| `start()` | Start server (stdio or SSE) |
| `stop()` | Graceful shutdown |
| `info()` | Server introspection |

MCP spec dispatch: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `resources/templates/list`, `prompts/list`, `prompts/get`, `ping`, `completion/complete`, `logging/setLevel`.

### MCP Client Bridge

Connect to external MCP servers and import their tools.

```ts
import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const bridge = new McpClientBridge();

// Connect to GitHub MCP server
await bridge.connect({
  id: 'github',
  name: 'GitHub',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
  toolPrefix: 'github_',
});

// Connect to Postgres
await bridge.connect({
  id: 'postgres',
  name: 'PostgreSQL',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!],
  toolPrefix: 'pg_',
});

// Connect via SSE
await bridge.connect({
  id: 'custom',
  name: 'Custom MCP',
  transport: 'sse',
  url: 'https://my-mcp-server.com/mcp/sse',
});

// Get tools or use as plugin
const externalTools = bridge.getTools();       // LangChain StructuredTool[]
const plugin = bridge.toPlugin();              // SynapsePlugin
kit.use(plugin);                               // chain into AgentKit

// Direct access
const result = await bridge.callTool('github', 'list_repos', { owner: 'oobe-protocol-labs' });
const resource = await bridge.readResource('postgres', 'postgres://table/users');
```

### McpClientBridge API

| Method | Description |
|--------|-------------|
| `connect(config)` | Connect to an MCP server |
| `disconnect(id)` | Disconnect a server |
| `disconnectAll()` | Disconnect all |
| `getTools()` | All external tools as LangChain |
| `getServerTools(id)` | Tools from specific server |
| `callTool(serverId, name, args)` | Call a tool directly |
| `readResource(serverId, uri)` | Read a resource |
| `toPlugin()` | Convert to SynapsePlugin for `.use()` |
| `getAllStatuses()` | Connection statuses |
| `getAllToolDefinitions()` | Raw tool definitions |

---

## 15. Agent Commerce Gateway

Session management, pricing, validation, and marketplace for agent-to-agent commerce.

```ts
import {
  AgentCommerceGateway,
  SessionManager,
  PricingEngine,
  ResponseValidator,
  ToolMarketplace,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/gateway';
```

### AgentCommerceGateway
| Method | Description |
|--------|-------------|
| `createSession(config)` | Create metered session |
| `processRequest(sessionId, request)` | Process request with metering |
| `getSessionInfo(sessionId)` | Session info |
| `revokeSession(sessionId)` | Revoke session |
| `registerTool(def)` | Register tool in marketplace |
| `discoverTools(query)` | Search marketplace |
| `getMetrics()` | Gateway metrics |

### SessionManager
| Method | Description |
|--------|-------------|
| `create(config)` | Create session with TTL + rate limits |
| `validate(sessionId, token)` | Validate session token |
| `consume(sessionId)` | Consume a request from quota |
| `revoke(sessionId)` | Revoke |
| `info(sessionId)` | Session details |
| `cleanup()` | Remove expired sessions |

### PricingEngine
| Method | Description |
|--------|-------------|
| `calculateCost(method, params)` | Calculate cost for a call |
| `registerTier(tier)` | Register pricing tier |
| `getTiers()` | List tiers |
| `getUsage(sessionId)` | Usage stats |
| `estimateBatch(methods)` | Estimate batch cost |

### ResponseValidator
| Method | Description |
|--------|-------------|
| `validate(response, schema)` | Validate response shape |
| `attest(response, privateKey)` | Sign response attestation |
| `verify(response, attestation, publicKey)` | Verify attestation |

---

## 16. x402 Payment Protocol

HTTP 402-based micropayment protocol for AI agent commerce.

```ts
import {
  X402BuyerClient,
  X402SellerPaywall,
  X402FacilitatorClient,
  createX402Middleware,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/gateway';
```

### X402BuyerClient
| Method | Description |
|--------|-------------|
| `pay(invoice)` | Pay a 402 invoice |
| `negotiate(offer)` | Negotiate terms |
| `getReceipt(paymentId)` | Get payment receipt |

### X402SellerPaywall
| Method | Description |
|--------|-------------|
| `protect(route, price)` | Protect endpoint with 402 |
| `verify(payment)` | Verify incoming payment |
| `middleware()` | Express/Connect middleware |

---

## 17. Intents System

Natural language → on-chain action resolution.

```ts
import { IntentParser, IntentPlanner, IntentExecutor } from '@oobe-protocol-labs/synapse-client-sdk/ai/intents';
```

| Class | Method | Description |
|-------|--------|-------------|
| `IntentParser` | `parse(text)` | Natural language → structured intent |
| `IntentPlanner` | `plan(intent)` | Intent → execution steps |
| `IntentExecutor` | `execute(plan)` | Execute planned steps |

---

## 18. SAP — Synapse Agent Protocol

On-chain agent registry, discovery, and scoring.

```ts
import {
  SapRegistry,
  SapDiscovery,
  SapValidator,
  SapScoring,
  SapSubnetwork,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
```

| Class | Key Methods | Description |
|-------|-------------|-------------|
| `SapRegistry` | `register()`, `update()`, `deregister()`, `resolve()` | On-chain agent registry |
| `SapDiscovery` | `discover()`, `findByCapability()`, `findByScore()` | Agent discovery |
| `SapValidator` | `validate()`, `challenge()`, `score()` | Agent behavior validation |
| `SapScoring` | `calculate()`, `getHistory()`, `getLeaderboard()` | Reputation scoring |
| `SapSubnetwork` | `create()`, `join()`, `leave()`, `broadcast()` | Agent subnetworks |

---

## 19. Solana Actions & Blinks

```ts
import { ActionsServer, BlinkResolver } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';
```

| Class | Key Methods | Description |
|-------|-------------|-------------|
| `ActionsServer` | `registerAction()`, `handleRequest()`, `serve()` | Host Solana Actions endpoints |
| `BlinkResolver` | `resolve(url)`, `execute(action)`, `confirm(sig)` | Consume blinks |

---

## 20. Persistence

Pluggable state persistence with 3 backends.

```ts
import {
  MemoryStore,
  FileStore,
  RedisStore,
  createStore,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
```

| Backend | Description |
|---------|-------------|
| `MemoryStore` | In-memory (dev/testing) |
| `FileStore` | JSON file-based |
| `RedisStore` | Redis-backed (production) |

Common API: `get(key)`, `set(key, value, ttl?)`, `delete(key)`, `has(key)`, `clear()`, `keys(pattern?)`.

---

## 21. Context / IoC Container

Dependency injection, service lifecycle, and hooks.

```ts
import {
  SynapseContext,
  createSynapseContext,
  createBareContext,
  createBinding,
  ServiceRef,
  WeakServiceRef,
  RefRegistry,
} from '@oobe-protocol-labs/synapse-client-sdk';
```

| Function | Description |
|----------|-------------|
| `createSynapseContext(config)` | Full IoC context with auto-wired services |
| `createBareContext()` | Empty context |
| `createBinding(token, factory)` | Service binding |
| `autoWire(context)` | Auto-register default services |

---

## 22. gRPC / Geyser Parser

Low-level Yellowstone/Geyser stream parser.

```ts
import { GeyserParser, GrpcTransport } from '@oobe-protocol-labs/synapse-client-sdk';
```

### GeyserParser
| Method | Description |
|--------|-------------|
| `parseTransaction(raw)` | Decode raw transaction |
| `parseAccountUpdate(raw)` | Decode account update |
| `parseBlockMeta(raw)` | Decode block metadata |
| `parseSlotUpdate(raw)` | Decode slot update |
| `parseEntry(raw)` | Decode ledger entry |
| `stream(filter, callback)` | Stream parsed updates |

**80+ known programs** recognized — Jupiter, Raydium, Metaplex, Orca, Meteora, Marinade, SPL programs, and more.

---

## 23. @solana/kit Bridge

Interop with `@solana/kit` native types.

```ts
import { address, signature, lamports } from '@oobe-protocol-labs/synapse-client-sdk/kit';

// Convert Synapse types → Kit types
const kitAddr = address('So11111111111111111111111111111111111111112');

// Or use kit-native RPC
const balance = await client.kitRpc.getBalance(kitAddr).send();
```

---

## 24. Next.js Integration

### ⚠️ Strict App Router Compatibility

Next.js app router builds use stricter TypeScript checking. The SDK's branded types and singleton factories require explicit handling:

### Singleton Setup (with explicit cast)

```ts
import {
  SynapseClient,
  createSingleton,
  Pubkey,
} from '@oobe-protocol-labs/synapse-client-sdk';

const ENDPOINT = `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}`;

const getClient = createSingleton(
  () => new SynapseClient({ endpoint: ENDPOINT }),
  { key: 'synapse-client' },
);

// ✅ MUST cast — createSingleton returns a generic; Next.js strict mode rejects 'unknown'
const client = getClient() as SynapseClient;
```

### Server Component Example — NFT-Gated Page

```ts
// app/gated/page.tsx  (server component)
import { SynapseClient, createSingleton, Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
import { redirect } from 'next/navigation';

const getClient = createSingleton(
  () => new SynapseClient({ endpoint: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` }),
  { key: 'synapse' },
);

const REQUIRED_COLLECTION = 'YourCollectionMintHere...';

export default async function GatedPage({ searchParams }: { searchParams: { wallet?: string } }) {
  const wallet = searchParams.wallet;
  if (!wallet) redirect('/connect');

  const client = getClient() as SynapseClient;          // ← cast
  const walletPk = Pubkey(wallet);                       // ← brand the string

  // Fetch assets, then filter client-side (getAssetsByOwner has no groupKey param)
  const { items } = await client.das.getAssetsByOwner({
    ownerAddress: wallet,
    page: 1,
    limit: 1000,
  });

  const hasAccess = items.some((a) =>
    a.grouping?.some((g) => g.group_key === 'collection' && g.group_value === REQUIRED_COLLECTION),
  );

  if (!hasAccess) redirect('/no-access');

  return <div>Welcome, holder!</div>;
}
```

### Key Rules for Next.js

| Rule | Why |
|------|-----|
| Cast `getClient()` to `SynapseClient` | `createSingleton` returns generic — strict TS rejects `unknown` |
| Wrap all address strings with `Pubkey()` | Branded type — plain `string` fails type-check |
| Filter DAS results client-side for collection gating | `getAssetsByOwner` params don't include `groupKey` / `groupValue` |
| Use `process.env.OOBE_API_KEY` in `?api_key=` | Server-only env var — never exposed to client bundle |

---

## 25. Common Patterns

### Get SOL balance of a wallet

```ts
const client = new SynapseClient({ endpoint: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` });
const { value } = await client.rpc.getBalance(Pubkey('WalletAddressHere'));
const sol = lamportsToSol(value);
```

### Get all NFTs owned by a wallet

```ts
const assets = await client.das.getAssetsByOwner({
  ownerAddress: 'WalletAddressHere',
  page: 1,
  limit: 100,
});
```

### Swap tokens via DeFi plugin

```ts
const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(DeFiPlugin);

const tools = kit.getTools();
const swapTool = kit.getToolMap().get('orca_swap');
const result = await swapTool.invoke({
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: 1_000_000_000, // 1 SOL
  slippage: 50, // 0.5%
});
```

### Resolve a .sol domain

```ts
const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(MiscPlugin);

const resolver = kit.getToolMap().get('sns_resolveDomain');
const result = await resolver.invoke({ domain: 'toly.sol' });
```

### Get real-time token price from Pyth

```ts
const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(MiscPlugin);

const pyth = kit.getToolMap().get('pyth_getPrice');
const price = await pyth.invoke({ symbol: 'SOL/USD' });
```

### Full agent with LangChain

```ts
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { SynapseAgentKit, TokenPlugin, DeFiPlugin, MiscPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createStructuredChatAgent } from 'langchain/agents';

const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(TokenPlugin)
  .use(DeFiPlugin)
  .use(MiscPlugin);

const tools = kit.getTools(); // 85 LangChain StructuredTool[]
const llm = new ChatOpenAI({ modelName: 'gpt-4o' });
const agent = createStructuredChatAgent({ llm, tools, prompt: '...' });
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: 'What is the current price of SOL and my balance?',
});
```

### Expose tools via MCP to Claude Desktop

```ts
import { SynapseAgentKit, TokenPlugin, DeFiPlugin, NFTPlugin, MiscPlugin, BlinksPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { SynapseMcpServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const kit = new SynapseAgentKit({ rpcUrl: `https://us-1-mainnet.oobeprotocol.ai?api_key=${process.env.OOBE_API_KEY}` })
  .use(TokenPlugin)
  .use(DeFiPlugin)
  .use(NFTPlugin)
  .use(MiscPlugin)
  .use(BlinksPlugin);

const server = new SynapseMcpServer(kit, {
  name: 'synapse-solana',
  version: '2.0.0',
});

await server.start(); // 110 tools available to Claude
```

### Combine MCP server + external MCP client

```ts
import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const bridge = new McpClientBridge();
await bridge.connect({
  id: 'github',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN! },
});

// Merge external tools into the kit
kit.use(bridge.toPlugin());

// Now kit has 110 Solana tools + GitHub tools
const allTools = kit.getTools();
```

---

## Quick Reference — Import Paths

| Import Path | What |
|-------------|------|
| `@oobe-protocol-labs/synapse-client-sdk` | Core: `SynapseClient`, types, utils, decoders, programs |
| `@oobe-protocol-labs/synapse-client-sdk/ai/tools` | LangChain: `createSolanaTools`, protocol tools |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins` | `SynapseAgentKit` + all 5 plugins |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token` | `TokenPlugin` (22 tools) |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft` | `NFTPlugin` (19 tools) |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi` | `DeFiPlugin` (43 tools) |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc` | `MiscPlugin` (20 tools) |
| `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks` | `BlinksPlugin` (6 tools) |
| `@oobe-protocol-labs/synapse-client-sdk/ai/mcp` | `SynapseMcpServer` + `McpClientBridge` |
| `@oobe-protocol-labs/synapse-client-sdk/ai/gateway` | Gateway, sessions, pricing, x402 |
| `@oobe-protocol-labs/synapse-client-sdk/ai/intents` | Intent parser, planner, executor |
| `@oobe-protocol-labs/synapse-client-sdk/ai/sap` | Synapse Agent Protocol |
| `@oobe-protocol-labs/synapse-client-sdk/ai/actions` | Solana Actions / Blinks server |
| `@oobe-protocol-labs/synapse-client-sdk/ai/persistence` | State store (memory, file, redis) |
| `@oobe-protocol-labs/synapse-client-sdk/kit` | @solana/kit bridge |

---

## Quick Reference — Endpoints

| Region | Endpoint | Protocol | URL |
|--------|----------|----------|-----|
| US | Mainnet RPC | HTTPS | `https://us-1-mainnet.oobeprotocol.ai?api_key=KEY` |
| US | Mainnet WS | WSS | `wss://us-1-mainnet.oobeprotocol.ai/ws?api_key=KEY` |
| US | Mainnet gRPC | HTTPS | `https://us-1-mainnet.oobeprotocol.ai/grpc?api_key=KEY` |
| EU | Mainnet RPC | HTTPS | `https://staging.oobeprotocol.ai?api_key=KEY` |
| EU | Mainnet WS | WSS | `wss://staging.oobeprotocol.ai/ws?api_key=KEY` |
