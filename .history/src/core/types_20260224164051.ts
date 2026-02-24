/**
 * Solana-branded primitive types.
 *
 * Phantom brands enforce **nominal typing** at zero runtime cost.
 * Every Solana concept (pubkey, signature, slot, lamports…) gets its own
 * opaque type so the compiler prevents accidental cross-use.
 *
 * @module core/types
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { Pubkey, Lamports, Slot } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const pk  = Pubkey('So11111111111111111111111111111111111111112');
 * const bal = Lamports(1_000_000_000n);
 * const s   = Slot(250_000_000);
 * ```
 */

// ── Brand utility ──────────────────────────────────────────────

/** @internal Unique symbol used for phantom branding. */
declare const __brand: unique symbol;

/**
 * Phantom brand utility.
 * Produces a nominal type `T & { [__brand]: B }` — the brand tag is
 * erased at runtime so there is zero allocation overhead.
 *
 * @typeParam T - The underlying JavaScript type (`string`, `number`, `bigint`).
 * @typeParam B - A unique string literal that identifies the brand.
 * @since 1.0.0
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Primitives ─────────────────────────────────────────────────

/** Base58-encoded string (Solana's default encoding). @since 1.0.0 */
export type Base58 = Brand<string, 'Base58'>;

/** Solana public key — 32 bytes, base58-encoded. @since 1.0.0 */
export type Pubkey = Brand<Base58, 'Pubkey'>;

/** Transaction signature — 64 bytes, base58-encoded. @since 1.0.0 */
export type Signature = Brand<Base58, 'Signature'>;

/** Slot number (absolute position in the ledger). @since 1.0.0 */
export type Slot = Brand<number, 'Slot'>;

/** Epoch number (Solana epoch counter). @since 1.0.0 */
export type Epoch = Brand<number, 'Epoch'>;

/** Lamport amount (1 SOL = 1 000 000 000 lamports). @since 1.0.0 */
export type Lamports = Brand<bigint, 'Lamports'>;

/** Unix timestamp in seconds. @since 1.0.0 */
export type UnixTimestamp = Brand<number, 'UnixTimestamp'>;

// ── Smart constructors ─────────────────────────────────────────
// Single branch, zero allocation on hot path.

/**
 * Create a branded {@link Pubkey} from a plain string.
 * @param v - Base58-encoded public key string.
 * @returns Branded `Pubkey`.
 * @since 1.0.0
 */
export const Pubkey = (v: string): Pubkey => v as unknown as Pubkey;

/**
 * Create a branded {@link Signature} from a plain string.
 * @param v - Base58-encoded transaction signature.
 * @returns Branded `Signature`.
 * @since 1.0.0
 */
export const Sig = (v: string): Signature => v as unknown as Signature;

/**
 * Create a branded {@link Slot} from a number.
 * @param v - Numeric slot value.
 * @returns Branded `Slot`.
 * @since 1.0.0
 */
export const Slot = (v: number): Slot => v as Slot;

/**
 * Create a branded {@link Epoch} from a number.
 * @param v - Numeric epoch value.
 * @returns Branded `Epoch`.
 * @since 1.0.0
 */
export const Epoch = (v: number): Epoch => v as Epoch;

/**
 * Create a branded {@link Lamports} from a number or bigint.
 * @param v - Lamport amount (will be coerced to `bigint`).
 * @returns Branded `Lamports`.
 * @since 1.0.0
 */
export const Lamports = (v: number | bigint): Lamports => BigInt(v) as Lamports;

/**
 * Create a branded {@link UnixTimestamp} from a number.
 * @param v - Unix epoch seconds.
 * @returns Branded `UnixTimestamp`.
 * @since 1.0.0
 */
export const UnixTs = (v: number): UnixTimestamp => v as UnixTimestamp;

// ── Commitment ─────────────────────────────────────────────────

/**
 * Solana commitment level for RPC queries.
 * - `processed` — fastest, may be rolled back.
 * - `confirmed` — optimistic confirmation by super-majority.
 * - `finalized` — guaranteed irreversible.
 * @since 1.0.0
 */
export type Commitment = 'processed' | 'confirmed' | 'finalized';

// ── Encoding ───────────────────────────────────────────────────

/**
 * Account data encoding for RPC responses.
 * @since 1.0.0
 */
export type Encoding = 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';

// ── DataSlice ──────────────────────────────────────────────────

/**
 * Byte range to return for account data (used with `getAccountInfo`).
 * @since 1.0.0
 */
export interface DataSlice {
  /** Byte offset to start reading from. */
  offset: number;
  /** Number of bytes to read. */
  length: number;
}

// ── JSON-RPC wire shapes ───────────────────────────────────────
export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown[];
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: RpcError;
}

export interface RpcContext<T> {
  context: { slot: Slot; apiVersion?: string };
  value: T;
}

// ── Account shapes ─────────────────────────────────────────────
export interface AccountInfo<D = string> {
  data: D;
  executable: boolean;
  lamports: Lamports;
  owner: Pubkey;
  rentEpoch: Epoch;
  space: number;
}

// ── Transaction shapes ─────────────────────────────────────────
export interface TransactionMeta {
  err: unknown;
  fee: number;
  preBalances: number[];
  postBalances: number[];
  preTokenBalances?: unknown[];
  postTokenBalances?: unknown[];
  logMessages?: string[];
  innerInstructions?: unknown[];
  loadedAddresses?: { writable: Pubkey[]; readonly: Pubkey[] };
  computeUnitsConsumed?: number;
}

export interface ConfirmedTransaction {
  slot: Slot;
  meta: TransactionMeta | null;
  transaction: unknown;
  blockTime: UnixTimestamp | null;
  version?: number | 'legacy';
}

export interface SignatureStatus {
  slot: Slot;
  confirmations: number | null;
  err: unknown;
  confirmationStatus: Commitment | null;
}

export interface SignatureInfo {
  signature: Signature;
  slot: Slot;
  err: unknown;
  memo: string | null;
  blockTime: UnixTimestamp | null;
  confirmationStatus: Commitment | null;
}

// ── Block shapes ───────────────────────────────────────────────
export type TransactionDetail = 'full' | 'accounts' | 'signatures' | 'none';

export interface BlockProduction {
  byIdentity: Record<Pubkey, [number, number]>;
  range: { firstSlot: Slot; lastSlot: Slot };
}

// ── Epoch / Inflation ──────────────────────────────────────────
export interface EpochInfo {
  absoluteSlot: Slot;
  blockHeight: number;
  epoch: Epoch;
  slotIndex: number;
  slotsInEpoch: number;
  transactionCount?: number;
}

export interface EpochSchedule {
  slotsPerEpoch: number;
  leaderScheduleSlotOffset: number;
  warmup: boolean;
  firstNormalEpoch: Epoch;
  firstNormalSlot: Slot;
}

export interface InflationRate {
  total: number;
  validator: number;
  foundation: number;
  epoch: Epoch;
}

export interface InflationGovernor {
  initial: number;
  terminal: number;
  taper: number;
  foundation: number;
  foundationTerm: number;
}

export interface InflationReward {
  epoch: Epoch;
  effectiveSlot: Slot;
  amount: number;
  postBalance: number;
  commission?: number;
}

// ── Validator / Leader ─────────────────────────────────────────
export interface VoteAccount {
  votePubkey: Pubkey;
  nodePubkey: Pubkey;
  activatedStake: number;
  epochVoteAccount: boolean;
  commission: number;
  lastVote: Slot;
  epochCredits: [Epoch, number, number][];
  rootSlot: Slot;
}

export interface VoteAccountsResult {
  current: VoteAccount[];
  delinquent: VoteAccount[];
}

export interface ContactInfo {
  pubkey: Pubkey;
  gossip?: string;
  tpu?: string;
  rpc?: string;
  version?: string;
  featureSet?: number;
  shredVersion?: number;
}

// ── Performance / Supply ───────────────────────────────────────
export interface PerfSample {
  slot: Slot;
  numSlots: number;
  numTransactions: number;
  numNonVoteTransactions: number;
  samplePeriodSecs: number;
}

export interface Supply {
  total: Lamports;
  circulating: Lamports;
  nonCirculating: Lamports;
  nonCirculatingAccounts: Pubkey[];
}

export interface TokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

export interface TokenAccount {
  pubkey: Pubkey;
  account: AccountInfo<{ parsed: { info: { mint: Pubkey; owner: Pubkey; tokenAmount: TokenAmount }; type: string }; program: string; space: number }>;
}

// ── Pagination helpers ─────────────────────────────────────────
export interface PaginationOpts {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}

export interface SortOpts {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// ── Filter for getProgramAccounts ──────────────────────────────
export type MemcmpFilter = { memcmp: { offset: number; bytes: string; encoding?: Encoding } };
export type DataSizeFilter = { dataSize: number };
export type AccountFilter = MemcmpFilter | DataSizeFilter;
