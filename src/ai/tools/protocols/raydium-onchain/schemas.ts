/**
 * @module ai/tools/protocols/raydium-onchain/schemas
 * @description Raydium On-Chain — Zod schemas for 10 local RPC-based tools.
 *
 * These tools query Raydium protocol state **directly from the Solana
 * blockchain** using the SDK's native RPC transport and binary decoders.
 * They complement the REST-based Raydium tools (which call api-v3.raydium.io)
 * by providing raw on-chain data without external API dependencies.
 *
 * Covers:
 *  - Account inspection       (2 methods — single + program search)
 *  - Transaction history      (2 methods — signatures + full tx parse)
 *  - Pool state               (3 methods — single, batch, search by mint)
 *  - Position discovery       (2 methods — LP tokens, farm positions)
 *  - Program registry         (1 method  — list all Raydium program IDs)
 *
 * @since 1.1.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('raydium_onchain');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zPubkey     = z.string().describe('Solana public key (base58-encoded)');
const zSignature  = z.string().describe('Transaction signature (base58-encoded, 88 chars)');
const zCommitment = z.enum(['processed', 'confirmed', 'finalized']).optional()
  .describe('RPC commitment level — "confirmed" is recommended for most reads');
const zEncoding   = z.enum(['base58', 'base64', 'base64+zstd', 'jsonParsed']).optional()
  .describe('Account data encoding — "base64" is fastest, "jsonParsed" returns human-readable JSON for known programs');

/** Raydium program name → resolves to on-chain program ID in the executor. */
const zRaydiumProgram = z.enum([
  'amm_v4',
  'clmm',
  'cpmm',
  'route',
  'farm',
  'acceleraytor',
  'clmm_legacy',
]).describe(
  'Raydium program name. amm_v4 is the classic AMM. clmm is Concentrated Liquidity Market Maker. ' +
  'cpmm is the Constant Product Market Maker. farm is the yield farming/staking program. ' +
  'route is the swap router. acceleraytor is the IDO launchpad.',
);

/** Memcmp filter for getProgramAccounts. */
const zMemcmpFilter = z.object({
  memcmp: z.object({
    offset: z.number().int().min(0).describe('Byte offset in account data where comparison starts'),
    bytes: z.string().describe('Base58-encoded bytes to match at the given offset'),
    encoding: z.enum(['base58', 'base64']).optional().describe('Encoding of bytes field (default: base58)'),
  }),
}).describe('Match accounts whose data contains specific bytes at a given offset');

/** DataSize filter for getProgramAccounts. */
const zDataSizeFilter = z.object({
  dataSize: z.number().int().positive().describe('Exact account data length in bytes to match'),
}).describe('Match accounts with exactly this data size');

const zFilter = z.union([zMemcmpFilter, zDataSizeFilter]);

/** DataSlice for partial data reads. */
const zDataSlice = z.object({
  offset: z.number().int().min(0).describe('Byte offset to start slicing from'),
  length: z.number().int().positive().describe('Number of bytes to return'),
}).optional().describe('Return only a slice of account data to reduce payload size');

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
    address: zPubkey.describe('Account address to fetch (e.g. a Raydium pool state, LP position, or farm account)'),
    encoding: zEncoding,
    commitment: zCommitment,
    dataSlice: zDataSlice,
  }),
  zAccountInfoResult,
  'Fetch raw on-chain account data for any Solana address. ' +
  'Use this to inspect Raydium program state accounts such as AMM pool states, ' +
  'CLMM positions, CPMM pools, or farming accounts. ' +
  'Returns owner program, lamports balance, data in the requested encoding, and executable flag.',
);

register(
  'searchProgramAccounts',
  z.object({
    program: zRaydiumProgram.describe('Raydium program to query — resolves to the correct on-chain program ID'),
    filters: z.array(zFilter).optional()
      .describe('Optional memcmp/dataSize filters. Use memcmp to filter by pool mint addresses, owner, or discriminator'),
    encoding: zEncoding,
    dataSlice: zDataSlice,
    commitment: zCommitment,
    maxResults: z.number().int().positive().max(1000).optional()
      .describe('Truncate results to this many accounts (default: no limit). Use filters to keep responses manageable'),
  }),
  z.object({
    programId: zPubkey.describe('Resolved on-chain program ID'),
    programName: z.string(),
    accounts: z.array(zProgramAccountEntry),
    totalFound: z.number(),
    truncated: z.boolean(),
  }),
  'Query all on-chain accounts owned by a specific Raydium program. ' +
  'Resolves the program name to its on-chain ID and calls getProgramAccounts. ' +
  'Use memcmp filters to narrow results by token mint, pool pair, or account type. ' +
  'WARNING: unfiltered queries on amm_v4 or clmm may return thousands of accounts — always apply filters.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. Transaction history
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getTransactionHistory',
  z.object({
    address: zPubkey.describe('Address to get transaction history for — can be a Raydium program, pool, or wallet'),
    limit: z.number().int().min(1).max(1000).optional()
      .describe('Maximum number of signatures to return (default: 20, max: 1000)'),
    before: zSignature.optional().describe('Return signatures older than this (pagination cursor)'),
    until: zSignature.optional().describe('Return signatures newer than this (stop condition)'),
    commitment: zCommitment,
  }),
  z.array(zSignatureEntry),
  'Get recent transaction signatures for a Raydium program address, pool account, or wallet. ' +
  'Returns chronological list with slot, block time, confirmation status, and error info. ' +
  'Use "before" and "until" for pagination. Combine with inspectTransaction for full details.',
);

register(
  'inspectTransaction',
  z.object({
    signature: zSignature.describe('Transaction signature to fetch and parse'),
    commitment: zCommitment,
  }),
  z.object({
    transaction: z.unknown().describe('Full parsed transaction with instructions'),
    raydiumInstructions: z.array(z.object({
      programId: zPubkey,
      programName: z.string(),
      instructionIndex: z.number(),
      data: z.string().optional(),
      accounts: z.array(zPubkey).optional(),
      isInner: z.boolean(),
    })).describe('Instructions involving Raydium programs, extracted from the transaction'),
    slot: z.number(),
    blockTime: z.number().nullable(),
  }),
  'Fetch a complete transaction by signature and identify all Raydium program interactions. ' +
  'Returns the full parsed transaction plus a filtered list of instructions involving Raydium programs ' +
  '(AMM swaps, CLMM position changes, CPMM operations, farm deposits/withdrawals, etc.).',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Pool state
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getPoolState',
  z.object({
    poolAddress: zPubkey.describe('Raydium pool account address (AMM v4, CLMM, or CPMM pool)'),
    encoding: zEncoding,
    commitment: zCommitment,
  }),
  z.object({
    address: zPubkey,
    owner: zPubkey.describe('Program that owns this pool (identifies pool type: AMM v4, CLMM, or CPMM)'),
    lamports: z.number(),
    data: z.unknown().describe('Pool state data in the requested encoding'),
    slot: z.number(),
    poolType: z.string().nullable().describe('Detected pool type based on owner program, or null if not a known Raydium pool'),
  }),
  'Fetch the on-chain state of a specific Raydium pool by its account address. ' +
  'Automatically detects the pool type (AMM v4, CLMM, or CPMM) based on the owner program. ' +
  'Returns raw pool state data including reserves, fees, tick state (CLMM), and configuration. ' +
  'Use encoding "base64" for raw binary data or "jsonParsed" if the RPC supports it.',
);

register(
  'getMultiplePoolStates',
  z.object({
    poolAddresses: z.array(zPubkey).min(1).max(100)
      .describe('Array of Raydium pool account addresses to fetch in a single RPC call (max 100)'),
    encoding: zEncoding,
    commitment: zCommitment,
  }),
  z.object({
    pools: z.array(z.object({
      address: zPubkey,
      owner: zPubkey.nullable(),
      lamports: z.number().nullable(),
      data: z.unknown().nullable(),
      poolType: z.string().nullable(),
      exists: z.boolean(),
    })),
    slot: z.number(),
    found: z.number(),
    missing: z.number(),
  }),
  'Fetch multiple Raydium pool states in a single getMultipleAccounts RPC call. ' +
  'More efficient than fetching pools one by one. Returns null for non-existent accounts. ' +
  'Automatically detects pool type for each account. Max 100 pools per call.',
);

register(
  'getPoolsByMint',
  z.object({
    program: z.enum(['amm_v4', 'clmm', 'cpmm'])
      .describe('Raydium pool program to search — each has different account layouts'),
    mint: zPubkey.describe('Token mint address to search for in pool accounts'),
    mintOffset: z.number().int().min(0)
      .describe(
        'Byte offset of the mint field in the pool account data layout. ' +
        'Common offsets — AMM v4: baseMint=400, quoteMint=432. ' +
        'CLMM: tokenMint0=73, tokenMint1=105. ' +
        'CPMM: token0Mint=73, token1Mint=105.',
      ),
    commitment: zCommitment,
    maxResults: z.number().int().positive().max(100).optional()
      .describe('Limit results (default: 50)'),
  }),
  z.object({
    programId: zPubkey,
    pools: z.array(z.object({
      pubkey: zPubkey.describe('Pool account address'),
      data: z.unknown(),
      lamports: z.number(),
    })),
    count: z.number(),
    truncated: z.boolean(),
  }),
  'Find Raydium pools containing a specific token mint by searching program accounts with a memcmp filter. ' +
  'You must specify the byte offset where the mint address appears in the pool account layout. ' +
  'Common offsets: AMM v4 baseMint=400, quoteMint=432; CLMM tokenMint0=73, tokenMint1=105; ' +
  'CPMM token0Mint=73, token1Mint=105. Returns raw pool state data.',
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Position discovery
 * ═══════════════════════════════════════════════════════════════ */

register(
  'getLPPositions',
  z.object({
    owner: zPubkey.describe('Wallet address to find LP token positions for'),
    lpMint: zPubkey.optional()
      .describe('Filter by specific LP token mint — omit to get all token accounts (then filter client-side for known LP mints)'),
    commitment: zCommitment,
  }),
  z.object({
    accounts: z.array(z.object({
      pubkey: zPubkey.describe('Token account address holding LP tokens'),
      mint: zPubkey.describe('LP token mint address'),
      owner: zPubkey,
      amount: z.string().describe('Raw LP token amount'),
      decimals: z.number(),
      uiAmount: z.number().nullable(),
    })),
    count: z.number(),
  }),
  'Find LP (Liquidity Provider) token accounts for a wallet. ' +
  'Uses getTokenAccountsByOwner to discover LP positions. ' +
  'If you know the specific LP mint, pass it to filter directly. ' +
  'Otherwise, returns all token accounts — cross-reference with known Raydium LP mints to identify positions. ' +
  'The LP token balance represents the wallet\'s share of the pool liquidity.',
);

register(
  'getFarmPositions',
  z.object({
    owner: zPubkey.describe('Wallet address (farmer) to find staking positions for'),
    commitment: zCommitment,
  }),
  z.object({
    programId: zPubkey,
    positions: z.array(z.object({
      pubkey: zPubkey.describe('Farm user account address'),
      data: z.unknown().describe('Raw account data (base64)'),
      lamports: z.number(),
    })),
    count: z.number(),
  }),
  'Find on-chain Raydium farm/staking position accounts for a wallet. ' +
  'Queries the Farm/Staking program (FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG) ' +
  'with a memcmp filter on the owner field at offset 40 (after discriminator + farm ID). ' +
  'Returns raw farming position data including staked amount and pending rewards.',
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
  'List all known Raydium program IDs with human-readable names and short keys. ' +
  'Returns the complete Raydium program registry: AMM v4, CLMM (Concentrated Liquidity), ' +
  'CPMM (Constant Product), Route (swap router), Farm/Staking, Acceleraytor (IDO), and CLMM Legacy. ' +
  'No RPC call needed — pure local lookup. ' +
  'Use the returned keys as input to the "program" field in searchProgramAccounts.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Export
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description All 10 registered Raydium on-chain methods with typed Zod schemas.
 * @since 1.1.0
 */
export const raydiumOnchainMethods = methods;

/**
 * @description Raydium on-chain method names as a readonly tuple.
 * @since 1.1.0
 */
export const raydiumOnchainMethodNames = methods.map((m) => m.name) as readonly string[];
