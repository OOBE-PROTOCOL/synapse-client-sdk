/**
 * @module ai/sap/adapter
 * @description SAP — On-chain persistence adapter for {@link AgentRegistry}.
 *
 * Implements the {@link PersistenceAdapter} interface using SAP on-chain
 * data, enabling the `AgentRegistry` to persist and discover agents
 * directly on the Solana blockchain.
 *
 * @example
 * ```ts
 * import { AgentRegistry, OnChainPersistenceAdapter } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const adapter = new OnChainPersistenceAdapter(client, { programId: 'SAPAgnt1...' });
 * const registry = new AgentRegistry({ adapter });
 *
 * // Agents registered via the registry are now backed by on-chain data
 * ```
 *
 * @since 1.3.0
 */

import type { SAPConfig, AgentPDAAccount } from './types';
import { SAP_DEFAULT_PROGRAM_ID, pdaToIdentity } from './types';
import { SAPDiscovery } from './discovery';

/* ═══════════════════════════════════════════════════════════════
 *  PersistenceAdapter interface (from gateway/registry)
 *
 *  Duplicated here to avoid circular dependency. The interface
 *  contract is: save(id, data), load(id), loadAll(), remove(id).
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Persistence adapter interface (matches gateway/registry).
 * @since 1.3.0
 */
interface PersistenceAdapterLike {
  save(id: string, data: unknown): Promise<void>;
  load(id: string): Promise<unknown | null>;
  loadAll(): Promise<Array<{ id: string; data: unknown }>>;
  remove(id: string): Promise<void>;
}

/**
 * @description Minimal RPC client interface.
 * @since 1.3.0
 */
interface RpcClient {
  transport: {
    request<T = unknown>(method: string, params: unknown[]): Promise<T>;
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  OnChainPersistenceAdapter
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Persistence adapter backed by SAP on-chain data.
 *
 * **Read operations** (`load`, `loadAll`) query the blockchain via
 * {@link SAPDiscovery}. **Write operations** (`save`, `remove`) are
 * cached locally — the actual on-chain write must be done by the user
 * via {@link SAPInstructionBuilder} + transaction signing.
 *
 * This design separates read (automatic) from write (user-driven)
 * because on-chain writes require a signature from the agent's wallet.
 *
 * @implements {PersistenceAdapterLike}
 * @since 1.3.0
 */
export class OnChainPersistenceAdapter implements PersistenceAdapterLike {
  private readonly discovery: SAPDiscovery;
  private readonly pendingWrites: Map<string, unknown> = new Map();
  private readonly removed: Set<string> = new Set();

  /**
   * @param {RpcClient} client - Client providing RPC transport
   * @param {Partial<SAPConfig>} [config] - SAP configuration
   */
  constructor(client: RpcClient, config?: Partial<SAPConfig>) {
    this.discovery = new SAPDiscovery(client, {
      programId: config?.programId ?? SAP_DEFAULT_PROGRAM_ID,
      commitment: config?.commitment ?? 'confirmed',
      maxAccounts: config?.maxAccounts ?? 100,
    });
  }

  /**
   * @description Get the underlying discovery instance for direct queries.
   * @returns {SAPDiscovery} Discovery engine
   * @since 1.3.0
   */
  getDiscovery(): SAPDiscovery {
    return this.discovery;
  }

  /**
   * @description Stage agent data for persistence.
   *
   * This caches the data locally. To actually write on-chain, build and
   * send a transaction using {@link SAPInstructionBuilder}.
   *
   * @param {string} id - Agent wallet pubkey or DID
   * @param {unknown} data - Agent data to persist
   * @returns {Promise<void>}
   * @since 1.3.0
   */
  async save(id: string, data: unknown): Promise<void> {
    this.removed.delete(id);
    this.pendingWrites.set(id, data);
  }

  /**
   * @description Load agent data from on-chain PDA.
   *
   * First checks pending writes (local cache), then queries the blockchain.
   *
   * @param {string} id - Agent wallet pubkey
   * @returns {Promise<AgentPDAAccount | unknown | null>} Agent data or null
   * @since 1.3.0
   */
  async load(id: string): Promise<unknown | null> {
    if (this.removed.has(id)) return null;
    if (this.pendingWrites.has(id)) return this.pendingWrites.get(id)!;

    const agent = await this.discovery.findAgent(id);
    if (!agent) return null;

    return {
      identity: pdaToIdentity(agent),
      pda: agent,
    };
  }

  /**
   * @description Load all agents from the blockchain.
   *
   * Merges on-chain data with pending local writes, excluding removed entries.
   *
   * @returns {Promise<Array<{ id: string; data: unknown }>>} All agent records
   * @since 1.3.0
   */
  async loadAll(): Promise<Array<{ id: string; data: unknown }>> {
    const onChain = await this.discovery.findActive();
    const results: Array<{ id: string; data: unknown }> = [];
    const seen = new Set<string>();

    // On-chain agents
    for (const agent of onChain) {
      if (this.removed.has(agent.walletPubkey)) continue;
      seen.add(agent.walletPubkey);

      // Prefer pending write if available
      if (this.pendingWrites.has(agent.walletPubkey)) {
        results.push({ id: agent.walletPubkey, data: this.pendingWrites.get(agent.walletPubkey)! });
      } else {
        results.push({
          id: agent.walletPubkey,
          data: { identity: pdaToIdentity(agent), pda: agent },
        });
      }
    }

    // Pending writes not yet on-chain
    for (const [id, data] of this.pendingWrites) {
      if (!seen.has(id) && !this.removed.has(id)) {
        results.push({ id, data });
      }
    }

    return results;
  }

  /**
   * @description Mark an agent for removal (locally cached).
   *
   * On-chain removal requires sending a `deactivate` instruction
   * via {@link SAPInstructionBuilder}.
   *
   * @param {string} id - Agent wallet pubkey
   * @returns {Promise<void>}
   * @since 1.3.0
   */
  async remove(id: string): Promise<void> {
    this.pendingWrites.delete(id);
    this.removed.add(id);
  }

  /**
   * @description Get pending writes that need to be committed on-chain.
   * @returns {Map<string, unknown>} Map of agent ID → staged data
   * @since 1.3.0
   */
  getPendingWrites(): ReadonlyMap<string, unknown> {
    return this.pendingWrites;
  }

  /**
   * @description Get IDs of agents marked for removal.
   * @returns {ReadonlySet<string>} Set of removed agent IDs
   * @since 1.3.0
   */
  getRemovedIds(): ReadonlySet<string> {
    return this.removed;
  }

  /**
   * @description Clear all pending local writes and removals.
   * Call after successfully committing transactions on-chain.
   * @returns {void}
   * @since 1.3.0
   */
  clearPending(): void {
    this.pendingWrites.clear();
    this.removed.clear();
  }
}
