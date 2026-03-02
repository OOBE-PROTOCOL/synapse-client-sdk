/**
 * @module ai/persistence
 * @description Synapse AI Persistence Layer — Redis, PostgreSQL, and in-memory
 * adapters for long-term storage of agent snapshots, sessions, receipts,
 * and metrics.
 *
 * ## Architecture
 *
 * All adapters implement the universal {@link PersistenceStore} interface
 * **and** the `PersistenceAdapter` interface from {@link AgentRegistry},
 * so they work everywhere:
 *
 * ```ts
 * // As a standalone store
 * const store = new RedisPersistence({ client: redis });
 * await store.saveAgent(snapshot);
 *
 * // As AgentRegistry backend
 * const registry = new AgentRegistry({ persistence: store });
 * ```
 *
 * ## Adapters
 *
 * | Adapter | Backing store | Best for |
 * |---|---|---|
 * | {@link MemoryStore} | In-process `Map` | Testing, dev, CLI tools |
 * | {@link RedisPersistence} | Redis / Valkey | Sessions, caching, pub/sub |
 * | {@link PostgresPersistence} | PostgreSQL | Analytics, receipts, audit |
 *
 * ## Dependency injection
 *
 * Redis and PostgreSQL adapters accept a pre-configured client instance
 * via their constructor config. No runtime dependencies are bundled —
 * install `ioredis` or `pg` as needed.
 *
 * @example Redis quick start
 * ```ts
 * import Redis from 'ioredis';
 * import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisPersistence({ client: redis, defaultTtl: 3600 });
 * await store.connect();
 *
 * await store.saveAgent(gateway.snapshot());
 * await store.saveSession(sessionRecord);
 * await store.recordMetric('agent-1', 'calls', 42);
 * ```
 *
 * @example PostgreSQL quick start
 * ```ts
 * import { Pool } from 'pg';
 * import { PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const store = new PostgresPersistence({ client: pool });
 * await store.connect(); // auto-creates tables
 *
 * await store.saveAgent(gateway.snapshot());
 * const receipts = await store.listReceipts('agent-1', { limit: 50 });
 * const stats = await store.getTableStats();
 * ```
 *
 * @example Dual-store pattern (Redis cache + PostgreSQL archive)
 * ```ts
 * import Redis from 'ioredis';
 * import { Pool } from 'pg';
 * import { RedisPersistence, PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const cache   = new RedisPersistence({ client: new Redis(), defaultTtl: 300 });
 * const archive = new PostgresPersistence({ client: new Pool() });
 * await Promise.all([cache.connect(), archive.connect()]);
 *
 * // Write to both, read from cache first
 * async function saveAgent(snapshot) {
 *   await Promise.all([cache.saveAgent(snapshot), archive.saveAgent(snapshot)]);
 * }
 *
 * async function loadAgent(id) {
 *   return (await cache.loadAgent(id)) ?? archive.loadAgent(id);
 * }
 * ```
 *
 * @since 1.2.2
 */

/* ── Types ───────────────────────────────────────────────────── */
export {
  PersistenceError,
  type PersistenceStore,
  type RedisLike,
  type PgLike,
  type SessionRecord,
  type ReceiptRecord,
  type MetricPoint,
  type SetOptions,
  type ListOptions,
  type MetricQueryOpts,
  type StoreConfig,
  type RedisStoreConfig,
  type PostgresStoreConfig,
  type MemoryStoreConfig,
} from './types';

/* ── Helpers ─────────────────────────────────────────────────── */
export {
  serialize,
  deserialize,
  buildKey,
  parseKey,
  extractAgentId,
  buildSchema,
  buildKvCleanupSql,
  SCHEMA_VERSION,
} from './helpers';

/* ── Adapters ────────────────────────────────────────────────── */
export { MemoryStore } from './memory';
export { RedisPersistence } from './redis';
export { PostgresPersistence } from './postgresql';
