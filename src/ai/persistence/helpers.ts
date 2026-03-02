/**
 * @module ai/persistence/helpers
 * @description Serialization utilities, key builders, and PostgreSQL schema
 * for the Synapse AI persistence layer.
 *
 * @since 1.2.2
 */

import { toJsonSafe } from '../../utils/helpers';

/* ═══════════════════════════════════════════════════════════════
 *  Serialization
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Serialize a value to a JSON string, converting `BigInt` to strings.
 *
 * @param value - Any value (may contain `BigInt`, `Map`, nested objects).
 * @returns JSON string safe for storage.
 * @since 1.2.2
 */
export function serialize(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}

/**
 * Deserialize a JSON string back to a typed value.
 *
 * @typeParam T - Expected return type.
 * @param json - JSON string from the store.
 * @returns Parsed value.
 * @since 1.2.2
 */
export function deserialize<T = unknown>(json: string): T {
  return JSON.parse(json) as T;
}

/* ═══════════════════════════════════════════════════════════════
 *  Redis key builders
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Build a namespaced Redis key from segments.
 *
 * @example
 * ```ts
 * buildKey('synapse', 'agent', 'did:agent:1');
 * // → 'synapse:agent:did:agent:1'
 * ```
 *
 * @param parts - Key segments joined by `:`.
 * @returns Colon-delimited key string.
 * @since 1.2.2
 */
export function buildKey(...parts: string[]): string {
  return parts.join(':');
}

/**
 * Strip a prefix from a Redis key and return the remaining segments.
 *
 * @param prefix - The prefix to strip (e.g. `'synapse'`).
 * @param key    - Full key (e.g. `'synapse:agent:id1'`).
 * @returns Remaining segments after the prefix (e.g. `['agent', 'id1']`).
 * @since 1.2.2
 */
export function parseKey(prefix: string, key: string): string[] {
  const stripped = key.startsWith(prefix + ':') ? key.slice(prefix.length + 1) : key;
  return stripped.split(':');
}

/**
 * Extract the agent ID from a namespaced Redis key.
 *
 * @param prefix - Key prefix (e.g. `'synapse'`).
 * @param key    - Full key (e.g. `'synapse:agent:my-agent'`).
 * @returns The agent ID segment, or the full key if pattern doesn't match.
 * @since 1.2.2
 */
export function extractAgentId(prefix: string, key: string): string {
  const parts = parseKey(prefix, key);
  // Keys are: agent:{id}, session:{agentId}:{sessionId}, etc.
  return parts.length >= 2 ? parts[1] : key;
}

/* ═══════════════════════════════════════════════════════════════
 *  PostgreSQL schema
 * ═══════════════════════════════════════════════════════════════ */

/** Current schema version. Bump when adding migrations. */
export const SCHEMA_VERSION = 1;

/**
 * Generate the full PostgreSQL DDL for a given table prefix.
 *
 * Creates tables:
 * - `{prefix}_agents`   — agent snapshots (JSONB)
 * - `{prefix}_sessions` — session records (JSONB)
 * - `{prefix}_receipts` — payment receipts (JSONB)
 * - `{prefix}_metrics`  — time-series metric points
 * - `{prefix}_kv`       — generic key-value store
 * - `{prefix}_schema_version` — migration tracking
 *
 * @param prefix - Table name prefix (default: `'synapse'`).
 * @returns SQL DDL string ready for `client.query()`.
 * @since 1.2.2
 */
export function buildSchema(prefix: string = 'synapse'): string {
  const p = prefix;
  return `
-- ═══════════════════════════════════════════════════════════════
--  Synapse AI Persistence — Schema v${SCHEMA_VERSION}
--  Prefix: ${p}
-- ═══════════════════════════════════════════════════════════════

-- Agent snapshots
CREATE TABLE IF NOT EXISTS ${p}_agents (
  agent_id   TEXT PRIMARY KEY,
  snapshot   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Session records
CREATE TABLE IF NOT EXISTS ${p}_sessions (
  id         TEXT NOT NULL,
  agent_id   TEXT NOT NULL,
  state      JSONB NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, id)
);
CREATE INDEX IF NOT EXISTS idx_${p}_sessions_agent
  ON ${p}_sessions (agent_id);
CREATE INDEX IF NOT EXISTS idx_${p}_sessions_status
  ON ${p}_sessions (status);

-- Payment receipts
CREATE TABLE IF NOT EXISTS ${p}_receipts (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL,
  session_id     TEXT,
  receipt        JSONB NOT NULL,
  amount_charged TEXT NOT NULL DEFAULT '0',
  settled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_${p}_receipts_agent
  ON ${p}_receipts (agent_id);
CREATE INDEX IF NOT EXISTS idx_${p}_receipts_settled
  ON ${p}_receipts (settled_at DESC);

-- Metric time-series
CREATE TABLE IF NOT EXISTS ${p}_metrics (
  id          BIGSERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  metric_key  TEXT NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  labels      JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_${p}_metrics_agent_key
  ON ${p}_metrics (agent_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_${p}_metrics_time
  ON ${p}_metrics (recorded_at DESC);

-- Generic key-value store
CREATE TABLE IF NOT EXISTS ${p}_kv (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS ${p}_schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO ${p}_schema_version (version) VALUES (${SCHEMA_VERSION})
  ON CONFLICT (version) DO NOTHING;
`.trim();
}

/**
 * SQL to clean up expired rows from the KV table.
 *
 * @param prefix - Table name prefix.
 * @returns DELETE statement string.
 * @since 1.2.2
 */
export function buildKvCleanupSql(prefix: string = 'synapse'): string {
  return `DELETE FROM ${prefix}_kv WHERE expires_at IS NOT NULL AND expires_at < NOW()`;
}
