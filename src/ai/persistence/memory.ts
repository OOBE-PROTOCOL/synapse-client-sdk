/**
 * @module ai/persistence/memory
 * @description In-memory persistence store for Synapse AI gateway data.
 *
 * Ideal for testing, local development, and single-process deployments
 * where external database infrastructure is unnecessary.
 *
 * Features:
 * - TTL support on generic key-value entries
 * - Optional max-entries eviction (FIFO)
 * - Full {@link PersistenceStore} API
 * - Drop-in `PersistenceAdapter` for {@link AgentRegistry}
 *
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { MemoryStore } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const store = new MemoryStore();
 * await store.connect();
 *
 * await store.saveAgent(gateway.snapshot());
 * const snap = await store.loadAgent('agent-1');
 * ```
 */

import type {
  PersistenceStore,
  MemoryStoreConfig,
  SetOptions,
  ListOptions,
  MetricQueryOpts,
  SessionRecord,
  ReceiptRecord,
  MetricPoint,
} from './types';
import type { GatewaySnapshot } from '../gateway/types';
import { serialize, deserialize } from './helpers';

/** @internal Entry in the generic KV store. */
interface KvEntry {
  json: string;
  expiresAt?: number;
}

/**
 * @description In-memory implementation of {@link PersistenceStore}.
 *
 * Data is stored in `Map` instances and does **not** survive process restarts.
 * TTL is checked lazily on read (no background timers).
 *
 * @since 1.2.2
 */
export class MemoryStore implements PersistenceStore {
  readonly name = 'memory';

  private readonly maxEntries: number;

  /* ── Storage maps ──────────────────────────────────────── */
  private readonly kv       = new Map<string, KvEntry>();
  private readonly agents   = new Map<string, GatewaySnapshot>();
  private readonly sessions = new Map<string, SessionRecord>();     // key = agentId:sessionId
  private readonly receipts = new Map<string, ReceiptRecord[]>();   // key = agentId
  private readonly metrics  = new Map<string, MetricPoint[]>();     // key = agentId:metricKey

  constructor(config: MemoryStoreConfig = {}) {
    this.maxEntries = config.maxEntries ?? 0;
  }

  /* ── Lifecycle ─────────────────────────────────────────── */

  async connect(): Promise<void> { /* no-op */ }
  async disconnect(): Promise<void> { /* no-op */ }
  async ping(): Promise<boolean> { return true; }

  /* ── Generic KV ────────────────────────────────────────── */

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.kv.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.kv.delete(key);
      return null;
    }
    return deserialize<T>(entry.json);
  }

  async set(key: string, value: unknown, opts?: SetOptions): Promise<void> {
    this.enforceEviction();
    const entry: KvEntry = { json: serialize(value) };
    if (opts?.ttl && opts.ttl > 0) {
      entry.expiresAt = Date.now() + opts.ttl * 1000;
    }
    this.kv.set(key, entry);
  }

  async del(key: string): Promise<boolean> {
    return this.kv.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.kv.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.kv.delete(key);
      return false;
    }
    return true;
  }

  /* ── Agents ────────────────────────────────────────────── */

  async saveAgent(snapshot: GatewaySnapshot): Promise<void> {
    this.agents.set(snapshot.agentId, snapshot);
  }

  async loadAgent(agentId: string): Promise<GatewaySnapshot | null> {
    return this.agents.get(agentId) ?? null;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    return this.agents.delete(agentId);
  }

  async listAgents(): Promise<string[]> {
    return [...this.agents.keys()];
  }

  /* ── Sessions ──────────────────────────────────────────── */

  async saveSession(record: SessionRecord): Promise<void> {
    this.sessions.set(`${record.agentId}:${record.id}`, record);
  }

  async loadSession(agentId: string, sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(`${agentId}:${sessionId}`) ?? null;
  }

  async deleteSessions(agentId: string): Promise<number> {
    const prefix = `${agentId}:`;
    let count = 0;
    for (const key of this.sessions.keys()) {
      if (key.startsWith(prefix)) {
        this.sessions.delete(key);
        count++;
      }
    }
    return count;
  }

  async listSessions(agentId: string, opts: ListOptions = {}): Promise<SessionRecord[]> {
    const prefix = `${agentId}:`;
    let results: SessionRecord[] = [];
    for (const [key, rec] of this.sessions) {
      if (key.startsWith(prefix)) {
        if (opts.status && rec.status !== opts.status) continue;
        results.push(rec);
      }
    }
    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt - a.createdAt);
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  /* ── Receipts ──────────────────────────────────────────── */

  async saveReceipt(record: ReceiptRecord): Promise<void> {
    const list = this.receipts.get(record.agentId) ?? [];
    list.push(record);
    this.receipts.set(record.agentId, list);
  }

  async listReceipts(agentId: string, opts: ListOptions = {}): Promise<ReceiptRecord[]> {
    const list = this.receipts.get(agentId) ?? [];
    // Sort by settledAt descending (most recent first)
    const sorted = [...list].sort((a, b) => b.settledAt - a.settledAt);
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? sorted.length;
    return sorted.slice(offset, offset + limit);
  }

  /* ── Metrics ───────────────────────────────────────────── */

  async recordMetric(
    agentId: string,
    key: string,
    value: number,
    labels?: Record<string, string>,
  ): Promise<void> {
    const mk = `${agentId}:${key}`;
    const list = this.metrics.get(mk) ?? [];
    list.push({ timestamp: Date.now(), value, labels });
    this.metrics.set(mk, list);
  }

  async queryMetrics(
    agentId: string,
    key: string,
    opts: MetricQueryOpts = {},
  ): Promise<MetricPoint[]> {
    const mk = `${agentId}:${key}`;
    let points = this.metrics.get(mk) ?? [];

    if (opts.from != null) points = points.filter(p => p.timestamp >= opts.from!);
    if (opts.to != null)   points = points.filter(p => p.timestamp <= opts.to!);

    // Most recent first
    points = [...points].sort((a, b) => b.timestamp - a.timestamp);
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
    this.agents.delete(agentId);
  }

  async keys(): Promise<string[]> {
    return this.listAgents();
  }

  /* ── Internals ─────────────────────────────────────────── */

  private enforceEviction(): void {
    if (this.maxEntries > 0 && this.kv.size >= this.maxEntries) {
      // FIFO: remove the oldest key
      const firstKey = this.kv.keys().next().value as string;
      if (firstKey) this.kv.delete(firstKey);
    }
  }
}
