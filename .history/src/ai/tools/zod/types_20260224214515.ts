/**
 * @module ai/tools/zod/types
 * @description Zod schemas for all 53 Solana JSON-RPC methods.
 *
 * Each method is registered with typed input/output schemas for
 * agent discovery, validation, and LLM tool creation.
 *
 * @since 1.0.0
 */

import { z } from 'zod';
import { registerRpcMethod } from '.';

/**
 * @description Descriptor for a registered Solana RPC method with Zod schemas.
 * @since 1.0.0
 */
export interface AgentRpcMethod {
  /** The JSON-RPC method name (e.g. 'getBalance'). */
  name: string;
  /** Human-readable description for agent/LLM discovery. */
  description?: string;
  /** Zod schema for validated input parameters. */
  input: z.ZodTypeAny;
  /** Zod schema documenting the expected output shape. */
  output: z.ZodTypeAny;
}

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives — reused across all method schemas
 * ═══════════════════════════════════════════════════════════════ */

const zPubkey      = z.string().describe('Base58-encoded Solana public key');
const zSignature   = z.string().describe('Base58-encoded transaction signature');
const zSlot        = z.number().int().nonnegative().describe('Slot number');
const zEpoch       = z.number().int().nonnegative().describe('Epoch number');
const zLamports    = z.number().nonnegative().describe('Lamports (u64)');
const zCommitment  = z.enum(['processed', 'confirmed', 'finalized']).optional();
const zEncoding    = z.enum(['base64', 'jsonParsed', 'base58', 'base64+zstd']).optional();
const zMinCtxSlot  = z.number().int().nonnegative().optional().describe('Minimum context slot');
const zDataSlice   = z.object({ offset: z.number(), length: z.number() }).optional();

/** Wraps a value schema in an RpcContext shape: { context, value } */
const zCtx = <T extends z.ZodTypeAny>(v: T) =>
  z.object({
    context: z.object({ slot: zSlot, apiVersion: z.string().optional() }),
    value: v,
  });

const zAccountInfo = z.object({
  data: z.unknown(),
  executable: z.boolean(),
  lamports: zLamports,
  owner: zPubkey,
  rentEpoch: z.number(),
  space: z.number(),
});

const zTokenAmount = z.object({
  amount: z.string(),
  decimals: z.number(),
  uiAmount: z.number().nullable(),
  uiAmountString: z.string(),
});

/* ═══════════════════════════════════════════════════════════════
 *  All 53 Solana JSON-RPC methods — registered once into the
 *  shared `agentRpcMethods` array for Agent/LLM discovery.
 * ═══════════════════════════════════════════════════════════════ */

// ── 1. Account ──────────────────────────────────────────────────

registerRpcMethod('getAccountInfo',
  z.object({ pubkey: zPubkey, encoding: zEncoding, dataSlice: zDataSlice, commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zCtx(zAccountInfo.nullable()),
  'Returns all information associated with the account of provided Pubkey.',
);

registerRpcMethod('getBalance',
  z.object({ pubkey: zPubkey, commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zCtx(zLamports),
  'Returns the lamport balance of the account of provided Pubkey.',
);

registerRpcMethod('getMultipleAccounts',
  z.object({
    pubkeys: z.array(zPubkey).max(100),
    encoding: zEncoding, dataSlice: zDataSlice, commitment: zCommitment, minContextSlot: zMinCtxSlot,
  }),
  zCtx(z.array(zAccountInfo.nullable())),
  'Returns the account information for a list of Pubkeys (max 100).',
);

registerRpcMethod('getProgramAccounts',
  z.object({
    programId: zPubkey,
    encoding: zEncoding, dataSlice: zDataSlice, commitment: zCommitment, minContextSlot: zMinCtxSlot,
    withContext: z.boolean().optional(),
    filters: z.array(z.union([
      z.object({ memcmp: z.object({ offset: z.number(), bytes: z.string(), encoding: z.string().optional() }) }),
      z.object({ dataSize: z.number() }),
    ])).optional(),
  }),
  z.array(z.object({ pubkey: zPubkey, account: zAccountInfo })),
  'Returns all accounts owned by the provided program Pubkey.',
);

registerRpcMethod('getLargestAccounts',
  z.object({ commitment: zCommitment, filter: z.enum(['circulating', 'nonCirculating']).optional() }),
  zCtx(z.array(z.object({ address: zPubkey, lamports: zLamports }))),
  'Returns the 20 largest accounts, by lamport balance.',
);

// ── 2. Block ────────────────────────────────────────────────────

registerRpcMethod('getBlock',
  z.object({
    slot: zSlot,
    encoding: zEncoding, commitment: zCommitment,
    transactionDetails: z.enum(['full', 'accounts', 'signatures', 'none']).optional(),
    rewards: z.boolean().optional(),
    maxSupportedTransactionVersion: z.number().optional(),
  }),
  z.object({
    blockhash: z.string(),
    previousBlockhash: z.string(),
    parentSlot: zSlot,
    blockHeight: z.number().nullable(),
    blockTime: z.number().nullable(),
    transactions: z.array(z.object({ transaction: z.unknown(), meta: z.unknown().nullable(), version: z.union([z.number(), z.literal('legacy')]).optional() })).optional(),
    signatures: z.array(z.string()).optional(),
    rewards: z.array(z.object({ pubkey: zPubkey, lamports: z.number(), postBalance: z.number(), rewardType: z.string().nullable(), commission: z.number().optional() })).optional(),
  }).nullable(),
  'Returns identity and transaction information about a confirmed block.',
);

registerRpcMethod('getBlockHeight',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  z.number(),
  'Returns the current block height of the node.',
);

registerRpcMethod('getBlockTime',
  z.object({ slot: zSlot }),
  z.number().nullable(),
  'Returns the estimated production time of a block as Unix timestamp.',
);

registerRpcMethod('getBlockProduction',
  z.object({
    commitment: zCommitment,
    range: z.object({ firstSlot: zSlot, lastSlot: zSlot.optional() }).optional(),
    identity: zPubkey.optional(),
  }),
  zCtx(z.object({
    byIdentity: z.record(zPubkey, z.tuple([z.number(), z.number()])),
    range: z.object({ firstSlot: zSlot, lastSlot: zSlot }),
  })),
  'Returns recent block production information from the current or previous epoch.',
);

registerRpcMethod('getBlocks',
  z.object({ startSlot: zSlot, endSlot: zSlot.optional(), commitment: zCommitment }),
  z.array(zSlot),
  'Returns a list of confirmed blocks between two slots.',
);

registerRpcMethod('getBlocksWithLimit',
  z.object({ startSlot: zSlot, limit: z.number().int().positive(), commitment: zCommitment }),
  z.array(zSlot),
  'Returns a list of confirmed blocks starting at the given slot, for up to limit blocks.',
);

registerRpcMethod('getBlockCommitment',
  z.object({ slot: zSlot }),
  z.object({ commitment: z.array(z.number()).nullable(), totalStake: z.number() }),
  'Returns commitment for particular block.',
);

registerRpcMethod('getFirstAvailableBlock',
  z.object({}),
  zSlot,
  'Returns the slot of the lowest confirmed block that has not been purged from the ledger.',
);

// ── 3. Transaction ──────────────────────────────────────────────

registerRpcMethod('getTransaction',
  z.object({
    signature: zSignature,
    encoding: zEncoding, commitment: zCommitment,
    maxSupportedTransactionVersion: z.number().optional(),
  }),
  z.object({
    slot: zSlot,
    meta: z.object({
      err: z.unknown(),
      fee: z.number(),
      preBalances: z.array(z.number()),
      postBalances: z.array(z.number()),
      preTokenBalances: z.array(z.unknown()).optional(),
      postTokenBalances: z.array(z.unknown()).optional(),
      logMessages: z.array(z.string()).optional(),
      innerInstructions: z.array(z.unknown()).optional(),
      loadedAddresses: z.object({ writable: z.array(zPubkey), readonly: z.array(zPubkey) }).optional(),
      computeUnitsConsumed: z.number().optional(),
    }).nullable(),
    transaction: z.unknown(),
    blockTime: z.number().nullable(),
    version: z.union([z.number(), z.literal('legacy')]).optional(),
  }).nullable(),
  'Returns transaction details for a confirmed transaction.',
);

registerRpcMethod('getSignaturesForAddress',
  z.object({
    address: zPubkey,
    limit: z.number().int().positive().max(1000).optional(),
    before: zSignature.optional(),
    until: zSignature.optional(),
    commitment: zCommitment,
    minContextSlot: zMinCtxSlot,
  }),
  z.array(z.object({
    signature: zSignature,
    slot: zSlot,
    err: z.unknown(),
    memo: z.string().nullable(),
    blockTime: z.number().nullable(),
    confirmationStatus: z.enum(['processed', 'confirmed', 'finalized']).nullable(),
  })),
  'Returns signatures for confirmed transactions that include the given address.',
);

registerRpcMethod('getSignatureStatuses',
  z.object({ signatures: z.array(zSignature), searchTransactionHistory: z.boolean().optional() }),
  zCtx(z.array(z.object({
    slot: zSlot,
    confirmations: z.number().nullable(),
    err: z.unknown(),
    confirmationStatus: z.enum(['processed', 'confirmed', 'finalized']).nullable(),
  }).nullable())),
  'Returns the statuses of a list of signatures.',
);

registerRpcMethod('getTransactionCount',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  z.number(),
  'Returns the current Transaction count from the ledger.',
);

registerRpcMethod('getFeeForMessage',
  z.object({ message: z.string().describe('Base64-encoded Message'), commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zCtx(z.number().nullable()),
  'Returns the fee the network will charge for a particular Message.',
);

registerRpcMethod('getRecentPrioritizationFees',
  z.object({ addresses: z.array(zPubkey).max(128).optional() }),
  z.array(z.object({ slot: zSlot, prioritizationFee: z.number() })),
  'Returns a list of prioritization fees from recent blocks.',
);

// ── 4. Blockhash ────────────────────────────────────────────────

registerRpcMethod('getLatestBlockhash',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zCtx(z.object({ blockhash: z.string(), lastValidBlockHeight: z.number() })),
  'Returns the latest blockhash.',
);

registerRpcMethod('isBlockhashValid',
  z.object({ blockhash: z.string(), commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zCtx(z.boolean()),
  'Returns whether a blockhash is still valid or not.',
);

// ── 5. Submission ───────────────────────────────────────────────

registerRpcMethod('sendTransaction',
  z.object({
    signedTx: z.string().describe('Fully-signed Transaction, encoded as base64 or base58'),
    encoding: z.enum(['base58', 'base64']).optional(),
    skipPreflight: z.boolean().optional(),
    preflightCommitment: zCommitment,
    maxRetries: z.number().int().nonnegative().optional(),
    minContextSlot: zMinCtxSlot,
  }),
  zSignature,
  'Submits a signed transaction to the cluster for processing.',
);

registerRpcMethod('simulateTransaction',
  z.object({
    tx: z.string().describe('Transaction, encoded as base64 or base58'),
    encoding: z.enum(['base58', 'base64']).optional(),
    commitment: zCommitment,
    sigVerify: z.boolean().optional(),
    replaceRecentBlockhash: z.boolean().optional(),
    accounts: z.object({ addresses: z.array(zPubkey), encoding: zEncoding }).optional(),
    minContextSlot: zMinCtxSlot,
    innerInstructions: z.boolean().optional(),
  }),
  z.object({
    err: z.unknown(),
    logs: z.array(z.string()).nullable(),
    accounts: z.array(z.unknown()).nullable().optional(),
    unitsConsumed: z.number().optional(),
    returnData: z.object({ programId: zPubkey, data: z.tuple([z.string(), z.string()]) }).nullable().optional(),
    innerInstructions: z.array(z.unknown()).nullable().optional(),
    replacementBlockhash: z.object({ blockhash: z.string(), lastValidBlockHeight: z.number() }).nullable().optional(),
    loadedAccountsDataSize: z.number().optional(),
  }),
  'Simulate sending a transaction.',
);

registerRpcMethod('requestAirdrop',
  z.object({ pubkey: zPubkey, lamports: zLamports, commitment: zCommitment }),
  zSignature,
  'Requests an airdrop of lamports to a Pubkey (devnet/testnet only).',
);

// ── 6. Slot / Epoch ─────────────────────────────────────────────

registerRpcMethod('getSlot',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zSlot,
  'Returns the slot that has reached the given or default commitment level.',
);

registerRpcMethod('getSlotLeader',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  zPubkey,
  'Returns the current slot leader.',
);

registerRpcMethod('getSlotLeaders',
  z.object({ startSlot: zSlot, limit: z.number().int().positive().max(5000) }),
  z.array(zPubkey),
  'Returns the slot leaders for a given slot range.',
);

registerRpcMethod('getEpochInfo',
  z.object({ commitment: zCommitment, minContextSlot: zMinCtxSlot }),
  z.object({
    absoluteSlot: zSlot, blockHeight: z.number(), epoch: zEpoch,
    slotIndex: z.number(), slotsInEpoch: z.number(), transactionCount: z.number().optional(),
  }),
  'Returns information about the current epoch.',
);

registerRpcMethod('getEpochSchedule',
  z.object({}),
  z.object({
    slotsPerEpoch: z.number(), leaderScheduleSlotOffset: z.number(), warmup: z.boolean(),
    firstNormalEpoch: zEpoch, firstNormalSlot: zSlot,
  }),
  'Returns the epoch schedule information from this cluster.',
);

// ── 7. Inflation ────────────────────────────────────────────────

registerRpcMethod('getInflationRate',
  z.object({}),
  z.object({ total: z.number(), validator: z.number(), foundation: z.number(), epoch: zEpoch }),
  'Returns the specific inflation values for the current epoch.',
);

registerRpcMethod('getInflationGovernor',
  z.object({ commitment: zCommitment }),
  z.object({ initial: z.number(), terminal: z.number(), taper: z.number(), foundation: z.number(), foundationTerm: z.number() }),
  'Returns the current inflation governor.',
);

registerRpcMethod('getInflationReward',
  z.object({
    addresses: z.array(zPubkey),
    epoch: zEpoch.optional(), commitment: zCommitment, minContextSlot: zMinCtxSlot,
  }),
  z.array(z.object({
    epoch: zEpoch, effectiveSlot: zSlot, amount: z.number(), postBalance: z.number(), commission: z.number().optional(),
  }).nullable()),
  'Returns the inflation / staking reward for a list of addresses for an epoch.',
);

// ── 8. Cluster / Network ────────────────────────────────────────

registerRpcMethod('getVoteAccounts',
  z.object({
    commitment: zCommitment,
    votePubkey: zPubkey.optional(),
    keepUnstakedDelinquents: z.boolean().optional(),
    delinquentSlotDistance: z.number().optional(),
  }),
  z.object({
    current: z.array(z.object({
      votePubkey: zPubkey, nodePubkey: zPubkey, activatedStake: z.number(),
      epochVoteAccount: z.boolean(), commission: z.number(), lastVote: zSlot,
      epochCredits: z.array(z.tuple([zEpoch, z.number(), z.number()])), rootSlot: zSlot,
    })),
    delinquent: z.array(z.object({
      votePubkey: zPubkey, nodePubkey: zPubkey, activatedStake: z.number(),
      epochVoteAccount: z.boolean(), commission: z.number(), lastVote: zSlot,
      epochCredits: z.array(z.tuple([zEpoch, z.number(), z.number()])), rootSlot: zSlot,
    })),
  }),
  'Returns the account info and associated stake for all the voting accounts in the current bank.',
);

registerRpcMethod('getClusterNodes',
  z.object({}),
  z.array(z.object({
    pubkey: zPubkey, gossip: z.string().nullable().optional(), tpu: z.string().nullable().optional(),
    rpc: z.string().nullable().optional(), version: z.string().nullable().optional(),
    featureSet: z.number().optional(), shredVersion: z.number().optional(),
  })),
  'Returns information about all the nodes participating in the cluster.',
);

registerRpcMethod('getSupply',
  z.object({ commitment: zCommitment, excludeNonCirculatingAccountsList: z.boolean().optional() }),
  zCtx(z.object({
    total: zLamports, circulating: zLamports, nonCirculating: zLamports,
    nonCirculatingAccounts: z.array(zPubkey),
  })),
  'Returns information about the current supply.',
);

registerRpcMethod('getRecentPerformanceSamples',
  z.object({ limit: z.number().int().positive().max(720).optional() }),
  z.array(z.object({
    slot: zSlot, numSlots: z.number(), numTransactions: z.number(),
    numNonVoteTransactions: z.number(), samplePeriodSecs: z.number(),
  })),
  'Returns a list of recent performance samples, in reverse slot order.',
);

registerRpcMethod('getHealth',
  z.object({}),
  z.string(),
  'Returns the current health of the node. "ok" if healthy.',
);

registerRpcMethod('getVersion',
  z.object({}),
  z.object({ 'solana-core': z.string(), 'feature-set': z.number() }),
  'Returns the current Solana version running on the node.',
);

registerRpcMethod('getGenesisHash',
  z.object({}),
  z.string(),
  'Returns the genesis hash.',
);

registerRpcMethod('getIdentity',
  z.object({}),
  z.object({ identity: zPubkey }),
  'Returns the identity pubkey for the current node.',
);

registerRpcMethod('getLeaderSchedule',
  z.object({
    slot: zSlot.optional().describe('Fetch the leader schedule for the epoch that corresponds to the provided slot. Default: current epoch.'),
    commitment: zCommitment,
    identity: zPubkey.optional().describe('Only return results for this validator identity.'),
  }),
  z.record(zPubkey, z.array(z.number())).nullable(),
  'Returns the leader schedule for an epoch.',
);

registerRpcMethod('getHighestSnapshotSlot',
  z.object({}),
  z.object({ full: zSlot, incremental: zSlot.optional() }),
  'Returns the highest slot information that the node has snapshots for.',
);

// ── 9. Rent / Ledger ────────────────────────────────────────────

registerRpcMethod('getMinimumBalanceForRentExemption',
  z.object({ dataLength: z.number().int().nonnegative(), commitment: zCommitment }),
  z.number(),
  'Returns minimum balance required to make account rent exempt.',
);

registerRpcMethod('minimumLedgerSlot',
  z.object({}),
  zSlot,
  'Returns the lowest slot that the node has information about in its ledger.',
);

registerRpcMethod('getMaxRetransmitSlot',
  z.object({}),
  zSlot,
  'Get the max slot seen from retransmit stage.',
);

registerRpcMethod('getMaxShredInsertSlot',
  z.object({}),
  zSlot,
  'Get the max slot seen from after shred insert.',
);

// ── 10. Staking ─────────────────────────────────────────────────

registerRpcMethod('getStakeMinimumDelegation',
  z.object({ commitment: zCommitment }),
  zCtx(z.number()),
  'Returns the stake minimum delegation, in lamports.',
);

registerRpcMethod('getStakeActivation',
  z.object({ stakeAccount: zPubkey, commitment: zCommitment, epoch: zEpoch.optional(), minContextSlot: zMinCtxSlot }),
  z.object({ state: z.enum(['active', 'inactive', 'activating', 'deactivating']), active: z.number(), inactive: z.number() }),
  '[Deprecated] Returns epoch activation information for a stake account.',
);

// ── 11. Token (SPL) ─────────────────────────────────────────────

registerRpcMethod('getTokenAccountBalance',
  z.object({ tokenAccount: zPubkey, commitment: zCommitment }),
  zCtx(zTokenAmount),
  'Returns the token balance of an SPL Token account.',
);

registerRpcMethod('getTokenAccountsByOwner',
  z.object({
    owner: zPubkey,
    filter: z.union([z.object({ mint: zPubkey }), z.object({ programId: zPubkey })]),
    commitment: zCommitment, minContextSlot: zMinCtxSlot, dataSlice: zDataSlice,
  }),
  zCtx(z.array(z.object({ pubkey: zPubkey, account: zAccountInfo }))),
  'Returns all SPL Token accounts by token owner.',
);

registerRpcMethod('getTokenAccountsByDelegate',
  z.object({
    delegate: zPubkey,
    filter: z.union([z.object({ mint: zPubkey }), z.object({ programId: zPubkey })]),
    commitment: zCommitment, minContextSlot: zMinCtxSlot, dataSlice: zDataSlice,
  }),
  zCtx(z.array(z.object({ pubkey: zPubkey, account: zAccountInfo }))),
  'Returns all SPL Token accounts by approved Delegate.',
);

registerRpcMethod('getTokenLargestAccounts',
  z.object({ mint: zPubkey, commitment: zCommitment }),
  zCtx(z.array(z.object({ address: zPubkey, amount: z.string(), decimals: z.number(), uiAmount: z.number().nullable(), uiAmountString: z.string() }))),
  'Returns the 20 largest accounts of a particular SPL Token type.',
);

registerRpcMethod('getTokenSupply',
  z.object({ mint: zPubkey, commitment: zCommitment }),
  zCtx(zTokenAmount),
  'Returns the total supply of an SPL Token type.',
);