/**
 * Solana-branded primitive types.
 *
 * Phantom brands enforce **nominal typing** at zero runtime cost.
 * Every Solana concept (pubkey, signature, slot, lamports...) gets its own
 * opaque type so the compiler prevents accidental cross-use.
 *
 * These types are Synapse-specific. For interop with `@solana/kit` native
 * types ({@link Address}, {@link Signature}, etc.) see the bridge utilities
 * in `@oobe-protocol-labs/synapse-client-sdk/kit`.
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

/**
 * Solana public key -- 32 bytes, base58-encoded.
 *
 * Use `toKitAddress()` from the `kit` module to convert to `@solana/kit`'s `Address` type.
 * @since 1.0.0
 */
export type Pubkey = Brand<Base58, 'Pubkey'>;

/**
 * Transaction signature -- 64 bytes, base58-encoded.
 *
 * For `@solana/kit` interop see `kitSignature()` in the `kit` module.
 * @since 1.0.0
 */
export type Signature = Brand<Base58, 'Signature'>;

/** Slot number (absolute position in the ledger). @since 1.0.0 */
export type Slot = Brand<number, 'Slot'>;

/** Epoch number (Solana epoch counter). @since 1.0.0 */
export type Epoch = Brand<number, 'Epoch'>;

/**
 * Lamport amount (1 SOL = 1 000 000 000 lamports).
 *
 * Use `toKitLamports()` from the `kit` module for `@solana/kit` interop.
 * @since 1.0.0
 */
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

/**
 * JSON-RPC 2.0 request envelope.
 * @since 1.0.0
 */
export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  /**
   * Positional (`unknown[]`) or named (`Record<string, unknown>`) params.
   * Standard Solana RPC uses positional; DAS / Read API uses named.
   */
  params?: unknown[] | Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 error object.
 * @since 1.0.0
 */
export interface RpcError {
  /** Numeric error code (e.g. `-32601` for method-not-found). */
  code: number;
  /** Human-readable error message. */
  message: string;
  /** Optional upstream-specific error data. */
  data?: unknown;
}

/**
 * JSON-RPC 2.0 response envelope.
 * @typeParam T - The expected `result` payload type.
 * @since 1.0.0
 */
export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: RpcError;
}

/**
 * Solana RPC context wrapper — wraps a `value` with slot context.
 * @typeParam T - The inner value type.
 * @since 1.0.0
 */
export interface RpcContext<T> {
  context: { slot: Slot; apiVersion?: string };
  value: T;
}

// ── Account shapes ─────────────────────────────────────────────

/**
 * On-chain account data returned by Solana RPC.
 * @typeParam D - The encoding type for account data (`string`, `Buffer`, parsed JSON).
 * @since 1.0.0
 */
export interface AccountInfo<D = string> {
  /** Account data in the requested encoding. */
  data: D;
  /** Whether this account contains an executable program. */
  executable: boolean;
  /** Account balance in lamports. */
  lamports: Lamports;
  /** Owner program of this account. */
  owner: Pubkey;
  /** Rent epoch for this account. */
  rentEpoch: Epoch;
  /** Account data size in bytes. */
  space: number;
}

// ── Transaction shapes ─────────────────────────────────────────

/**
 * Transaction metadata returned alongside confirmed transactions.
 * @since 1.0.0
 */
export interface TransactionMeta {
  /** Transaction error (`null` if success). */
  err: unknown;
  /** Transaction fee in lamports. */
  fee: number;
  /** Pre-transaction SOL balances for each account. */
  preBalances: number[];
  /** Post-transaction SOL balances for each account. */
  postBalances: number[];
  /** Pre-transaction token balances. */
  preTokenBalances?: unknown[];
  /** Post-transaction token balances. */
  postTokenBalances?: unknown[];
  /** Program log messages emitted during execution. */
  logMessages?: string[];
  /** Inner (CPI) instructions. */
  innerInstructions?: unknown[];
  /** Address table lookups (v0 transactions). */
  loadedAddresses?: { writable: Pubkey[]; readonly: Pubkey[] };
  /** Compute units consumed by the transaction. */
  computeUnitsConsumed?: number;
}

/**
 * A confirmed transaction with full metadata.
 * @since 1.0.0
 */
export interface ConfirmedTransaction {
  /** Slot in which the transaction was processed. */
  slot: Slot;
  /** Transaction metadata (fees, balances, logs). */
  meta: TransactionMeta | null;
  /** Raw transaction data. */
  transaction: unknown;
  /** Unix timestamp of the block. */
  blockTime: UnixTimestamp | null;
  /** Transaction version (`0` for v0, `'legacy'` for legacy). */
  version?: number | 'legacy';
}

/**
 * Status of a transaction signature.
 * @since 1.0.0
 */
export interface SignatureStatus {
  /** Slot where the transaction was processed. */
  slot: Slot;
  /** Number of confirmations (`null` = finalized). */
  confirmations: number | null;
  /** Error if the transaction failed. */
  err: unknown;
  /** Current confirmation status. */
  confirmationStatus: Commitment | null;
}

/**
 * Signature information returned by `getSignaturesForAddress`.
 * @since 1.0.0
 */
export interface SignatureInfo {
  /** Transaction signature (base58). */
  signature: Signature;
  /** Slot of the transaction. */
  slot: Slot;
  /** Error if the transaction failed. */
  err: unknown;
  /** Transaction memo (if present). */
  memo: string | null;
  /** Unix timestamp of the block. */
  blockTime: UnixTimestamp | null;
  /** Confirmation status at query time. */
  confirmationStatus: Commitment | null;
}

// ── Block shapes ───────────────────────────────────────────────

/**
 * Level of transaction detail to include in block responses.
 * @since 1.0.0
 */
export type TransactionDetail = 'full' | 'accounts' | 'signatures' | 'none';

/**
 * Block production statistics from `getBlockProduction`.
 * @since 1.0.0
 */
export interface BlockProduction {
  /** Leader slots by validator identity: `[leaderSlots, blocksProduced]`. */
  byIdentity: Record<Pubkey, [number, number]>;
  /** Slot range covered. */
  range: { firstSlot: Slot; lastSlot: Slot };
}

// ── Epoch / Inflation ──────────────────────────────────────────

/**
 * Current epoch information.
 * @since 1.0.0
 */
export interface EpochInfo {
  /** Current absolute slot. */
  absoluteSlot: Slot;
  /** Current block height. */
  blockHeight: number;
  /** Current epoch number. */
  epoch: Epoch;
  /** Current slot index within the epoch. */
  slotIndex: number;
  /** Total slots per epoch. */
  slotsInEpoch: number;
  /** Total transaction count (optional). */
  transactionCount?: number;
}

/**
 * Epoch schedule configuration.
 * @since 1.0.0
 */
export interface EpochSchedule {
  slotsPerEpoch: number;
  leaderScheduleSlotOffset: number;
  warmup: boolean;
  firstNormalEpoch: Epoch;
  firstNormalSlot: Slot;
}

/**
 * Current inflation rate breakdown.
 * @since 1.0.0
 */
export interface InflationRate {
  total: number;
  validator: number;
  foundation: number;
  epoch: Epoch;
}

/**
 * Inflation governor parameters.
 * @since 1.0.0
 */
export interface InflationGovernor {
  initial: number;
  terminal: number;
  taper: number;
  foundation: number;
  foundationTerm: number;
}

/**
 * Staking inflation reward for one epoch.
 * @since 1.0.0
 */
export interface InflationReward {
  epoch: Epoch;
  effectiveSlot: Slot;
  amount: number;
  postBalance: number;
  commission?: number;
}

// ── Validator / Leader ─────────────────────────────────────────

/**
 * Validator vote account information.
 * @since 1.0.0
 */
export interface VoteAccount {
  /** Vote account public key. */
  votePubkey: Pubkey;
  /** Validator node identity. */
  nodePubkey: Pubkey;
  /** Total activated stake in lamports. */
  activatedStake: number;
  /** Whether this account is active in the current epoch. */
  epochVoteAccount: boolean;
  /** Commission percentage (0–100). */
  commission: number;
  /** Last slot voted on. */
  lastVote: Slot;
  /** Epoch credit history: `[epoch, credits, previousCredits]`. */
  epochCredits: [Epoch, number, number][];
  /** Root slot. */
  rootSlot: Slot;
}

/**
 * Vote accounts grouped by status.
 * @since 1.0.0
 */
export interface VoteAccountsResult {
  /** Active validators. */
  current: VoteAccount[];
  /** Delinquent validators. */
  delinquent: VoteAccount[];
}

/**
 * Cluster node contact information.
 * @since 1.0.0
 */
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

/**
 * Recent performance sample.
 * @since 1.0.0
 */
export interface PerfSample {
  slot: Slot;
  numSlots: number;
  numTransactions: number;
  numNonVoteTransactions: number;
  samplePeriodSecs: number;
}

/**
 * SOL supply breakdown.
 * @since 1.0.0
 */
export interface Supply {
  /** Total supply in lamports. */
  total: Lamports;
  /** Circulating supply in lamports. */
  circulating: Lamports;
  /** Non-circulating supply in lamports. */
  nonCirculating: Lamports;
  /** Accounts holding non-circulating supply. */
  nonCirculatingAccounts: Pubkey[];
}

/**
 * SPL token amount with UI formatting.
 * @since 1.0.0
 */
export interface TokenAmount {
  /** Raw amount as a string (avoids floating-point loss). */
  amount: string;
  /** Token decimals. */
  decimals: number;
  /** UI-friendly amount (`null` if zero). */
  uiAmount: number | null;
  /** UI-friendly amount as string. */
  uiAmountString: string;
}

/**
 * Token account with parsed owner/mint info.
 * @since 1.0.0
 */
export interface TokenAccount {
  /** Token account public key. */
  pubkey: Pubkey;
  /** Parsed account data including mint, owner, and balance. */
  account: AccountInfo<{ parsed: { info: { mint: Pubkey; owner: Pubkey; tokenAmount: TokenAmount }; type: string }; program: string; space: number }>;
}

// ── Pagination helpers ─────────────────────────────────────────

/**
 * Cursor-based pagination options.
 * @since 1.0.0
 */
export interface PaginationOpts {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}

/**
 * Sort options for paginated queries.
 * @since 1.0.0
 */
export interface SortOpts {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

// ── Filter for getProgramAccounts ──────────────────────────────

/** Memory comparison filter — matches account data at a specific offset. @since 1.0.0 */
export type MemcmpFilter = { memcmp: { offset: number; bytes: string; encoding?: Encoding } };

/** Data size filter — matches accounts with exactly N bytes. @since 1.0.0 */
export type DataSizeFilter = { dataSize: number };

/** Union of all supported `getProgramAccounts` filters. @since 1.0.0 */
export type AccountFilter = MemcmpFilter | DataSizeFilter;
