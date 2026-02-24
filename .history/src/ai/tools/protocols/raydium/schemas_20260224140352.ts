/**
 * Raydium Protocol — Zod schemas for all 16 Raydium API v3 methods.
 *
 * Covers:
 *  - Main / Info     (5 methods)
 *  - Mint / Token    (3 methods)
 *  - Pools           (6 methods)
 *  - Farms           (2 methods)
 *
 * API reference: https://api-v3.raydium.io/docs/
 * @module protocols/raydium/schemas
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('raydium');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zMint   = z.string().describe('Token mint address (base58)');
const zPoolId = z.string().describe('Raydium pool ID');

/* ═══════════════════════════════════════════════════════════════
 *  1. Main / Info — /main/*
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getInfo',
  z.object({}),
  z.object({
    tvl: z.number().describe('Total value locked in USD'),
    volume24h: z.number().describe('24h trading volume in USD'),
    totalLiquidity: z.number().optional(),
    totalSwapVolume: z.number().optional(),
  }),
  'Get Raydium protocol-wide stats: TVL and 24-hour trading volume.',
  { httpMethod: 'GET', path: '/main/info' },
);

register(
  'getChainTime',
  z.object({}),
  z.object({
    chainTime: z.number().describe('Current Solana chain timestamp (Unix seconds)'),
    offset: z.number().optional().describe('Offset from local clock'),
  }),
  'Get the current Solana chain time from Raydium nodes.',
  { httpMethod: 'GET', path: '/main/chain-time' },
);

register(
  'getClmmConfig',
  z.object({}),
  z.array(z.object({
    id: z.string(),
    index: z.number(),
    protocolFeeRate: z.number(),
    tradeFeeRate: z.number(),
    tickSpacing: z.number(),
    fundFeeRate: z.number(),
    defaultRange: z.number().optional(),
    defaultRangePoint: z.array(z.number()).optional(),
  })),
  'Get configuration for all CLMM (Concentrated Liquidity) pool tiers, including fee rates and tick spacing.',
  { httpMethod: 'GET', path: '/main/clmm-config' },
);

register(
  'getCpmmConfig',
  z.object({}),
  z.array(z.object({
    id: z.string(),
    index: z.number(),
    protocolFeeRate: z.number(),
    tradeFeeRate: z.number(),
    fundFeeRate: z.number(),
    createPoolFee: z.string(),
  })),
  'Get configuration for all CPMM (Constant Product) pool tiers, including fee rates and pool creation costs.',
  { httpMethod: 'GET', path: '/main/cpmm-config' },
);

register(
  'getAutoFee',
  z.object({}),
  z.object({
    fee: z.number().describe('Recommended transaction priority fee (lamports)'),
    feeLevel: z.string().optional().describe('Fee urgency level'),
  }),
  'Get the recommended auto-computed transaction priority fee.',
  { httpMethod: 'GET', path: '/main/auto-fee' },
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Mint / Token — /mint/*
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getMintList',
  z.object({}),
  z.array(z.object({
    address: zMint,
    name: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    tags: z.array(z.string()).optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    priority: z.number().optional(),
  })),
  'Get the Raydium default token mint list with metadata.',
  { httpMethod: 'GET', path: '/mint/list' },
);

register(
  'getMintInfo',
  z.object({
    mints: z.array(zMint).min(1).max(100).describe('Token mint addresses to query'),
  }),
  z.array(z.object({
    address: zMint,
    name: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    tags: z.array(z.string()).optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    freezeAuthority: z.string().nullable().optional(),
    mintAuthority: z.string().nullable().optional(),
  })),
  'Get detailed token mint info for one or more mints.',
  { httpMethod: 'GET', path: '/mint/ids' },
);

register(
  'getMintPrice',
  z.object({
    mints: z.array(zMint).min(1).max(100).describe('Token mint addresses to price'),
  }),
  z.record(zMint, z.number()),
  'Get USD prices for one or more token mints.',
  { httpMethod: 'GET', path: '/mint/price' },
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Pools — /pools/*
 * ═══════════════════════════════════════════════════════════════ */

const zPoolInfo = z.object({
  id: zPoolId,
  type: z.enum(['Standard', 'Concentrated', 'Cpmm']).describe('Pool type (AMM v4 / CLMM / CPMM)'),
  mintA: z.object({ address: zMint, symbol: z.string().optional(), decimals: z.number(), logoURI: z.string().optional() }),
  mintB: z.object({ address: zMint, symbol: z.string().optional(), decimals: z.number(), logoURI: z.string().optional() }),
  price: z.number().describe('Current price of mintA in terms of mintB'),
  tvl: z.number().describe('Total value locked in USD'),
  feeRate: z.number().describe('Trading fee rate'),
  volume24h: z.number().optional(),
  fee24h: z.number().optional(),
  apr24h: z.number().optional(),
  apr7d: z.number().optional(),
  apr30d: z.number().optional(),
  lpMint: z.object({ address: zMint, decimals: z.number() }).optional(),
  farmCount: z.number().optional(),
  isOpenBook: z.boolean().optional(),
  programId: z.string(),
});

register(
  'getPoolInfo',
  z.object({
    ids: z.array(zPoolId).min(1).max(100).describe('Pool IDs to query'),
  }),
  z.array(zPoolInfo),
  'Get detailed pool info (TVL, price, APR, volume) for specific Raydium pool IDs.',
  { httpMethod: 'GET', path: '/pools/info/ids' },
);

register(
  'getPoolsByLpMint',
  z.object({
    lpMints: z.array(zMint).min(1).max(100).describe('LP mint addresses'),
  }),
  z.array(zPoolInfo),
  'Find Raydium pools by their LP token mint address.',
  { httpMethod: 'GET', path: '/pools/info/lps' },
);

register(
  'getPoolList',
  z.object({
    type: z.enum(['all', 'standard', 'concentrated', 'cpmm', 'allFarm']).optional().describe('Filter by pool type'),
    sort: z.enum(['liquidity', 'volume24h', 'fee24h', 'apr24h', 'apr7d', 'apr30d']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(1000).optional(),
  }),
  z.object({
    count: z.number(),
    data: z.array(zPoolInfo),
    hasNextPage: z.boolean(),
  }),
  'Get a paginated, sortable list of all Raydium pools with full stats.',
  { httpMethod: 'GET', path: '/pools/info/list' },
);

register(
  'getPoolsByTokenMint',
  z.object({
    mint1: zMint.describe('First token mint'),
    mint2: zMint.optional().describe('Second token mint (narrows to specific pair)'),
    type: z.enum(['all', 'standard', 'concentrated', 'cpmm']).optional(),
    sort: z.enum(['liquidity', 'volume24h', 'fee24h', 'apr24h']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(1000).optional(),
  }),
  z.object({
    count: z.number(),
    data: z.array(zPoolInfo),
    hasNextPage: z.boolean(),
  }),
  'Find Raydium pools by token mint(s). Great for discovering where to swap a specific token.',
  { httpMethod: 'GET', path: '/pools/info/mint' },
);

register(
  'getPoolLiquidity',
  z.object({
    poolId: zPoolId,
    period: z.enum(['1h', '4h', '1d', '1w', '1m']).optional().describe('Aggregation period'),
  }),
  z.object({
    poolId: zPoolId,
    data: z.array(z.object({
      time: z.number(),
      liquidity: z.number(),
    })),
  }),
  'Get historical liquidity data for a pool (useful for charting).',
  { httpMethod: 'GET', path: '/pools/line/liquidity' },
);

register(
  'getClmmPosition',
  z.object({
    poolId: zPoolId,
  }),
  z.object({
    poolId: zPoolId,
    data: z.array(z.object({
      priceLower: z.number(),
      priceUpper: z.number(),
      liquidity: z.string(),
      amountA: z.string(),
      amountB: z.string(),
    })),
  }),
  'Get current CLMM concentrated liquidity position distribution for a pool.',
  { httpMethod: 'GET', path: '/pools/line/position' },
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Farms — /farms/*
 * ═══════════════════════════════════════════════════════════════ */

const zFarmInfo = z.object({
  id: z.string(),
  lpMint: z.object({ address: zMint, decimals: z.number() }),
  baseMint: zMint.optional(),
  quoteMint: zMint.optional(),
  rewardInfos: z.array(z.object({
    mint: z.object({ address: zMint, symbol: z.string().optional(), decimals: z.number() }),
    perSecond: z.string().optional(),
    perDay: z.string().optional(),
    openTime: z.number().optional(),
    endTime: z.number().optional(),
    type: z.string().optional(),
  })),
  apr: z.number().optional(),
  tvl: z.number().optional(),
  programId: z.string(),
});

register(
  'getFarmInfo',
  z.object({
    ids: z.array(z.string()).min(1).max(100).describe('Farm IDs to query'),
  }),
  z.array(zFarmInfo),
  'Get detailed farm info (APR, rewards, TVL) for specific Raydium farm IDs.',
  { httpMethod: 'GET', path: '/farms/info/ids' },
);

register(
  'getFarmByLpMint',
  z.object({
    lpMints: z.array(zMint).min(1).max(100).describe('LP mint addresses to search farms for'),
  }),
  z.array(zFarmInfo),
  'Find Raydium yield farms by the LP mint address they accept.',
  { httpMethod: 'GET', path: '/farms/info/lp' },
);

/* ═══════════════════════════════════════════════════════════════
 *  Export
 * ═══════════════════════════════════════════════════════════════ */

/** All 16 registered Raydium methods with typed Zod schemas. */
export const raydiumMethods = methods;

/** Raydium method names as a readonly tuple for allow-listing. */
export const raydiumMethodNames = methods.map((m) => m.name) as readonly string[];
