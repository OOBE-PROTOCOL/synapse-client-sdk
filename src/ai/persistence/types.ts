/**
 * @module ai/persistence/types
 * @description Core type definitions for the Synapse AI persistence layer.
 *
 * Defines the universal {@link PersistenceStore} interface and all associated
 * data records, configuration objects, and client abstractions.
 *
 * The generic client interfaces ({@link RedisLike}, {@link PgLike}) use
 * dependency-injection: you create the client with your preferred library
 * (ioredis, node-redis, pg, @vercel/postgres, @neondatabase/serverless, …)
 * and pass the instance to the adapter constructor.
 *
 * @since 1.2.2
 */

import type { GatewaySnapshot } from '../gateway/types';

/* ═══════════════════════════════════════════════════════════════
 *  Error
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error thrown by any persistence store operation.
 * @since 1.2.2
 */
export class PersistenceError extends Error {
  constructor(
    message: string,
    /** Machine-readable error code (e.g. `'CONN_FAILED'`, `'QUERY_ERROR'`). */
    public readonly code: string,
    /** The underlying error from the database driver, if any. */
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PersistenceError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Generic client interfaces (DI)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Minimal interface a Redis-compatible client must satisfy.
 *
 * Compatible with:
 * - **ioredis** (`new Redis()`)
 * - **node-redis v4** (`createClient()`)
 * - **@upstash/redis** (REST-based)
 * - Any client exposing the same method signatures
 *
 * @since 1.2.2
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

/**
 * @description Minimal interface a PostgreSQL-compatible client must satisfy.
 *
 * Compatible with:
 * - **pg** (`new Pool()` or `new Client()`)
 * - **@vercel/postgres** (`sql` tagged template or pool)
 * - **@neondatabase/serverless** (`neon()`)
 * - Any client exposing a `.query()` method
 *
 * @since 1.2.2
 */
export interface PgLike {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  /** Optional — some pool implementations don't expose `end()`. */
  end?(): Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Data records (JSON-safe — no BigInt)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description JSON-safe session record for persistence.
 * All `BigInt` fields are stored as decimal strings.
 * @since 1.2.2
 */
export interface SessionRecord {
  /** Session unique ID. */
  id: string;
  /** Owning agent ID. */
  agentId: string;
  /** Lifecycle status (`active`, `settled`, `expired`, …). */
  status: string;
  /** Buyer agent ID. */
  buyer: string;
  /** Seller agent ID. */
  seller: string;
  /** Pricing tier ID. */
  tierId: string;
  /** Payment-intent nonce. */
  intentNonce: string;
  /** Remaining budget (smallest token unit, as string). */
  budgetRemaining: string;
  /** Total budget allocated at session start (as string). */
  budgetTotal: string;
  /** Number of calls made. */
  callsMade: number;
  /** Calls remaining (−1 = unlimited). */
  callsRemaining: number;
  /** Per-method call counts. */
  methodCounts: Record<string, number>;
  /** Arbitrary session metadata. */
  metadata: Record<string, unknown>;
  /** Unix timestamp of creation (ms). */
  createdAt: number;
  /** Unix timestamp of last activity (ms). */
  lastActivityAt: number;
  /** Session TTL in seconds. */
  ttl: number;
}

/**
 * @description JSON-safe payment receipt for persistence.
 * @since 1.2.2
 */
export interface ReceiptRecord {
  /** Receipt unique ID. */
  id: string;
  /** Agent that issued the receipt. */
  agentId: string;
  /** Session this receipt belongs to. */
  sessionId?: string;
  /** Payment-intent nonce. */
  intentNonce: string;
  /** Amount actually charged (smallest unit, as string). */
  amountCharged: string;
  /** Total calls billed in this receipt. */
  callCount: number;
  /** On-chain tx signature, or `null` for off-chain. */
  txSignature: string | null;
  /** Settlement method (`onchain`, `offchain-escrow`, `streaming`). */
  settlement: string;
  /** Unix timestamp of settlement (ms). */
  settledAt: number;
}

/**
 * @description A single metric data point.
 * @since 1.2.2
 */
export interface MetricPoint {
  /** Unix timestamp (ms). */
  timestamp: number;
  /** Numeric value. */
  value: number;
  /** Optional labels for grouping/filtering. */
  labels?: Record<string, string>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Options
 * ═══════════════════════════════════════════════════════════════ */

/** Options for {@link PersistenceStore.set}. */
export interface SetOptions {
  /** TTL in seconds (0 or `undefined` = no expiry). */
  ttl?: number;
}

/** Options for list queries (sessions, receipts). */
export interface ListOptions {
  /** Max results to return. */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
  /** Filter by status (sessions only). */
  status?: string;
}

/** Options for metric queries. */
export interface MetricQueryOpts {
  /** Start timestamp (inclusive, ms). */
  from?: number;
  /** End timestamp (inclusive, ms). */
  to?: number;
  /** Max points to return (most recent first). */
  limit?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Store configurations
 * ═══════════════════════════════════════════════════════════════ */

/** Base configuration shared by all stores. */
export interface StoreConfig {
  /**
   * Key/table prefix. Default: `'synapse'`.
   * - Redis keys: `{prefix}:agent:{id}`, `{prefix}:session:{agentId}:{id}`, …
   * - PostgreSQL tables: `{prefix}_agents`, `{prefix}_sessions`, …
   */
  keyPrefix?: string;
}

/** Configuration for {@link RedisPersistence}. */
export interface RedisStoreConfig extends StoreConfig {
  /** Pre-configured Redis-compatible client instance. */
  client: RedisLike;
  /** Default TTL in seconds for stored values (0 = no expiry). Default: `0`. */
  defaultTtl?: number;
}

/** Configuration for {@link PostgresPersistence}. */
export interface PostgresStoreConfig extends StoreConfig {
  /** Pre-configured PostgreSQL-compatible client/pool instance. */
  client: PgLike;
  /** Run schema migrations automatically on `connect()`. Default: `true`. */
  autoMigrate?: boolean;
}

/** Configuration for {@link MemoryStore}. */
export interface MemoryStoreConfig extends StoreConfig {
  /** Maximum entries before oldest are evicted (0 = unlimited). Default: `0`. */
  maxEntries?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  PersistenceStore — main interface
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Universal persistence store for Synapse AI gateway data.
 *
 * Three built-in implementations:
 * | Store | Best for |
 * |---|---|
 * | {@link MemoryStore} | Testing, dev, single-process |
 * | {@link RedisPersistence} | Sessions, caching, pub/sub, replicas |
 * | {@link PostgresPersistence} | Long-term analytics, receipts, audit |
 *
 * All implementations also satisfy the `PersistenceAdapter` interface
 * from {@link AgentRegistry}, so they can be used as drop-in replacements:
 *
 * ```ts
 * const store = new RedisPersistence({ client: redis });
 * const registry = new AgentRegistry({ persistence: store });
 * ```
 *
 * @since 1.2.2
 */
export interface PersistenceStore {
  /** Store identifier (e.g. `'memory'`, `'redis'`, `'postgresql'`). */
  readonly name: string;

  /* ── Lifecycle ─────────────────────────────────────────── */

  /** Establish connection / run migrations. Idempotent. */
  connect(): Promise<void>;
  /** Gracefully disconnect from the backing store. */
  disconnect(): Promise<void>;
  /** Health check — returns `true` if the store is reachable. */
  ping(): Promise<boolean>;

  /* ── Generic key-value ─────────────────────────────────── */

  /** Retrieve a value by key. Returns `null` if not found or expired. */
  get<T = unknown>(key: string): Promise<T | null>;
  /** Store a value by key with optional TTL. */
  set(key: string, value: unknown, opts?: SetOptions): Promise<void>;
  /** Delete a key. Returns `true` if the key existed. */
  del(key: string): Promise<boolean>;
  /** Check if a key exists (and is not expired). */
  has(key: string): Promise<boolean>;

  /* ── Agent snapshots ───────────────────────────────────── */

  /** Persist an agent's {@link GatewaySnapshot}. */
  saveAgent(snapshot: GatewaySnapshot): Promise<void>;
  /** Load an agent snapshot by ID. */
  loadAgent(agentId: string): Promise<GatewaySnapshot | null>;
  /** Delete an agent snapshot. Returns `true` if it existed. */
  deleteAgent(agentId: string): Promise<boolean>;
  /** List all persisted agent IDs. */
  listAgents(): Promise<string[]>;

  /* ── Sessions ──────────────────────────────────────────── */

  /** Persist a session record. */
  saveSession(record: SessionRecord): Promise<void>;
  /** Load a session by agent ID + session ID. */
  loadSession(agentId: string, sessionId: string): Promise<SessionRecord | null>;
  /** Delete all sessions for an agent. Returns the count deleted. */
  deleteSessions(agentId: string): Promise<number>;
  /** List sessions for an agent with optional filtering. */
  listSessions(agentId: string, opts?: ListOptions): Promise<SessionRecord[]>;

  /* ── Receipts ──────────────────────────────────────────── */

  /** Persist a payment receipt. */
  saveReceipt(record: ReceiptRecord): Promise<void>;
  /** List receipts for an agent with pagination. */
  listReceipts(agentId: string, opts?: ListOptions): Promise<ReceiptRecord[]>;

  /* ── Metrics ───────────────────────────────────────────── */

  /** Record a numeric metric data point. */
  recordMetric(agentId: string, key: string, value: number, labels?: Record<string, string>): Promise<void>;
  /** Query metric points with optional time range and limit. */
  queryMetrics(agentId: string, key: string, opts?: MetricQueryOpts): Promise<MetricPoint[]>;

  /* ── PersistenceAdapter compatibility ──────────────────── */
  /* These methods satisfy the PersistenceAdapter interface   */
  /* from AgentRegistry, enabling drop-in usage.              */

  /** Alias for `saveAgent()`. Satisfies `PersistenceAdapter.save()`. */
  save(agentId: string, snapshot: GatewaySnapshot): Promise<void>;
  /** Alias for `loadAgent()`. Satisfies `PersistenceAdapter.load()`. */
  load(agentId: string): Promise<GatewaySnapshot | null>;
  /** Alias for `deleteAgent()`. Satisfies `PersistenceAdapter.delete()`. */
  delete(agentId: string): Promise<void>;
  /** Alias for `listAgents()`. Satisfies `PersistenceAdapter.keys()`. */
  keys(): Promise<string[]>;
}
