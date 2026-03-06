/**
 * @module ai/sap/discovery
 * @description SAP — On-chain agent discovery via `getProgramAccounts`.
 *
 * Queries the Solana blockchain for registered agents, applying filters
 * like capability, protocol, reputation, price range, and uptime.
 *
 * Uses the SDK's native {@link HttpTransport} — no external dependencies.
 *
 * @example
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { SAPDiscovery } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const client = new SynapseClient({ endpoint: 'https://api.mainnet-beta.solana.com' });
 * const discovery = new SAPDiscovery(client, { programId: 'SAPAgnt1...' });
 *
 * // Find agents that support Jupiter swaps
 * const result = await discovery.find({ capability: 'jupiter:swap', minReputation: 700 });
 * for (const agent of result.agents) {
 *   console.log(agent.name, agent.reputation.score, agent.x402Endpoint);
 * }
 * ```
 *
 * @since 1.3.0
 */

import type {
  SAPConfig,
  AgentPDAAccount,
  AgentDiscoveryFilter,
  DiscoveryResult,
  SAPAggregateMetrics,
} from './types';
import { SAP_DEFAULT_PROGRAM_ID, SAP_ACCOUNT_DISCRIMINATOR } from './types';
import { deserializeAgentAccount, base58Decode, base58Encode, deriveAgentPDA } from './pda';

/* ═══════════════════════════════════════════════════════════════
 *  Transport interface (avoids circular deps with core)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Minimal transport interface for RPC calls.
 * @since 1.3.0
 */
interface RpcTransport {
  request<T = unknown>(method: string, params: unknown[]): Promise<T>;
}

/**
 * @description Minimal client interface providing transport access.
 * Satisfied by {@link SynapseClient} and any object with a `transport` property.
 * @since 1.3.0
 */
interface RpcClient {
  transport: RpcTransport;
}

/* ═══════════════════════════════════════════════════════════════
 *  SAPDiscovery
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error class for SAP discovery failures.
 * @since 1.3.0
 */
export class SAPDiscoveryError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SAPDiscoveryError';
  }
}

/**
 * @description On-chain agent discovery engine.
 *
 * Queries the Solana blockchain for SAP-registered agents using
 * `getProgramAccounts` with memcmp filters for efficient querying.
 *
 * @since 1.3.0
 */
export class SAPDiscovery {
  private readonly transport: RpcTransport;
  private readonly config: Required<SAPConfig>;

  /**
   * @param {RpcClient} client - Client providing RPC transport
   * @param {Partial<SAPConfig>} [config] - Discovery configuration
   */
  constructor(client: RpcClient, config?: Partial<SAPConfig>) {
    this.transport = client.transport;
    this.config = {
      programId: config?.programId ?? SAP_DEFAULT_PROGRAM_ID,
      commitment: config?.commitment ?? 'confirmed',
      maxAccounts: config?.maxAccounts ?? 100,
    };
  }

  /**
   * @description Find a single agent by wallet public key.
   *
   * Derives the PDA and fetches the account data directly.
   *
   * @param {string} walletPubkey - Agent's wallet (base58)
   * @returns {Promise<AgentPDAAccount | null>} Agent account or null
   *
   * @example
   * ```ts
   * const agent = await discovery.findAgent('7xKXwJ...');
   * if (agent) console.log(agent.name, agent.capabilities);
   * ```
   *
   * @since 1.3.0
   */
  async findAgent(walletPubkey: string): Promise<AgentPDAAccount | null> {
    const pda = deriveAgentPDA(walletPubkey, this.config.programId);

    const result = await this.transport.request<{
      value: { data: [string, string]; owner: string; lamports: number } | null;
    }>('getAccountInfo', [pda.address, { encoding: 'base64', commitment: this.config.commitment }]);

    if (!result?.value?.data) return null;

    try {
      const bytes = Buffer.from(result.value.data[0], 'base64');
      return deserializeAgentAccount(pda.address, bytes);
    } catch {
      return null;
    }
  }

  /**
   * @description Find agents matching the given filters.
   *
   * Uses `getProgramAccounts` with a memcmp filter on the discriminator
   * to fetch all SAP accounts, then applies client-side filters.
   *
   * @param {AgentDiscoveryFilter} [filter] - Query filters
   * @returns {Promise<DiscoveryResult>} Discovery results with matching agents
   *
   * @example
   * ```ts
   * const result = await discovery.find({
   *   capability: 'jupiter:swap',
   *   minReputation: 600,
   *   maxPricePerCall: 5000n,
   *   sortBy: 'reputation',
   *   limit: 20,
   * });
   * ```
   *
   * @since 1.3.0
   */
  async find(filter: AgentDiscoveryFilter = {}): Promise<DiscoveryResult> {
    const start = performance.now();
    const {
      activeOnly = true,
      capability,
      protocol,
      minReputation,
      maxPricePerCall,
      minUptime,
      sortBy,
      sortDirection = 'desc',
      limit = 50,
    } = filter;

    // Fetch all accounts with discriminator filter
    const accounts = await this.fetchAllAccounts();
    const totalScanned = accounts.length;

    // Apply filters
    let matched = accounts.filter((agent) => {
      if (activeOnly && !agent.isActive) return false;
      if (capability && !agent.capabilities.some(c => c.id === capability)) return false;
      if (protocol && !agent.capabilities.some(c => c.protocol === protocol)) return false;
      if (minReputation !== undefined && agent.reputation.score < minReputation) return false;
      if (maxPricePerCall !== undefined) {
        const cheapest = agent.pricing.reduce(
          (min, p) => p.pricePerCall < min ? p.pricePerCall : min,
          agent.pricing[0]?.pricePerCall ?? 0n,
        );
        if (cheapest > maxPricePerCall) return false;
      }
      if (minUptime !== undefined && agent.reputation.uptimePercent < minUptime) return false;
      return true;
    });

    const totalMatching = matched.length;

    // Sort
    if (sortBy) {
      const mul = sortDirection === 'asc' ? 1 : -1;
      matched.sort((a, b) => {
        switch (sortBy) {
          case 'reputation': return mul * (a.reputation.score - b.reputation.score);
          case 'latency':    return mul * (a.reputation.avgLatencyMs - b.reputation.avgLatencyMs);
          case 'uptime':     return mul * (a.reputation.uptimePercent - b.reputation.uptimePercent);
          case 'calls':      return mul * Number(a.reputation.totalCallsServed - b.reputation.totalCallsServed);
          case 'price': {
            const aMin = a.pricing[0]?.pricePerCall ?? 0n;
            const bMin = b.pricing[0]?.pricePerCall ?? 0n;
            return mul * Number(aMin - bMin);
          }
          default: return 0;
        }
      });
    }

    // Limit
    if (matched.length > limit) {
      matched = matched.slice(0, limit);
    }

    return {
      agents: matched,
      totalScanned,
      totalMatching,
      queryLatencyMs: Math.round(performance.now() - start),
    };
  }

  /**
   * @description Find all active agents (shortcut for `find({ activeOnly: true })`).
   * @returns {Promise<AgentPDAAccount[]>} Active agent accounts
   * @since 1.3.0
   */
  async findActive(): Promise<AgentPDAAccount[]> {
    const result = await this.find({ activeOnly: true, limit: this.config.maxAccounts });
    return result.agents;
  }

  /**
   * @description Find agents by capability ID.
   * @param {string} capabilityId - Capability to search for (e.g. `"jupiter:swap"`)
   * @returns {Promise<AgentPDAAccount[]>} Agents with the given capability
   * @since 1.3.0
   */
  async findByCapability(capabilityId: string): Promise<AgentPDAAccount[]> {
    const result = await this.find({ capability: capabilityId, limit: this.config.maxAccounts });
    return result.agents;
  }

  /**
   * @description Find agents by protocol name.
   * @param {string} protocol - Protocol name (e.g. `"jupiter"`, `"raydium"`)
   * @returns {Promise<AgentPDAAccount[]>} Agents offering tools for the given protocol
   * @since 1.3.0
   */
  async findByProtocol(protocol: string): Promise<AgentPDAAccount[]> {
    const result = await this.find({ protocol, limit: this.config.maxAccounts });
    return result.agents;
  }

  /**
   * @description Find the cheapest agent for a given capability.
   * @param {string} capabilityId - Capability to search for
   * @returns {Promise<AgentPDAAccount | null>} Cheapest agent or null
   * @since 1.3.0
   */
  async findCheapest(capabilityId: string): Promise<AgentPDAAccount | null> {
    const result = await this.find({
      capability: capabilityId,
      sortBy: 'price',
      sortDirection: 'asc',
      limit: 1,
    });
    return result.agents[0] ?? null;
  }

  /**
   * @description Find the most reputable agent for a given capability.
   * @param {string} capabilityId - Capability to search for
   * @returns {Promise<AgentPDAAccount | null>} Most reputable agent or null
   * @since 1.3.0
   */
  async findMostReputable(capabilityId: string): Promise<AgentPDAAccount | null> {
    const result = await this.find({
      capability: capabilityId,
      sortBy: 'reputation',
      sortDirection: 'desc',
      limit: 1,
    });
    return result.agents[0] ?? null;
  }

  /**
   * @description Compute aggregate metrics across all registered agents.
   *
   * @returns {Promise<SAPAggregateMetrics>} Network-wide agent statistics
   *
   * @example
   * ```ts
   * const metrics = await discovery.getAggregateMetrics();
   * console.log(`${metrics.activeAgents} active agents`);
   * console.log(`${metrics.totalCallsServed} total calls served`);
   * console.log(`Protocols: ${metrics.protocols.join(', ')}`);
   * ```
   *
   * @since 1.3.0
   */
  async getAggregateMetrics(): Promise<SAPAggregateMetrics> {
    const agents = await this.fetchAllAccounts();

    const protocols = new Set<string>();
    const capabilities = new Set<string>();
    let totalCalls = 0n;
    let totalReputation = 0;
    let totalLatency = 0;
    let activeCount = 0;

    for (const agent of agents) {
      if (agent.isActive) activeCount++;
      totalCalls += agent.reputation.totalCallsServed;
      totalReputation += agent.reputation.score;
      totalLatency += agent.reputation.avgLatencyMs;

      for (const cap of agent.capabilities) {
        capabilities.add(cap.id);
        if (cap.protocol) protocols.add(cap.protocol);
      }
    }

    return {
      totalAgents: agents.length,
      activeAgents: activeCount,
      totalCallsServed: totalCalls,
      avgReputation: agents.length > 0 ? Math.round(totalReputation / agents.length) : 0,
      avgLatencyMs: agents.length > 0 ? Math.round(totalLatency / agents.length) : 0,
      protocols: [...protocols],
      capabilities: [...capabilities],
    };
  }

  /* ── Internal ── */

  /**
   * @description Fetch all SAP accounts from the blockchain using getProgramAccounts.
   * @returns {Promise<AgentPDAAccount[]>} All deserialized agent accounts
   * @internal
   */
  private async fetchAllAccounts(): Promise<AgentPDAAccount[]> {
    // memcmp filter: match the 8-byte discriminator at offset 0
    const discriminatorBase64 = Buffer.from(SAP_ACCOUNT_DISCRIMINATOR).toString('base64');

    const rpcResult = await this.transport.request<{
      pubkey: string;
      account: { data: [string, string]; lamports: number };
    }[]>('getProgramAccounts', [
      this.config.programId,
      {
        encoding: 'base64',
        commitment: this.config.commitment,
        filters: [
          { memcmp: { offset: 0, bytes: discriminatorBase64, encoding: 'base64' } },
        ],
      },
    ]);

    if (!Array.isArray(rpcResult)) return [];

    const agents: AgentPDAAccount[] = [];
    for (const entry of rpcResult) {
      try {
        const bytes = Buffer.from(entry.account.data[0], 'base64');
        agents.push(deserializeAgentAccount(entry.pubkey, bytes));
      } catch {
        // Skip malformed accounts
      }
    }

    return agents;
  }
}
