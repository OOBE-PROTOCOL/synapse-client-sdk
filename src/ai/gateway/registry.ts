/**
 * @module ai/gateway/registry
 * @description AgentRegistry — Multi-agent lifecycle management.
 *
 * Provides a centralised registry for creating, discovering, and managing
 * multiple {@link AgentGateway} instances.  Ideal for platforms that host
 * many agents (e.g. marketplace back-ends, orchestrators, multi-tenant SaaS).
 *
 * Includes:
 * - `create()` / `get()` / `remove()` / `clear()`  — CRUD
 * - `list()` / `filter()`                           — discovery
 * - `searchMarketplace()`                           — cross-agent tool search
 * - `getAggregateMetrics()`                         — rolled-up stats
 * - Pluggable persistence via `PersistenceAdapter`  (memory adapter built-in)
 *
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { AgentRegistry, AgentGateway } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const registry = new AgentRegistry();
 *
 * const gateway = registry.create(client, {
 *   identity: { id: AgentId('agent-1'), name: 'Alice', walletPubkey: '...', createdAt: Date.now() },
 *   defaultTiers: DEFAULT_TIERS,
 * });
 *
 * const all = registry.list();
 * const defi = registry.filter(g => g.identity.tags?.includes('defi'));
 * ```
 */

import type { SynapseClientLike } from '../../core/client';
import type { AgentId, GatewayConfig } from './types';
import { AgentGateway } from './index';
import type { GatewaySnapshot, SnapshotDepth } from './types';
import type { MarketplaceQuery } from './marketplace';

/* ═══════════════════════════════════════════════════════════════
 *  Persistence abstraction
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Pluggable persistence layer for the registry.
 * Implement this interface to back the registry with Redis, SQLite, etc.
 * @since 1.2.2
 */
export interface PersistenceAdapter {
  /** Save a snapshot keyed by agent ID. */
  save(agentId: string, snapshot: GatewaySnapshot): void | Promise<void>;
  /** Load a snapshot by agent ID (returns `null` if not found). */
  load(agentId: string): GatewaySnapshot | null | Promise<GatewaySnapshot | null>;
  /** Delete a snapshot by agent ID. */
  delete(agentId: string): void | Promise<void>;
  /** List all stored agent IDs. */
  keys(): string[] | Promise<string[]>;
}

/**
 * @description Default in-memory persistence adapter.
 * @since 1.2.2
 */
export class MemoryAdapter implements PersistenceAdapter {
  private readonly store = new Map<string, GatewaySnapshot>();

  save(agentId: string, snapshot: GatewaySnapshot): void {
    this.store.set(agentId, snapshot);
  }

  load(agentId: string): GatewaySnapshot | null {
    return this.store.get(agentId) ?? null;
  }

  delete(agentId: string): void {
    this.store.delete(agentId);
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Registry options
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for {@link AgentRegistry}.
 * @since 1.2.2
 */
export interface AgentRegistryConfig {
  /** Maximum number of agents allowed in the registry (default: unlimited). */
  maxAgents?: number;
  /** Optional persistence adapter (default: in-memory). */
  persistence?: PersistenceAdapter;
  /** Gateway config template — merged with per-agent overrides in `create()`. */
  defaultConfig?: Partial<GatewayConfig>;
}

/* ═══════════════════════════════════════════════════════════════
 *  AgentRegistry
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Multi-agent lifecycle manager.
 *
 * Manages a collection of {@link AgentGateway} instances with CRUD
 * operations, discovery, aggregate metrics, and optional persistence.
 *
 * @since 1.2.2
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentGateway>();
  private readonly config: AgentRegistryConfig;
  private readonly persistence: PersistenceAdapter;

  /**
   * @param {AgentRegistryConfig} [config] - Optional registry configuration.
   */
  constructor(config: AgentRegistryConfig = {}) {
    this.config = config;
    this.persistence = config.persistence ?? new MemoryAdapter();
  }

  /* ── CRUD ──────────────────────────────────────────────── */

  /**
   * @description Create and register a new agent gateway.
   *
   * @param {SynapseClientLike} client - Synapse client (or client-like transport wrapper)
   * @param {GatewayConfig} config - Gateway configuration (merged with `defaultConfig`)
   * @returns {AgentGateway} The newly created and registered gateway
   * @throws {Error} If an agent with the same ID already exists or the max limit is reached
   * @since 1.2.2
   */
  create(client: SynapseClientLike, config: GatewayConfig): AgentGateway {
    const merged: GatewayConfig = { ...this.config.defaultConfig, ...config } as GatewayConfig;
    const gateway = new AgentGateway(client, merged);
    const id = gateway.agentId as string;

    if (this.agents.has(id)) {
      throw new Error(`Agent '${id}' already exists in the registry`);
    }

    if (this.config.maxAgents != null && this.agents.size >= this.config.maxAgents) {
      throw new Error(`Registry limit reached (max ${this.config.maxAgents} agents)`);
    }

    this.agents.set(id, gateway);
    return gateway;
  }

  /**
   * @description Register an existing gateway in the registry.
   *
   * @param {AgentGateway} gateway - An already-constructed gateway
   * @throws {Error} If an agent with the same ID already exists
   * @since 1.2.2
   */
  register(gateway: AgentGateway): void {
    const id = gateway.agentId as string;

    if (this.agents.has(id)) {
      throw new Error(`Agent '${id}' already exists in the registry`);
    }

    if (this.config.maxAgents != null && this.agents.size >= this.config.maxAgents) {
      throw new Error(`Registry limit reached (max ${this.config.maxAgents} agents)`);
    }

    this.agents.set(id, gateway);
  }

  /**
   * @description Get a gateway by agent ID.
   * @param {AgentId | string} agentId - The agent ID
   * @returns {AgentGateway | undefined} The gateway or undefined
   * @since 1.2.2
   */
  get(agentId: AgentId | string): AgentGateway | undefined {
    return this.agents.get(agentId as string);
  }

  /**
   * @description Remove an agent from the registry.
   * @param {AgentId | string} agentId - The agent ID to remove
   * @returns {boolean} `true` if the agent was found and removed
   * @since 1.2.2
   */
  remove(agentId: AgentId | string): boolean {
    return this.agents.delete(agentId as string);
  }

  /**
   * @description Remove all agents from the registry.
   * @since 1.2.2
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * @description Check if an agent exists in the registry.
   * @param {AgentId | string} agentId - The agent ID to check
   * @returns {boolean} `true` if registered
   * @since 1.2.2
   */
  has(agentId: AgentId | string): boolean {
    return this.agents.has(agentId as string);
  }

  /**
   * @description Get the number of registered agents.
   * @since 1.2.2
   */
  get size(): number {
    return this.agents.size;
  }

  /* ── Discovery ─────────────────────────────────────────── */

  /**
   * @description List all registered gateways.
   * @returns {AgentGateway[]} Array of all gateways
   * @since 1.2.2
   */
  list(): AgentGateway[] {
    return [...this.agents.values()];
  }

  /**
   * @description Filter gateways by a predicate.
   *
   * @param {(gateway: AgentGateway) => boolean} predicate - Filter function
   * @returns {AgentGateway[]} Matching gateways
   * @since 1.2.2
   *
   * @example
   * ```ts
   * const defiAgents = registry.filter(g => g.identity.tags?.includes('defi'));
   * ```
   */
  filter(predicate: (gateway: AgentGateway) => boolean): AgentGateway[] {
    return [...this.agents.values()].filter(predicate);
  }

  /**
   * @description Search tool listings across all registered gateways.
   *
   * @param {MarketplaceQuery} query - Marketplace search query
   * @returns {{ agent: AgentGateway; listings: import('./marketplace').ToolListing[] }[]}
   * @since 1.2.2
   */
  searchMarketplace(query: MarketplaceQuery): {
    agent: AgentGateway;
    listings: ReturnType<AgentGateway['marketplace']['search']>;
  }[] {
    const results: {
      agent: AgentGateway;
      listings: ReturnType<AgentGateway['marketplace']['search']>;
    }[] = [];

    for (const gateway of this.agents.values()) {
      const listings = gateway.marketplace.search(query);
      if (listings.length > 0) {
        results.push({ agent: gateway, listings });
      }
    }

    return results;
  }

  /* ── Metrics ───────────────────────────────────────────── */

  /**
   * @description Get aggregate metrics across all registered agents.
   *
   * @returns {object} Rolled-up metrics
   * @since 1.2.2
   */
  getAggregateMetrics(): {
    totalAgents: number;
    totalCallsServed: number;
    totalRevenue: string;
    totalActiveSessions: number;
    totalSessions: number;
    avgLatencyMs: number;
  } {
    let totalCalls = 0;
    let totalRevenue = 0n;
    let totalActiveSessions = 0;
    let totalSessions = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const gateway of this.agents.values()) {
      const m = gateway.getMetrics();
      totalCalls += m.totalCallsServed;
      totalRevenue += BigInt(m.totalRevenue);
      totalActiveSessions += m.activeSessions;
      totalSessions += m.totalSessions;
      if (m.avgLatencyMs > 0) {
        latencySum += m.avgLatencyMs;
        latencyCount++;
      }
    }

    return {
      totalAgents: this.agents.size,
      totalCallsServed: totalCalls,
      totalRevenue: totalRevenue.toString(),
      totalActiveSessions,
      totalSessions,
      avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    };
  }

  /* ── Snapshot & serialization ──────────────────────────── */

  /**
   * @description Snapshot all agents in the registry.
   *
   * @param {{ depth?: SnapshotDepth }} [opts] - Snapshot options
   * @returns {GatewaySnapshot[]} Array of JSON-safe snapshots
   * @since 1.2.2
   */
  snapshot(opts: { depth?: SnapshotDepth } = {}): GatewaySnapshot[] {
    return [...this.agents.values()].map(g => g.snapshot(opts));
  }

  /**
   * Enables `JSON.stringify(registry)`.
   * @since 1.2.2
   */
  toJSON(): GatewaySnapshot[] {
    return this.snapshot({ depth: 'standard' });
  }

  /* ── Persistence helpers ───────────────────────────────── */

  /**
   * @description Persist all current agent snapshots via the configured adapter.
   * @since 1.2.2
   */
  async persist(): Promise<void> {
    for (const gateway of this.agents.values()) {
      const snap = gateway.snapshot({ depth: 'full' });
      await this.persistence.save(snap.agentId, snap);
    }
  }

  /**
   * @description Load a snapshot from the persistence layer.
   * @param {string} agentId - The agent ID to load
   * @returns {Promise<GatewaySnapshot | null>} The stored snapshot or null
   * @since 1.2.2
   */
  async loadSnapshot(agentId: string): Promise<GatewaySnapshot | null> {
    return this.persistence.load(agentId);
  }

  /* ── Iteration ─────────────────────────────────────────── */

  /**
   * @description Iterate over all registered gateways.
   * @since 1.2.2
   */
  [Symbol.iterator](): IterableIterator<AgentGateway> {
    return this.agents.values();
  }

  /**
   * @description Iterate over `[agentId, gateway]` pairs.
   * @since 1.2.2
   */
  entries(): IterableIterator<[string, AgentGateway]> {
    return this.agents.entries();
  }
}
