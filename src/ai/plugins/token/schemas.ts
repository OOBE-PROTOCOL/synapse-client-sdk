/**
 * @module ai/plugins/token/schemas
 * @description Token Plugin — Zod schemas for SPL token operations.
 *
 * Covers:
 *  - SPL Token operations    (deploy, transfer, burn, freeze, mint-to, close)
 *  - Balance checks          (token + SOL native)
 *  - Token metadata          (Metaplex token-metadata lookups)
 *  - Staking                 (native SOL staking, JupSOL, Solayer sSOL)
 *  - Bridging                (Wormhole cross-chain, deBridge DLN)
 *  - Rug / safety checks     (token security analysis)
 *
 * @since 2.0.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../../tools/protocols/shared';

/* ═══════════════════════════════════════════════════════════════
 *  Shared primitives
 * ═══════════════════════════════════════════════════════════════ */

const zMint    = z.string().describe('Token mint address (base58)');
const zPubkey  = z.string().describe('Solana public key (base58)');
const zAmount  = z.string().describe('Raw token amount (smallest unit, no decimals)');
const zTx      = z.string().describe('Base64-encoded serialized transaction');

/* ═══════════════════════════════════════════════════════════════
 *  1. SPL Token — core operations
 * ═══════════════════════════════════════════════════════════════ */

const { register: regSpl, methods: splMethods } = createMethodRegistry('spl-token');

regSpl(
  'deployToken',
  z.object({
    owner: zPubkey.describe('Token owner / mint authority wallet'),
    name: z.string().describe('Token name (stored in Metaplex metadata)'),
    symbol: z.string().max(10).describe('Token symbol (e.g. "MYTKN")'),
    decimals: z.number().int().min(0).max(18).default(9).describe('Token decimals (default: 9)'),
    initialSupply: zAmount.optional().describe('Initial supply to mint to owner (default: 0)'),
    uri: z.string().url().optional().describe('URI to off-chain metadata JSON (image, description, etc.)'),
    isMutable: z.boolean().optional().default(true).describe('Whether metadata is mutable (default: true)'),
    freezeAuthority: zPubkey.optional().describe('Freeze authority (default: owner). Set to null to disable.'),
    mintAuthority: zPubkey.optional().describe('Mint authority (default: owner). Set to null for fixed supply.'),
    sellerFeeBasisPoints: z.number().int().min(0).max(10000).optional().describe('Royalty fee in bps (for fungible with metadata)'),
  }),
  z.object({
    mint: zMint.describe('Newly created mint address'),
    ata: zPubkey.describe('Associated token account for the owner'),
    metadataAddress: zPubkey.optional().describe('Metaplex metadata PDA address'),
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Deploy a new SPL token with Metaplex metadata. Returns the mint address and an unsigned transaction.',
);

regSpl(
  'transfer',
  z.object({
    from: zPubkey.describe('Sender wallet address'),
    to: zPubkey.describe('Recipient wallet address'),
    mint: zMint.describe('Token mint address'),
    amount: zAmount.describe('Amount to transfer (raw, smallest unit)'),
    createAta: z.boolean().optional().default(true).describe('Create recipient ATA if needed (default: true)'),
    memo: z.string().optional().describe('Optional memo to attach to the transaction'),
  }),
  z.object({
    tx: zTx,
    fromAta: zPubkey.describe('Sender associated token account'),
    toAta: zPubkey.describe('Recipient associated token account'),
    signature: z.string().optional(),
  }),
  'Transfer SPL tokens between wallets. Optionally creates the recipient ATA.',
);

regSpl(
  'transferSol',
  z.object({
    from: zPubkey.describe('Sender wallet address'),
    to: zPubkey.describe('Recipient wallet address'),
    amount: zAmount.describe('Amount in lamports (1 SOL = 1_000_000_000 lamports)'),
    memo: z.string().optional().describe('Optional memo to attach'),
  }),
  z.object({
    tx: zTx,
    signature: z.string().optional(),
  }),
  'Transfer native SOL between wallets via SystemProgram.transfer.',
);

regSpl(
  'getBalance',
  z.object({
    wallet: zPubkey.describe('Wallet address to check'),
    mint: zMint.optional().describe('Token mint to check balance for (omit for SOL)'),
  }),
  z.object({
    balance: zAmount,
    decimals: z.number(),
    uiAmount: z.number().describe('Human-readable amount with decimals applied'),
    mint: zMint.optional(),
    symbol: z.string().optional(),
  }),
  'Get token or SOL balance for a wallet. If mint is omitted, returns native SOL balance.',
);

regSpl(
  'getTokenAccounts',
  z.object({
    wallet: zPubkey.describe('Wallet to query all token accounts for'),
    showZeroBalance: z.boolean().optional().default(false).describe('Include zero-balance accounts'),
  }),
  z.object({
    accounts: z.array(z.object({
      mint: zMint,
      ata: zPubkey,
      amount: zAmount,
      decimals: z.number(),
      uiAmount: z.number(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      logoURI: z.string().optional(),
    })),
    totalAccounts: z.number(),
    nativeSolBalance: zAmount,
  }),
  'List all SPL token accounts for a wallet with balances and metadata.',
);

regSpl(
  'mintTo',
  z.object({
    mint: zMint.describe('Token mint address'),
    mintAuthority: zPubkey.describe('Mint authority wallet'),
    destination: zPubkey.describe('Wallet to receive minted tokens'),
    amount: zAmount.describe('Amount to mint (raw, smallest unit)'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Mint additional tokens to a destination wallet (requires mint authority).',
);

regSpl(
  'burn',
  z.object({
    mint: zMint,
    owner: zPubkey.describe('Token account owner'),
    amount: zAmount.describe('Amount to burn'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Burn SPL tokens from the owner\'s token account.',
);

regSpl(
  'freezeAccount',
  z.object({
    mint: zMint,
    account: zPubkey.describe('Token account to freeze'),
    freezeAuthority: zPubkey.describe('Freeze authority wallet'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Freeze a token account (prevents all transfers). Requires freeze authority.',
);

regSpl(
  'thawAccount',
  z.object({
    mint: zMint,
    account: zPubkey.describe('Token account to thaw'),
    freezeAuthority: zPubkey.describe('Freeze authority wallet'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Thaw (unfreeze) a previously frozen token account.',
);

regSpl(
  'closeAccount',
  z.object({
    account: zPubkey.describe('Token account to close'),
    owner: zPubkey.describe('Token account owner'),
    destination: zPubkey.optional().describe('Wallet to receive rent SOL (default: owner)'),
  }),
  z.object({ tx: zTx, reclaimedLamports: zAmount, signature: z.string().optional() }),
  'Close a token account and reclaim the rent SOL.',
);

regSpl(
  'rugCheck',
  z.object({
    mint: zMint.describe('Token mint to analyze'),
  }),
  z.object({
    mint: zMint,
    riskLevel: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    risks: z.array(z.object({
      type: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
      message: z.string(),
    })),
    details: z.object({
      hasMintAuthority: z.boolean(),
      hasFreezeAuthority: z.boolean(),
      topHoldersPercent: z.number().optional(),
      isVerified: z.boolean().optional(),
      liquidity: z.number().optional(),
      holderCount: z.number().optional(),
    }),
  }),
  'Check a token for potential rug pull risks: mint/freeze authority, holder concentration, liquidity.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Staking — SOL staking + liquid staking protocols
 * ═══════════════════════════════════════════════════════════════ */

const { register: regStake, methods: stakingMethods } = createMethodRegistry('staking');

regStake(
  'stakeSOL',
  z.object({
    wallet: zPubkey.describe('Wallet to stake from'),
    amount: zAmount.describe('Amount in lamports to stake'),
    validator: zPubkey.optional().describe('Validator vote account (default: auto-selected high-quality validator)'),
  }),
  z.object({
    stakeAccount: zPubkey,
    tx: zTx,
    estimatedApy: z.number().optional(),
    signature: z.string().optional(),
  }),
  'Stake native SOL to a validator. Creates a stake account and delegates.',
);

regStake(
  'unstakeSOL',
  z.object({
    wallet: zPubkey,
    stakeAccount: zPubkey.describe('Stake account to deactivate and withdraw'),
  }),
  z.object({ tx: zTx, signature: z.string().optional() }),
  'Deactivate and withdraw SOL from a stake account.',
);

regStake(
  'getStakeAccounts',
  z.object({
    wallet: zPubkey.describe('Wallet to query stake accounts for'),
  }),
  z.object({
    accounts: z.array(z.object({
      address: zPubkey,
      lamports: zAmount,
      state: z.enum(['activating', 'active', 'deactivating', 'inactive']),
      validator: zPubkey.optional(),
      activationEpoch: z.number().optional(),
      deactivationEpoch: z.number().optional(),
    })),
    totalStaked: zAmount,
  }),
  'List all stake accounts for a wallet with delegation status.',
);

regStake(
  'stakeJupSOL',
  z.object({
    wallet: zPubkey,
    amount: zAmount.describe('Amount in lamports to stake for jupSOL'),
  }),
  z.object({
    tx: zTx,
    jupsolAmount: zAmount.describe('Expected jupSOL received'),
    exchangeRate: z.number().describe('SOL/jupSOL exchange rate'),
    signature: z.string().optional(),
  }),
  'Stake SOL for jupSOL (Jupiter liquid staking). Instant liquidity, auto-compounding.',
);

regStake(
  'unstakeJupSOL',
  z.object({
    wallet: zPubkey,
    amount: zAmount.describe('Amount of jupSOL to unstake'),
  }),
  z.object({
    tx: zTx,
    solAmount: zAmount.describe('Expected SOL received'),
    signature: z.string().optional(),
  }),
  'Unstake jupSOL back to SOL.',
);

regStake(
  'stakeSolayer',
  z.object({
    wallet: zPubkey,
    amount: zAmount.describe('Amount in lamports to stake for sSOL'),
  }),
  z.object({
    tx: zTx,
    ssolAmount: zAmount.describe('Expected sSOL received'),
    exchangeRate: z.number().describe('SOL/sSOL exchange rate'),
    signature: z.string().optional(),
  }),
  'Stake SOL for sSOL via Solayer. Re-staking protocol with additional yield.',
);

regStake(
  'unstakeSolayer',
  z.object({
    wallet: zPubkey,
    amount: zAmount.describe('Amount of sSOL to unstake'),
  }),
  z.object({
    tx: zTx,
    solAmount: zAmount.describe('Expected SOL received'),
    signature: z.string().optional(),
  }),
  'Unstake sSOL back to SOL via Solayer.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Bridging — Wormhole + deBridge DLN
 * ═══════════════════════════════════════════════════════════════ */

const { register: regBridge, methods: bridgingMethods } = createMethodRegistry('bridging');

regBridge(
  'bridgeWormhole',
  z.object({
    sourceChain: z.string().describe('Source chain identifier (e.g. "solana", "ethereum", "base", "polygon")'),
    destinationChain: z.string().describe('Destination chain identifier'),
    token: zMint.describe('Token address on source chain'),
    amount: zAmount.describe('Amount to bridge (raw, smallest unit)'),
    sender: zPubkey.describe('Sender wallet on source chain'),
    recipient: z.string().describe('Recipient address on destination chain'),
    relayerFee: zAmount.optional().describe('Relayer fee amount (if using automatic relaying)'),
  }),
  z.object({
    tx: zTx,
    sequence: z.string().describe('Wormhole sequence number'),
    emitterAddress: z.string(),
    estimatedArrival: z.string().optional().describe('Estimated arrival time (ISO 8601)'),
    signature: z.string().optional(),
  }),
  'Bridge tokens across chains via Wormhole. Supports Solana ↔ EVM chains.',
);

regBridge(
  'bridgeWormholeStatus',
  z.object({
    sequence: z.string().describe('Wormhole sequence number from bridgeWormhole response'),
    sourceChain: z.string(),
  }),
  z.object({
    status: z.enum(['pending', 'signed', 'completed', 'failed']),
    vaaHash: z.string().optional(),
    destinationTx: z.string().optional(),
    completedAt: z.string().optional(),
  }),
  'Check the status of a Wormhole bridge transfer.',
);

regBridge(
  'bridgeDeBridge',
  z.object({
    sourceChain: z.number().describe('Source chain ID (e.g. 7565164 for Solana)'),
    destinationChain: z.number().describe('Destination chain ID'),
    tokenIn: z.string().describe('Token address on source chain'),
    tokenOut: z.string().describe('Token address on destination chain (use "0x0" for native)'),
    amount: zAmount.describe('Amount to bridge (raw)'),
    sender: z.string().describe('Sender address'),
    recipient: z.string().describe('Recipient address on destination chain'),
    slippageBps: z.number().optional().default(50).describe('Slippage tolerance in bps'),
  }),
  z.object({
    tx: zTx,
    orderId: z.string().describe('deBridge DLN order ID'),
    estimatedOutput: zAmount,
    fee: zAmount.describe('Bridge fee'),
    estimatedArrival: z.string().optional(),
    signature: z.string().optional(),
  }),
  'Bridge tokens across chains via deBridge DLN. Fast cross-chain transfers with deterministic pricing.',
);

regBridge(
  'bridgeDeBridgeStatus',
  z.object({
    orderId: z.string().describe('deBridge DLN order ID'),
  }),
  z.object({
    status: z.enum(['created', 'fulfilled', 'cancelled', 'expired']),
    sourceChainTx: z.string().optional(),
    destinationChainTx: z.string().optional(),
    completedAt: z.string().optional(),
  }),
  'Check the status of a deBridge DLN cross-chain transfer.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

export const tokenSplMethods = splMethods;
export const tokenStakingMethods = stakingMethods;
export const tokenBridgingMethods = bridgingMethods;

export const allTokenMethods = [...splMethods, ...stakingMethods, ...bridgingMethods] as const;
