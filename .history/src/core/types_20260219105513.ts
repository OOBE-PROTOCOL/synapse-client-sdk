/**
 * Solana-branded primitive types.
 * Phantom brands enforce nominal typing at zero runtime cost.
 */

// ── Brand utility ──────────────────────────────────────────────
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Primitives ─────────────────────────────────────────────────
export type Base58 = Brand<string, 'Base58'>;
export type Pubkey = Brand<Base58, 'Pubkey'>;
export type Signature = Brand<Base58, 'Signature'>;
export type Slot = Brand<number, 'Slot'>;
export type Epoch = Brand<number, 'Epoch'>;
export type Lamports = Brand<bigint, 'Lamports'>;
export type UnixTimestamp = Brand<number, 'UnixTimestamp'>;

/** Smart constructors — single branch, zero allocation on hot path */
export const Pubkey = (v: string): Pubkey => v as unknown as Pubkey;
export const Sig = (v: string): Signature => v as unknown as Signature;
export const Slot = (v: number): Slot => v as Slot;
export const Epoch = (v: number): Epoch => v as Epoch;
export const Lamports = (v: number | bigint): Lamports => BigInt(v) as Lamports;
export const UnixTs = (v: number): UnixTimestamp => v as UnixTimestamp;

// ── Commitment ─────────────────────────────────────────────────
export type Commitment = 'processed' | 'confirmed' | 'finalized';

// ── Encoding ───────────────────────────────────────────────────
export type Encoding = 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';

// ── DataSlice ──────────────────────────────────────────────────
export interface DataSlice {
  offset: number;
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
