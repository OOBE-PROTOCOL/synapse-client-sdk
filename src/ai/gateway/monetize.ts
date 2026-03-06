/**
 * @module ai/gateway/monetize
 * @description DeFi Tool Monetization Bridge — connects protocol tools
 * (Jupiter, Raydium, Metaplex, etc.) to the AgentGateway commerce layer.
 *
 * Every protocol tool becomes a metered, attested, x402-payable service:
 * - Budget tracking per session
 * - Rate limiting (sliding window)
 * - Proof-of-Computation attestation
 * - Auto-publish to ToolMarketplace
 * - x402 payment integration
 *
 * @example
 * ```ts
 * import { createAgentGateway, createJupiterTools, createMonetizedTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const gateway = createAgentGateway(client, config);
 * const jupiter = createJupiterTools({ apiKey: '...' });
 * const session = gateway.openSession(intent);
 *
 * // Wrap all Jupiter tools with metering + attestation
 * const monetized = await createMonetizedTools(gateway, session.id, jupiter);
 * agent.tools.push(...monetized.tools);
 *
 * // Multi-protocol monetization
 * const all = await createMultiProtocolMonetizedTools(gateway, session.id, {
 *   jupiter: createJupiterTools(),
 *   raydium: createRaydiumTools(),
 * });
 * agent.tools.push(...all.allTools);
 * ```
 *
 * @since 1.3.0
 */

import type {
  AgentId,
  AgentIdentity,
  PricingTier,
  AttestedResult,
  ToolListing,
  ResponseAttestation,
} from './types';
import type { AgentSession } from './session';
import type { ResponseValidator } from './validator';
import type { ToolMarketplace } from './marketplace';
import type { ProtocolToolkit, ProtocolTool, ProtocolMethod } from '../tools/protocols/shared';

/* ═══════════════════════════════════════════════════════════════
 *  Error
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error class for monetization-related failures.
 * @since 1.3.0
 */
export class MonetizeError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='MONETIZE_ERROR'] - Machine-readable error code
   */
  constructor(message: string, public readonly code = 'MONETIZE_ERROR') {
    super(message);
    this.name = 'MonetizeError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Interface satisfied by {@link AgentGateway}. Avoids circular
 * dependency while giving `createMonetizedTools` full access to the
 * session, validator, and marketplace subsystems.
 *
 * @since 1.3.0
 */
export interface MonetizableGateway {
  /** Seller's unique agent identifier. */
  readonly agentId: AgentId;
  /** Seller's full identity (name, wallet, tags). */
  readonly identity: AgentIdentity;
  /** Proof-of-Computation engine. */
  readonly validator: ResponseValidator;
  /** Decentralized tool marketplace. */
  readonly marketplace: ToolMarketplace;
  /** Look up a live session by ID. Returns `undefined` if not found. */
  getSession(sessionId: string): AgentSession | undefined;
}

/**
 * @description Configuration for {@link createMonetizedTools}.
 * @since 1.3.0
 */
export interface MonetizeConfig {
  /**
   * If `true`, each monetized tool is automatically listed on the
   * gateway's {@link ToolMarketplace}.
   * @default true
   */
  autoPublish?: boolean;
  /**
   * Description prefix prepended to every tool description.
   * @default '[Monetized]'
   */
  descriptionPrefix?: string;
  /**
   * Force attestation on/off regardless of the session tier.
   * When `undefined`, inherits the tier's `includesAttestation` flag.
   */
  includeAttestation?: boolean;
  /**
   * Tool name prefix. Each tool will be named `<prefix><protocol>_<method>`.
   * @default 'monetized_'
   */
  prefix?: string;
  /**
   * Region hint added to marketplace listings.
   * @default undefined
   */
  region?: string;
  /**
   * Commitment levels advertised in marketplace listings.
   * @default ['confirmed']
   */
  commitments?: ('processed' | 'confirmed' | 'finalized')[];
  /**
   * Pricing tiers to advertise when auto-publishing.
   * When omitted, the session's current tier is used.
   */
  tiers?: PricingTier[];
}

/**
 * @description Live monetization counters tracked per-toolkit.
 * @since 1.3.0
 */
export interface MonetizationMetrics {
  /** Total successful calls across all tools. */
  totalCalls: number;
  /** Cumulative revenue (smallest token unit). */
  totalRevenue: bigint;
  /** Call count keyed by method name. */
  callsByMethod: Record<string, number>;
  /** Revenue keyed by method name. */
  revenueByMethod: Record<string, bigint>;
  /** Running average latency (ms). */
  avgLatencyMs: number;
  /** Total failed invocations. */
  errors: number;
}

/**
 * @description Return type of {@link createMonetizedTools}. Extends
 * the toolkit concept with commerce metadata and lifecycle control.
 *
 * @since 1.3.0
 */
export interface MonetizedToolkit {
  /** Protocol identifier (e.g. `'jupiter'`). */
  protocol: string;
  /** Monetized LangChain-compatible tools. */
  tools: ProtocolTool[];
  /** Keyed tool map (both prefixed and unprefixed keys). */
  toolMap: Record<string, ProtocolTool>;
  /** Reference to the unwrapped original toolkit. */
  original: ProtocolToolkit;
  /** Session this toolkit is bound to. */
  sessionId: string;
  /** Live monetization metrics (updates on every call). */
  metrics: Readonly<MonetizationMetrics>;
  /**
   * Stop metering and reject all future calls.
   * Idempotent — calling twice is a no-op.
   */
  dispose(): void;
  /** Whether this toolkit has been disposed. */
  readonly disposed: boolean;
}

/**
 * @description Result of {@link createMultiProtocolMonetizedTools}.
 * @since 1.3.0
 */
export interface MultiMonetizedResult {
  /** Per-protocol toolkits. */
  toolkits: Record<string, MonetizedToolkit>;
  /** Flat array of every monetized tool across all protocols. */
  allTools: ProtocolTool[];
  /** Aggregate metrics across all protocols. */
  aggregateMetrics(): MonetizationMetrics;
  /** Dispose all toolkits at once. */
  disposeAll(): void;
}

/* ═══════════════════════════════════════════════════════════════
 *  createMonetizedTools()
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Wrap every tool in a {@link ProtocolToolkit} with session
 * metering, attestation, and optional marketplace listing.
 *
 * The returned tools are drop-in replacements for the originals: same
 * name pattern, same Zod schema, same JSON output — plus an
 * `_monetization` envelope that includes attestation, cost, and latency.
 *
 * @param {MonetizableGateway} gateway  - Gateway providing session + validator
 * @param {string}             sessionId - Active session to charge against
 * @param {ProtocolToolkit}    toolkit   - Original protocol toolkit to wrap
 * @param {MonetizeConfig}     [config]  - Optional monetization settings
 * @returns {Promise<MonetizedToolkit>} Monetized toolkit ready for agent use
 *
 * @throws {MonetizeError} If the session does not exist
 *
 * @example
 * ```ts
 * const monetized = await createMonetizedTools(gateway, session.id, jupiterTools);
 * const result = await monetized.toolMap.getQuote.invoke({ inputMint: 'So11...', outputMint: 'EPjF...' });
 * console.log(monetized.metrics); // { totalCalls: 1, totalRevenue: 1000n, ... }
 * ```
 *
 * @since 1.3.0
 */
export async function createMonetizedTools(
  gateway: MonetizableGateway,
  sessionId: string,
  toolkit: ProtocolToolkit,
  config: MonetizeConfig = {},
): Promise<MonetizedToolkit> {
  const session = gateway.getSession(sessionId);
  if (!session) {
    throw new MonetizeError(`Session '${sessionId}' not found`, 'SESSION_NOT_FOUND');
  }

  /* ── Lazy-import LangChain to keep gateway usable without it ── */
  const { tool: lcTool } = await import('@langchain/core/tools');

  const {
    autoPublish = true,
    descriptionPrefix = '[Monetized]',
    includeAttestation,
    prefix = 'monetized_',
    region,
    commitments = ['confirmed'],
    tiers,
  } = config;

  /* ── Mutable metrics ── */
  const metrics: MonetizationMetrics = {
    totalCalls: 0,
    totalRevenue: 0n,
    callsByMethod: {},
    revenueByMethod: {},
    avgLatencyMs: 0,
    errors: 0,
  };
  let cumulativeLatency = 0;
  let _disposed = false;

  /* ── Build wrapped tools ── */
  const tools: ProtocolTool[] = [];
  const toolMap: Record<string, ProtocolTool> = {};

  for (const method of toolkit.methods) {
    const originalTool = toolkit.toolMap[method.name];
    if (!originalTool) continue;

    const toolName = `${prefix}${toolkit.protocol}_${method.name}`;

    const wrappedTool = lcTool(
      async (input: unknown) => {
        if (_disposed) {
          throw new MonetizeError('Toolkit has been disposed', 'DISPOSED');
        }

        const currentSession = gateway.getSession(sessionId);
        if (!currentSession) {
          throw new MonetizeError(`Session '${sessionId}' is no longer active`, 'SESSION_EXPIRED');
        }

        /* 1 ── Pre-call: budget + rate limit ── */
        const cost = currentSession.preCall(method.name);

        const start = performance.now();
        try {
          /* 2 ── Execute original tool ── */
          const rawResult: unknown = await originalTool.invoke(input as Record<string, unknown>);
          const latencyMs = Math.round(performance.now() - start);

          /* 3 ── Parse result for attestation hashing ── */
          let parsed: unknown;
          try {
            parsed = JSON.parse(rawResult as string);
          } catch {
            parsed = rawResult;
          }

          /* 4 ── Attestation ── */
          const snap = currentSession.snapshot();
          const shouldAttest = includeAttestation ?? snap.tier.includesAttestation;

          const attested = await gateway.validator.wrapResult(
            parsed,
            sessionId,
            `${toolkit.protocol}:${method.name}`,
            input as Record<string, unknown>,
            0, // slot — protocol calls are off-chain
            latencyMs,
            snap.callsMade + 1,
            shouldAttest,
          );

          /* 5 ── Post-call: deduct budget ── */
          currentSession.postCall(method.name, cost);

          /* 6 ── Update metrics ── */
          metrics.totalCalls++;
          metrics.totalRevenue += cost;
          metrics.callsByMethod[method.name] = (metrics.callsByMethod[method.name] ?? 0) + 1;
          metrics.revenueByMethod[method.name] = (metrics.revenueByMethod[method.name] ?? 0n) + cost;
          cumulativeLatency += latencyMs;
          metrics.avgLatencyMs = Math.round(cumulativeLatency / metrics.totalCalls);

          /* 7 ── Return enriched result ── */
          return JSON.stringify({
            data: parsed,
            attestation: attested.attestation ?? null,
            latencyMs,
            callIndex: attested.callIndex,
            metered: true,
            protocol: toolkit.protocol,
            method: method.name,
            cost: cost.toString(),
          }, null, 2);
        } catch (err) {
          metrics.errors++;
          throw err;
        }
      },
      {
        name: toolName,
        description: `${descriptionPrefix} ${method.description ?? method.name} — metered + attested via Synapse Gateway`,
        schema: method.input as import('zod').ZodObject<any>,
      },
    );

    tools.push(wrappedTool);
    toolMap[method.name] = wrappedTool;   // unprefixed
    toolMap[toolName] = wrappedTool;       // prefixed
  }

  /* ── Auto-publish to marketplace ── */
  if (autoPublish) {
    const snap = session.snapshot();
    const publishTiers = tiers ?? [snap.tier];

    for (const method of toolkit.methods) {
      const listing: ToolListing = {
        method: `${toolkit.protocol}:${method.name}`,
        description: method.description ?? method.name,
        seller: gateway.identity,
        tiers: publishTiers,
        avgLatencyMs: 0,
        uptimePercent: 100,
        totalServed: 0,
        reputationScore: 500,
        attestationAvailable: true,
        region,
        commitments,
        listedAt: Date.now(),
        updatedAt: Date.now(),
      };
      gateway.marketplace.listTool(listing);
    }
  }

  return {
    protocol: toolkit.protocol,
    tools,
    toolMap,
    original: toolkit,
    sessionId,
    metrics,
    get disposed() { return _disposed; },
    dispose() {
      _disposed = true;
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createMultiProtocolMonetizedTools()
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Monetize multiple protocol toolkits in a single call.
 * Returns per-protocol toolkits plus a flat `allTools` array.
 *
 * @param {MonetizableGateway} gateway   - Gateway instance
 * @param {string}             sessionId - Active session
 * @param {Record<string, ProtocolToolkit>} toolkits - Map of protocol name → toolkit
 * @param {MonetizeConfig}     [config]  - Shared config applied to all toolkits
 * @returns {Promise<MultiMonetizedResult>} All monetized toolkits + aggregated helpers
 *
 * @example
 * ```ts
 * const result = await createMultiProtocolMonetizedTools(gateway, sid, {
 *   jupiter: jupiterToolkit,
 *   raydium: raydiumToolkit,
 *   metaplex: metaplexToolkit,
 * });
 * agent.tools.push(...result.allTools); // 48+ monetized tools
 * console.log(result.aggregateMetrics());
 * ```
 *
 * @since 1.3.0
 */
export async function createMultiProtocolMonetizedTools(
  gateway: MonetizableGateway,
  sessionId: string,
  toolkits: Record<string, ProtocolToolkit>,
  config: MonetizeConfig = {},
): Promise<MultiMonetizedResult> {
  const entries = Object.entries(toolkits);
  const monetized = await Promise.all(
    entries.map(([, tk]) => createMonetizedTools(gateway, sessionId, tk, config)),
  );

  const result: Record<string, MonetizedToolkit> = {};
  const allTools: ProtocolTool[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [name] = entries[i];
    result[name] = monetized[i];
    allTools.push(...monetized[i].tools);
  }

  return {
    toolkits: result,
    allTools,
    aggregateMetrics(): MonetizationMetrics {
      const agg: MonetizationMetrics = {
        totalCalls: 0,
        totalRevenue: 0n,
        callsByMethod: {},
        revenueByMethod: {},
        avgLatencyMs: 0,
        errors: 0,
      };
      let totalLatency = 0;
      for (const tk of monetized) {
        agg.totalCalls += tk.metrics.totalCalls;
        agg.totalRevenue += tk.metrics.totalRevenue;
        agg.errors += tk.metrics.errors;
        totalLatency += tk.metrics.avgLatencyMs * tk.metrics.totalCalls;
        for (const [k, v] of Object.entries(tk.metrics.callsByMethod)) {
          agg.callsByMethod[`${tk.protocol}:${k}`] = (agg.callsByMethod[`${tk.protocol}:${k}`] ?? 0) + v;
        }
        for (const [k, v] of Object.entries(tk.metrics.revenueByMethod)) {
          agg.revenueByMethod[`${tk.protocol}:${k}`] = (agg.revenueByMethod[`${tk.protocol}:${k}`] ?? 0n) + v;
        }
      }
      agg.avgLatencyMs = agg.totalCalls > 0 ? Math.round(totalLatency / agg.totalCalls) : 0;
      return agg;
    },
    disposeAll() {
      for (const tk of monetized) tk.dispose();
    },
  };
}
