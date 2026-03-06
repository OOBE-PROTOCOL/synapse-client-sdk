/**
 * @module ai/sap/scoring
 * @description SAP — Agent health scoring and network analytics.
 *
 * Computes composite health scores for individual agents and entire
 * sub-networks, factoring in reputation, uptime, latency, call volume,
 * capability coverage, and pricing competitiveness.
 *
 * Also provides **network-level analytics**: protocol concentration,
 * Gini coefficient for call distribution, and trend detection.
 *
 * @example
 * ```ts
 * import { computeAgentHealthScore, computeNetworkAnalytics } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const health = computeAgentHealthScore(agentPDA);
 * console.log(health.composite);   // 0..100
 * console.log(health.breakdown);   // { reputation, uptime, latency, activity, pricing }
 *
 * const analytics = computeNetworkAnalytics(allAgents);
 * console.log(analytics.giniCoefficient);     // 0..1 (0 = perfectly even)
 * console.log(analytics.protocolConcentration);
 * ```
 *
 * @since 1.4.0
 */

import type { AgentPDAAccount } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Breakdown of an agent's health score.
 * Each component is 0–100.
 * @since 1.4.0
 */
export interface HealthScoreBreakdown {
  /** Reputation component (from on-chain score 0–1000 mapped to 0–100). */
  reputation: number;
  /** Uptime component (0–100). */
  uptime: number;
  /** Latency component (lower latency → higher score). */
  latency: number;
  /** Activity component (based on call volume relative to network average). */
  activity: number;
  /** Pricing competitiveness (lower relative price → higher score). */
  pricing: number;
}

/**
 * @description Full health score result for a single agent.
 * @since 1.4.0
 */
export interface AgentHealthScore {
  /** Wallet pubkey. */
  walletPubkey: string;
  /** Agent name. */
  name: string;
  /** Composite score (0–100, weighted average of breakdown). */
  composite: number;
  /** Component-level breakdown. */
  breakdown: HealthScoreBreakdown;
  /** Qualitative tier: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'. */
  tier: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  /** Human-readable summary. */
  summary: string;
  /** Actionable recommendations (if any). */
  recommendations: string[];
}

/**
 * @description Network-level analytics across all agents.
 * @since 1.4.0
 */
export interface NetworkAnalytics {
  /** Total agents analysed. */
  totalAgents: number;
  /** Active agents count. */
  activeAgents: number;
  /** Average composite health score. */
  avgHealthScore: number;
  /** Distribution of agents by tier. */
  tierDistribution: Record<AgentHealthScore['tier'], number>;
  /** Gini coefficient for call distribution (0 = equal, 1 = one agent has all calls). */
  giniCoefficient: number;
  /** Protocol concentration: which protocols have the most agents. */
  protocolConcentration: Array<{ protocol: string; agentCount: number; pct: number }>;
  /** Capability coverage: how many agents cover each capability. */
  capabilityCoverage: Array<{ capability: string; agentCount: number }>;
  /** Top agents by composite score. */
  topAgents: Array<{ walletPubkey: string; name: string; score: number }>;
  /** Agents needing attention (score < 40). */
  needsAttention: Array<{ walletPubkey: string; name: string; score: number; reasons: string[] }>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Scoring Weights
 * ═══════════════════════════════════════════════════════════════ */

const DEFAULT_WEIGHTS = {
  reputation: 0.30,
  uptime:     0.25,
  latency:    0.20,
  activity:   0.15,
  pricing:    0.10,
} as const;

/* ═══════════════════════════════════════════════════════════════
 *  Single Agent Scoring
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Compute a composite health score for a single agent.
 *
 * @param {AgentPDAAccount} agent - The agent to score
 * @param {Object} [context] - Optional context for relative scoring
 * @param {number} [context.networkAvgCalls] - Network average calls (for activity scoring)
 * @param {bigint} [context.networkAvgPrice] - Network average price per call
 * @param {Partial<typeof DEFAULT_WEIGHTS>} [weights] - Override default weights
 * @returns {AgentHealthScore}
 *
 * @since 1.4.0
 */
export function computeAgentHealthScore(
  agent: AgentPDAAccount,
  context?: { networkAvgCalls?: number; networkAvgPrice?: bigint },
  weights?: Partial<typeof DEFAULT_WEIGHTS>,
): AgentHealthScore {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  // Reputation: 0–1000 → 0–100
  const reputation = Math.min(100, (agent.reputation.score / 1000) * 100);

  // Uptime: direct mapping (0–100)
  const uptime = Math.min(100, Math.max(0, agent.reputation.uptimePercent));

  // Latency: log scale, 0ms = 100, 100ms = 80, 1s = 50, 10s = 10, 30s+ = 0
  const latency = computeLatencyScore(agent.reputation.avgLatencyMs);

  // Activity: relative to network average (or absolute if no context)
  const avgCalls = context?.networkAvgCalls ?? 1000;
  const callRatio = Number(agent.reputation.totalCallsServed) / Math.max(avgCalls, 1);
  const activity = Math.min(100, callRatio * 50); // 2x average = 100

  // Pricing: lower is better (relative to network average)
  const agentPrice = agent.pricing[0]?.pricePerCall ?? 0n;
  const avgPrice = context?.networkAvgPrice ?? 5000n;
  const pricing = avgPrice > 0n
    ? Math.min(100, Math.max(0, 100 - Number((agentPrice * 100n) / avgPrice)))
    : 50;

  const breakdown: HealthScoreBreakdown = {
    reputation: Math.round(reputation),
    uptime: Math.round(uptime),
    latency: Math.round(latency),
    activity: Math.round(activity),
    pricing: Math.round(pricing),
  };

  const composite = Math.round(
    w.reputation * reputation +
    w.uptime * uptime +
    w.latency * latency +
    w.activity * activity +
    w.pricing * pricing,
  );

  const tier = scoreTier(composite);
  const recommendations = generateRecommendations(agent, breakdown);

  return {
    walletPubkey: agent.walletPubkey,
    name: agent.name,
    composite,
    breakdown,
    tier,
    summary: `${agent.name}: ${composite}/100 (${tier})`,
    recommendations,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Network Analytics
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Compute network-level analytics across all discovered agents.
 *
 * @param {AgentPDAAccount[]} agents - All agents in the network
 * @returns {NetworkAnalytics}
 *
 * @since 1.4.0
 */
export function computeNetworkAnalytics(agents: AgentPDAAccount[]): NetworkAnalytics {
  if (agents.length === 0) {
    return {
      totalAgents: 0,
      activeAgents: 0,
      avgHealthScore: 0,
      tierDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
      giniCoefficient: 0,
      protocolConcentration: [],
      capabilityCoverage: [],
      topAgents: [],
      needsAttention: [],
    };
  }

  // Context for relative scoring
  const totalCalls = agents.reduce((s, a) => s + Number(a.reputation.totalCallsServed), 0);
  const networkAvgCalls = totalCalls / agents.length;
  const totalPrice = agents.reduce((s, a) => s + (a.pricing[0]?.pricePerCall ?? 0n), 0n);
  const networkAvgPrice = totalPrice / BigInt(agents.length);

  // Score each agent
  const scores = agents.map(a =>
    computeAgentHealthScore(a, { networkAvgCalls, networkAvgPrice }),
  );

  const active = agents.filter(a => a.isActive).length;
  const avgScore = Math.round(scores.reduce((s, h) => s + h.composite, 0) / scores.length);

  // Tier distribution
  const tierDist: Record<AgentHealthScore['tier'], number> = {
    excellent: 0, good: 0, fair: 0, poor: 0, critical: 0,
  };
  for (const s of scores) tierDist[s.tier]++;

  // Gini coefficient (for call distribution fairness)
  const gini = computeGini(agents.map(a => Number(a.reputation.totalCallsServed)));

  // Protocol concentration
  const protocolMap = new Map<string, number>();
  for (const agent of agents) {
    for (const cap of agent.capabilities) {
      const protocol = cap.protocol ?? cap.id.split(':')[0];
      protocolMap.set(protocol, (protocolMap.get(protocol) ?? 0) + 1);
    }
  }
  const protocolConcentration = [...protocolMap.entries()]
    .map(([protocol, agentCount]) => ({
      protocol,
      agentCount,
      pct: Math.round((agentCount / agents.length) * 100),
    }))
    .sort((a, b) => b.agentCount - a.agentCount);

  // Capability coverage
  const capMap = new Map<string, number>();
  for (const agent of agents) {
    for (const cap of agent.capabilities) {
      capMap.set(cap.id, (capMap.get(cap.id) ?? 0) + 1);
    }
  }
  const capabilityCoverage = [...capMap.entries()]
    .map(([capability, agentCount]) => ({ capability, agentCount }))
    .sort((a, b) => b.agentCount - a.agentCount);

  // Top agents
  const topAgents = [...scores]
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 10)
    .map(s => ({ walletPubkey: s.walletPubkey, name: s.name, score: s.composite }));

  // Needs attention
  const needsAttention = scores
    .filter(s => s.composite < 40)
    .map(s => ({
      walletPubkey: s.walletPubkey,
      name: s.name,
      score: s.composite,
      reasons: s.recommendations,
    }));

  return {
    totalAgents: agents.length,
    activeAgents: active,
    avgHealthScore: avgScore,
    tierDistribution: tierDist,
    giniCoefficient: gini,
    protocolConcentration,
    capabilityCoverage,
    topAgents,
    needsAttention,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Internal Helpers
 * ═══════════════════════════════════════════════════════════════ */

function computeLatencyScore(ms: number): number {
  if (ms <= 0) return 100;
  if (ms <= 50) return 95;
  if (ms <= 100) return 85;
  if (ms <= 500) return 70;
  if (ms <= 1000) return 55;
  if (ms <= 3000) return 35;
  if (ms <= 10000) return 15;
  return 5;
}

function scoreTier(composite: number): AgentHealthScore['tier'] {
  if (composite >= 85) return 'excellent';
  if (composite >= 65) return 'good';
  if (composite >= 45) return 'fair';
  if (composite >= 25) return 'poor';
  return 'critical';
}

function generateRecommendations(agent: AgentPDAAccount, breakdown: HealthScoreBreakdown): string[] {
  const recs: string[] = [];

  if (breakdown.uptime < 50) {
    recs.push('Improve uptime — current uptime is below 50%, causing automatic filtering by discovery queries');
  }

  if (breakdown.reputation < 30) {
    recs.push('Reputation is very low — consider reducing pricing to attract initial calls and build reputation');
  }

  if (breakdown.latency < 30) {
    recs.push(`Reduce response latency (currently ${agent.reputation.avgLatencyMs}ms) — high latency reduces selection probability`);
  }

  if (breakdown.activity < 20) {
    recs.push('Very low call volume — register more capabilities or reduce pricing to increase visibility');
  }

  if (breakdown.pricing < 20) {
    recs.push('Pricing is significantly above network average — consider competitive pricing to increase call volume');
  }

  if (agent.capabilities.length < 2) {
    recs.push('Register additional capabilities — multi-capable agents are preferred by SubnetworkBuilder');
  }

  if (!agent.x402Endpoint) {
    recs.push('Add an x402 endpoint to enable pay-per-call via the x402 protocol');
  }

  return recs;
}

/**
 * @description Compute the Gini coefficient for a distribution of values.
 * 0 = perfectly equal, 1 = maximum inequality.
 * @internal
 */
function computeGini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    giniSum += (2 * (i + 1) - n - 1) * sorted[i];
  }

  return Math.round((giniSum / (n * sum)) * 1000) / 1000;
}
