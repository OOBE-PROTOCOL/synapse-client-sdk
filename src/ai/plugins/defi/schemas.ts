/**
 * @module ai/plugins/defi/schemas
 * @description DeFi Plugin — Zod schemas for all DeFi protocol integrations.
 *
 * Covers:
 *  - PumpPortal        (2 methods — launch token, buy/sell on Pump.fun)
 *  - Raydium Pools     (5 methods — CPMM, CLMM, AMMv4 pool creation + liquidity)
 *  - Orca Whirlpool    (5 methods — pool info, swap, positions, liquidity)
 *  - Manifest          (4 methods — market creation, limit orders, cancel, orderbook)
 *  - Meteora           (5 methods — Dynamic AMM, DLMM, Alpha Vault)
 *  - Openbook          (3 methods — market creation, place order, cancel)
 *  - Drift             (7 methods — vaults, perps, lending, borrowing)
 *  - Adrena            (5 methods — perpetuals trading)
 *  - Lulo              (4 methods — lending/borrowing with best APR)
 *  - Jito              (3 methods — bundles, tips)
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
 *  1. PumpPortal — Launch on Pump.fun
 * ═══════════════════════════════════════════════════════════════ */

const { register: regPump, methods: pumpMethods } = createMethodRegistry('pump');

regPump(
  'launchToken',
  z.object({
    deployer: zPubkey.describe('Deployer wallet'),
    name: z.string().describe('Token name'),
    symbol: z.string().max(10).describe('Token ticker'),
    description: z.string().optional(),
    image: z.string().url().optional().describe('Token logo URL'),
    twitter: z.string().optional().describe('Twitter/X handle'),
    telegram: z.string().optional().describe('Telegram group link'),
    website: z.string().url().optional().describe('Website URL'),
    initialBuyAmount: zAmount.optional().describe('SOL amount to buy at launch (dev buy)'),
  }),
  z.object({
    mint: zMint,
    bondingCurve: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Launch a new token on Pump.fun via PumpPortal. Optionally include an initial dev buy.',
);

regPump(
  'trade',
  z.object({
    wallet: zPubkey,
    mint: zMint.describe('Pump.fun token mint'),
    action: z.enum(['buy', 'sell']).describe('Trade direction'),
    amount: zAmount.describe('Amount in SOL (buy) or tokens (sell)'),
    slippageBps: z.number().min(0).max(10000).optional().default(500),
  }),
  z.object({
    tx: zTx,
    expectedOutput: zAmount,
    priceImpact: z.string().optional(),
    signature: z.string().optional(),
  }),
  'Buy or sell tokens on Pump.fun bonding curve.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Raydium — Pool Creation + Liquidity
 * ═══════════════════════════════════════════════════════════════ */

const { register: regRayPool, methods: raydiumPoolMethods } = createMethodRegistry('raydium-pools');

regRayPool(
  'createCPMM',
  z.object({
    creator: zPubkey,
    mintA: zMint.describe('Token A mint'),
    mintB: zMint.describe('Token B mint'),
    amountA: zAmount.describe('Initial liquidity for token A'),
    amountB: zAmount.describe('Initial liquidity for token B'),
    startTime: z.number().optional().describe('Pool start time (Unix timestamp)'),
  }),
  z.object({
    poolId: zPubkey,
    lpMint: zMint,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Raydium CPMM (Constant Product Market Maker) pool.',
);

regRayPool(
  'createCLMM',
  z.object({
    creator: zPubkey,
    mintA: zMint,
    mintB: zMint,
    initialPrice: z.number().positive().describe('Initial price of token A in terms of token B'),
    tickSpacing: z.number().int().positive().describe('Tick spacing (defines fee tier: 1=0.01%, 10=0.05%, 60=0.3%, 200=1%)'),
    amountA: zAmount.describe('Initial liquidity for token A'),
    amountB: zAmount.describe('Initial liquidity for token B'),
    priceLower: z.number().positive().describe('Lower price bound for liquidity range'),
    priceUpper: z.number().positive().describe('Upper price bound for liquidity range'),
    startTime: z.number().optional(),
  }),
  z.object({
    poolId: zPubkey,
    positionNft: zMint.optional(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Raydium CLMM (Concentrated Liquidity) pool with a price range.',
);

regRayPool(
  'createAMMv4',
  z.object({
    creator: zPubkey,
    marketId: zPubkey.describe('Openbook market ID'),
    baseAmount: zAmount,
    quoteAmount: zAmount,
    startTime: z.number().optional(),
  }),
  z.object({
    ammId: zPubkey,
    lpMint: zMint,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Raydium AMM v4 pool (requires an existing Openbook market).',
);

regRayPool(
  'addLiquidity',
  z.object({
    wallet: zPubkey,
    poolId: zPubkey.describe('Raydium pool ID'),
    amountA: zAmount.optional().describe('Token A amount (for CPMM/AMM)'),
    amountB: zAmount.optional().describe('Token B amount (for CPMM/AMM)'),
    priceLower: z.number().optional().describe('Lower price for CLMM range'),
    priceUpper: z.number().optional().describe('Upper price for CLMM range'),
    fixedSide: z.enum(['a', 'b']).optional().describe('Fixed side for single-sided liquidity'),
  }),
  z.object({
    tx: zTx,
    lpAmount: zAmount.optional(),
    positionNft: zMint.optional(),
    signature: z.string().optional(),
  }),
  'Add liquidity to a Raydium pool (CPMM, CLMM, or AMM v4).',
);

regRayPool(
  'removeLiquidity',
  z.object({
    wallet: zPubkey,
    poolId: zPubkey,
    lpAmount: zAmount.optional().describe('LP tokens to burn (for CPMM/AMM)'),
    positionNft: zMint.optional().describe('Position NFT (for CLMM)'),
    percentage: z.number().min(0).max(100).optional().describe('Percentage of liquidity to remove'),
  }),
  z.object({
    tx: zTx,
    amountA: zAmount,
    amountB: zAmount,
    signature: z.string().optional(),
  }),
  'Remove liquidity from a Raydium pool.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Orca Whirlpool
 * ═══════════════════════════════════════════════════════════════ */

const { register: regOrca, methods: orcaMethods } = createMethodRegistry('orca');

regOrca(
  'getWhirlpool',
  z.object({
    poolAddress: zPubkey.describe('Whirlpool pool address'),
  }),
  z.object({
    address: zPubkey,
    tokenMintA: zMint,
    tokenMintB: zMint,
    tickSpacing: z.number(),
    sqrtPrice: z.string(),
    liquidity: z.string(),
    feeRate: z.number(),
    protocolFeeRate: z.number(),
    currentTickIndex: z.number(),
  }),
  'Get Orca Whirlpool pool information.',
);

regOrca(
  'swap',
  z.object({
    wallet: zPubkey,
    poolAddress: zPubkey,
    inputMint: zMint,
    amount: zAmount,
    slippageBps: z.number().min(0).max(10000).optional().default(100),
    isExactInput: z.boolean().optional().default(true),
  }),
  z.object({
    tx: zTx,
    estimatedOutput: zAmount,
    priceImpact: z.string(),
    fee: zAmount,
    signature: z.string().optional(),
  }),
  'Swap tokens on an Orca Whirlpool.',
);

regOrca(
  'openPosition',
  z.object({
    wallet: zPubkey,
    poolAddress: zPubkey,
    priceLower: z.number().positive(),
    priceUpper: z.number().positive(),
    amountA: zAmount.optional(),
    amountB: zAmount.optional(),
  }),
  z.object({
    positionMint: zMint,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Open a concentrated liquidity position on an Orca Whirlpool.',
);

regOrca(
  'closePosition',
  z.object({
    wallet: zPubkey,
    positionMint: zMint,
  }),
  z.object({
    tx: zTx,
    collectedA: zAmount,
    collectedB: zAmount,
    signature: z.string().optional(),
  }),
  'Close a Whirlpool position and collect all fees/rewards.',
);

regOrca(
  'collectFees',
  z.object({
    wallet: zPubkey,
    positionMint: zMint,
  }),
  z.object({
    tx: zTx,
    feesA: zAmount,
    feesB: zAmount,
    signature: z.string().optional(),
  }),
  'Collect accumulated fees from a Whirlpool position.',
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Manifest — Market Creation + Limit Orders
 * ═══════════════════════════════════════════════════════════════ */

const { register: regManifest, methods: manifestMethods } = createMethodRegistry('manifest');

regManifest(
  'createMarket',
  z.object({
    creator: zPubkey,
    baseMint: zMint.describe('Base token mint'),
    quoteMint: zMint.describe('Quote token mint'),
  }),
  z.object({
    marketId: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a new Manifest market for a token pair.',
);

regManifest(
  'placeLimitOrder',
  z.object({
    wallet: zPubkey,
    marketId: zPubkey,
    side: z.enum(['buy', 'sell']),
    price: z.number().positive().describe('Limit price'),
    size: zAmount.describe('Order size in base tokens'),
    orderType: z.enum(['limit', 'postOnly', 'ioc']).optional().default('limit'),
  }),
  z.object({
    orderId: z.string(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Place a limit order on a Manifest market.',
);

regManifest(
  'cancelOrder',
  z.object({
    wallet: zPubkey,
    marketId: zPubkey,
    orderId: z.string(),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Cancel a limit order on a Manifest market.',
);

regManifest(
  'getOrderbook',
  z.object({
    marketId: zPubkey,
    depth: z.number().int().min(1).max(100).optional().default(20),
  }),
  z.object({
    bids: z.array(z.object({ price: z.number(), size: z.string() })),
    asks: z.array(z.object({ price: z.number(), size: z.string() })),
    lastTradePrice: z.number().optional(),
    spread: z.number().optional(),
  }),
  'Get the current orderbook for a Manifest market.',
);

/* ═══════════════════════════════════════════════════════════════
 *  5. Meteora — Dynamic AMM, DLMM, Alpha Vault
 * ═══════════════════════════════════════════════════════════════ */

const { register: regMeteora, methods: meteoraMethods } = createMethodRegistry('meteora');

regMeteora(
  'createDynamicPool',
  z.object({
    creator: zPubkey,
    mintA: zMint,
    mintB: zMint,
    amountA: zAmount,
    amountB: zAmount,
    tradeFeeNumerator: z.number().int().optional().describe('Trade fee numerator (default pool fee)'),
    tradeFeeDenominator: z.number().int().optional(),
    activationType: z.enum(['slot', 'timestamp']).optional(),
    activationPoint: z.number().optional().describe('Activation slot/timestamp'),
  }),
  z.object({
    poolAddress: zPubkey,
    lpMint: zMint,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Meteora Dynamic AMM pool.',
);

regMeteora(
  'createDLMMPool',
  z.object({
    creator: zPubkey,
    mintX: zMint.describe('Token X mint'),
    mintY: zMint.describe('Token Y mint'),
    binStep: z.number().int().positive().describe('Bin step size (defines fee tier and price granularity)'),
    initialPrice: z.number().positive(),
    amountX: zAmount.optional(),
    amountY: zAmount.optional(),
    priceRoundingUp: z.boolean().optional().default(true),
    feeBps: z.number().int().min(0).max(10000).optional(),
    activationType: z.enum(['slot', 'timestamp']).optional(),
    activationPoint: z.number().optional(),
  }),
  z.object({
    poolAddress: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Meteora DLMM (Discrete Liquidity Market Maker) pool.',
);

regMeteora(
  'addDLMMLiquidity',
  z.object({
    wallet: zPubkey,
    poolAddress: zPubkey,
    amountX: zAmount,
    amountY: zAmount,
    strategy: z.enum(['spot', 'curve', 'bid-ask']).optional().default('spot')
      .describe('Liquidity distribution strategy'),
    minBinId: z.number().int().optional(),
    maxBinId: z.number().int().optional(),
  }),
  z.object({
    positionAddress: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Add liquidity to a Meteora DLMM pool with a distribution strategy.',
);

regMeteora(
  'removeDLMMLiquidity',
  z.object({
    wallet: zPubkey,
    positionAddress: zPubkey,
    percentage: z.number().min(0).max(100).default(100),
  }),
  z.object({
    tx: zTx,
    amountX: zAmount,
    amountY: zAmount,
    signature: z.string().optional(),
  }),
  'Remove liquidity from a Meteora DLMM position.',
);

regMeteora(
  'createAlphaVault',
  z.object({
    creator: zPubkey,
    poolAddress: zPubkey,
    depositMint: zMint.describe('Token mint accepted for deposits'),
    maxDeposit: zAmount.describe('Maximum deposit cap'),
    vestingDuration: z.number().int().positive().describe('Vesting duration in seconds'),
    startTime: z.number().optional().describe('Vault start time (Unix timestamp)'),
  }),
  z.object({
    vaultAddress: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a Meteora Alpha Vault for fair token launches with vesting.',
);

/* ═══════════════════════════════════════════════════════════════
 *  6. Openbook — Market Creation
 * ═══════════════════════════════════════════════════════════════ */

const { register: regOb, methods: openbookMethods } = createMethodRegistry('openbook');

regOb(
  'createMarket',
  z.object({
    creator: zPubkey,
    baseMint: zMint,
    quoteMint: zMint,
    lotSize: z.number().positive().describe('Minimum order size'),
    tickSize: z.number().positive().describe('Minimum price increment'),
  }),
  z.object({
    marketId: zPubkey,
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Create a new Openbook DEX market for a token pair.',
);

regOb(
  'placeOrder',
  z.object({
    wallet: zPubkey,
    marketId: zPubkey,
    side: z.enum(['buy', 'sell']),
    price: z.number().positive(),
    size: zAmount,
    orderType: z.enum(['limit', 'ioc', 'postOnly']).optional().default('limit'),
  }),
  z.object({
    orderId: z.string(),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Place an order on an Openbook market.',
);

regOb(
  'cancelOrder',
  z.object({
    wallet: zPubkey,
    marketId: zPubkey,
    orderId: z.string(),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Cancel an open order on an Openbook market.',
);

/* ═══════════════════════════════════════════════════════════════
 *  7. Drift — Vaults, Perps, Lending, Borrowing
 * ═══════════════════════════════════════════════════════════════ */

const { register: regDrift, methods: driftMethods } = createMethodRegistry('drift');

regDrift(
  'deposit',
  z.object({
    wallet: zPubkey,
    mint: zMint.describe('Token to deposit (e.g. USDC, SOL)'),
    amount: zAmount,
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Deposit tokens into a Drift account for trading or lending.',
);

regDrift(
  'withdraw',
  z.object({
    wallet: zPubkey,
    mint: zMint,
    amount: zAmount,
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Withdraw tokens from a Drift account.',
);

regDrift(
  'openPerpPosition',
  z.object({
    wallet: zPubkey,
    marketIndex: z.number().int().describe('Drift perp market index (0=SOL-PERP, 1=BTC-PERP, etc.)'),
    direction: z.enum(['long', 'short']),
    size: zAmount.describe('Position size in base token units'),
    leverage: z.number().positive().max(20).optional().describe('Leverage multiplier (max 20x)'),
    orderType: z.enum(['market', 'limit']).optional().default('market'),
    price: z.number().positive().optional().describe('Limit price (required for limit orders)'),
    reduceOnly: z.boolean().optional().default(false),
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({
    tx: zTx,
    orderId: z.number().optional(),
    estimatedEntryPrice: z.number().optional(),
    signature: z.string().optional(),
  }),
  'Open a perpetual futures position on Drift.',
);

regDrift(
  'closePerpPosition',
  z.object({
    wallet: zPubkey,
    marketIndex: z.number().int(),
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({
    tx: zTx,
    pnl: z.string().optional().describe('Realized PnL'),
    signature: z.string().optional(),
  }),
  'Close a perpetual position on Drift.',
);

regDrift(
  'getPositions',
  z.object({
    wallet: zPubkey,
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({
    perpPositions: z.array(z.object({
      marketIndex: z.number(),
      baseAssetAmount: z.string(),
      quoteAssetAmount: z.string(),
      direction: z.enum(['long', 'short']),
      unrealizedPnl: z.string(),
      entryPrice: z.number(),
      markPrice: z.number(),
      leverage: z.number().optional(),
    })),
    spotPositions: z.array(z.object({
      marketIndex: z.number(),
      balance: z.string(),
      tokenSymbol: z.string().optional(),
    })),
    accountEquity: z.string(),
    freeCollateral: z.string(),
  }),
  'Get all open positions and account info for a Drift account.',
);

regDrift(
  'lend',
  z.object({
    wallet: zPubkey,
    mint: zMint,
    amount: zAmount,
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({
    tx: zTx,
    estimatedApy: z.number().optional(),
    signature: z.string().optional(),
  }),
  'Lend tokens on Drift to earn interest.',
);

regDrift(
  'borrow',
  z.object({
    wallet: zPubkey,
    mint: zMint,
    amount: zAmount,
    subAccountId: z.number().int().optional().default(0),
  }),
  z.object({
    tx: zTx,
    borrowRate: z.number().optional(),
    signature: z.string().optional(),
  }),
  'Borrow tokens on Drift against deposited collateral.',
);

/* ═══════════════════════════════════════════════════════════════
 *  8. Adrena — Perpetuals Trading
 * ═══════════════════════════════════════════════════════════════ */

const { register: regAdrena, methods: adrenaMethods } = createMethodRegistry('adrena');

regAdrena(
  'openPosition',
  z.object({
    wallet: zPubkey,
    market: z.string().describe('Market symbol (e.g. "SOL", "BTC", "ETH")'),
    collateralMint: zMint.describe('Collateral token mint (e.g. USDC, SOL)'),
    collateralAmount: zAmount,
    side: z.enum(['long', 'short']),
    leverage: z.number().positive().max(100).describe('Leverage multiplier'),
    stopLoss: z.number().optional().describe('Stop loss price'),
    takeProfit: z.number().optional().describe('Take profit price'),
  }),
  z.object({
    positionKey: zPubkey,
    tx: zTx,
    estimatedEntryPrice: z.number(),
    estimatedSize: zAmount,
    signature: z.string().optional(),
  }),
  'Open a leveraged perpetual position on Adrena Protocol.',
);

regAdrena(
  'closePosition',
  z.object({
    wallet: zPubkey,
    positionKey: zPubkey,
  }),
  z.object({
    tx: zTx,
    pnl: z.string(),
    signature: z.string().optional(),
  }),
  'Close a perpetual position on Adrena Protocol.',
);

regAdrena(
  'addCollateral',
  z.object({
    wallet: zPubkey,
    positionKey: zPubkey,
    amount: zAmount,
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Add collateral to an existing Adrena position.',
);

regAdrena(
  'removeCollateral',
  z.object({
    wallet: zPubkey,
    positionKey: zPubkey,
    amount: zAmount,
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Remove collateral from an Adrena position.',
);

regAdrena(
  'getPositions',
  z.object({
    wallet: zPubkey,
  }),
  z.object({
    positions: z.array(z.object({
      positionKey: zPubkey,
      market: z.string(),
      side: z.enum(['long', 'short']),
      size: zAmount,
      collateral: zAmount,
      entryPrice: z.number(),
      markPrice: z.number(),
      leverage: z.number(),
      unrealizedPnl: z.string(),
      liquidationPrice: z.number(),
    })),
  }),
  'Get all open positions on Adrena Protocol.',
);

/* ═══════════════════════════════════════════════════════════════
 *  9. Lulo — Best APR Lending
 * ═══════════════════════════════════════════════════════════════ */

const { register: regLulo, methods: luloMethods } = createMethodRegistry('lulo');

regLulo(
  'deposit',
  z.object({
    wallet: zPubkey,
    mint: zMint.describe('Token to deposit (e.g. USDC)'),
    amount: zAmount,
  }),
  z.object({
    tx: zTx,
    protocol: z.string().describe('Selected lending protocol (best APR)'),
    estimatedApy: z.number(),
    signature: z.string().optional(),
  }),
  'Deposit into the best APR lending protocol via Lulo aggregator.',
);

regLulo(
  'withdraw',
  z.object({
    wallet: zPubkey,
    mint: zMint,
    amount: zAmount,
  }),
  z.object({
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Withdraw from Lulo lending position.',
);

regLulo(
  'getBestRates',
  z.object({
    mint: zMint.optional().describe('Token to check rates for (default: USDC)'),
  }),
  z.object({
    rates: z.array(z.object({
      protocol: z.string(),
      apy: z.number(),
      tvl: z.string().optional(),
      utilizationRate: z.number().optional(),
    })),
    bestRate: z.object({
      protocol: z.string(),
      apy: z.number(),
    }),
  }),
  'Get the best lending/yield rates across all protocols via Lulo.',
);

regLulo(
  'getPositions',
  z.object({
    wallet: zPubkey,
  }),
  z.object({
    positions: z.array(z.object({
      protocol: z.string(),
      mint: zMint,
      deposited: zAmount,
      earned: zAmount,
      currentApy: z.number(),
    })),
    totalValueUsd: z.number().optional(),
  }),
  'Get all Lulo lending positions for a wallet.',
);

/* ═══════════════════════════════════════════════════════════════
 *  10. Jito — Bundles + Tips
 * ═══════════════════════════════════════════════════════════════ */

const { register: regJito, methods: jitoMethods } = createMethodRegistry('jito');

regJito(
  'sendBundle',
  z.object({
    transactions: z.array(zTx).min(1).max(5)
      .describe('Array of base64-encoded signed transactions (max 5)'),
    tipLamports: zAmount.optional().describe('Jito tip amount in lamports (higher = faster inclusion)'),
  }),
  z.object({
    bundleId: z.string(),
    status: z.enum(['submitted', 'landed', 'failed']),
    slot: z.number().optional(),
    signatures: z.array(z.string()),
  }),
  'Send a Jito bundle for MEV-protected, atomic transaction execution.',
);

regJito(
  'getBundleStatus',
  z.object({
    bundleId: z.string(),
  }),
  z.object({
    status: z.enum(['pending', 'landed', 'failed', 'dropped']),
    slot: z.number().optional(),
    confirmationStatus: z.string().optional(),
    error: z.string().optional(),
  }),
  'Check the status of a submitted Jito bundle.',
);

regJito(
  'getTipEstimate',
  z.object({}),
  z.object({
    percentile25: zAmount.describe('25th percentile tip (lamports)'),
    percentile50: zAmount.describe('50th percentile tip'),
    percentile75: zAmount.describe('75th percentile tip'),
    percentile95: zAmount.describe('95th percentile tip'),
    percentile99: zAmount.describe('99th percentile tip'),
  }),
  'Get current Jito tip percentile estimates for bundle inclusion priority.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

export {
  pumpMethods,
  raydiumPoolMethods,
  orcaMethods,
  manifestMethods,
  meteoraMethods,
  openbookMethods,
  driftMethods,
  adrenaMethods,
  luloMethods,
  jitoMethods,
};

export const allDefiMethods = [
  ...pumpMethods,
  ...raydiumPoolMethods,
  ...orcaMethods,
  ...manifestMethods,
  ...meteoraMethods,
  ...openbookMethods,
  ...driftMethods,
  ...adrenaMethods,
  ...luloMethods,
  ...jitoMethods,
] as const;
