/**
 * @module ai/plugins/misc/schemas
 * @description Misc Plugin — Zod schemas for utility & data protocols.
 *
 * Covers:
 *  - SNS            (3 methods — Solana Name Service: register, resolve, reverse-lookup)
 *  - Alldomains     (3 methods — multi-TLD domain registration + resolution)
 *  - Pyth           (3 methods — on-chain price feeds)
 *  - CoinGecko      (6 methods — market data, trending, gainers, pools)
 *  - GibWork        (3 methods — bounties & tasks)
 *  - Send Arcade    (2 methods — on-chain mini-games / referral rewards)
 *
 * Total: 20 methods
 *
 * @since 2.0.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../../tools/protocols/shared';

const zPubkey = z.string().describe('Solana public key (base58)');
const zMint   = z.string().describe('Token mint address (base58)');
const zAmount = z.string().describe('Raw token amount (smallest unit)');
const zTx     = z.string().describe('Base64-encoded serialized transaction');

/* ═══════════════════════════════════════════════════════════════
 *  1. SNS — Solana Name Service (.sol domains)
 * ═══════════════════════════════════════════════════════════════ */

const { register: regSns, methods: snsMethods } = createMethodRegistry('sns');

regSns(
  'registerDomain',
  z.object({
    wallet: zPubkey,
    domain: z.string().describe('Domain name without .sol suffix (e.g. "myname")'),
    space: z.number().int().min(1000).optional().default(1000).describe('Storage space in bytes'),
  }),
  z.object({
    domainKey: zPubkey.describe('Domain account public key'),
    tx: zTx,
    registrationCost: zAmount,
    signature: z.string().optional(),
  }),
  'Register a .sol domain name on Solana Name Service.',
);

regSns(
  'resolveDomain',
  z.object({
    domain: z.string().describe('Full domain name (e.g. "myname.sol")'),
  }),
  z.object({
    owner: zPubkey.nullable().describe('Wallet that owns this domain, null if unregistered'),
    domainKey: zPubkey,
    data: z.string().optional().describe('Custom data stored in the domain record'),
  }),
  'Resolve a .sol domain to its owner wallet address.',
);

regSns(
  'reverseLookup',
  z.object({
    wallet: zPubkey.describe('Wallet address to reverse-lookup'),
  }),
  z.object({
    domains: z.array(z.string()).describe('All .sol domains owned by this wallet'),
    primaryDomain: z.string().nullable().describe('Primary/favourite domain'),
  }),
  'Reverse-lookup all .sol domains owned by a wallet.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Alldomains — Multi-TLD Domain Resolution
 * ═══════════════════════════════════════════════════════════════ */

const { register: regDomains, methods: alldomainsMethods } = createMethodRegistry('alldomains');

regDomains(
  'registerDomain',
  z.object({
    wallet: zPubkey,
    domain: z.string().describe('Full domain (e.g. "myname.abc", "trader.bonk")'),
    tld: z.string().optional().describe('TLD if not included in domain string'),
  }),
  z.object({
    domainKey: zPubkey,
    tx: zTx,
    cost: zAmount,
    signature: z.string().optional(),
  }),
  'Register a domain on AllDomains (supports multiple TLDs: .abc, .bonk, .poor, etc.).',
);

regDomains(
  'resolveDomain',
  z.object({
    domain: z.string().describe('Full domain to resolve'),
  }),
  z.object({
    owner: zPubkey.nullable(),
    tld: z.string(),
    domainKey: zPubkey,
  }),
  'Resolve a multi-TLD domain to its owner wallet.',
);

regDomains(
  'getOwnedDomains',
  z.object({
    wallet: zPubkey,
    tld: z.string().optional().describe('Filter by TLD'),
  }),
  z.object({
    domains: z.array(z.object({
      domain: z.string(),
      tld: z.string(),
      domainKey: zPubkey,
    })),
  }),
  'Get all domains owned by a wallet across all TLDs.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Pyth — On-Chain Price Feeds
 * ═══════════════════════════════════════════════════════════════ */

const { register: regPyth, methods: pythMethods } = createMethodRegistry('pyth');

regPyth(
  'getPrice',
  z.object({
    priceId: z.string().describe('Pyth price feed ID (hex) or symbol (e.g. "SOL/USD")'),
  }),
  z.object({
    id: z.string(),
    price: z.number(),
    confidence: z.number(),
    expo: z.number(),
    publishTime: z.number(),
    emaPrice: z.number().optional(),
    emaConfidence: z.number().optional(),
    status: z.enum(['trading', 'halted', 'unknown']),
  }),
  'Get the current price from a Pyth on-chain oracle feed.',
);

regPyth(
  'getPriceHistory',
  z.object({
    priceId: z.string(),
    period: z.enum(['1h', '4h', '1d', '7d', '30d']).optional().default('1d'),
  }),
  z.object({
    prices: z.array(z.object({
      timestamp: z.number(),
      price: z.number(),
      confidence: z.number(),
    })),
    symbol: z.string().optional(),
  }),
  'Get historical price data from Pyth oracle.',
);

regPyth(
  'listPriceFeeds',
  z.object({
    query: z.string().optional().describe('Search filter (e.g. "SOL", "BTC")'),
    assetType: z.enum(['crypto', 'equity', 'fx', 'metal', 'rates']).optional(),
  }),
  z.object({
    feeds: z.array(z.object({
      id: z.string(),
      symbol: z.string(),
      assetType: z.string(),
      description: z.string().optional(),
    })),
  }),
  'List available Pyth price feeds, optionally filtered by query or asset type.',
);

/* ═══════════════════════════════════════════════════════════════
 *  4. CoinGecko — Market Data (Pro API)
 * ═══════════════════════════════════════════════════════════════ */

const { register: regGecko, methods: coingeckoMethods } = createMethodRegistry('coingecko');

regGecko(
  'getTokenPrice',
  z.object({
    tokenId: z.string().describe('CoinGecko token ID or contract address'),
    vsCurrency: z.string().optional().default('usd'),
    includeMarketCap: z.boolean().optional().default(true),
    include24hChange: z.boolean().optional().default(true),
    include24hVolume: z.boolean().optional().default(true),
  }),
  z.object({
    id: z.string(),
    symbol: z.string(),
    currentPrice: z.number(),
    marketCap: z.number().optional(),
    priceChange24h: z.number().optional(),
    priceChangePercent24h: z.number().optional(),
    volume24h: z.number().optional(),
    high24h: z.number().optional(),
    low24h: z.number().optional(),
    ath: z.number().optional(),
    athDate: z.string().optional(),
  }),
  'Get token price and market data from CoinGecko.',
);

regGecko(
  'getTrending',
  z.object({}),
  z.object({
    coins: z.array(z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      marketCapRank: z.number().optional(),
      priceChange24h: z.number().optional(),
      thumb: z.string().optional(),
    })),
    nfts: z.array(z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
      thumb: z.string().optional(),
    })).optional(),
  }),
  'Get trending tokens and NFTs on CoinGecko.',
);

regGecko(
  'getTopGainersLosers',
  z.object({
    vsCurrency: z.string().optional().default('usd'),
    duration: z.enum(['1h', '24h', '7d', '14d', '30d', '1y']).optional().default('24h'),
  }),
  z.object({
    topGainers: z.array(z.object({
      id: z.string(),
      symbol: z.string(),
      name: z.string(),
      priceChangePercent: z.number(),
      currentPrice: z.number(),
    })),
    topLosers: z.array(z.object({
      id: z.string(),
      symbol: z.string(),
      name: z.string(),
      priceChangePercent: z.number(),
      currentPrice: z.number(),
    })),
  }),
  'Get top gainers and losers from CoinGecko.',
);

regGecko(
  'getTokenInfo',
  z.object({
    tokenId: z.string().describe('CoinGecko token ID'),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    description: z.string().optional(),
    homepage: z.string().optional(),
    genesisDate: z.string().optional(),
    categories: z.array(z.string()).optional(),
    platforms: z.record(z.string(), z.string()).optional().describe('Chain → contract_address mapping'),
    links: z.object({
      twitter: z.string().optional(),
      telegram: z.string().optional(),
      discord: z.string().optional(),
      github: z.array(z.string()).optional(),
    }).optional(),
    marketData: z.object({
      currentPrice: z.record(z.string(), z.number()).optional(),
      totalSupply: z.number().optional(),
      circulatingSupply: z.number().optional(),
      maxSupply: z.number().nullable().optional(),
      fdv: z.number().optional(),
    }).optional(),
  }),
  'Get detailed token information from CoinGecko (description, links, market data).',
);

regGecko(
  'getPoolsByToken',
  z.object({
    network: z.string().optional().default('solana'),
    tokenAddress: z.string().describe('Token contract/mint address'),
    page: z.number().int().min(1).optional().default(1),
  }),
  z.object({
    pools: z.array(z.object({
      poolAddress: z.string(),
      dex: z.string(),
      baseToken: z.object({ symbol: z.string(), address: z.string() }),
      quoteToken: z.object({ symbol: z.string(), address: z.string() }),
      priceUsd: z.string().optional(),
      volume24h: z.number().optional(),
      liquidity: z.number().optional(),
      fdv: z.number().optional(),
    })),
    totalPools: z.number(),
  }),
  'Get all liquidity pools for a token from CoinGecko on-chain DEX tracker.',
);

regGecko(
  'getOHLCV',
  z.object({
    tokenId: z.string(),
    vsCurrency: z.string().optional().default('usd'),
    days: z.enum(['1', '7', '14', '30', '90', '180', '365', 'max']).optional().default('7'),
  }),
  z.object({
    prices: z.array(z.tuple([z.number(), z.number()])).describe('[[timestamp, price], ...]'),
    marketCaps: z.array(z.tuple([z.number(), z.number()])).optional(),
    totalVolumes: z.array(z.tuple([z.number(), z.number()])).optional(),
  }),
  'Get OHLCV (price chart) data from CoinGecko.',
);

/* ═══════════════════════════════════════════════════════════════
 *  5. GibWork — Bounties & Tasks
 * ═══════════════════════════════════════════════════════════════ */

const { register: regGib, methods: gibworkMethods } = createMethodRegistry('gibwork');

regGib(
  'createBounty',
  z.object({
    creator: zPubkey,
    title: z.string().describe('Bounty title'),
    description: z.string().describe('Detailed bounty description'),
    rewardMint: zMint.optional().describe('Reward token mint (default: SOL)'),
    rewardAmount: zAmount.describe('Reward amount'),
    tags: z.array(z.string()).optional(),
    deadline: z.number().optional().describe('Deadline (Unix timestamp)'),
  }),
  z.object({
    bountyId: z.string(),
    tx: zTx,
    escrowAddress: zPubkey,
    signature: z.string().optional(),
  }),
  'Create a new bounty on Gib Work with on-chain escrow.',
);

regGib(
  'listBounties',
  z.object({
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().default('open'),
    tags: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }),
  z.object({
    bounties: z.array(z.object({
      bountyId: z.string(),
      title: z.string(),
      creator: zPubkey,
      rewardAmount: zAmount,
      rewardMint: zMint,
      status: z.string(),
      tags: z.array(z.string()),
      deadline: z.number().optional(),
    })),
    totalCount: z.number(),
  }),
  'List available bounties on Gib Work.',
);

regGib(
  'submitWork',
  z.object({
    wallet: zPubkey,
    bountyId: z.string(),
    submissionUrl: z.string().url().describe('URL to the completed work (PR, doc, etc.)'),
    notes: z.string().optional(),
  }),
  z.object({
    submissionId: z.string(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Submit completed work for a Gib Work bounty.',
);

/* ═══════════════════════════════════════════════════════════════
 *  6. Send Arcade — On-Chain Mini-Games
 * ═══════════════════════════════════════════════════════════════ */

const { register: regArcade, methods: sendArcadeMethods } = createMethodRegistry('send-arcade');

regArcade(
  'listGames',
  z.object({
    status: z.enum(['active', 'upcoming', 'ended']).optional().default('active'),
  }),
  z.object({
    games: z.array(z.object({
      gameId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      entryFee: zAmount,
      entryFeeMint: zMint.optional(),
      prizePool: zAmount.optional(),
      playersCount: z.number().optional(),
      status: z.string(),
    })),
  }),
  'List available games on Send Arcade.',
);

regArcade(
  'playGame',
  z.object({
    wallet: zPubkey,
    gameId: z.string(),
    betAmount: zAmount.optional().describe('Bet/entry amount (if variable)'),
  }),
  z.object({
    tx: zTx,
    sessionId: z.string().optional(),
    entryFee: zAmount,
    signature: z.string().optional(),
  }),
  'Enter and play a game on Send Arcade (pays entry fee via transaction).',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

export {
  snsMethods,
  alldomainsMethods,
  pythMethods,
  coingeckoMethods,
  gibworkMethods,
  sendArcadeMethods,
};

export const allMiscMethods = [
  ...snsMethods,
  ...alldomainsMethods,
  ...pythMethods,
  ...coingeckoMethods,
  ...gibworkMethods,
  ...sendArcadeMethods,
] as const;
