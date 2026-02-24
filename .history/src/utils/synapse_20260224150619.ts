/**
 * Synapse Endpoints — Production-grade endpoint registry.
 *
 * Separates **network** (mainnet / devnet / testnet) from **region** (US / EU)
 * and provides typed, immutable endpoint configs that plug directly into
 * `SynapseClient`.
 *
 * @example Quick start
 * ```ts
 * import { SynapseNetwork, SynapseRegion, resolveEndpoint } from './utils/synapse';
 * import { SynapseClient } from './core/client';
 *
 * // Resolve + create client in one step
 * const client = SynapseClient.fromEndpoint({
 *   network: SynapseNetwork.Mainnet,
 *   region: SynapseRegion.US,
 *   apiKey: 'sk-...',
 * });
 *
 * // Or manually resolve and customize
 * const ep = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);
 * const client2 = new SynapseClient({ endpoint: ep.rpc, apiKey: '...' });
 * ```
 *
 * @example Auto-select fastest region
 * ```ts
 * const fastest = await autoSelectRegion(SynapseNetwork.Mainnet);
 * console.log(`Best region: ${fastest.region} (${fastest.latencyMs}ms)`);
 * ```
 *
 * @module utils/synapse
 */
import type { SynapseClientConfig } from '../core/client';

/* ═══════════════════════════════════════════════════════════════
 *  Enums — Network & Region
 * ═══════════════════════════════════════════════════════════════ */

/** Solana network environment. */
export enum SynapseNetwork {
  Mainnet = 'mainnet',
  Devnet  = 'devnet',
  Testnet = 'testnet',
}

/** Geographic region for endpoint selection. */
export enum SynapseRegion {
  US   = 'US',
  EU   = 'EU',
}

/* ═══════════════════════════════════════════════════════════════
 *  Endpoint types
 * ═══════════════════════════════════════════════════════════════ */

/** A fully-resolved set of service URLs for a single network + region combination. */
export interface SynapseEndpoint {
  /** Network environment. */
  readonly network: SynapseNetwork;
  /** Geographic region. */
  readonly region: SynapseRegion;
  /** HTTPS URL for JSON-RPC calls. */
  readonly rpc: string;
  /** WSS URL for WebSocket subscriptions. */
  readonly wss: string;
  /** HTTPS URL for gRPC transport (Yellowstone, etc.). */
  readonly grpc: string;
}

/** Shorthand config for `SynapseClient.fromEndpoint()`. */
export interface EndpointConnectConfig {
  network: SynapseNetwork;
  region?: SynapseRegion;
  /** API key / bearer token. */
  apiKey?: string;
  /** Request timeout in ms. */
  timeout?: number;
  /** Enable debug logging. */
  debug?: boolean;
  /** Additional headers. */
  headers?: Record<string, string>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Endpoint registry — immutable, keyed by `network:region`
 * ═══════════════════════════════════════════════════════════════ */

/** Registry key format. */
type EndpointKey = `${SynapseNetwork}:${SynapseRegion}`;

function key(n: SynapseNetwork, r: SynapseRegion): EndpointKey {
  return `${n}:${r}`;
}

function ep(
  network: SynapseNetwork,
  region: SynapseRegion,
  baseHost: string,
): SynapseEndpoint {
  return Object.freeze({
    network,
    region,
    rpc: `https://${baseHost}`,
    wss: `wss://${baseHost}/ws`,
    grpc: `https://${baseHost}/grpc`,
  });
}

/**
 * Internal registry — all known Synapse endpoints.
 * Frozen at module load to prevent runtime mutation.
 */
const REGISTRY: ReadonlyMap<EndpointKey, SynapseEndpoint> = Object.freeze(
  new Map<EndpointKey, SynapseEndpoint>([
    // ── Mainnet ────────────────────────────────────────────
    [key(SynapseNetwork.Mainnet, SynapseRegion.US), ep(SynapseNetwork.Mainnet, SynapseRegion.US, 'us-1-mainnet.oobeprotocol.ai')],
    [key(SynapseNetwork.Mainnet, SynapseRegion.EU), ep(SynapseNetwork.Mainnet, SynapseRegion.EU, 'eu-1-mainnet.oobeprotocol.ai')],

    // ── Devnet ─────────────────────────────────────────────
    [key(SynapseNetwork.Devnet, SynapseRegion.US), ep(SynapseNetwork.Devnet, SynapseRegion.US, 'us-1-devnet.oobeprotocol.ai')],
    [key(SynapseNetwork.Devnet, SynapseRegion.EU), ep(SynapseNetwork.Devnet, SynapseRegion.EU, 'eu-1-devnet.oobeprotocol.ai')],

    // ── Testnet ────────────────────────────────────────────
    [key(SynapseNetwork.Testnet, SynapseRegion.US), ep(SynapseNetwork.Testnet, SynapseRegion.US, 'us-1-testnet.oobeprotocol.ai')],
    [key(SynapseNetwork.Testnet, SynapseRegion.EU), ep(SynapseNetwork.Testnet, SynapseRegion.EU, 'eu-1-testnet.oobeprotocol.ai')],
  ]),
);

/* ═══════════════════════════════════════════════════════════════
 *  Public API — resolve, list, auto-select
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Resolve a single endpoint for the given network + region.
 * Throws if the combination is not registered.
 */
export function resolveEndpoint(
  network: SynapseNetwork,
  region: SynapseRegion = SynapseRegion.US,
): SynapseEndpoint {
  const endpoint = REGISTRY.get(key(network, region));
  if (!endpoint) {
    throw new Error(
      `No Synapse endpoint registered for ${network}:${region}. ` +
      `Available: ${[...REGISTRY.keys()].join(', ')}`,
    );
  }
  return endpoint;
}

/** List all registered endpoints, optionally filtered by network. */
export function listEndpoints(network?: SynapseNetwork): SynapseEndpoint[] {
  const all = [...REGISTRY.values()];
  return network ? all.filter((e) => e.network === network) : all;
}

/** List all available regions for a given network. */
export function listRegions(network: SynapseNetwork): SynapseRegion[] {
  return listEndpoints(network).map((e) => e.region);
}

/** List all available networks. */
export function listNetworks(): SynapseNetwork[] {
  return [...new Set([...REGISTRY.values()].map((e) => e.network))];
}

/**
 * Convert a `SynapseEndpoint` + optional overrides into a `SynapseClientConfig`
 * ready to be passed to `new SynapseClient(...)`.
 */
export function toClientConfig(
  endpoint: SynapseEndpoint,
  opts: {
    apiKey?: string;
    timeout?: number;
    debug?: boolean;
    headers?: Record<string, string>;
  } = {},
): SynapseClientConfig {
  return {
    endpoint: endpoint.rpc,
    wsEndpoint: endpoint.wss,
    grpcEndpoint: endpoint.grpc,
    apiKey: opts.apiKey,
    timeout: opts.timeout,
    debug: opts.debug,
    headers: opts.headers,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  probeLatency() + autoSelectRegion()
 *
 *  Async health check that pings the RPC endpoint and measures
 *  round-trip time. Used by autoSelectRegion to pick the fastest.
 * ═══════════════════════════════════════════════════════════════ */

/** Result of a single latency probe. */
export interface LatencyProbeResult {
  endpoint: SynapseEndpoint;
  region: SynapseRegion;
  latencyMs: number;
  healthy: boolean;
  error?: string;
}

/**
 * Probe a single endpoint for health and latency.
 * Sends a lightweight `getHealth` RPC call.
 */
export async function probeLatency(
  endpoint: SynapseEndpoint,
  timeoutMs = 5_000,
): Promise<LatencyProbeResult> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(endpoint.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    const healthy = res.ok;
    return { endpoint, region: endpoint.region, latencyMs, healthy };
  } catch (err: any) {
    return {
      endpoint,
      region: endpoint.region,
      latencyMs: Date.now() - t0,
      healthy: false,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Probe all regions for a given network and return them sorted by latency.
 * The first element is the fastest healthy region.
 *
 * @example
 * ```ts
 * const results = await autoSelectRegion(SynapseNetwork.Mainnet);
 * const best = results[0]; // fastest healthy region
 * const client = SynapseClient.fromEndpoint({ ...best.endpoint, apiKey: '...' });
 * ```
 */
export async function autoSelectRegion(
  network: SynapseNetwork,
  timeoutMs = 5_000,
): Promise<LatencyProbeResult[]> {
  const endpoints = listEndpoints(network);
  const results = await Promise.all(
    endpoints.map((ep) => probeLatency(ep, timeoutMs)),
  );

  // Sort: healthy first, then by latency ascending
  return results.sort((a, b) => {
    if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
    return a.latencyMs - b.latencyMs;
  });
}

/* ═══════════════════════════════════════════════════════════════
 *  Convenience — pre-resolved shortcuts
 *
 *  For users who just want `SYNAPSE_MAINNET_US` without resolving.
 * ═══════════════════════════════════════════════════════════════ */

/** Pre-resolved mainnet US endpoint. */
export const SYNAPSE_MAINNET_US = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US);

/** Pre-resolved mainnet EU endpoint. */
export const SYNAPSE_MAINNET_EU = resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.EU);

/** Pre-resolved devnet US endpoint. */
export const SYNAPSE_DEVNET_US = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.US);

/** Pre-resolved devnet EU endpoint. */
export const SYNAPSE_DEVNET_EU = resolveEndpoint(SynapseNetwork.Devnet, SynapseRegion.EU);

/* ═══════════════════════════════════════════════════════════════
 *  Legacy compatibility — SYNAPSE_ENDPOINTS
 *
 *  Maps the old `SYNAPSE_ENDPOINTS.US` / `.EU` shape to the
 *  new resolved mainnet endpoints. Marked @deprecated.
 * ═══════════════════════════════════════════════════════════════ */

/** @deprecated Use `resolveEndpoint(SynapseNetwork.Mainnet, SynapseRegion.US)` instead. */
export const SYNAPSE_ENDPOINTS = Object.freeze({
  US: SYNAPSE_MAINNET_US,
  EU: SYNAPSE_MAINNET_EU,
});