# 08 — Persistence: Storage Adapters for Sessions, Receipts & Metrics

> **Import**: `@…/synapse-client-sdk/ai/persistence`  
> **Source**: `src/ai/persistence/`  
> **Prerequisites**: [04_AI_GATEWAY.md](./04_AI_GATEWAY.md) — persistence stores are used by AgentGateway, PricingEngine, and ToolMarketplace.

---

## Overview

Persistence stores provide a uniform key-value interface for storing agent sessions, payment receipts, and metrics. The SDK ships with three backends:

| Store | Best for | External dependency |
|-------|---------|-------------------|
| `MemoryStore` | Development, testing, prototyping | None |
| `RedisPersistence` | Production — fast, distributed | `ioredis` (peer dep) |
| `PostgresPersistence` | Production — durable, queryable | `pg` (peer dep) |

All three implement the same `PersistenceStore` interface, so you can swap backends without changing any other code.

---

## Quick Start

### Memory (zero-config)

```ts
import { MemoryStore } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

const store = new MemoryStore();
await store.set('session:abc', { id: 'abc', status: 'active' });
const session = await store.get('session:abc');
```

### Redis

```ts
import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');
const store = new RedisPersistence(redis, { prefix: 'synapse:' });

await store.set('session:abc', { id: 'abc', status: 'active' }, { ttl: 3600 });
```

### PostgreSQL

```ts
import { PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
import { Pool } from 'pg';

const pool  = new Pool({ connectionString: 'postgresql://...' });
const store = new PostgresPersistence(pool, { tableName: 'synapse_kv' });

// Auto-creates the table on first use
await store.set('session:abc', { id: 'abc', status: 'active' });
```

---

## PersistenceStore Interface

All stores implement this interface:

```ts
interface PersistenceStore {
  // Core CRUD
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: SetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;

  // Batch operations
  getMany<T = any>(keys: string[]): Promise<Map<string, T>>;
  setMany<T = any>(entries: Array<{ key: string; value: T; options?: SetOptions }>): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;

  // Query
  keys(pattern?: string): Promise<string[]>;
  values<T = any>(pattern?: string): Promise<T[]>;
  entries<T = any>(pattern?: string): Promise<Map<string, T>>;
  count(pattern?: string): Promise<number>;

  // Lifecycle
  clear(): Promise<void>;
  close(): Promise<void>;
}

interface SetOptions {
  ttl?: number;    // Time-to-live in seconds (0 = no expiry)
}
```

> **Tip**: The `pattern` parameter supports glob-style matching: `session:*`, `receipt:agent-*`, etc.

---

## MemoryStore

In-memory Map-based store. Data is lost when the process exits.

```ts
import { MemoryStore } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

const store = new MemoryStore(config?: MemoryStoreConfig);
```

```ts
interface MemoryStoreConfig {
  maxSize?:   number;     // Max entries (default: 10_000)
  defaultTtl?: number;    // Default TTL in seconds (default: 0 = no expiry)
}
```

### When to use

- ✅ Local development
- ✅ Unit tests
- ✅ Quick prototyping
- ❌ Production (no persistence across restarts)
- ❌ Multi-instance deployments (no shared state)

### TTL handling

MemoryStore implements lazy TTL expiration — expired keys are evicted on access:

```ts
const store = new MemoryStore();
await store.set('temp', { data: 'hello' }, { ttl: 60 }); // Expires in 60s
// After 60 seconds:
await store.get('temp'); // → null
```

---

## RedisPersistence

Production-grade store backed by Redis.

```ts
import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

const store = new RedisPersistence(redisClient: RedisLike, config?: RedisConfig);
```

```ts
interface RedisConfig {
  prefix?:     string;    // Key prefix (default: 'synapse:')
  defaultTtl?: number;    // Default TTL in seconds (default: 0)
  serializer?: 'json' | 'msgpack';  // Value serialization (default: 'json')
}
```

### `RedisLike` interface

The store accepts any Redis client that implements this minimal interface:

```ts
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): any;
  quit(): Promise<any>;
}
```

> Compatible with: `ioredis`, `redis` (node-redis v4+), `@upstash/redis` (with adapter)

### Using with ioredis

```ts
import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6379');
const store = new RedisPersistence(redis, { prefix: 'myapp:' });

// All keys are automatically prefixed
await store.set('session:abc', data);
// Actually stored as 'myapp:session:abc' in Redis

// TTL uses Redis native EXPIRE
await store.set('temp', data, { ttl: 300 }); // 5-minute expiry
```

### Redis Cluster

```ts
import Redis from 'ioredis';

const cluster = new Redis.Cluster([
  { host: 'node1', port: 6379 },
  { host: 'node2', port: 6379 },
]);
const store = new RedisPersistence(cluster, { prefix: 'synapse:' });
```

---

## PostgresPersistence

Durable store backed by PostgreSQL with automatic table management.

```ts
import { PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

const store = new PostgresPersistence(pgClient: PgLike, config?: PgConfig);
```

```ts
interface PgConfig {
  tableName?:   string;    // Default: 'synapse_persistence'
  schema?:      string;    // Default: 'public'
  defaultTtl?:  number;    // Default TTL in seconds (default: 0)
}
```

### `PgLike` interface

```ts
interface PgLike {
  query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  end(): Promise<void>;
}
```

> Compatible with: `pg.Pool`, `pg.Client`, `@vercel/postgres`, `neon-serverless`

### Auto-created table schema

On first operation, the store creates:

```sql
CREATE TABLE IF NOT EXISTS synapse_persistence (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ          -- NULL = no expiry
);

CREATE INDEX IF NOT EXISTS idx_synapse_persistence_expires
  ON synapse_persistence (expires_at)
  WHERE expires_at IS NOT NULL;
```

### TTL handling

Postgres uses `expires_at` timestamps. Expired rows are filtered in queries and periodically cleaned:

```ts
const store = new PostgresPersistence(pool, {
  tableName: 'agent_data',
});

await store.set('session:abc', data, { ttl: 3600 }); // Expires in 1 hour
// Stored with expires_at = NOW() + INTERVAL '3600 seconds'
```

### Using with `pg`

```ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
const store = new PostgresPersistence(pool);
```

### Using with Vercel Postgres

```ts
import { sql } from '@vercel/postgres';

// Wrap @vercel/postgres in PgLike adapter
const adapter = {
  query: (text: string, values?: any[]) => sql.query(text, values),
  end: async () => {},
};
const store = new PostgresPersistence(adapter);
```

---

## Record Types

The SDK defines typed records for common data:

### SessionRecord

```ts
interface SessionRecord {
  id:           string;
  agentId:      string;
  buyerWallet:  string;
  status:       'pending' | 'active' | 'completed' | 'expired' | 'revoked';
  tierId:       string;
  callsUsed:    number;
  callsLimit:   number;
  createdAt:    number;     // Unix timestamp ms
  expiresAt:    number;
  metadata?:    Record<string, any>;
}
```

### ReceiptRecord

```ts
interface ReceiptRecord {
  id:           string;
  sessionId:    string;
  agentId:      string;
  buyerWallet:  string;
  amount:       bigint;
  token:        string;     // 'SOL', 'USDC', etc.
  txSignature:  string;     // Solana tx signature
  timestamp:    number;
  status:       'pending' | 'confirmed' | 'failed';
}
```

### MetricPoint

```ts
interface MetricPoint {
  name:       string;       // e.g., 'rpc.latency', 'session.created'
  value:      number;
  timestamp:  number;
  tags?:      Record<string, string>;
}
```

### Storing typed records

```ts
const store = new MemoryStore();

// Store a session
const session: SessionRecord = {
  id: 'sess-001',
  agentId: 'agent-abc',
  buyerWallet: 'BuyerPubkey...',
  status: 'active',
  tierId: 'standard',
  callsUsed: 0,
  callsLimit: 1000,
  createdAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};
await store.set(`session:${session.id}`, session);

// Query all sessions
const sessions = await store.values<SessionRecord>('session:*');
const activeSessions = sessions.filter(s => s.status === 'active');
```

---

## Dual-Store Pattern

Use Redis for hot data (sessions) and Postgres for cold data (receipts, audit log):

```ts
import { RedisPersistence, PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';
import Redis from 'ioredis';
import { Pool } from 'pg';

// Hot store: Redis (fast reads, auto-expiry)
const hotStore = new RedisPersistence(
  new Redis('redis://localhost:6379'),
  { prefix: 'hot:', defaultTtl: 3600 },
);

// Cold store: Postgres (durable, queryable)
const coldStore = new PostgresPersistence(
  new Pool({ connectionString: process.env.DATABASE_URL }),
  { tableName: 'agent_receipts' },
);

// Usage pattern
async function createSession(session: SessionRecord) {
  // Write to both
  await hotStore.set(`session:${session.id}`, session, { ttl: session.expiresAt - Date.now() / 1000 });
  await coldStore.set(`session:${session.id}`, session);
}

async function getSession(id: string) {
  // Try hot first
  let session = await hotStore.get<SessionRecord>(`session:${id}`);
  if (!session) {
    // Fall back to cold
    session = await coldStore.get<SessionRecord>(`session:${id}`);
  }
  return session;
}

async function storeReceipt(receipt: ReceiptRecord) {
  // Receipts are durable — only cold store
  await coldStore.set(`receipt:${receipt.id}`, receipt);
}
```

---

## Helper Functions

### `createPersistenceStore(type, config?)`

Factory function that creates the right store based on type:

```ts
import { createPersistenceStore } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

// Memory
const memStore = createPersistenceStore('memory');

// Redis
const redisStore = createPersistenceStore('redis', {
  client: redisClient,
  prefix: 'synapse:',
});

// Postgres
const pgStore = createPersistenceStore('postgres', {
  client: pgPool,
  tableName: 'synapse_data',
});
```

---

## Integration with Gateway

Pass persistence stores to `AgentGateway` and related components:

```ts
import { createAgentGateway, PricingEngine } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai/persistence';

const sessionStore  = new RedisPersistence(redis, { prefix: 'sessions:' });
const receiptStore  = new RedisPersistence(redis, { prefix: 'receipts:' });

const gateway = createAgentGateway(client, {
  identity:     myIdentity,
  defaultTiers: myTiers,
  persistence: {
    sessions: sessionStore,
    receipts: receiptStore,
  },
});
```

---

## Best Practices

1. **Use MemoryStore only for dev/test** — data is lost on restart
2. **Set TTLs for sessions** — avoid unbounded memory/storage growth
3. **Use key prefixes** — `session:`, `receipt:`, `metric:` — for clean querying
4. **Dual-store for production** — Redis for speed, Postgres for durability
5. **Close stores on shutdown** — call `store.close()` in your graceful shutdown handler
6. **Use `count()` before `values()`** — check size before loading all records into memory

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `get()` returns `null` for existing key | TTL expired | Check TTL value, use `has()` to verify |
| Redis connection refused | Redis not running or wrong URL | Check `redis://` connection string |
| Postgres table not created | Insufficient privileges | Grant `CREATE TABLE` permission |
| `keys('session:*')` returns empty | Wrong prefix | Check `RedisConfig.prefix` — it's prepended to all keys |
| Memory usage grows unboundedly | No TTL on MemoryStore | Set `maxSize` or `defaultTtl` |
| `close()` hangs | Active queries | Await all operations before closing |

---

## Next Steps

- **[04_AI_GATEWAY.md](./04_AI_GATEWAY.md)** — Use stores with the commerce gateway
- **[05_SAP.md](./05_SAP.md)** — `OnChainPersistenceAdapter` for on-chain storage
- **[09_PIPELINES.md](./09_PIPELINES.md)** — Full production integration patterns
