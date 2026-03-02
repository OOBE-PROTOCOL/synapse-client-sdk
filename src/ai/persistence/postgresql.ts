/**
 * @module ai/persistence/postgresql
 * @description PostgreSQL persistence adapter for Synapse AI gateway data.
 *
 * Stores agent snapshots, sessions, receipts, and metric time-series in
 * PostgreSQL using JSONB columns, with automatic schema migration on
 * first `connect()`.
 *
 * Bring your own client — the adapter works with any library that satisfies
 * the {@link PgLike} interface:
 * - **pg** (`new Pool()` or `new Client()`)
 * - **@vercel/postgres** (`createPool()`)
 * - **@neondatabase/serverless** (`neon()`)
 *
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { Pool } from 'pg';
 * import { PostgresPersistence } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const store = new PostgresPersistence({ client: pool });
 * await store.connect(); // runs migrations
 *
 * await store.saveAgent(gateway.snapshot());
 * const receipts = await store.listReceipts('agent-1', { limit: 50 });
 *
 * // Drop-in for AgentRegistry:
 * const registry = new AgentRegistry({ persistence: store });
 * ```
 */

import type {
  PersistenceStore,
  PostgresStoreConfig,
  PgLike,
  SetOptions,
  ListOptions,
  MetricQueryOpts,
  SessionRecord,
  ReceiptRecord,
  MetricPoint,
} from './types';
import { PersistenceError } from './types';
import type { GatewaySnapshot } from '../gateway/types';
import { serialize, deserialize, buildSchema, buildKvCleanupSql, SCHEMA_VERSION } from './helpers';

/**
 * @description PostgreSQL implementation of {@link PersistenceStore}.
 *
 * Table layout (default prefix `synapse`):
 * ```
 * synapse_agents          (agent_id PK, snapshot JSONB)
 * synapse_sessions        (agent_id + id PK, state JSONB, status)
 * synapse_receipts        (id PK, agent_id, receipt JSONB)
 * synapse_metrics         (id BIGSERIAL, agent_id, metric_key, value, labels, recorded_at)
 * synapse_kv              (key PK, value JSONB, expires_at)
 * synapse_schema_version  (version PK, applied_at)
 * ```
 *
 * @since 1.2.2
 */
export class PostgresPersistence implements PersistenceStore {
  readonly name = 'postgresql';

  private readonly client: PgLike;
  private readonly prefix: string;
  private readonly autoMigrate: boolean;
  private migrated = false;

  constructor(config: PostgresStoreConfig) {
    this.client = config.client;
    this.prefix = config.keyPrefix ?? 'synapse';
    this.autoMigrate = config.autoMigrate ?? true;
  }

  /* ── Lifecycle ─────────────────────────────────────────── */

  async connect(): Promise<void> {
    try {
      // Verify connection
      await this.client.query('SELECT 1');

      // Auto-migrate if enabled and not yet done
      if (this.autoMigrate && !this.migrated) {
        await this.migrate();
      }
    } catch (err) {
      throw new PersistenceError('Failed to connect to PostgreSQL', 'CONN_FAILED', err);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client.end) await this.client.end();
    } catch {
      // Swallow — already disconnected
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @description Run schema migrations.
   *
   * Called automatically on `connect()` if `autoMigrate` is `true` (default).
   * Safe to call multiple times — all DDL uses `IF NOT EXISTS`.
   *
   * @since 1.2.2
   */
  async migrate(): Promise<void> {
    try {
      const ddl = buildSchema(this.prefix);
      await this.client.query(ddl);
      this.migrated = true;
    } catch (err) {
      throw new PersistenceError('Schema migration failed', 'MIGRATION_FAILED', err);
    }
  }

  /* ── Generic KV ────────────────────────────────────────── */

  private t(name: string): string {
    return `${this.prefix}_${name}`;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const { rows } = await this.client.query<{ value: unknown }>(
      `SELECT value FROM ${this.t('kv')}
       WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [key],
    );
    if (rows.length === 0) return null;
    return rows[0].value as T;
  }

  async set(key: string, value: unknown, opts?: SetOptions): Promise<void> {
    const parsed = JSON.parse(serialize(value));
    const expiresAt = opts?.ttl && opts.ttl > 0
      ? new Date(Date.now() + opts.ttl * 1000).toISOString()
      : null;

    await this.client.query(
      `INSERT INTO ${this.t('kv')} (key, value, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [key, parsed, expiresAt],
    );
  }

  async del(key: string): Promise<boolean> {
    const { rowCount } = await this.client.query(
      `DELETE FROM ${this.t('kv')} WHERE key = $1`, [key],
    );
    return (rowCount ?? 0) > 0;
  }

  async has(key: string): Promise<boolean> {
    const { rows } = await this.client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ${this.t('kv')}
       WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [key],
    );
    return parseInt(rows[0]?.n ?? '0', 10) > 0;
  }

  /* ── Agents ────────────────────────────────────────────── */

  async saveAgent(snapshot: GatewaySnapshot): Promise<void> {
    const parsed = JSON.parse(serialize(snapshot));
    await this.client.query(
      `INSERT INTO ${this.t('agents')} (agent_id, snapshot, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (agent_id)
       DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()`,
      [snapshot.agentId, parsed],
    );
  }

  async loadAgent(agentId: string): Promise<GatewaySnapshot | null> {
    const { rows } = await this.client.query<{ snapshot: GatewaySnapshot }>(
      `SELECT snapshot FROM ${this.t('agents')} WHERE agent_id = $1`,
      [agentId],
    );
    return rows[0]?.snapshot ?? null;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    const { rowCount } = await this.client.query(
      `DELETE FROM ${this.t('agents')} WHERE agent_id = $1`, [agentId],
    );
    return (rowCount ?? 0) > 0;
  }

  async listAgents(): Promise<string[]> {
    const { rows } = await this.client.query<{ agent_id: string }>(
      `SELECT agent_id FROM ${this.t('agents')} ORDER BY created_at`,
    );
    return rows.map(r => r.agent_id);
  }

  /* ── Sessions ──────────────────────────────────────────── */

  async saveSession(record: SessionRecord): Promise<void> {
    const parsed = JSON.parse(serialize(record));
    await this.client.query(
      `INSERT INTO ${this.t('sessions')} (id, agent_id, state, status, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (agent_id, id)
       DO UPDATE SET state = EXCLUDED.state, status = EXCLUDED.status, updated_at = NOW()`,
      [record.id, record.agentId, parsed, record.status],
    );
  }

  async loadSession(agentId: string, sessionId: string): Promise<SessionRecord | null> {
    const { rows } = await this.client.query<{ state: SessionRecord }>(
      `SELECT state FROM ${this.t('sessions')} WHERE agent_id = $1 AND id = $2`,
      [agentId, sessionId],
    );
    return rows[0]?.state ?? null;
  }

  async deleteSessions(agentId: string): Promise<number> {
    const { rowCount } = await this.client.query(
      `DELETE FROM ${this.t('sessions')} WHERE agent_id = $1`, [agentId],
    );
    return rowCount ?? 0;
  }

  async listSessions(agentId: string, opts: ListOptions = {}): Promise<SessionRecord[]> {
    const conditions = ['agent_id = $1'];
    const params: unknown[] = [agentId];
    let paramIdx = 2;

    if (opts.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(opts.status);
    }

    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    const { rows } = await this.client.query<{ state: SessionRecord }>(
      `SELECT state FROM ${this.t('sessions')}
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset],
    );
    return rows.map(r => r.state);
  }

  /* ── Receipts ──────────────────────────────────────────── */

  async saveReceipt(record: ReceiptRecord): Promise<void> {
    const parsed = JSON.parse(serialize(record));
    await this.client.query(
      `INSERT INTO ${this.t('receipts')} (id, agent_id, session_id, receipt, amount_charged, settled_at)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
       ON CONFLICT (id) DO NOTHING`,
      [record.id, record.agentId, record.sessionId ?? null, parsed, record.amountCharged, record.settledAt],
    );
  }

  async listReceipts(agentId: string, opts: ListOptions = {}): Promise<ReceiptRecord[]> {
    const limit = opts.limit ?? 100;
    const offset = opts.offset ?? 0;

    const { rows } = await this.client.query<{ receipt: ReceiptRecord }>(
      `SELECT receipt FROM ${this.t('receipts')}
       WHERE agent_id = $1
       ORDER BY settled_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset],
    );
    return rows.map(r => r.receipt);
  }

  /* ── Metrics ───────────────────────────────────────────── */

  async recordMetric(
    agentId: string,
    key: string,
    value: number,
    labels?: Record<string, string>,
  ): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.t('metrics')} (agent_id, metric_key, value, labels)
       VALUES ($1, $2, $3, $4)`,
      [agentId, key, value, labels ? JSON.parse(JSON.stringify(labels)) : {}],
    );
  }

  async queryMetrics(
    agentId: string,
    key: string,
    opts: MetricQueryOpts = {},
  ): Promise<MetricPoint[]> {
    const conditions = ['agent_id = $1', 'metric_key = $2'];
    const params: unknown[] = [agentId, key];
    let paramIdx = 3;

    if (opts.from != null) {
      conditions.push(`recorded_at >= to_timestamp($${paramIdx++} / 1000.0)`);
      params.push(opts.from);
    }
    if (opts.to != null) {
      conditions.push(`recorded_at <= to_timestamp($${paramIdx++} / 1000.0)`);
      params.push(opts.to);
    }

    const limit = opts.limit ?? 1000;

    const { rows } = await this.client.query<{
      value: number;
      labels: Record<string, string>;
      recorded_at: string;
    }>(
      `SELECT value, labels, recorded_at
       FROM ${this.t('metrics')}
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT $${paramIdx}`,
      [...params, limit],
    );

    return rows.map(r => ({
      timestamp: new Date(r.recorded_at).getTime(),
      value: Number(r.value),
      labels: r.labels && Object.keys(r.labels).length > 0 ? r.labels : undefined,
    }));
  }

  /* ── Maintenance ───────────────────────────────────────── */

  /**
   * @description Delete expired KV entries and old metric data.
   *
   * Call periodically (e.g. via a cron job) to reclaim storage.
   *
   * @param {object} [opts] - Cleanup options
   * @param {number} [opts.metricsOlderThanDays=90] - Delete metrics older than N days
   * @returns {Promise<{ kvDeleted: number; metricsDeleted: number }>}
   * @since 1.2.2
   */
  async cleanup(opts: { metricsOlderThanDays?: number } = {}): Promise<{
    kvDeleted: number;
    metricsDeleted: number;
  }> {
    const kvResult = await this.client.query(buildKvCleanupSql(this.prefix));
    const days = opts.metricsOlderThanDays ?? 90;
    const metricsResult = await this.client.query(
      `DELETE FROM ${this.t('metrics')}
       WHERE recorded_at < NOW() - INTERVAL '${days} days'`,
    );
    return {
      kvDeleted: kvResult.rowCount ?? 0,
      metricsDeleted: metricsResult.rowCount ?? 0,
    };
  }

  /**
   * @description Get the currently applied schema version.
   * @returns {Promise<number>} Schema version, or `0` if not yet migrated.
   * @since 1.2.2
   */
  async getSchemaVersion(): Promise<number> {
    try {
      const { rows } = await this.client.query<{ version: number }>(
        `SELECT MAX(version) AS version FROM ${this.t('schema_version')}`,
      );
      return rows[0]?.version ?? 0;
    } catch {
      return 0; // Table doesn't exist yet
    }
  }

  /**
   * @description Get row counts for all tables (useful for monitoring).
   * @returns {Promise<Record<string, number>>} Table name → row count
   * @since 1.2.2
   */
  async getTableStats(): Promise<Record<string, number>> {
    const tables = ['agents', 'sessions', 'receipts', 'metrics', 'kv'];
    const stats: Record<string, number> = {};
    for (const table of tables) {
      try {
        const { rows } = await this.client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM ${this.t(table)}`,
        );
        stats[table] = parseInt(rows[0]?.n ?? '0', 10);
      } catch {
        stats[table] = -1; // Table doesn't exist
      }
    }
    return stats;
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
