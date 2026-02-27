/**
 * @module ai/tools/protocols/jupiter/schemas
 * @description Jupiter Protocol — Zod schemas for all 21 Jupiter API methods.
 *
 * Covers:
 *  - Ultra Swap API   (5 methods)
 *  - Metis Swap API   (4 methods)
 *  - Price API v3     (1 method)
 *  - Token API        (2 methods — list, info)
 *  - Trigger API      (5 methods — limit orders)
 *  - Recurring API    (4 methods — DCA)
 *
 * @since 1.0.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('jupiter');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zMint       = z.string().describe('Token mint address (base58)');
const zAmount     = z.string().describe('Raw token amount as string (no decimals)');
const zSlippage   = z.number().min(0).max(10000).describe('Slippage tolerance in bps (e.g. 50 = 0.5%)');
const zPubkey     = z.string().describe('Solana wallet public key (base58)');
const zTxBase64   = z.string().describe('Base64-encoded unsigned transaction');
const zSignedTx   = z.string().describe('Base64-encoded signed transaction');

/* ═══════════════════════════════════════════════════════════════
 *  1. Ultra Swap API — /ultra/v1/*
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getOrder',
  z.object({
    inputMint: zMint,
    outputMint: zMint,
    amount: zAmount,
    taker: zPubkey.describe('Taker (sender) wallet address'),
    slippageBps: zSlippage.optional(),
    referralAccount: zPubkey.optional().describe('Referral account for fee-sharing'),
    referralFeeBps: z.number().optional().describe('Referral fee in bps'),
  }),
  z.object({
    requestId: z.string(),
    inputMint: zMint,
    outputMint: zMint,
    inAmount: zAmount,
    outAmount: zAmount,
    otherAmountThreshold: zAmount,
    swapMode: z.string(),
    slippageBps: z.number(),
    priceImpactPct: z.string(),
    routePlan: z.array(z.unknown()),
    transaction: zTxBase64,
    lastValidBlockHeight: z.number(),
    prioritizationFeeLamports: z.number().optional(),
    dynamicSlippageReport: z.unknown().optional(),
  }),
  'Get a quote + unsigned swap transaction in a single call (Ultra API). The recommended entry-point for swaps.',
  { httpMethod: 'GET', path: '/ultra/v1/order' },
);

register(
  'executeOrder',
  z.object({
    signedTransaction: zSignedTx,
    requestId: z.string().describe('requestId from getOrder response'),
  }),
  z.object({
    signature: z.string(),
    status: z.enum(['Success', 'Failed', 'Expired']),
    error: z.string().optional(),
    slot: z.number().optional(),
    inputAmountResult: zAmount.optional(),
    outputAmountResult: zAmount.optional(),
  }),
  'Execute a signed swap transaction obtained from getOrder and receive execution status.',
  { httpMethod: 'POST', path: '/ultra/v1/execute' },
);

register(
  'getHoldings',
  z.object({
    tokenAccountAddresses: z.array(zPubkey).min(1).max(100)
      .describe('Array of token account addresses to query balances for'),
  }),
  z.object({
    tokens: z.array(z.object({
      mint: zMint,
      amount: zAmount,
      decimals: z.number(),
      uiAmount: z.number(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      logoURI: z.string().optional(),
      priceUsd: z.number().optional(),
      valueUsd: z.number().optional(),
    })),
    nativeBalance: z.object({
      lamports: z.number(),
      solUsd: z.number().optional(),
    }).optional(),
  }),
  'Fetch token balances and holdings for specific token accounts, including USD valuations.',
  { httpMethod: 'GET', path: '/ultra/v1/holdings' },
);

register(
  'shield',
  z.object({
    mints: z.array(zMint).min(1).max(100).describe('Token mints to check'),
  }),
  z.object({
    warnings: z.record(zMint, z.array(z.object({
      severity: z.enum(['info', 'warning', 'critical']),
      type: z.string(),
      message: z.string(),
    }))),
  }),
  'Check token mints for potential security risks (honeypot, freeze authority, low liquidity, etc.).',
  { httpMethod: 'GET', path: '/ultra/v1/shield' },
);

register(
  'searchTokens',
  z.object({
    query: z.string().describe('Search by token symbol, name, or mint address'),
  }),
  z.array(z.object({
    address: zMint,
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    tags: z.array(z.string()).optional(),
    daily_volume: z.number().optional(),
    freeze_authority: z.string().nullable().optional(),
    mint_authority: z.string().nullable().optional(),
  })),
  'Search for tokens by symbol, name, or mint address. Returns matching tokens with metadata.',
  { httpMethod: 'GET', path: '/ultra/v1/search' },
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Metis Swap API — /swap/v1/*
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getQuote',
  z.object({
    inputMint: zMint,
    outputMint: zMint,
    amount: zAmount,
    slippageBps: zSlippage.optional(),
    swapMode: z.enum(['ExactIn', 'ExactOut']).optional(),
    onlyDirectRoutes: z.boolean().optional().describe('Restrict to single-hop routes'),
    asLegacyTransaction: z.boolean().optional().describe('Return a legacy transaction'),
    maxAccounts: z.number().optional().describe('Max accounts in transaction (default 64)'),
    platformFeeBps: z.number().optional().describe('Platform fee in bps'),
    restrictIntermediateTokens: z.boolean().optional(),
    dynamicSlippage: z.boolean().optional(),
  }),
  z.object({
    inputMint: zMint,
    inAmount: zAmount,
    outputMint: zMint,
    outAmount: zAmount,
    otherAmountThreshold: zAmount,
    swapMode: z.string(),
    slippageBps: z.number(),
    priceImpactPct: z.string(),
    routePlan: z.array(z.object({
      swapInfo: z.object({
        ammKey: z.string(),
        label: z.string().optional(),
        inputMint: zMint,
        outputMint: zMint,
        inAmount: zAmount,
        outAmount: zAmount,
        feeAmount: zAmount,
        feeMint: zMint,
      }),
      percent: z.number(),
    })),
    contextSlot: z.number().optional(),
    timeTaken: z.number().optional(),
  }),
  'Get an optimally-routed swap quote with full route plan details (Metis engine).',
  { httpMethod: 'GET', path: '/swap/v1/quote' },
);

register(
  'swap',
  z.object({
    userPublicKey: zPubkey,
    wrapAndUnwrapSol: z.boolean().optional().describe('Auto wrap/unwrap SOL (default true)'),
    useSharedAccounts: z.boolean().optional(),
    feeAccount: zPubkey.optional().describe('Fee token account for platform fee collection'),
    computeUnitPriceMicroLamports: z.number().optional().describe('Priority fee in µ-lamports/CU'),
    asLegacyTransaction: z.boolean().optional(),
    useTokenLedger: z.boolean().optional(),
    destinationTokenAccount: zPubkey.optional(),
    dynamicComputeUnitLimit: z.boolean().optional(),
    skipUserAccountsRpcCalls: z.boolean().optional(),
    dynamicSlippage: z.boolean().optional(),
    quoteResponse: z.record(z.string(), z.unknown()).describe('The full quoteResponse object from getQuote'),
  }),
  z.object({
    swapTransaction: zTxBase64,
    lastValidBlockHeight: z.number(),
    prioritizationFeeLamports: z.number().optional(),
    computeUnitLimit: z.number().optional(),
    prioritizationType: z.object({ computeBudget: z.unknown() }).optional(),
    dynamicSlippageReport: z.unknown().optional(),
    simulationError: z.unknown().optional(),
  }),
  'Build an unsigned swap transaction from a quote response. Sign and send the returned transaction.',
  { httpMethod: 'POST', path: '/swap/v1/swap' },
);

register(
  'swapInstructions',
  z.object({
    userPublicKey: zPubkey,
    wrapAndUnwrapSol: z.boolean().optional(),
    useSharedAccounts: z.boolean().optional(),
    feeAccount: zPubkey.optional(),
    computeUnitPriceMicroLamports: z.number().optional(),
    asLegacyTransaction: z.boolean().optional(),
    useTokenLedger: z.boolean().optional(),
    destinationTokenAccount: zPubkey.optional(),
    dynamicComputeUnitLimit: z.boolean().optional(),
    quoteResponse: z.record(z.string(), z.unknown()).describe('The full quoteResponse object from getQuote'),
  }),
  z.object({
    tokenLedgerInstruction: z.unknown().nullable(),
    computeBudgetInstructions: z.array(z.unknown()),
    setupInstructions: z.array(z.unknown()),
    swapInstruction: z.unknown(),
    cleanupInstruction: z.unknown().nullable(),
    addressLookupTableAddresses: z.array(z.string()),
    otherInstructions: z.array(z.unknown()).optional(),
  }),
  'Get individual swap instructions instead of a full transaction. Useful for composing with other instructions.',
  { httpMethod: 'POST', path: '/swap/v1/swap-instructions' },
);

register(
  'programLabels',
  z.object({}),
  z.record(z.string(), z.string()),
  'Get a mapping from program ID to human-readable label for all DEX programs in the routing engine.',
  { httpMethod: 'GET', path: '/swap/v1/program-id-to-label' },
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Price API v3 — /price/v3
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getPrice',
  z.object({
    ids: z.array(zMint).min(1).max(100).describe('Token mints to price'),
    vsToken: zMint.optional().describe('Quote token (default: USDC)'),
    showExtraInfo: z.boolean().optional().describe('Include confidence, depth, timestamps'),
  }),
  z.object({
    data: z.record(zMint, z.object({
      id: zMint,
      type: z.string(),
      price: z.string(),
      extraInfo: z.object({
        lastSwappedPrice: z.object({
          lastJupiterSellAt: z.number().optional(),
          lastJupiterSellPrice: z.string().optional(),
          lastJupiterBuyAt: z.number().optional(),
          lastJupiterBuyPrice: z.string().optional(),
        }).optional(),
        quotedPrice: z.object({
          buyPrice: z.string().optional(),
          buyAt: z.number().optional(),
          sellPrice: z.string().optional(),
          sellAt: z.number().optional(),
        }).optional(),
        confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
        depth: z.object({
          buyPriceImpactRatio: z.unknown().optional(),
          sellPriceImpactRatio: z.unknown().optional(),
        }).optional(),
      }).optional(),
    })),
    timeTaken: z.number(),
  }),
  'Get real-time heuristic prices for tokens. Supports buy/sell price, confidence, and depth info.',
  { httpMethod: 'GET', path: '/price/v3' },
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Token API — /tokens/v1  (served from tokensApiUrl)
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getTokenList',
  z.object({
    tags: z.array(z.string()).optional().describe('Filter by tags (e.g. "verified", "community")'),
  }),
  z.array(z.object({
    address: zMint,
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    tags: z.array(z.string()),
    daily_volume: z.number().optional(),
    created_at: z.string().optional(),
    freeze_authority: z.string().nullable().optional(),
    mint_authority: z.string().nullable().optional(),
    permanent_delegate: z.string().nullable().optional(),
    minted_at: z.string().nullable().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  })),
  'Get the full Jupiter verified token list with metadata, tags, and daily volume.',
  { httpMethod: 'GET', path: '/tokens/v1/all' },
);

register(
  'getTokenInfo',
  z.object({
    mint: zMint.describe('Token mint address to query'),
  }),
  z.object({
    address: zMint,
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
    logoURI: z.string().optional(),
    tags: z.array(z.string()).optional(),
    daily_volume: z.number().optional(),
    created_at: z.string().optional(),
    freeze_authority: z.string().nullable().optional(),
    mint_authority: z.string().nullable().optional(),
    permanent_delegate: z.string().nullable().optional(),
    minted_at: z.string().nullable().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  }),
  'Get metadata for a single token by mint address.',
  { httpMethod: 'GET', path: '/tokens/v1' },
);

/* ═══════════════════════════════════════════════════════════════
 *  5. Trigger API — /trigger/v1/* (Limit Orders)
 * ═══════════════════════════════════════════════════════════════ */

register(
  'createLimitOrder',
  z.object({
    maker: zPubkey.describe('Wallet address of the order creator'),
    payer: zPubkey.describe('Wallet paying for transaction fees'),
    inputMint: zMint.describe('Input token mint'),
    outputMint: zMint.describe('Output token mint'),
    makingAmount: zAmount.describe('Amount of input token to sell'),
    takingAmount: zAmount.describe('Amount of output token to receive'),
    expiredAt: z.string().optional().describe('ISO 8601 expiry timestamp'),
    feeBps: z.number().optional().describe('Referral fee in bps'),
    computeUnitPrice: z.string().optional().describe('Priority fee (µ-lamports/CU)'),
  }),
  z.object({
    order: z.string().describe('Order public key'),
    tx: zTxBase64,
  }),
  'Create a limit order. Returns an unsigned transaction — sign and submit via executeTrigger.',
  { httpMethod: 'POST', path: '/trigger/v1/createOrder' },
);

register(
  'executeTrigger',
  z.object({
    signedTransaction: zSignedTx,
    requestId: z.string().describe('Request ID from createLimitOrder response'),
  }),
  z.object({
    signature: z.string(),
    status: z.enum(['Success', 'Failed', 'Expired']),
    error: z.string().optional(),
  }),
  'Submit a signed limit-order transaction for on-chain execution.',
  { httpMethod: 'POST', path: '/trigger/v1/execute' },
);

register(
  'cancelLimitOrder',
  z.object({
    maker: zPubkey,
    order: z.string().describe('Order public key to cancel'),
    computeUnitPrice: z.string().optional(),
  }),
  z.object({
    tx: zTxBase64,
  }),
  'Create an unsigned transaction to cancel a specific limit order.',
  { httpMethod: 'POST', path: '/trigger/v1/cancelOrder' },
);

register(
  'cancelLimitOrders',
  z.object({
    maker: zPubkey,
    orders: z.array(z.string()).describe('Array of order public keys to cancel'),
    computeUnitPrice: z.string().optional(),
  }),
  z.object({
    txs: z.array(zTxBase64),
  }),
  'Create unsigned transactions to cancel multiple limit orders in batch.',
  { httpMethod: 'POST', path: '/trigger/v1/cancelOrders' },
);

register(
  'getLimitOrders',
  z.object({
    wallet: zPubkey.describe('Wallet address to query'),
    orderStatus: z.enum(['active', 'history']).describe('Filter by order status: "active" for open orders, "history" for filled/cancelled'),
    inputMint: zMint.optional(),
    outputMint: zMint.optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
  z.object({
    orders: z.array(z.object({
      orderKey: z.string(),
      maker: zPubkey,
      inputMint: zMint,
      outputMint: zMint,
      makingAmount: zAmount,
      takingAmount: zAmount,
      remainingMakingAmount: zAmount,
      remainingTakingAmount: zAmount,
      expiredAt: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      status: z.string(),
    })),
    total: z.number().optional(),
    page: z.number().optional(),
  }),
  'Get all limit orders (active and optionally historical) for a wallet.',
  { httpMethod: 'GET', path: '/trigger/v1/getTriggerOrders' },
);

/* ═══════════════════════════════════════════════════════════════
 *  6. Recurring API — /recurring/v1/* (DCA)
 * ═══════════════════════════════════════════════════════════════ */

register(
  'createDCA',
  z.object({
    payer: zPubkey.describe('Wallet paying for the DCA setup'),
    user: zPubkey.describe('Wallet executing the DCA'),
    inputMint: zMint,
    outputMint: zMint,
    totalInAmount: zAmount.describe('Total amount of input token to DCA'),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly']).describe('DCA interval'),
    numberOfOrders: z.number().int().positive().describe('Total number of orders to split into'),
    minOutAmountPerOrder: zAmount.optional().describe('Minimum output per order (slippage protection)'),
    maxOutAmountPerOrder: zAmount.optional().describe('Maximum output per order'),
    startAt: z.string().optional().describe('ISO 8601 start timestamp (default: now)'),
  }),
  z.object({
    order: z.string().describe('DCA order public key'),
    tx: zTxBase64,
  }),
  'Create a Dollar-Cost Averaging (DCA) recurring order. Returns an unsigned transaction.',
  { httpMethod: 'POST', path: '/recurring/v1/createOrder' },
);

register(
  'executeDCA',
  z.object({
    signedTransaction: zSignedTx,
    requestId: z.string().describe('Request ID from createDCA response'),
  }),
  z.object({
    signature: z.string(),
    status: z.enum(['Success', 'Failed', 'Expired']),
    error: z.string().optional(),
  }),
  'Submit a signed DCA order creation/cancellation transaction.',
  { httpMethod: 'POST', path: '/recurring/v1/execute' },
);

register(
  'cancelDCA',
  z.object({
    user: zPubkey.describe('Wallet that owns the DCA order'),
    order: z.string().describe('DCA order public key to cancel'),
    recurringType: z.enum(['time', 'price']).describe('Recurring order type — "time" for time-based DCA, "price" for price-triggered'),
    computeUnitPrice: z.string().optional(),
  }),
  z.object({
    tx: zTxBase64,
  }),
  'Create an unsigned transaction to cancel a DCA recurring order.',
  { httpMethod: 'POST', path: '/recurring/v1/cancelOrder' },
);

register(
  'getDCAOrders',
  z.object({
    user: zPubkey.describe('Wallet address to query (sent as "user" query param to Jupiter)'),
    recurringType: z.enum(['time', 'price', 'all']).describe('Recurring order type — "time" for time-based DCA, "price" for price-triggered, "all" for both'),
    orderStatus: z.enum(['active', 'history']).describe('Filter by order status: "active" for running orders, "history" for completed/cancelled'),
    includeFailedTx: z.boolean().optional().default(false).describe('Include failed transactions in results (default: false)'),
    inputMint: zMint.optional(),
    outputMint: zMint.optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
  z.object({
    orders: z.array(z.object({
      orderKey: z.string(),
      maker: zPubkey,
      inputMint: zMint,
      outputMint: zMint,
      totalInAmount: zAmount,
      totalOutAmount: zAmount,
      remainingInAmount: zAmount,
      frequency: z.string(),
      numberOfOrders: z.number(),
      completedOrders: z.number(),
      nextExecutionAt: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      status: z.string(),
    })),
    total: z.number().optional(),
    page: z.number().optional(),
  }),
  'Get all DCA orders (active and optionally historical) for a wallet.',
  { httpMethod: 'GET', path: '/recurring/v1/getRecurringOrders' },
);

/* ═══════════════════════════════════════════════════════════════
 *  Export
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description All 20 registered Jupiter methods with typed Zod schemas.
 * @since 1.0.0
 */
export const jupiterMethods = methods;

/**
 * @description Jupiter method names as a readonly tuple for allow-listing.
 * @since 1.0.0
 */
export const jupiterMethodNames = methods.map((m) => m.name) as readonly string[];
