# 01 — Core: Client, Transport, Types, Errors

> **Import**: `@oobe-protocol-labs/synapse-client-sdk`  
> **Source**: `src/core/`  
> **Prerequisites**: None — this module has zero external dependencies.

---

## Overview

The Core module provides three building blocks that every other module depends on:

1. **`SynapseClient`** — the top-level orchestrator that lazily initializes sub-clients
2. **`HttpTransport`** — the JSON-RPC 2.0 I/O layer with retry and timeout logic
3. **Branded types** — compile-time safe wrappers for Solana primitives

---

## SynapseClient

The main entry point for the SDK. Create one instance and use it everywhere.

### Creating a client

```ts
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';

const client = new SynapseClient({
  endpoint:     'https://rpc.synapse.com',
  apiKey:       'sk-your-key',          // sent as Bearer token
  timeout:      30_000,                 // ms, default 30s
  maxRetries:   3,                      // default 3
  debug:        false,                  // log every call + timing
  headers:      { 'x-custom': 'val' }, // extra HTTP headers
  wsEndpoint:   'wss://rpc.synapse.com',     // for .ws client
  grpcEndpoint: 'https://grpc.synapse.com',  // for .grpc client
});
```

### Configuration

```ts
interface SynapseClientConfig {
  endpoint:      string;                       // Required — RPC URL
  apiKey?:       string;                       // Bearer token
  timeout?:      number;                       // ms (default: 30_000)
  maxRetries?:   number;                       // default: 3
  debug?:        boolean;                      // default: false
  headers?:      Record<string, string>;       // additional HTTP headers
  wsEndpoint?:   string;                       // WebSocket URL for .ws
  grpcEndpoint?: string;                       // gRPC URL for .grpc
}
```

### Lazy sub-clients

Sub-clients are instantiated on **first property access**. If you never call `client.grpc`, no gRPC code is loaded:

```ts
// Only creates SolanaRpc on first .rpc access
const slot = await client.rpc.getSlot();

// Only creates WsClient on first .ws access
client.ws.onSlotChange((n) => console.log(n.slot));

// Only creates DasClient on first .das access
const asset = await client.das.getAsset(assetId);
```

| Property | Type | What it does |
|----------|------|-------------|
| `.rpc` | `SolanaRpc` | 53 typed JSON-RPC methods |
| `.das` | `DasClient` | Metaplex Digital Asset Standard queries |
| `.ws` | `WsClient` | 6 PubSub subscriptions with auto-reconnect |
| `.grpc` | `GrpcTransport` | Geyser streaming and parser |
| `.accounts` | `AccountsClient` | Fetch + decode in one call |
| `.kitRpc` | `Rpc<SolanaRpcApi>` | `@solana/kit` native RPC client |
| `.kitSubs` | `RpcSubscriptions<…>` | `@solana/kit` native subscriptions |

### Methods

```ts
// Raw RPC call — escape hatch for methods not yet typed
const result = await client.call<number>('getSlot');

// Batch — multiple calls in one HTTP request
const [slot, height] = await client.batch<[number, number]>([
  { method: 'getSlot' },
  { method: 'getBlockHeight' },
]);

// Get the underlying transport (for factory functions)
const transport = client.getTransport();

// Clean up WebSocket + gRPC connections
client.destroy();
```

### Static factories

```ts
// Create from network + region config
const client = SynapseClient.fromEndpoint({
  network: 'mainnet-beta',
  region: 'us-east',
  apiKey: 'sk-...',
});
```

### `SynapseClientLike` — for dependency injection

All SDK factory functions accept `SynapseClientLike` instead of the full `SynapseClient`. This lets you pass mocks in tests:

```ts
interface SynapseClientLike {
  readonly transport: HttpTransport;
}

// In production
const tools = createExecutableSolanaTools(client.getTransport());

// In tests — just pass a mock transport
const mockTransport = { request: vi.fn(), batch: vi.fn() } as any;
const tools = createExecutableSolanaTools(mockTransport);
```

---

## HttpTransport

Low-level JSON-RPC 2.0 I/O. You don't usually create this directly — `SynapseClient` does it for you. But you can if you want a lightweight setup:

```ts
import { HttpTransport } from '@oobe-protocol-labs/synapse-client-sdk';

const transport = new HttpTransport({
  endpoint:   'https://rpc.synapse.com',
  apiKey:     'sk-your-key',
  timeout:    30_000,
  maxRetries: 3,
});

// Single call
const slot = await transport.request<number>('getSlot');

// Batch call — one HTTP request, multiple RPC calls
const [slot2, height] = await transport.batch<[number, number]>([
  { method: 'getSlot' },
  { method: 'getBlockHeight' },
]);
```

### Per-call overrides

You can override timeout, retries, and commitment per call:

```ts
const result = await transport.request<number>('getSlot', [], {
  timeout:    60_000,           // override timeout
  maxRetries: 5,                // override retries
  commitment: 'finalized',     // override commitment
});
```

### `CallOptions`

```ts
interface CallOptions {
  timeout?:    number;                    // ms
  maxRetries?: number;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  routeHint?:  'rotate' | 'sticky';      // upstream routing
  routeIndex?: number;                     // specific upstream
}
```

### Retry behavior

On a `-32601` (method not found) error, the transport automatically rotates to the next upstream endpoint. All other errors are retried with the same endpoint up to `maxRetries` times.

---

## Branded Types

The SDK uses **nominal typing** (branded types) to prevent common mistakes at compile time:

```ts
import { Pubkey, Sig, Slot, Epoch, Lamports, UnixTs } from '@oobe-protocol-labs/synapse-client-sdk';

const pk  = Pubkey('So11111111111111111111111111111111111111112');
const sig = Sig('5VERv8NMhGvR....');
const s   = Slot(250_000_000);
const e   = Epoch(600);
const bal = Lamports(1_000_000_000n);    // bigint
const ts  = UnixTs(1709500000);
```

### Why branded types?

Without branding, all Solana identifiers are just `string`. This compiles fine but is wrong:

```ts
// ❌ No branding — compiles but is a bug
function getBalance(pubkey: string): Promise<number>;
getBalance(txSignature);  // passes a signature where a pubkey is expected!

// ✅ With branding — TypeScript error at compile time
function getBalance(pubkey: Pubkey): Promise<Lamports>;
getBalance(Sig('5VERv...')); // TS Error: Argument of type 'Signature' is not assignable to 'Pubkey'
```

### Type table

| Type | Underlying | Constructor | Example |
|------|-----------|------------|---------|
| `Pubkey` | `string` (base58) | `Pubkey(v)` | `Pubkey('So111...')` |
| `Signature` | `string` (base58) | `Sig(v)` | `Sig('5VERv...')` |
| `Slot` | `number` | `Slot(v)` | `Slot(250_000_000)` |
| `Epoch` | `number` | `Epoch(v)` | `Epoch(600)` |
| `Lamports` | `bigint` | `Lamports(v)` | `Lamports(1_000_000_000n)` |
| `UnixTimestamp` | `number` | `UnixTs(v)` | `UnixTs(1709500000)` |
| `Base58` | `string` | — | Base type for Pubkey/Signature |

### How it works

```ts
// The brand is a phantom property — zero runtime cost
type Brand<T, B extends string> = T & { readonly [__brand]: B };
type Pubkey = Brand<string, 'Pubkey'>;

// Smart constructors are identity functions (no runtime overhead)
const Pubkey = (v: string): Pubkey => v as Pubkey;
```

---

## RPC Response Types

These types are used across all RPC methods. See [02_RPC.md](./02_RPC.md) for the full method table.

### `RpcContext<T>` — Solana's standard context wrapper

```ts
interface RpcContext<T> {
  context: {
    slot: Slot;
    apiVersion?: string;
  };
  value: T;
}

// Usage
const { context, value: balance } = await client.rpc.getBalance(Pubkey('...'));
console.log(`Balance at slot ${context.slot}: ${balance}`);
```

### `AccountInfo<D>`

```ts
interface AccountInfo<D = string> {
  data:       D;
  executable: boolean;
  lamports:   Lamports;
  owner:      Pubkey;
  rentEpoch:  Epoch;
  space:      number;
}
```

### `ConfirmedTransaction`

```ts
interface ConfirmedTransaction {
  slot:      Slot;
  meta:      TransactionMeta | null;
  transaction: unknown;
  blockTime: UnixTimestamp | null;
  version?:  number | 'legacy';
}

interface TransactionMeta {
  err:                  unknown;
  fee:                  number;
  preBalances:          number[];
  postBalances:         number[];
  logMessages?:         string[];
  innerInstructions?:   unknown[];
  computeUnitsConsumed?: number;
}
```

### `TokenAmount`

```ts
interface TokenAmount {
  amount:         string;     // raw integer string
  decimals:       number;
  uiAmount:       number | null;
  uiAmountString: string;
}
```

### Account filters

```ts
type MemcmpFilter   = { memcmp: { offset: number; bytes: string; encoding?: Encoding } };
type DataSizeFilter  = { dataSize: number };
type AccountFilter   = MemcmpFilter | DataSizeFilter;
```

### Commitment & Encoding

```ts
type Commitment = 'processed' | 'confirmed' | 'finalized';
type Encoding   = 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
```

---

## Errors

All errors extend `SynapseError` and include a numeric `code` and optional `data`:

```ts
class SynapseError extends Error {
  readonly code: number;
  readonly data?: unknown;
}
```

| Error | Code | Thrown when |
|-------|------|------------|
| `SynapseError` | -32000 | Base class (don't throw directly) |
| `NetworkError` | -32001 | DNS failure, TCP reset, non-200 HTTP |
| `TimeoutError` | -32002 | `AbortController` fires |
| `RpcMethodNotFoundError` | -32601 | RPC method doesn't exist on endpoint |
| `UpstreamError` | varies | Upstream provider returned an error |

### Error handling patterns

```ts
try {
  const balance = await client.rpc.getBalance(Pubkey('...'));
} catch (err) {
  if (err instanceof TimeoutError) {
    // Retry with longer timeout
    const balance = await client.rpc.getBalance(Pubkey('...'), { timeout: 60_000 });
  } else if (err instanceof UpstreamError) {
    // Log which upstream failed
    console.error(`${err.upstreamName} at ${err.upstreamUrl} failed: ${err.message}`);
  } else if (err instanceof NetworkError) {
    // Check internet connectivity
  } else if (err instanceof SynapseError) {
    // Generic RPC error
    console.error(`Error ${err.code}: ${err.message}`, err.data);
  }
}
```

---

## Best Practices

### 1. Create one client, share everywhere

```ts
// ✅ Good — one client, reused across your app
const client = new SynapseClient({ endpoint, apiKey });
export default client;

// ❌ Bad — creating multiple clients wastes connections
app.get('/api', async (req, res) => {
  const client = new SynapseClient({ endpoint });  // wasteful!
  const slot = await client.rpc.getSlot();
});
```

### 2. Use `batch()` for multiple queries

```ts
// ❌ Slow — 3 sequential HTTP requests
const slot    = await client.rpc.getSlot();
const height  = await client.rpc.getBlockHeight();
const epoch   = await client.rpc.getEpochInfo();

// ✅ Fast — 1 HTTP request with 3 RPC calls
const [slot, height, epoch] = await client.batch<[number, number, EpochInfo]>([
  { method: 'getSlot' },
  { method: 'getBlockHeight' },
  { method: 'getEpochInfo' },
]);
```

### 3. Always call `destroy()` on shutdown

```ts
process.on('SIGTERM', () => {
  client.destroy();  // closes WebSocket + gRPC connections
  process.exit(0);
});
```

### 4. Use subpath imports for smaller bundles

```ts
// ❌ Imports everything (~full SDK)
import { SynapseClient, decodeTokenAccount, SystemProgram } from '@oobe-protocol-labs/synapse-client-sdk';

// ✅ Imports only what you need
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { decodeTokenAccount } from '@oobe-protocol-labs/synapse-client-sdk/decoders/token';
import { SystemProgram } from '@oobe-protocol-labs/synapse-client-sdk/programs/system';
```

### 5. Enable `debug: true` in development

```ts
const client = new SynapseClient({
  endpoint,
  debug: true,  // logs every RPC call with method, params, timing
});
// → [Synapse] getSlot() → 250000000 (23ms)
// → [Synapse] getBalance(So111...) → 1500000000 (45ms)
```

### 6. Prefer branded types everywhere

```ts
// ❌ Untyped — runtime bugs
const balance = await getBalance('5VERv8NMhGvR....');  // oops, that's a signature

// ✅ Typed — caught at compile time
const balance = await getBalance(Pubkey('So111...'));
```

---

## Next Steps

- **[02_RPC.md](./02_RPC.md)** — Full reference for all 53 RPC methods
- **[03_AI_TOOLS.md](./03_AI_TOOLS.md)** — Create LangChain tools from the client
