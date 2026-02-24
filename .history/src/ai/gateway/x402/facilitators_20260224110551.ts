/**
 * Known Solana Facilitators — Pre-configured facilitator presets for quick integration.
 *
 * Developers can choose a well-known facilitator by name instead of
 * manually configuring URLs, auth headers, and supported networks.
 *
 * @example Quick setup
 * ```ts
 * import { createFacilitator, Facilitator } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * // One-liner with API key
 * const fac = createFacilitator(Facilitator.PAYAI, { apiKey: 'pk_live_...' });
 *
 * // Or use the enum string
 * const fac2 = createFacilitator('dexter', { apiKey: 'dex_...' });
 * ```
 */

import type {
  X402Network,
  X402FacilitatorConfig,
  X402CreateAuthHeaders,
} from './types';
import { SOLANA_MAINNET, SOLANA_DEVNET, USDC_MAINNET, USDC_DEVNET } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Facilitator registry enum
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Well-known Solana x402 facilitators.
 *
 * Use with `createFacilitator()` for zero-config setup.
 */
export enum Facilitator {
  /** PayAI — AI-native payment infrastructure for Solana agents */
  PAYAI = 'payai',
  /** Dexter — High-performance DeFi facilitator with MEV protection */
  DEXTER = 'dexter',
  /** RelAI — Relay-based facilitator with gasless agent transactions */
  RELAI = 'relai',
  /** Coinbase x402 — The original x402 reference facilitator */
  COINBASE = 'coinbase',
}

/** String literal union matching the enum values (for ergonomic usage). */
export type FacilitatorName = `${Facilitator}`;

/* ═══════════════════════════════════════════════════════════════
 *  Supported asset descriptors
 * ═══════════════════════════════════════════════════════════════ */

/** Describes a token asset supported by a facilitator. */
export interface FacilitatorAsset {
  /** Human-readable label */
  label: string;
  /** SPL token mint address */
  mint: string;
  /** Number of decimals */
  decimals: number;
}

/** Well-known Solana SPL token mints. */
export const KNOWN_ASSETS = {
  USDC_MAINNET: { label: 'USDC',  mint: USDC_MAINNET, decimals: 6 },
  USDC_DEVNET:  { label: 'USDC (devnet)', mint: USDC_DEVNET, decimals: 6 },
  USDT_MAINNET: { label: 'USDT',  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  PYUSD_MAINNET: { label: 'PYUSD', mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo', decimals: 6 },
  SOL_NATIVE:   { label: 'SOL (wrapped)', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
} as const satisfies Record<string, FacilitatorAsset>;

/* ═══════════════════════════════════════════════════════════════
 *  Facilitator preset descriptor
 * ═══════════════════════════════════════════════════════════════ */

/** Auth strategy used by a facilitator. */
export enum FacilitatorAuthStrategy {
  /** Bearer token in Authorization header: `Authorization: Bearer <key>` */
  BEARER = 'bearer',
  /** Custom header: `X-API-Key: <key>` */
  API_KEY_HEADER = 'api-key-header',
  /** No auth required (public facilitator) */
  NONE = 'none',
}

/**
 * Full preset for a known facilitator, including URLs,
 * supported networks/assets, auth strategy, and capabilities.
 */
export interface FacilitatorPreset {
  /** Display name */
  name: string;
  /** Enum value */
  id: Facilitator;
  /** Short description */
  description: string;
  /** Production API URL */
  url: string;
  /** Devnet / testnet API URL (if available) */
  devnetUrl?: string;
  /** Website / docs link */
  docsUrl: string;
  /** Auth strategy */
  authStrategy: FacilitatorAuthStrategy;
  /** Name of the auth header (if authStrategy is API_KEY_HEADER) */
  authHeaderName?: string;
  /** Supported CAIP-2 networks */
  supportedNetworks: X402Network[];
  /** Supported payment assets */
  supportedAssets: FacilitatorAsset[];
  /** Whether the facilitator sponsors gas fees (feePayer) */
  sponsorsGas: boolean;
  /** Typical verification latency (ms) — informational */
  avgVerifyLatencyMs: number;
  /** Typical settlement latency (ms) — informational */
  avgSettleLatencyMs: number;
  /** Maximum payment timeout supported (seconds) */
  maxTimeoutSeconds: number;
  /** Extra capabilities */
  capabilities: FacilitatorCapability[];
}

/** Special capabilities a facilitator may offer. */
export enum FacilitatorCapability {
  /** Supports gasless transactions (facilitator is feePayer) */
  GASLESS = 'gasless',
  /** Supports batch settlements */
  BATCH_SETTLE = 'batch-settle',
  /** Supports streaming/micropayments */
  STREAMING = 'streaming',
  /** Supports escrow holds */
  ESCROW = 'escrow',
  /** Provides MEV protection */
  MEV_PROTECTION = 'mev-protection',
  /** Supports stablecoin-only payments */
  STABLECOIN_ONLY = 'stablecoin-only',
  /** Supports native SOL payments */
  NATIVE_SOL = 'native-sol',
  /** Multi-sig settlement support */
  MULTISIG = 'multisig',
  /** Webhook notifications for settlement events */
  WEBHOOKS = 'webhooks',
  /** Priority fee estimation for faster confirmation */
  PRIORITY_FEES = 'priority-fees',
}

/* ═══════════════════════════════════════════════════════════════
 *  Preset registry
 * ═══════════════════════════════════════════════════════════════ */

export const FACILITATOR_PRESETS: Record<Facilitator, FacilitatorPreset> = {
  /* ── PayAI ─────────────────────────────────────────────────── */
  [Facilitator.PAYAI]: {
    name: 'PayAI',
    id: Facilitator.PAYAI,
    description: 'AI-native payment infrastructure for Solana agents. Built for high-throughput agent commerce with gasless transactions and real-time webhooks.',
    url: 'https://facilitator.payai.network',
    devnetUrl: 'https://devnet.facilitator.payai.network',
    docsUrl: 'https://docs.payai.network/x402',
    authStrategy: FacilitatorAuthStrategy.BEARER,
    supportedNetworks: [SOLANA_MAINNET, SOLANA_DEVNET],
    supportedAssets: [
      KNOWN_ASSETS.USDC_MAINNET,
      KNOWN_ASSETS.USDC_DEVNET,
      KNOWN_ASSETS.USDT_MAINNET,
      KNOWN_ASSETS.PYUSD_MAINNET,
    ],
    sponsorsGas: true,
    avgVerifyLatencyMs: 80,
    avgSettleLatencyMs: 400,
    maxTimeoutSeconds: 120,
    capabilities: [
      FacilitatorCapability.GASLESS,
      FacilitatorCapability.BATCH_SETTLE,
      FacilitatorCapability.STREAMING,
      FacilitatorCapability.WEBHOOKS,
      FacilitatorCapability.PRIORITY_FEES,
      FacilitatorCapability.STABLECOIN_ONLY,
    ],
  },

  /* ── Dexter ────────────────────────────────────────────────── */
  [Facilitator.DEXTER]: {
    name: 'Dexter',
    id: Facilitator.DEXTER,
    description: 'High-performance DeFi facilitator with MEV-protected settlements. Optimized for latency-sensitive agent trading flows.',
    url: 'https://x402.dexter.trade/v1',
    devnetUrl: 'https://x402-devnet.dexter.trade/v1',
    docsUrl: 'https://docs.dexter.trade/x402',
    authStrategy: FacilitatorAuthStrategy.API_KEY_HEADER,
    authHeaderName: 'X-Dexter-Key',
    supportedNetworks: [SOLANA_MAINNET, SOLANA_DEVNET],
    supportedAssets: [
      KNOWN_ASSETS.USDC_MAINNET,
      KNOWN_ASSETS.USDC_DEVNET,
      KNOWN_ASSETS.USDT_MAINNET,
      KNOWN_ASSETS.SOL_NATIVE,
    ],
    sponsorsGas: true,
    avgVerifyLatencyMs: 50,
    avgSettleLatencyMs: 300,
    maxTimeoutSeconds: 90,
    capabilities: [
      FacilitatorCapability.GASLESS,
      FacilitatorCapability.MEV_PROTECTION,
      FacilitatorCapability.NATIVE_SOL,
      FacilitatorCapability.PRIORITY_FEES,
      FacilitatorCapability.ESCROW,
    ],
  },

  /* ── RelAI ─────────────────────────────────────────────────── */
  [Facilitator.RELAI]: {
    name: 'RelAI',
    id: Facilitator.RELAI,
    description: 'Relay-based facilitator with gasless agent transactions. Designed for multi-sig and institutional agent deployments.',
    url: 'https://relay.relai.network/x402',
    devnetUrl: 'https://relay-devnet.relai.network/x402',
    docsUrl: 'https://relai.network/docs/x402',
    authStrategy: FacilitatorAuthStrategy.BEARER,
    supportedNetworks: [SOLANA_MAINNET, SOLANA_DEVNET],
    supportedAssets: [
      KNOWN_ASSETS.USDC_MAINNET,
      KNOWN_ASSETS.USDC_DEVNET,
      KNOWN_ASSETS.PYUSD_MAINNET,
    ],
    sponsorsGas: true,
    avgVerifyLatencyMs: 100,
    avgSettleLatencyMs: 500,
    maxTimeoutSeconds: 180,
    capabilities: [
      FacilitatorCapability.GASLESS,
      FacilitatorCapability.MULTISIG,
      FacilitatorCapability.ESCROW,
      FacilitatorCapability.WEBHOOKS,
      FacilitatorCapability.STABLECOIN_ONLY,
    ],
  },

  /* ── Coinbase (reference implementation) ───────────────────── */
  [Facilitator.COINBASE]: {
    name: 'Coinbase x402',
    id: Facilitator.COINBASE,
    description: 'The original x402 reference facilitator by Coinbase. Broad EVM + Solana support.',
    url: 'https://x402.org/facilitator',
    docsUrl: 'https://github.com/coinbase/x402',
    authStrategy: FacilitatorAuthStrategy.NONE,
    supportedNetworks: [SOLANA_MAINNET],
    supportedAssets: [
      KNOWN_ASSETS.USDC_MAINNET,
    ],
    sponsorsGas: false,
    avgVerifyLatencyMs: 200,
    avgSettleLatencyMs: 800,
    maxTimeoutSeconds: 60,
    capabilities: [],
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Auth header builders
 * ═══════════════════════════════════════════════════════════════ */

/** Options for configuring a known facilitator. */
export interface FacilitatorQuickConfig {
  /** API key / auth token for the facilitator */
  apiKey?: string;
  /** Use devnet instead of mainnet */
  devnet?: boolean;
  /** Override the default timeout */
  timeoutMs?: number;
  /** Additional headers to include in all requests */
  extraHeaders?: Record<string, string>;
}

/**
 * Builds an `X402CreateAuthHeaders` factory from a preset + quick config.
 *
 * Maps the auth strategy to the correct header format automatically.
 */
function buildAuthFactory(
  preset: FacilitatorPreset,
  config: FacilitatorQuickConfig,
): X402CreateAuthHeaders | undefined {
  if (!config.apiKey) {
    if (preset.authStrategy === FacilitatorAuthStrategy.NONE) return undefined;
    return undefined; // no key provided, let facilitator reject if auth required
  }

  const extra = config.extraHeaders ?? {};

  switch (preset.authStrategy) {
    case FacilitatorAuthStrategy.BEARER:
      return async () => {
        const h = { Authorization: `Bearer ${config.apiKey}`, ...extra };
        return { verify: h, settle: h, supported: extra };
      };

    case FacilitatorAuthStrategy.API_KEY_HEADER: {
      const headerName = preset.authHeaderName ?? 'X-API-Key';
      return async () => {
        const h = { [headerName]: config.apiKey!, ...extra };
        return { verify: h, settle: h, supported: extra };
      };
    }

    case FacilitatorAuthStrategy.NONE:
    default:
      if (Object.keys(extra).length > 0) {
        return async () => ({ verify: extra, settle: extra, supported: extra });
      }
      return undefined;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Preset → X402FacilitatorConfig resolver
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Resolve a facilitator name or enum into a fully-typed `X402FacilitatorConfig`.
 *
 * @param facilitator — name (e.g. `'payai'`) or enum value (`Facilitator.PAYAI`)
 * @param config — quick configuration (API key, devnet toggle, etc.)
 * @returns ready-to-use `X402FacilitatorConfig`
 *
 * @example
 * ```ts
 * const config = resolveFacilitatorConfig(Facilitator.PAYAI, { apiKey: 'pk_live_...' });
 * const paywall = new X402Paywall({ ...paywallConfig, facilitator: config });
 * ```
 */
export function resolveFacilitatorConfig(
  facilitator: Facilitator | FacilitatorName,
  config: FacilitatorQuickConfig = {},
): X402FacilitatorConfig {
  const name = facilitator.toLowerCase() as FacilitatorName;
  const preset = FACILITATOR_PRESETS[name as Facilitator];

  if (!preset) {
    const known = Object.values(Facilitator).join(', ');
    throw new Error(`Unknown facilitator '${facilitator}'. Known facilitators: ${known}`);
  }

  const url = config.devnet && preset.devnetUrl
    ? preset.devnetUrl
    : preset.url;

  return {
    url,
    createAuthHeaders: buildAuthFactory(preset, config),
    timeoutMs: config.timeoutMs,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Discovery helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * List all known facilitator presets.
 *
 * @example
 * ```ts
 * const all = listFacilitators();
 * console.table(all.map(f => ({ name: f.name, gas: f.sponsorsGas, latency: f.avgSettleLatencyMs })));
 * ```
 */
export function listFacilitators(): FacilitatorPreset[] {
  return Object.values(FACILITATOR_PRESETS);
}

/**
 * Find facilitators that support a given network.
 *
 * @example
 * ```ts
 * const devnetFacs = findFacilitatorsByNetwork(SOLANA_DEVNET);
 * ```
 */
export function findFacilitatorsByNetwork(network: X402Network): FacilitatorPreset[] {
  return Object.values(FACILITATOR_PRESETS).filter(
    p => p.supportedNetworks.includes(network),
  );
}

/**
 * Find facilitators that support a given asset mint.
 *
 * @example
 * ```ts
 * const usdcFacs = findFacilitatorsByAsset(USDC_MAINNET);
 * ```
 */
export function findFacilitatorsByAsset(mint: string): FacilitatorPreset[] {
  return Object.values(FACILITATOR_PRESETS).filter(
    p => p.supportedAssets.some(a => a.mint === mint),
  );
}

/**
 * Find facilitators that have a specific capability.
 *
 * @example
 * ```ts
 * const gaslessFacs = findFacilitatorsByCapability(FacilitatorCapability.GASLESS);
 * ```
 */
export function findFacilitatorsByCapability(capability: FacilitatorCapability): FacilitatorPreset[] {
  return Object.values(FACILITATOR_PRESETS).filter(
    p => p.capabilities.includes(capability),
  );
}

/**
 * Find the fastest facilitator (by avg settlement latency).
 * Optionally filter by network.
 */
export function findFastestFacilitator(network?: X402Network): FacilitatorPreset | undefined {
  let candidates = Object.values(FACILITATOR_PRESETS);
  if (network) {
    candidates = candidates.filter(p => p.supportedNetworks.includes(network));
  }
  return candidates.sort((a, b) => a.avgSettleLatencyMs - b.avgSettleLatencyMs)[0];
}

/**
 * Find the cheapest facilitator (gasless first, then by capabilities).
 * Optionally filter by network.
 */
export function findCheapestFacilitator(network?: X402Network): FacilitatorPreset | undefined {
  let candidates = Object.values(FACILITATOR_PRESETS);
  if (network) {
    candidates = candidates.filter(p => p.supportedNetworks.includes(network));
  }
  // Prefer gasless, then sort by settle latency as tiebreaker
  return candidates.sort((a, b) => {
    if (a.sponsorsGas !== b.sponsorsGas) return a.sponsorsGas ? -1 : 1;
    return a.avgSettleLatencyMs - b.avgSettleLatencyMs;
  })[0];
}
