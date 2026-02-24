/**
 * x402 Facilitator Registry — Native registry of known x402 facilitators.
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
 * Complete registry of known x402 facilitators with their configuration,
 * supported networks, and metadata.
 *
 * Data sourced from the official x402 ecosystem:
 * https://x402.org/ecosystem
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
 * Get the metadata for a known facilitator.
 *
 * @param facilitator — a KnownFacilitator enum value
 * @returns full facilitator info or undefined if not found
 */
export function getFacilitatorInfo(
  facilitator: KnownFacilitator,
): KnownFacilitatorInfo | undefined {
  return FACILITATOR_REGISTRY.get(facilitator);
}

/**
 * Find all known facilitators that support a given network.
 *
 * ```ts
 * const solanaFacilitators = findFacilitatorsByNetwork(SOLANA_MAINNET);
 * // → [PayAI, Dexter, RelAI, CDP, AutoIncentive, SolPay, ...]
 * ```
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
 * Find all known facilitators that support gas sponsoring.
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
 * List all known facilitator IDs.
 */
export function listKnownFacilitators(): KnownFacilitator[] {
  return [...FACILITATOR_REGISTRY.keys()];
}

/**
 * Resolve a KnownFacilitator enum to a FacilitatorConfig
 * ready to be passed to `FacilitatorClient` or `createFacilitator()`.
 *
 * @param facilitator — KnownFacilitator enum value
 * @param overrides — optional overrides (auth headers, timeout)
 * @returns X402FacilitatorConfig
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
