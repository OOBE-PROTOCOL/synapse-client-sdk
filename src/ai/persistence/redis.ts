/**
 * @module ai/persistence/redis
 * @description Redis persistence adapter for Synapse AI gateway data.
 *
 * Stores agent snapshots, sessions, receipts, metrics, and arbitrary
 * key-value data in Redis using JSON serialization and configurable
 * key prefixing.
 *
 * Bring your own Redis client — the adapter works with any library
 * that satisfies the {@link RedisLike} interface:
 * - **ioredis** (`new Redis()`)
 * - **node-redis v4** (`createClient()`)
 * - **@upstash/redis** (REST-based, partial)
 *
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import Redis from 'ioredis';
 * import { RedisPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const store = new RedisPersistence({ client: redis });
 * await store.connect();
 *
 * await store.saveAgent(gateway.snapshot());
 * await store.saveSession(sessionRecord);
 *
 * // Drop-in for AgentRegistry:
 * const registry = new AgentRegistry({ persistence: store });
 * ```
 */

import type {
  PersistenceStore,
  RedisStoreConfig,
  RedisLike,
  SetOptions,
  ListOptions,
  MetricQueryOpts,
  SessionRecord,
  ReceiptRecord,
  MetricPoint,
} from './types';
import { PersistenceError } from './types';
import type { GatewaySnapshot } from '../gateway/types';
import { serialize, deserialize, buildKey } from './helpers';

/**
 * @description Redis implementation of {@link PersistenceStore}.
 *
 * Key layout (default prefix `synapse`):
 * ```
 * synapse:kv:{key}                       → generic KV
 * synapse:agent:{agentId}                → agent snapshot JSON
 * synapse:session:{agentId}:{sessionId}  → session record JSON
 * synapse:receipts:{agentId}             → JSON array of receipts
 * synapse:metrics:{agentId}:{metricKey}  → JSON array of MetricPoint
 * ```
 *
 * @since 1.2.2
 */
export class RedisPersistence implements PersistenceStore {
  readonly name = 'redis';

  private readonly client: RedisLike;
  private readonly prefix: string;
  private readonly defaultTtl: number;

  constructor(config: RedisStoreConfig) {
    this.client = config.client;
    this.prefix = config.keyPrefix ?? 'synapse';
    this.defaultTtl = config.defaultTtl ?? 0;
  }

  /* ── Lifecycle ─────────────────────────────────────────── */

  async connect(): Promise<void> {
    try {
      await this.client.ping();
    } catch (err) {
      throw new PersistenceError('Failed to connect to Redis', 'CONN_FAILED', err);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Swallow — already disconnected
    }
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG' || res === 'pong';
    } catch {
      return false;
    }
  }

  /* ── Generic KV ────────────────────────────────────────── */

  private kvKey(key: string): string {
    return buildKey(this.prefix, 'kv', key);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(this.kvKey(key));
    return raw ? deserialize<T>(raw) : null;
  }

  async set(key: string, value: unknown, opts?: SetOptions): Promise<void> {
    const k = this.kvKey(key);
    await this.client.set(k, serialize(value));
    const ttl = opts?.ttl ?? this.defaultTtl;
    if (ttl > 0) await this.client.expire(k, ttl);
  }

  async del(key: string): Promise<boolean> {
    const n = await this.client.del(this.kvKey(key));
    return n > 0;
  }

  async has(key: string): Promise<boolean> {
    const n = await this.client.exists(this.kvKey(key));
    return n > 0;
  }

  /* ── Agents ────────────────────────────────────────────── */

  private agentKey(agentId: string): string {
    return buildKey(this.prefix, 'agent', agentId);
  }

  async saveAgent(snapshot: GatewaySnapshot): Promise<void> {
    const k = this.agentKey(snapshot.agentId);
    await this.client.set(k, serialize(snapshot));
    if (this.defaultTtl > 0) await this.client.expire(k, this.defaultTtl);
  }

  async loadAgent(agentId: string): Promise<GatewaySnapshot | null> {
    const raw = await this.client.get(this.agentKey(agentId));
    return raw ? deserialize<GatewaySnapshot>(raw) : null;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    const n = await this.client.del(this.agentKey(agentId));
    return n > 0;
  }

  async listAgents(): Promise<string[]> {
    const pattern = buildKey(this.prefix, 'agent', '*');
    const keys = await this.client.keys(pattern);
    const prefixLen = buildKey(this.prefix, 'agent', '').length;
    return keys.map(k => k.slice(prefixLen));
  }

  /* ── Sessions ──────────────────────────────────────────── */

  private sessionKey(agentId: string, sessionId: string): string {
    return buildKey(this.prefix, 'session', agentId, sessionId);
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const k = this.sessionKey(record.agentId, record.id);
    await this.client.set(k, serialize(record));
    // Auto-expire sessions based on their TTL
    if (record.ttl > 0) await this.client.expire(k, record.ttl);
  }

  async loadSession(agentId: string, sessionId: string): Promise<SessionRecord | null> {
    const raw = await this.client.get(this.sessionKey(agentId, sessionId));
    return raw ? deserialize<SessionRecord>(raw) : null;
  }

  async deleteSessions(agentId: string): Promise<number> {
    const pattern = buildKey(this.prefix, 'session', agentId, '*');
    const keys = await this.client.keys(pattern);
    let count = 0;
    for (const k of keys) {
      count += await this.client.del(k);
    }
    return count;
  }

  async listSessions(agentId: string, opts: ListOptions = {}): Promise<SessionRecord[]> {
    const pattern = buildKey(this.prefix, 'session', agentId, '*');
    const keys = await this.client.keys(pattern);
    let records: SessionRecord[] = [];
    for (const k of keys) {
      const raw = await this.client.get(k);
      if (raw) {
        const rec = deserialize<SessionRecord>(raw);
        if (opts.status && rec.status !== opts.status) continue;
        records.push(rec);
      }
    }
    records.sort((a, b) => b.createdAt - a.createdAt);
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? records.length;
    return records.slice(offset, offset + limit);
  }

  /* ── Receipts ──────────────────────────────────────────── */

  private receiptsKey(agentId: string): string {
    return buildKey(this.prefix, 'receipts', agentId);
  }

  async saveReceipt(record: ReceiptRecord): Promise<void> {
    const k = this.receiptsKey(record.agentId);
    const raw = await this.client.get(k);
    const list: ReceiptRecord[] = raw ? deserialize<ReceiptRecord[]>(raw) : [];
    list.push(record);
    await this.client.set(k, serialize(list));
  }

  async listReceipts(agentId: string, opts: ListOptions = {}): Promise<ReceiptRecord[]> {
    const raw = await this.client.get(this.receiptsKey(agentId));
    if (!raw) return [];
    const list = deserialize<ReceiptRecord[]>(raw);
    const sorted = list.sort((a, b) => b.settledAt - a.settledAt);
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? sorted.length;
    return sorted.slice(offset, offset + limit);
  }

  /* ── Metrics ───────────────────────────────────────────── */

  private metricsKey(agentId: string, key: string): string {
    return buildKey(this.prefix, 'metrics', agentId, key);
  }

  async recordMetric(
    agentId: string,
    key: string,
    value: number,
    labels?: Record<string, string>,
  ): Promise<void> {
    const k = this.metricsKey(agentId, key);
    const raw = await this.client.get(k);
    const list: MetricPoint[] = raw ? deserialize<MetricPoint[]>(raw) : [];
    list.push({ timestamp: Date.now(), value, labels });
    // Keep last 10 000 points per metric key (prevent unbounded growth)
    if (list.length > 10_000) list.splice(0, list.length - 10_000);
    await this.client.set(k, serialize(list));
  }

  async queryMetrics(
    agentId: string,
    key: string,
    opts: MetricQueryOpts = {},
  ): Promise<MetricPoint[]> {
    const raw = await this.client.get(this.metricsKey(agentId, key));
    if (!raw) return [];
    let points = deserialize<MetricPoint[]>(raw);

    if (opts.from != null) points = points.filter(p => p.timestamp >= opts.from!);
    if (opts.to != null)   points = points.filter(p => p.timestamp <= opts.to!);
    points.sort((a, b) => b.timestamp - a.timestamp);
    if (opts.limit != null) points = points.slice(0, opts.limit);

    return points;
  }

  /* ── PersistenceAdapter compat ─────────────────────────── */

  async save(agentId: string, snapshot: GatewaySnapshot): Promise<void> {
    return this.saveAgent(snapshot);
  }

  async load(agentId: string): Promise<GatewaySnapshot | null> {
    return this.loadAgent(agentId);
  }

  async delete(agentId: string): Promise<void> {
    await this.deleteAgent(agentId);
  }

  async keys(): Promise<string[]> {
    return this.listAgents();
  }
}
