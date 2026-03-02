/**
 * @module ai/gateway/x402/registry
 * @description x402 Facilitator Registry — Native registry of known x402 facilitators.
 *
 * Provides instant access to pre-configured facilitator clients for
 * the most popular x402 facilitators in the Coinbase ecosystem.
 *
 * All facilitators implement the standard x402 protocol endpoints:
 *  - POST /verify   — verify a payment payload
 *  - POST /settle   — settle payment on-chain
 *  - GET  /supported — query supported schemes / networks
 *
 * @example Quick start with a known facilitator
 * ```ts
 * import { createFacilitator, KnownFacilitator } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * // One-liner: get a pre-configured PayAI client
 * const facilitator = createFacilitator(KnownFacilitator.PayAI);
 *
 * // Or use the registry directly
 * import { FACILITATOR_REGISTRY, getFacilitatorInfo } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const info = getFacilitatorInfo(KnownFacilitator.RelAI);
 * console.log(info.url); // "https://facilitator.x402.fi"
 * ```
 *
 * @since 1.0.0
 */

import type { X402FacilitatorConfig, X402Network, KnownFacilitatorInfo } from './types';
import {
  KnownFacilitator,
  X402ProtocolVersion,
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  BASE_MAINNET,
  BASE_SEPOLIA,
  ETHEREUM_MAINNET,
  POLYGON_MAINNET,
  AVALANCHE_MAINNET,
  SEI_MAINNET,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Facilitator Registry — static metadata for known facilitators
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Complete registry of known x402 facilitators with their configuration,
 * supported networks, and metadata.
 *
 * Data sourced from the official x402 ecosystem:
 * https://x402.org/ecosystem
 *
 * @since 1.0.0
 */
export const FACILITATOR_REGISTRY: ReadonlyMap<KnownFacilitator, KnownFacilitatorInfo> = new Map<
  KnownFacilitator,
  KnownFacilitatorInfo
>([
  /* ── PayAI ─────────────────────────────────────────────── */
  [
    KnownFacilitator.PayAI,
    {
      id: KnownFacilitator.PayAI,
      name: 'PayAI',
      description: 'Solana-first, multi-network x402 facilitator. Free tier available.',
      url: 'https://facilitator.payai.network',
      supportedNetworks: [
        SOLANA_MAINNET,
        SOLANA_DEVNET,
        BASE_MAINNET,
        BASE_SEPOLIA,
        POLYGON_MAINNET,
        AVALANCHE_MAINNET,
        SEI_MAINNET,
        'eip155:43113' as X402Network,   // Avalanche Fuji
        'eip155:80002' as X402Network,   // Polygon Amoy
        'eip155:713715' as X402Network,  // Sei Testnet
        'eip155:196' as X402Network,     // X Layer
        'eip155:1952' as X402Network,    // X Layer Testnet
        'eip155:1187947933' as X402Network, // SKALE Base
      ],
      supportedVersions: [X402ProtocolVersion.V1, X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: false,
      website: 'https://payai.network',
      notes: 'Free tier requires no API key. Set PAYAI_API_KEY_ID and PAYAI_API_KEY_SECRET env vars for production.',
    },
  ],

  /* ── Dexter ────────────────────────────────────────────── */
  [
    KnownFacilitator.Dexter,
    {
      id: KnownFacilitator.Dexter,
      name: 'Dexter',
      description: 'Solana & Base facilitator with integrated marketplace and cross-chain MCP bridge.',
      url: 'https://facilitator.usedex.dev',
      supportedNetworks: [
        SOLANA_MAINNET,
        SOLANA_DEVNET,
        BASE_MAINNET,
        BASE_SEPOLIA,
      ],
      supportedVersions: [X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: false,
      website: 'https://usedex.dev',
      notes: 'Agents discover tools via MCP, pay via x402, and get results in one flow.',
    },
  ],

  /* ── RelAI ─────────────────────────────────────────────── */
  [
    KnownFacilitator.RelAI,
    {
      id: KnownFacilitator.RelAI,
      name: 'RelAI',
      description: 'Multi-chain facilitator with gas-sponsored payments and Zauth endpoint protection.',
      url: 'https://facilitator.x402.fi',
      supportedNetworks: [
        SOLANA_MAINNET,
        SOLANA_DEVNET,
        ETHEREUM_MAINNET,
        POLYGON_MAINNET,
        BASE_MAINNET,
        BASE_SEPOLIA,
        AVALANCHE_MAINNET,
        'eip155:1187947933' as X402Network, // SKALE Base
        'eip155:103698795' as X402Network,  // SKALE BITE V2
      ],
      supportedVersions: [X402ProtocolVersion.V1, X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: true,
      website: 'https://relai.fi',
      notes: 'Gas-sponsored: RelAI pays gas on all supported networks. Supports Zauth extensions for pre-payment endpoint validation.',
    },
  ],

  /* ── CDP (Coinbase Developer Platform) ─────────────────── */
  [
    KnownFacilitator.CDP,
    {
      id: KnownFacilitator.CDP,
      name: 'CDP (Coinbase)',
      description: 'Best-in-class x402 facilitator by Coinbase. Fee-free USDC settlement on Base.',
      url: 'https://x402.org/facilitator',
      supportedNetworks: [
        BASE_MAINNET,
        BASE_SEPOLIA,
        SOLANA_MAINNET,
        SOLANA_DEVNET,
      ],
      supportedVersions: [X402ProtocolVersion.V1, X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: true,
      website: 'https://x402.org',
      notes: 'Reference facilitator from Coinbase. KYT/OFAC checks on every transaction.',
    },
  ],

  /* ── AutoIncentive ─────────────────────────────────────── */
  [
    KnownFacilitator.AutoIncentive,
    {
      id: KnownFacilitator.AutoIncentive,
      name: 'AutoIncentive',
      description: 'Free, public x402 facilitator for Base and Solana. No API keys required.',
      url: 'https://facilitator.autoincentive.online',
      supportedNetworks: [
        BASE_MAINNET,
        BASE_SEPOLIA,
        SOLANA_MAINNET,
        SOLANA_DEVNET,
      ],
      supportedVersions: [X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: false,
      website: 'https://autoincentive.online',
      notes: 'Full verify + settle flow with on-chain USDC transfers. Completely free.',
    },
  ],

  /* ── SolPay ────────────────────────────────────────────── */
  [
    KnownFacilitator.SolPay,
    {
      id: KnownFacilitator.SolPay,
      name: 'SolPay',
      description: 'Solana-native facilitator with sub-second finality and trustless escrow.',
      url: 'https://facilitator.solpay.app',
      supportedNetworks: [
        SOLANA_MAINNET,
        SOLANA_DEVNET,
      ],
      supportedVersions: [X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: false,
      website: 'https://solpay.app',
      notes: 'Solana-only. USDC settlements with sub-second finality.',
    },
  ],

  /* ── Coinbase Default (testnet) ────────────────────────── */
  [
    KnownFacilitator.CoinbaseDefault,
    {
      id: KnownFacilitator.CoinbaseDefault,
      name: 'x402.org (Testnet)',
      description: 'Default testnet facilitator for x402 protocol testing.',
      url: 'https://x402.org/facilitator',
      supportedNetworks: [
        BASE_SEPOLIA,
        SOLANA_DEVNET,
      ],
      supportedVersions: [X402ProtocolVersion.V1, X402ProtocolVersion.V2],
      supportedSchemes: ['exact'],
      requiresApiKey: false,
      gasSponsored: true,
      website: 'https://x402.org',
      notes: 'Same as CDP. Use for testnet development.',
    },
  ],
]);

/* ═══════════════════════════════════════════════════════════════
 *  Registry query helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Get the metadata for a known facilitator.
 *
 * @param {KnownFacilitator} facilitator - A KnownFacilitator enum value
 * @returns {KnownFacilitatorInfo | undefined} Full facilitator info or undefined if not found
 * @since 1.0.0
 */
export function getFacilitatorInfo(
  facilitator: KnownFacilitator,
): KnownFacilitatorInfo | undefined {
  return FACILITATOR_REGISTRY.get(facilitator);
}

/**
 * @description Find all known facilitators that support a given network.
 *
 * @example
 * ```ts
 * const solanaFacilitators = findFacilitatorsByNetwork(SOLANA_MAINNET);
 * // → [PayAI, Dexter, RelAI, CDP, AutoIncentive, SolPay, ...]
 * ```
 *
 * @param {X402Network} network - CAIP-2 network identifier
 * @returns {KnownFacilitatorInfo[]} Array of facilitators supporting the network
 * @since 1.0.0
 */
export function findFacilitatorsByNetwork(
  network: X402Network,
): KnownFacilitatorInfo[] {
  const results: KnownFacilitatorInfo[] = [];
  for (const info of FACILITATOR_REGISTRY.values()) {
    if (info.supportedNetworks.includes(network)) {
      results.push(info);
    }
  }
  return results;
}

/**
 * @description Find all known facilitators that support gas sponsoring.
 * @returns {KnownFacilitatorInfo[]} Array of gas-sponsored facilitators
 * @since 1.0.0
 */
export function findGasSponsoredFacilitators(): KnownFacilitatorInfo[] {
  const results: KnownFacilitatorInfo[] = [];
  for (const info of FACILITATOR_REGISTRY.values()) {
    if (info.gasSponsored) {
      results.push(info);
    }
  }
  return results;
}

/**
 * @description List all known facilitator IDs.
 * @returns {KnownFacilitator[]} Array of all known facilitator enum values
 * @since 1.0.0
 */
export function listKnownFacilitators(): KnownFacilitator[] {
  return [...FACILITATOR_REGISTRY.keys()];
}

/**
 * @description Resolve a KnownFacilitator enum to a FacilitatorConfig
 * ready to be passed to `FacilitatorClient` or `createFacilitator()`.
 *
 * @param {KnownFacilitator} facilitator - KnownFacilitator enum value
 * @param {Partial<Omit<X402FacilitatorConfig, 'url'>>} [overrides] - Optional overrides (auth headers, timeout)
 * @returns {X402FacilitatorConfig} The resolved facilitator configuration
 * @throws {Error} If the facilitator is not found in the registry
 * @since 1.0.0
 */
export function resolveKnownFacilitator(
  facilitator: KnownFacilitator,
  overrides?: Partial<Omit<X402FacilitatorConfig, 'url'>>,
): X402FacilitatorConfig {
  const info = FACILITATOR_REGISTRY.get(facilitator);
  if (!info) {
    throw new Error(`Unknown facilitator: "${facilitator}". Use one of: ${listKnownFacilitators().join(', ')}`);
  }

  return {
    url: info.url,
    createAuthHeaders: overrides?.createAuthHeaders,
    timeoutMs: overrides?.timeoutMs ?? 30_000,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  FacilitatorDiscovery — runtime-aware wrapper over the static registry
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Result of a {@link FacilitatorDiscovery.healthCheck} call.
 * @since 1.2.2
 */
export interface FacilitatorHealthResult {
  facilitator: KnownFacilitator;
  url: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * @description Options for {@link FacilitatorDiscovery.findBest}.
 * @since 1.2.2
 */
export interface FindBestOptions {
  /** Required network support. */
  network?: X402Network;
  /** Prefer gas-sponsored facilitators. */
  preferGasSponsored?: boolean;
  /** Require gas sponsorship (strict). */
  requireGasSponsored?: boolean;
  /** Required protocol version. */
  version?: X402ProtocolVersion;
  /** Run a health check and exclude unhealthy facilitators. Default: `false`. */
  healthCheck?: boolean;
}

/**
 * @description Runtime-aware facilitator discovery service.
 *
 * Wraps the static {@link FACILITATOR_REGISTRY} with dynamic operations:
 * health checking, smart selection, and filtering by multiple criteria.
 *
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { FacilitatorDiscovery, SOLANA_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const discovery = new FacilitatorDiscovery();
 *
 * // Find the best facilitator for Solana mainnet (with health check)
 * const best = await discovery.findBest({ network: SOLANA_MAINNET, healthCheck: true });
 *
 * // Health check all facilitators
 * const health = await discovery.healthCheck();
 * console.log(health.filter(h => h.healthy));
 * ```
 */
export class FacilitatorDiscovery {
  private readonly timeoutMs: number;

  /**
   * @param {{ timeoutMs?: number }} [opts] - Options
   * @param {number} [opts.timeoutMs=5000] - Timeout for health check requests
   */
  constructor(opts: { timeoutMs?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? 5_000;
  }

  /**
   * @description Get all known facilitators as an array.
   * @returns {KnownFacilitatorInfo[]} All facilitators
   * @since 1.2.2
   */
  all(): KnownFacilitatorInfo[] {
    return [...FACILITATOR_REGISTRY.values()];
  }

  /**
   * @description Filter facilitators by a predicate.
   *
   * @param {(info: KnownFacilitatorInfo) => boolean} predicate - Filter function
   * @returns {KnownFacilitatorInfo[]} Matching facilitators
   * @since 1.2.2
   *
   * @example
   * ```ts
   * const solana = discovery.filter(f => f.supportedNetworks.includes(SOLANA_MAINNET));
   * const noKey  = discovery.filter(f => !f.requiresApiKey);
   * ```
   */
  filter(predicate: (info: KnownFacilitatorInfo) => boolean): KnownFacilitatorInfo[] {
    return [...FACILITATOR_REGISTRY.values()].filter(predicate);
  }

  /**
   * @description Filter facilitators by network, protocol version, and gas sponsoring.
   *
   * @param {object} criteria - Filter criteria
   * @returns {KnownFacilitatorInfo[]} Matching facilitators
   * @since 1.2.2
   */
  query(criteria: {
    network?: X402Network;
    version?: X402ProtocolVersion;
    gasSponsored?: boolean;
    requiresApiKey?: boolean;
    scheme?: string;
  }): KnownFacilitatorInfo[] {
    return this.filter(info => {
      if (criteria.network && !info.supportedNetworks.includes(criteria.network)) return false;
      if (criteria.version && !info.supportedVersions.includes(criteria.version)) return false;
      if (criteria.gasSponsored != null && info.gasSponsored !== criteria.gasSponsored) return false;
      if (criteria.requiresApiKey != null && info.requiresApiKey !== criteria.requiresApiKey) return false;
      if (criteria.scheme && !info.supportedSchemes.includes(criteria.scheme)) return false;
      return true;
    });
  }

  /**
   * @description Health check one or all known facilitators.
   *
   * Sends a `GET /supported` request (standard x402 endpoint) and
   * measures round-trip time. Times out after `timeoutMs`.
   *
   * @param {KnownFacilitator} [facilitator] - Check a specific facilitator, or omit for all
   * @returns {Promise<FacilitatorHealthResult[]>} Health results
   * @since 1.2.2
   */
  async healthCheck(facilitator?: KnownFacilitator): Promise<FacilitatorHealthResult[]> {
    const targets: KnownFacilitatorInfo[] = facilitator
      ? [FACILITATOR_REGISTRY.get(facilitator)!].filter(Boolean)
      : [...FACILITATOR_REGISTRY.values()];

    const results = await Promise.allSettled(
      targets.map(async (info): Promise<FacilitatorHealthResult> => {
        const start = performance.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
          const res = await fetch(`${info.url}/supported`, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const latencyMs = Math.round(performance.now() - start);
          return {
            facilitator: info.id,
            url: info.url,
            healthy: res.ok || res.status === 200,
            latencyMs,
          };
        } catch (err) {
          return {
            facilitator: info.id,
            url: info.url,
            healthy: false,
            latencyMs: Math.round(performance.now() - start),
            error: String(err),
          };
        }
      }),
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : {
      facilitator: KnownFacilitator.CoinbaseDefault,
      url: '',
      healthy: false,
      latencyMs: 0,
      error: String((r as PromiseRejectedResult).reason),
    });
  }

  /**
   * @description Find the best facilitator based on criteria and optional health check.
   *
   * Selection priority:
   * 1. Filter by `network`, `version`, `requireGasSponsored`
   * 2. If `healthCheck` is true, remove unhealthy facilitators
   * 3. Sort by: gas-sponsored preference → lowest latency
   * 4. Return the top match (or `null` if none match)
   *
   * @param {FindBestOptions} [opts] - Selection criteria
   * @returns {Promise<KnownFacilitatorInfo | null>} Best match or null
   * @since 1.2.2
   *
   * @example
   * ```ts
   * const best = await discovery.findBest({
   *   network: SOLANA_MAINNET,
   *   preferGasSponsored: true,
   *   healthCheck: true,
   * });
   * if (best) {
   *   const facilitator = createFacilitator(best.id);
   * }
   * ```
   */
  async findBest(opts: FindBestOptions = {}): Promise<KnownFacilitatorInfo | null> {
    // Step 1: Filter by criteria
    let candidates = this.filter(info => {
      if (opts.network && !info.supportedNetworks.includes(opts.network)) return false;
      if (opts.version && !info.supportedVersions.includes(opts.version)) return false;
      if (opts.requireGasSponsored && !info.gasSponsored) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    // Step 2: Optional health check
    let healthResults: Map<KnownFacilitator, FacilitatorHealthResult> | null = null;
    if (opts.healthCheck) {
      const checks = await Promise.allSettled(
        candidates.map(async (info): Promise<FacilitatorHealthResult> => {
          const start = performance.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
            const res = await fetch(`${info.url}/supported`, {
              method: 'GET',
              signal: controller.signal,
            });
            clearTimeout(timeout);
            return {
              facilitator: info.id,
              url: info.url,
              healthy: res.ok,
              latencyMs: Math.round(performance.now() - start),
            };
          } catch (err) {
            return {
              facilitator: info.id,
              url: info.url,
              healthy: false,
              latencyMs: Math.round(performance.now() - start),
              error: String(err),
            };
          }
        }),
      );

      healthResults = new Map();
      for (const r of checks) {
        if (r.status === 'fulfilled') {
          healthResults.set(r.value.facilitator, r.value);
        }
      }

      // Remove unhealthy
      candidates = candidates.filter(c => healthResults!.get(c.id)?.healthy !== false);
      if (candidates.length === 0) return null;
    }

    // Step 3: Sort by preference
    candidates.sort((a, b) => {
      // Prefer gas-sponsored if requested
      if (opts.preferGasSponsored) {
        if (a.gasSponsored && !b.gasSponsored) return -1;
        if (!a.gasSponsored && b.gasSponsored) return 1;
      }

      // Then by latency (if health checked)
      if (healthResults) {
        const aLatency = healthResults.get(a.id)?.latencyMs ?? Infinity;
        const bLatency = healthResults.get(b.id)?.latencyMs ?? Infinity;
        return aLatency - bLatency;
      }

      // Otherwise by network coverage (more = better)
      return b.supportedNetworks.length - a.supportedNetworks.length;
    });

    return candidates[0] ?? null;
  }
}
