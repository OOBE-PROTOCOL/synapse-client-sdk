/**
 * @module ai/sap/subnetwork
 * @description SAP — Subnetwork builder for composing multi-agent task forces.
 *
 * Given a set of **required capabilities**, discovers the optimal set of
 * agents that collectively cover all capabilities, then provides utilities
 * to orchestrate them (cost estimation, health checks, failover selection).
 *
 * Think of it as a **query planner** for an agent-based microservice mesh:
 * you describe WHAT you need, and the SubnetworkBuilder finds WHO can do it,
 * optimizing for cost, reputation, latency, or a weighted combination.
 *
 * @example
 * ```ts
 * import { SubnetworkBuilder, SAPDiscovery } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const discovery = new SAPDiscovery(client, { programId });
 * const subnet = new SubnetworkBuilder(discovery);
 *
 * // Build a subnetwork that can swap, lend, and analyze risk
 * const result = await subnet.build({
 *   requiredCapabilities: ['jupiter:swap', 'solend:lend', 'ai:riskScore'],
 *   strategy: 'balanced',
 *   maxCostPerCall: 5000n,
 * });
 *
 * if (result.complete) {
 *   for (const assignment of result.assignments) {
 *     console.log(`${assignment.capability} → ${assignment.agent.name}`);
 *   }
 *   console.log(`Total cost: ${result.estimatedCostPerCall}`);
 * }
 * ```
 *
 * @since 1.4.0
 */

import type { AgentPDAAccount, AgentPricingOnChain } from './types';
import type { SAPDiscovery } from './discovery';

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Optimization strategy for agent selection.
 * @since 1.4.0
 */
export type SelectionStrategy =
  | 'cheapest'       // minimize total cost
  | 'reputable'      // maximize total reputation
  | 'fastest'        // minimize total latency
  | 'balanced';      // weighted combination of all three

/**
 * @description Configuration for building a subnetwork.
 * @since 1.4.0
 */
export interface SubnetworkConfig {
  /** Capabilities the subnetwork must collectively support. */
  requiredCapabilities: string[];
  /** Optimization strategy. @default 'balanced' */
  strategy?: SelectionStrategy;
  /** Maximum acceptable cost per call (total across all agents). */
  maxCostPerCall?: bigint;
  /** Minimum reputation score for any agent in the subnetwork. @default 0 */
  minReputation?: number;
  /** Minimum uptime for any agent. @default 0 */
  minUptime?: number;
  /** Pricing tier to use for cost calculations. @default 'standard' */
  pricingTier?: string;
  /** Maximum number of agents in the subnetwork. @default 10 */
  maxAgents?: number;
  /** Prefer agents that cover multiple required capabilities (reduces hop count). @default true */
  preferMultiCapable?: boolean;
}

/**
 * @description A single capability → agent assignment in a subnetwork.
 * @since 1.4.0
 */
export interface CapabilityAssignment {
  /** The capability ID. */
  capability: string;
  /** The agent assigned to provide this capability. */
  agent: AgentPDAAccount;
  /** The pricing tier selected for this agent. */
  pricing: AgentPricingOnChain;
  /** The agent's reputation score. */
  reputationScore: number;
  /** The agent's average latency. */
  latencyMs: number;
  /** Alternative agents that could provide this capability (sorted by score). */
  alternatives: AgentPDAAccount[];
}

/**
 * @description Result of a subnetwork build operation.
 * @since 1.4.0
 */
export interface SubnetworkResult {
  /** Whether ALL required capabilities were assigned. */
  complete: boolean;
  /** Capability → agent assignments. */
  assignments: CapabilityAssignment[];
  /** Capabilities that could NOT be assigned (no agents found). */
  unassigned: string[];
  /** Unique agents in this subnetwork (deduplicated). */
  agents: AgentPDAAccount[];
  /** Estimated total cost per call (sum across all agents). */
  estimatedCostPerCall: bigint;
  /** Average reputation across all agents. */
  avgReputation: number;
  /** Max latency across all agents (bottleneck). */
  maxLatencyMs: number;
  /** Time taken to build the subnetwork (ms). */
  buildTimeMs: number;
  /** The strategy used. */
  strategy: SelectionStrategy;
}

/**
 * @description Health status of the subnetwork.
 * @since 1.4.0
 */
export interface SubnetworkHealth {
  /** Overall health: 'healthy' | 'degraded' | 'critical'. */
  status: 'healthy' | 'degraded' | 'critical';
  /** Per-agent health. */
  agents: Array<{
    agent: AgentPDAAccount;
    capabilities: string[];
    isHealthy: boolean;
    reason?: string;
  }>;
  /** Capabilities at risk (only one agent, low reputation or uptime). */
  atRisk: string[];
  /** Capabilities with redundancy (2+ agents can provide them). */
  redundant: string[];
}

/* ═══════════════════════════════════════════════════════════════
 *  SubnetworkBuilder
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Builds and manages agent sub-networks for multi-capability tasks.
 *
 * The builder:
 * 1. Discovers agents for each required capability via {@link SAPDiscovery}
 * 2. Scores candidates using the selected strategy
 * 3. Assigns agents to capabilities, preferring multi-capable agents
 * 4. Computes cost, reputation, and latency estimates
 * 5. Identifies failover alternatives for each assignment
 *
 * @since 1.4.0
 */
export class SubnetworkBuilder {
  constructor(private readonly discovery: SAPDiscovery) {}

  /**
   * @description Build an optimal subnetwork covering all required capabilities.
   *
   * @param {SubnetworkConfig} config - Subnetwork requirements
   * @returns {Promise<SubnetworkResult>} The built subnetwork with assignments
   *
   * @example
   * ```ts
   * const result = await subnet.build({
   *   requiredCapabilities: ['jupiter:swap', 'pyth:getPrice', 'ai:riskScore'],
   *   strategy: 'balanced',
   *   minReputation: 500,
   *   maxCostPerCall: 10000n,
   * });
   * ```
   *
   * @since 1.4.0
   */
  async build(config: SubnetworkConfig): Promise<SubnetworkResult> {
    const start = performance.now();
    const {
      requiredCapabilities,
      strategy = 'balanced',
      maxCostPerCall,
      minReputation = 0,
      minUptime = 0,
      pricingTier = 'standard',
      maxAgents = 10,
      preferMultiCapable = true,
    } = config;

    // Phase 1: Discover candidate agents for each capability
    const candidateMap = new Map<string, AgentPDAAccount[]>();
    for (const capId of requiredCapabilities) {
      const agents = await this.discovery.findByCapability(capId);
      const filtered = agents.filter(a =>
        a.reputation.score >= minReputation &&
        a.reputation.uptimePercent >= minUptime,
      );
      candidateMap.set(capId, filtered);
    }

    // Phase 2: Score and select
    const assignments: CapabilityAssignment[] = [];
    const unassigned: string[] = [];
    const assignedAgentSet = new Set<string>();

    // Sort capabilities: those with fewer candidates first (constrained first)
    const sortedCaps = [...requiredCapabilities].sort((a, b) => {
      const aCount = candidateMap.get(a)?.length ?? 0;
      const bCount = candidateMap.get(b)?.length ?? 0;
      return aCount - bCount;
    });

    for (const capId of sortedCaps) {
      const candidates = candidateMap.get(capId) ?? [];

      if (candidates.length === 0) {
        unassigned.push(capId);
        continue;
      }

      // Score each candidate
      const scored = candidates.map(agent => ({
        agent,
        score: this.scoreAgent(agent, strategy, pricingTier, preferMultiCapable, requiredCapabilities, assignedAgentSet),
      }));

      // Sort by score (higher = better)
      scored.sort((a, b) => b.score - a.score);

      const best = scored[0].agent;
      const pricing = this.findPricing(best, pricingTier);

      // Check cost constraint
      if (maxCostPerCall !== undefined && pricing) {
        const currentCost = assignments.reduce(
          (sum, a) => sum + a.pricing.pricePerCall, 0n,
        );
        if (currentCost + pricing.pricePerCall > maxCostPerCall) {
          // Try cheaper alternatives
          const cheaper = scored.find(s => {
            const p = this.findPricing(s.agent, pricingTier);
            return p && currentCost + p.pricePerCall <= maxCostPerCall;
          });
          if (cheaper) {
            const cheaperPricing = this.findPricing(cheaper.agent, pricingTier)!;
            assignments.push({
              capability: capId,
              agent: cheaper.agent,
              pricing: cheaperPricing,
              reputationScore: cheaper.agent.reputation.score,
              latencyMs: cheaper.agent.reputation.avgLatencyMs,
              alternatives: scored
                .filter(s => s.agent.walletPubkey !== cheaper.agent.walletPubkey)
                .map(s => s.agent)
                .slice(0, 3),
            });
            assignedAgentSet.add(cheaper.agent.walletPubkey);
            continue;
          } else {
            unassigned.push(capId);
            continue;
          }
        }
      }

      if (!pricing) {
        // No matching pricing tier, use agent but warn
        const fallbackPricing: AgentPricingOnChain = {
          tierId: pricingTier,
          pricePerCall: 0n,
          rateLimit: 1,
          maxCallsPerSession: 0,
          tokenType: 'SOL',
        };

        assignments.push({
          capability: capId,
          agent: best,
          pricing: fallbackPricing,
          reputationScore: best.reputation.score,
          latencyMs: best.reputation.avgLatencyMs,
          alternatives: scored.slice(1, 4).map(s => s.agent),
        });
      } else {
        assignments.push({
          capability: capId,
          agent: best,
          pricing,
          reputationScore: best.reputation.score,
          latencyMs: best.reputation.avgLatencyMs,
          alternatives: scored.slice(1, 4).map(s => s.agent),
        });
      }

      assignedAgentSet.add(best.walletPubkey);

      // Enforce max agents
      if (assignedAgentSet.size >= maxAgents) break;
    }

    // Deduplicate agents
    const agentsMap = new Map<string, AgentPDAAccount>();
    for (const a of assignments) {
      agentsMap.set(a.agent.walletPubkey, a.agent);
    }
    const agents = [...agentsMap.values()];

    // Metrics
    const estimatedCostPerCall = assignments.reduce(
      (sum, a) => sum + a.pricing.pricePerCall, 0n,
    );
    const avgReputation = agents.length > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.reputation.score, 0) / agents.length)
      : 0;
    const maxLatencyMs = agents.length > 0
      ? Math.max(...agents.map(a => a.reputation.avgLatencyMs))
      : 0;

    return {
      complete: unassigned.length === 0,
      assignments,
      unassigned,
      agents,
      estimatedCostPerCall,
      avgReputation,
      maxLatencyMs,
      buildTimeMs: Math.round(performance.now() - start),
      strategy,
    };
  }

  /**
   * @description Evaluate the health of an existing subnetwork result.
   *
   * Checks each assigned agent's reputation, uptime, and latency,
   * and identifies capabilities at risk (single provider) or with
   * redundancy (multiple alternatives).
   *
   * @param {SubnetworkResult} subnet - A previously built subnetwork
   * @returns {SubnetworkHealth} Health assessment
   *
   * @since 1.4.0
   */
  evaluateHealth(subnet: SubnetworkResult): SubnetworkHealth {
    const agentHealth: SubnetworkHealth['agents'] = [];
    const atRisk: string[] = [];
    const redundant: string[] = [];

    // Group capabilities by agent
    const agentCaps = new Map<string, string[]>();
    for (const a of subnet.assignments) {
      const key = a.agent.walletPubkey;
      if (!agentCaps.has(key)) agentCaps.set(key, []);
      agentCaps.get(key)!.push(a.capability);
    }

    for (const agent of subnet.agents) {
      const caps = agentCaps.get(agent.walletPubkey) ?? [];
      let isHealthy = true;
      let reason: string | undefined;

      if (agent.reputation.uptimePercent < 50) {
        isHealthy = false;
        reason = `Low uptime: ${agent.reputation.uptimePercent}%`;
      } else if (agent.reputation.score < 200) {
        isHealthy = false;
        reason = `Very low reputation: ${agent.reputation.score}/1000`;
      } else if (agent.reputation.avgLatencyMs > 10000) {
        isHealthy = false;
        reason = `Very high latency: ${agent.reputation.avgLatencyMs}ms`;
      } else if (!agent.isActive) {
        isHealthy = false;
        reason = 'Agent is deactivated';
      }

      agentHealth.push({ agent, capabilities: caps, isHealthy, reason });
    }

    // Check redundancy
    for (const assignment of subnet.assignments) {
      if (assignment.alternatives.length === 0) {
        atRisk.push(assignment.capability);
      } else {
        redundant.push(assignment.capability);
      }
    }

    const unhealthyCount = agentHealth.filter(a => !a.isHealthy).length;
    let status: SubnetworkHealth['status'];
    if (unhealthyCount === 0) {
      status = 'healthy';
    } else if (unhealthyCount < agentHealth.length / 2) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    return { status, agents: agentHealth, atRisk, redundant };
  }

  /**
   * @description Rebuild a subnetwork, replacing unhealthy agents with alternatives.
   *
   * @param {SubnetworkResult} current - The current subnetwork
   * @param {SubnetworkConfig} config - Original config (for constraints)
   * @returns {Promise<SubnetworkResult>} A rebuilt subnetwork
   *
   * @since 1.4.0
   */
  async rebuild(current: SubnetworkResult, config: SubnetworkConfig): Promise<SubnetworkResult> {
    const health = this.evaluateHealth(current);

    if (health.status === 'healthy') return current;

    // Identify capabilities with unhealthy agents
    const unhealthyWallets = new Set(
      health.agents.filter(a => !a.isHealthy).map(a => a.agent.walletPubkey),
    );

    // Filter out unhealthy agents' capabilities and rebuild only those
    const capsToRebuild: string[] = [];
    for (const assignment of current.assignments) {
      if (unhealthyWallets.has(assignment.agent.walletPubkey)) {
        capsToRebuild.push(assignment.capability);
      }
    }

    if (capsToRebuild.length === 0) return current;

    // Full rebuild with the same config
    return this.build({
      ...config,
      requiredCapabilities: config.requiredCapabilities,
    });
  }

  /**
   * @description Estimate the total cost for N calls through the subnetwork.
   * @param {SubnetworkResult} subnet - Built subnetwork
   * @param {number} calls - Number of calls to estimate for
   * @returns {{ totalCost: bigint; perAgent: Array<{ agent: string; cost: bigint }> }}
   * @since 1.4.0
   */
  estimateCost(subnet: SubnetworkResult, calls: number): {
    totalCost: bigint;
    perAgent: Array<{ agent: string; cost: bigint }>;
  } {
    const perAgent = new Map<string, bigint>();

    for (const assignment of subnet.assignments) {
      const key = assignment.agent.walletPubkey;
      const current = perAgent.get(key) ?? 0n;
      perAgent.set(key, current + assignment.pricing.pricePerCall * BigInt(calls));
    }

    const totalCost = [...perAgent.values()].reduce((a, b) => a + b, 0n);

    return {
      totalCost,
      perAgent: [...perAgent.entries()].map(([agent, cost]) => ({ agent, cost })),
    };
  }

  /* ── Internal scoring ── */

  private scoreAgent(
    agent: AgentPDAAccount,
    strategy: SelectionStrategy,
    pricingTier: string,
    preferMultiCapable: boolean,
    requiredCapabilities: string[],
    alreadyAssigned: Set<string>,
  ): number {
    const pricing = this.findPricing(agent, pricingTier);
    const priceNorm = pricing
      ? 1 - Math.min(Number(pricing.pricePerCall) / 100000, 1) // lower price → higher score
      : 0;
    const repNorm = agent.reputation.score / 1000;
    const latNorm = 1 - Math.min(agent.reputation.avgLatencyMs / 10000, 1);
    const uptimeNorm = agent.reputation.uptimePercent / 100;

    let score: number;
    switch (strategy) {
      case 'cheapest':
        score = priceNorm * 0.7 + repNorm * 0.15 + uptimeNorm * 0.15;
        break;
      case 'reputable':
        score = repNorm * 0.6 + uptimeNorm * 0.25 + latNorm * 0.15;
        break;
      case 'fastest':
        score = latNorm * 0.6 + uptimeNorm * 0.2 + repNorm * 0.2;
        break;
      case 'balanced':
      default:
        score = repNorm * 0.3 + priceNorm * 0.25 + latNorm * 0.2 + uptimeNorm * 0.25;
        break;
    }

    // Bonus: agent already in the subnetwork (reduces hop count)
    if (alreadyAssigned.has(agent.walletPubkey)) {
      score += 0.15;
    }

    // Bonus: agent covers multiple required capabilities
    if (preferMultiCapable) {
      const coverage = requiredCapabilities.filter(
        cap => agent.capabilities.some(c => c.id === cap),
      ).length;
      if (coverage > 1) {
        score += 0.1 * (coverage - 1);
      }
    }

    return score;
  }

  private findPricing(agent: AgentPDAAccount, tierId: string): AgentPricingOnChain | undefined {
    return agent.pricing.find(p => p.tierId === tierId) ?? agent.pricing[0];
  }
}
