/**
 * @module ai/tools/protocols/jupiter-onchain/schemas
 * @description Jupiter On-Chain — Zod schemas for 10 local RPC-based tools.
 *
 * These tools query Jupiter protocol state **directly from the Solana
 * blockchain** using the SDK's native RPC transport and binary decoders.
 * They complement the REST-based Jupiter tools (which call api.jup.ag)
 * by providing raw on-chain data without external API dependencies.
 *
 * Covers:
 *  - Account inspection    (2 methods — single + program search)
 *  - Transaction history   (2 methods — signatures + full tx parse)
 *  - Position discovery    (3 methods — limit orders, DCA, perps)
 *  - Token utilities       (2 methods — mint info, token holdings)
 *  - Program registry      (1 method  — list all Jupiter program IDs)
 *
 * @since 1.1.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('jupiter_onchain');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zPubkey     = z.string().describe('Solana public key (base58-encoded)');
const zSignature  = z.string().describe('Transaction signature (base58-encoded, 88 chars)');
const zCommitment = z.enum(['processed', 'confirmed', 'finalized']).optional()
  .describe('RPC commitment level — "confirmed" is recommended for most reads, "finalized" for critical state');
const zEncoding   = z.enum(['base58', 'base64', 'base64+zstd', 'jsonParsed']).optional()
  .describe('Account data encoding — "base64" is fastest, "jsonParsed" returns human-readable JSON for known programs');

/** Jupiter program name → resolves to on-chain program ID in the executor. */
const zJupiterProgram = z.enum([
  'aggregator_v6',
  'aggregator_v4',
  'aggregator_v3',
  'aggregator_v2',
  'perps_v2',
  'perps_v1',
  'limit_order_v2',
  'dca',
  'lock',
  'vote',
  'dao',
]).describe(
  'Jupiter program name. aggregator_v6 is the current swap router. ' +
  'limit_order_v2 stores on-chain limit orders. dca stores Dollar-Cost-Average positions. ' +
  'perps_v2 is the perpetual futures engine. lock is the token lock program.',
);

/** Memcmp filter: match bytes at a specific offset in account data. */
const zMemcmpFilter = z.object({
  memcmp: z.object({
    offset: z.number().int().min(0).describe('Byte offset in account data where comparison starts'),
    bytes: z.string().describe('Base58-encoded bytes to match at the given offset'),
    encoding: z.enum(['base58', 'base64']).optional().describe('Encoding of the bytes field (default: base58)'),
  }),
}).describe('Match accounts whose data contains specific bytes at a given offset');

/** DataSize filter: match accounts with an exact data length. */
const zDataSizeFilter = z.object({
  dataSize: z.number().int().positive().describe('Exact account data length in bytes to match'),
}).describe('Match accounts with exactly this data size (useful for filtering by account type)');

/** Union of supported getProgramAccounts filters. */
const zFilter = z.union([zMemcmpFilter, zDataSizeFilter]);

/** DataSlice: return only a portion of account data. */
const zDataSlice = z.object({
  offset: z.number().int().min(0).describe('Byte offset to start slicing from'),
  length: z.number().int().positive().describe('Number of bytes to return'),
}).optional().describe('Return only a slice of account data — use to reduce payload size for large accounts');

/* ═══════════════════════════════════════════════════════════════
 *  Generic output shapes
 * ═══════════════════════════════════════════════════════════════ */

const zAccountInfoResult = z.object({
  context: z.object({ slot: z.number() }),
  value: z.object({
    data: z.unknown().describe('Account data in the requested encoding'),
    executable: z.boolean(),
    lamports: z.number(),
    owner: zPubkey,
    rentEpoch: z.number(),
    space: z.number().optional(),
  }).nullable(),
});

const zProgramAccountEntry = z.object({
  pubkey: zPubkey,
  account: z.object({
    data: z.unknown(),
    executable: z.boolean(),
    lamports: z.number(),
    owner: zPubkey,
    rentEpoch: z.number(),
    space: z.number().optional(),
  }),
});

const zSignatureEntry = z.object({
  signature: zSignature,
  slot: z.number(),
  blockTime: z.number().nullable(),
  confirmationStatus: z.string().nullable(),
  err: z.unknown().nullable(),
  memo: z.string().nullable(),
});

/* ═══════════════════════════════════════════════════════════════
 *  1. Account inspection
 * ═══════════════════════════════════════════════════════════════ */

register(
  'fetchAccount',
  z.object({
    address: zPubkey.describe('Account address to fetch (e.g. a Jupiter limit order, DCA, or perps position account)'),
    encoding: zEncoding,
    commitment: zCommitment,
    dataSlice: zDataSlice,
  }),
  zAccountInfoResult,
  'Fetch raw on-chain account data for any Solana address. ' +
  'Use this to inspect Jupiter program state accounts such as limit orders, DCA positions, ' +
  'perps positions, or any account owned by a Jupiter program. ' +
  'Returns owner program, lamports balance, data in the requested encoding, and executable flag. ' +
  'Use encoding "jsonParsed" for SPL Token accounts, "base64" for raw binary data.',
);

register(
  'searchProgramAccounts',
  z.object({
    program: zJupiterProgram.describe('Jupiter program to query — the tool resolves this to the correct on-chain program ID'),
    filters: z.array(zFilter).optional()
      .describe('Optional memcmp/dataSize filters. For example, use memcmp at offset 8 with the owner pubkey bytes to find accounts belonging to a specific wallet'),
    encoding: zEncoding,
    dataSlice: zDataSlice,
    commitment: zCommitment,
    maxResults: z.number().int().positive().max(1000).optional()
      .describe('Truncate results to this many accounts (default: no limit). Large programs may return thousands of accounts — use filters or dataSlice to keep responses manageable'),
  }),
  z.object({
    programId: zPubkey.describe('Resolved on-chain program ID'),
    programName: z.string(),
    accounts: z.array(zProgramAccountEntry),
    totalFound: z.number(),
    truncated: z.boolean(),
  }),
  'Query all on-chain accounts owned by a specific Jupiter program. ' +
  'Resolves the program name to its on-chain ID and calls getProgramAccounts. ' +
  'Use memcmp filters to narrow results by discriminator, owner, or token mint. ' +
  'Use dataSlice to return only account headers and reduce payload size. ' +
  'WARNING: unfiltered queries on large programs (e.g. aggregator_v6) may return thousands of accounts — always apply filters in production.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Transaction history
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getTransactionHistory',
  z.object({
    address: zPubkey.describe('Address to get transaction history for — can be a Jupiter program ID, a wallet, or any account'),
    limit: z.number().int().min(1).max(1000).optional()
      .describe('Maximum number of signatures to return (default: 20, max: 1000)'),
    before: zSignature.optional().describe('Return signatures older than this signature (pagination cursor)'),
    until: zSignature.optional().describe('Return signatures newer than this signature (stop condition)'),
    commitment: zCommitment,
  }),
  z.array(zSignatureEntry),
  'Get recent transaction signatures for a Jupiter program address, wallet, or any on-chain account. ' +
  'Returns chronological list with slot, block time, confirmation status, and error info. ' +
  'Use "before" and "until" for pagination through transaction history. ' +
  'Combine with inspectTransaction to get full transaction details.',
);

register(
  'inspectTransaction',
  z.object({
    signature: zSignature.describe('Transaction signature to fetch and parse'),
    commitment: zCommitment,
  }),
  z.object({
    transaction: z.unknown().describe('Full parsed transaction with instructions'),
    jupiterInstructions: z.array(z.object({
      programId: zPubkey,
      programName: z.string(),
      instructionIndex: z.number(),
      data: z.string().optional(),
      accounts: z.array(zPubkey).optional(),
      isInner: z.boolean(),
    })).describe('Instructions involving Jupiter programs, extracted from the transaction'),
    slot: z.number(),
    blockTime: z.number().nullable(),
  }),
  'Fetch a complete transaction by signature and identify all Jupiter program interactions. ' +
  'Returns the full parsed transaction plus a filtered list of instructions that involve known Jupiter programs ' +
  '(aggregator swaps, limit order fills, DCA executions, perps trades, etc.). ' +
  'Useful for understanding what happened in a specific Jupiter-related transaction.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Position discovery
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getLimitOrders',
  z.object({
    owner: zPubkey.describe('Wallet address (maker) to find limit orders for'),
    commitment: zCommitment,
  }),
  z.object({
    programId: zPubkey,
    orders: z.array(z.object({
      pubkey: zPubkey.describe('Limit order account address'),
      data: z.unknown().describe('Raw account data (base64)'),
      lamports: z.number(),
    })),
    count: z.number(),
  }),
  'Find all on-chain Jupiter Limit Order v2 accounts for a specific wallet. ' +
  'Queries the limit order program (J1TnP8zvVxbtF5KFp5xRmWuvG9McnhzmBd9XGfCyuxFP) ' +
  'with a memcmp filter on the maker field at offset 8 (after the 8-byte Anchor discriminator). ' +
  'Returns raw account data — the agent can interpret the binary layout or combine with the REST API for enriched data.',
);

register(
  'getDCAAccounts',
  z.object({
    owner: zPubkey.describe('Wallet address (user) to find DCA positions for'),
    commitment: zCommitment,
  }),
  z.object({
    programId: zPubkey,
    accounts: z.array(z.object({
      pubkey: zPubkey.describe('DCA account address'),
      data: z.unknown().describe('Raw account data (base64)'),
      lamports: z.number(),
    })),
    count: z.number(),
  }),
  'Find all on-chain Jupiter DCA (Dollar-Cost Averaging) accounts for a wallet. ' +
  'Queries the DCA program (DCA265Vj8a9CE2Xng1bcnkRg2PeugTsRt) ' +
  'with a memcmp filter on the user field at offset 8 (after the 8-byte Anchor discriminator). ' +
  'Returns raw account data for each active or completed DCA position.',
);

register(
  'getPerpsPositions',
  z.object({
    trader: zPubkey.describe('Trader wallet address to find perpetual positions for'),
    version: z.enum(['v1', 'v2']).optional()
      .describe('Perps program version — v2 is the current active version (default: v2)'),
    commitment: zCommitment,
  }),
  z.object({
    programId: zPubkey,
    programName: z.string(),
    positions: z.array(z.object({
      pubkey: zPubkey.describe('Position account address'),
      data: z.unknown().describe('Raw account data (base64)'),
      lamports: z.number(),
    })),
    count: z.number(),
  }),
  'Find on-chain Jupiter Perpetuals position accounts for a trader wallet. ' +
  'Queries the Perps program (v1 or v2, default v2) with a memcmp filter on the trader field. ' +
  'Jupiter Perps supports SOL, ETH, and BTC perpetual contracts. ' +
  'Returns raw position state data including size, collateral, entry price, and liquidation price.',
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Token utilities
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getTokenMintInfo',
  z.object({
    mint: zPubkey.describe('SPL Token mint address to decode (e.g. SOL-USDC LP mint, JUP token mint)'),
    commitment: zCommitment,
  }),
  z.object({
    mintAuthority: zPubkey.nullable(),
    supply: z.string().describe('Total supply as raw integer string'),
    decimals: z.number().describe('Number of decimal places'),
    isInitialized: z.boolean(),
    freezeAuthority: zPubkey.nullable(),
    slot: z.number().describe('Slot at which the data was fetched'),
  }),
  'Fetch and decode a SPL Token mint account using the SDK native binary decoder. ' +
  'Returns supply, decimals, mint authority, freeze authority, and initialization state. ' +
  'Works with both SPL Token and Token-2022 mints. ' +
  'Useful for checking token supply, verifying authority keys, and validating token metadata on-chain.',
);

register(
  'getTokenHoldings',
  z.object({
    owner: zPubkey.describe('Wallet address to query token holdings for'),
    mint: zPubkey.optional().describe('Filter by specific token mint — omit to get ALL token accounts'),
    programId: zPubkey.optional()
      .describe('Token program ID — omit for SPL Token, set to "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" for Token-2022'),
    commitment: zCommitment,
  }),
  z.object({
    accounts: z.array(z.object({
      pubkey: zPubkey.describe('Token account address'),
      mint: zPubkey,
      owner: zPubkey,
      amount: z.string().describe('Raw token amount (no decimals)'),
      decimals: z.number(),
      uiAmount: z.number().nullable(),
      delegate: zPubkey.nullable().optional(),
      state: z.string(),
    })),
    count: z.number(),
  }),
  'Get all SPL token accounts owned by a wallet using getTokenAccountsByOwner. ' +
  'Optionally filter by a specific mint address to get the balance of one token. ' +
  'Returns decoded token account data including balance, mint, delegate, and account state. ' +
  'Useful for checking Jupiter-related token balances (JUP, LP tokens, etc.) or discovering all tokens in a wallet.',
);

/* ═══════════════════════════════════════════════════════════════
 *  5. Program registry
 * ═══════════════════════════════════════════════════════════════ */

register(
  'resolvePrograms',
  z.object({}),
  z.object({
    programs: z.array(z.object({
      id: zPubkey.describe('On-chain program ID'),
      name: z.string().describe('Human-readable program name'),
      key: z.string().describe('Short key used in searchProgramAccounts'),
    })),
    count: z.number(),
  }),
  'List all known Jupiter program IDs with human-readable names and short keys. ' +
  'Returns the complete Jupiter program registry: aggregator versions (v2–v6), ' +
  'Perps (v1/v2), Limit Order v2, DCA, Lock, Vote, and DAO programs. ' +
  'No RPC call needed — this is a pure local lookup. ' +
  'Use the returned keys as input to the "program" field in searchProgramAccounts.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Export
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description All 10 registered Jupiter on-chain methods with typed Zod schemas.
 * @since 1.1.0
 */
export const jupiterOnchainMethods = methods;

/**
 * @description Jupiter on-chain method names as a readonly tuple.
 * @since 1.1.0
 */
export const jupiterOnchainMethodNames = methods.map((m) => m.name) as readonly string[];
