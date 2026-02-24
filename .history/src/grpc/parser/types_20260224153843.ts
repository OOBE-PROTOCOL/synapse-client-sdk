/**
 * Geyser gRPC Subscription Parser — Type definitions.
 *
 * These types model both the **raw** Yellowstone/Geyser protobuf-style
 * messages coming off a `subscribe()` stream AND their **parsed**
 * developer-friendly equivalents.
 *
 * @module grpc/parser/types
 */

import type { Pubkey, Signature, Slot, Lamports, UnixTimestamp, Commitment } from '../../core/types';

/* ═══════════════════════════════════════════════════════════════
 *  Raw Geyser wire types — exactly what the gRPC stream emits
 * ═══════════════════════════════════════════════════════════════ */

/** A Buffer descriptor as emitted by protobufjs / Yellowstone. */
export interface RawBuffer {
  type: 'Buffer';
  data: number[];
}

/** Raw protobuf Timestamp (seconds as string, nanos). */
export interface RawTimestamp {
  seconds: string;
  nanos: number;
}

/** Raw transaction signature + message + meta as received from gRPC. */
export interface RawTransactionInfo {
  signature: RawBuffer;
  is_vote: boolean;
  transaction: {
    signature: RawBuffer;
    message: RawBuffer;
  };
  meta: {
    err?: unknown;
    fee: string;
    pre_balances: string[];
    post_balances: string[];
    pre_token_balances?: RawTokenBalance[];
    post_token_balances?: RawTokenBalance[];
    log_messages?: string[];
    inner_instructions?: RawInnerInstruction[];
    loaded_addresses?: {
      writable: RawBuffer[];
      readonly: RawBuffer[];
    };
    compute_units_consumed?: string;
    return_data?: {
      program_id: RawBuffer;
      data: RawBuffer;
    };
  };
  index: string;
}

/** Raw token balance from gRPC meta. */
export interface RawTokenBalance {
  account_index: number;
  mint: string;
  ui_token_amount: {
    ui_amount: number;
    decimals: number;
    amount: string;
    ui_amount_string: string;
  };
  owner: string;
  program_id: string;
}

/** Raw inner instruction set. */
export interface RawInnerInstruction {
  index: number;
  instructions: RawCompiledInstruction[];
}

/** Raw compiled instruction from protobuf. */
export interface RawCompiledInstruction {
  program_id_index: number;
  accounts: number[];
  data: RawBuffer | string;
}

/** Raw account update from geyser subscribe. */
export interface RawAccountInfo {
  pubkey: RawBuffer;
  lamports: string;
  owner: RawBuffer;
  executable: boolean;
  rent_epoch: string;
  data: RawBuffer;
  write_version: string;
  txn_signature?: RawBuffer;
}

/** Raw slot update. */
export interface RawSlotInfo {
  slot: string;
  parent?: string;
  status: string | number;
}

/** Raw block meta update. */
export interface RawBlockMeta {
  slot: string;
  blockhash: string;
  rewards: unknown[];
  block_time?: RawTimestamp;
  block_height?: string;
  parent_slot?: string;
  parent_blockhash?: string;
  executed_transaction_count?: string;
}

/** Raw entry notification. */
export interface RawEntry {
  slot: string;
  index: string;
  num_hashes: string;
  hash: RawBuffer;
  executed_transaction_count: string;
  starting_transaction_index?: string;
}

/**
 * Top-level Geyser subscription update — the exact shape emitted
 * by Yellowstone gRPC `subscribe()`.
 */
export interface RawGeyserUpdate {
  filters: string[];
  created_at?: RawTimestamp;
  update_oneof: 'transaction' | 'account' | 'slot' | 'block_meta' | 'entry' | 'ping';

  transaction?: {
    transaction: RawTransactionInfo;
    slot: string;
  };
  account?: {
    account: RawAccountInfo;
    slot: string;
    is_startup: boolean;
  };
  slot?: RawSlotInfo;
  block_meta?: RawBlockMeta;
  entry?: RawEntry;
  ping?: {};
}

/* ═══════════════════════════════════════════════════════════════
 *  Parsed — developer-friendly types
 * ═══════════════════════════════════════════════════════════════ */

/** Parsed balance change for a single account. */
export interface BalanceChange {
  /** Account index in the transaction's account list. */
  index: number;
  /** Pre-transaction balance in lamports. */
  preLamports: Lamports;
  /** Post-transaction balance in lamports. */
  postLamports: Lamports;
  /** Delta in lamports (positive = received SOL). */
  deltaLamports: bigint;
  /** Delta in SOL. */
  deltaSol: number;
}

/** Parsed token balance change. */
export interface TokenBalanceChange {
  accountIndex: number;
  mint: Pubkey;
  owner: Pubkey;
  preAmount: string;
  postAmount: string;
  deltaAmount: bigint;
  decimals: number;
  preUiAmount: number | null;
  postUiAmount: number | null;
}

/** A single decoded instruction. */
export interface ParsedInstruction {
  /** Program ID (base58). */
  programId: Pubkey;
  /** Readable program name if recognized. */
  programName?: string;
  /** Account pubkeys involved (base58). */
  accounts: Pubkey[];
  /** Raw instruction data (hex). */
  dataHex: string;
  /** Instruction data (base64). */
  dataBase64: string;
  /** Instruction index within the transaction. */
  index: number;
  /** Whether this is an inner (CPI) instruction. */
  isInner: boolean;
  /** Parent instruction index (for inner instructions). */
  parentIndex?: number;
}

/** Parsed transaction from a gRPC subscription. */
export interface ParsedTransaction {
  /** Transaction signature (base58). */
  signature: Signature;
  /** Slot this transaction was processed in. */
  slot: Slot;
  /** Transaction index within the block. */
  blockIndex: number;
  /** Whether this is a vote transaction. */
  isVote: boolean;
  /** Transaction fee in lamports. */
  feeLamports: Lamports;
  /** Transaction fee in SOL. */
  feeSol: number;
  /** Compute units consumed. */
  computeUnitsConsumed?: number;
  /** All account pubkeys involved (base58, ordered). */
  accountKeys: Pubkey[];
  /** Recent blockhash used. */
  recentBlockhash?: string;
  /** SOL balance changes per account. */
  balanceChanges: BalanceChange[];
  /** Token balance changes. */
  tokenBalanceChanges: TokenBalanceChange[];
  /** Decoded instructions (top-level + inner). */
  instructions: ParsedInstruction[];
  /** Log messages. */
  logs: string[];
  /** Transaction error (null if success). */
  error: unknown;
  /** Timestamp from gRPC `created_at` field. */
  timestamp?: Date;
  /** Programs invoked (unique set, base58). */
  programsInvoked: Pubkey[];
  /** Human-readable program names invoked. */
  programNamesInvoked: string[];
  /** Loaded address tables (v0 transactions). */
  loadedAddresses?: {
    writable: Pubkey[];
    readonly: Pubkey[];
  };
}

/** Parsed account update from a gRPC subscription. */
export interface ParsedAccountUpdate {
  /** Account pubkey (base58). */
  pubkey: Pubkey;
  /** Slot of the update. */
  slot: Slot;
  /** Account balance in lamports. */
  lamports: Lamports;
  /** Account balance in SOL. */
  sol: number;
  /** Owner program (base58). */
  owner: Pubkey;
  /** Owner program name if recognized. */
  ownerName?: string;
  /** Is executable (program account). */
  executable: boolean;
  /** Rent epoch. */
  rentEpoch: number;
  /** Account data as hex string. */
  dataHex: string;
  /** Account data as base64 string. */
  dataBase64: string;
  /** Account data size in bytes. */
  dataSize: number;
  /** Write version for ordering. */
  writeVersion: bigint;
  /** Signature of the transaction that caused this write. */
  txnSignature?: Signature;
  /** Whether this update came during validator startup replay. */
  isStartup: boolean;
  /** Timestamp. */
  timestamp?: Date;
}

/** Parsed slot update. */
export interface ParsedSlotUpdate {
  slot: Slot;
  parent?: Slot;
  /** Slot status: 0=processed, 1=confirmed, 2=finalized. */
  status: 'processed' | 'confirmed' | 'finalized' | 'rooted' | string;
  timestamp?: Date;
}

/** Parsed block meta. */
export interface ParsedBlockMeta {
  slot: Slot;
  blockhash: string;
  parentSlot?: Slot;
  parentBlockhash?: string;
  blockTime?: Date;
  blockHeight?: number;
  executedTransactionCount?: number;
  timestamp?: Date;
}

/** Parsed entry notification. */
export interface ParsedEntry {
  slot: Slot;
  index: number;
  numHashes: number;
  hashHex: string;
  executedTransactionCount: number;
  startingTransactionIndex?: number;
  timestamp?: Date;
}

/**
 * Union type for any parsed geyser update.
 * The `type` discriminant tells the dev what shape `.data` is.
 */
export type ParsedGeyserUpdate =
  | { type: 'transaction'; filters: string[]; data: ParsedTransaction }
  | { type: 'account';     filters: string[]; data: ParsedAccountUpdate }
  | { type: 'slot';        filters: string[]; data: ParsedSlotUpdate }
  | { type: 'block_meta';  filters: string[]; data: ParsedBlockMeta }
  | { type: 'entry';       filters: string[]; data: ParsedEntry }
  | { type: 'ping';        filters: string[]; data: {} };

/* ═══════════════════════════════════════════════════════════════
 *  Parser configuration
 * ═══════════════════════════════════════════════════════════════ */

/** Options for the GeyserParser. */
export interface GeyserParserConfig {
  /**
   * When `true`, balance changes with Δ=0 are excluded
   * from `balanceChanges` to reduce noise.
   * @default true
   */
  skipZeroBalanceChanges?: boolean;

  /**
   * When `true`, vote transactions are dropped entirely.
   * Useful for most DeFi/NFT use-cases.
   * @default false
   */
  skipVotes?: boolean;

  /**
   * Additional program IDs → human-readable names.
   * Merged with the built-in registry.
   */
  customPrograms?: Record<string, string>;

  /**
   * When `true`, inner (CPI) instructions are decoded
   * and included in `instructions`.
   * @default true
   */
  includeInnerInstructions?: boolean;

  /**
   * When `true`, token balance changes are calculated.
   * @default true
   */
  includeTokenBalances?: boolean;
}
