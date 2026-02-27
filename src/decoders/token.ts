/**
 * SPL Token account and mint decoders.
 *
 * Decodes raw bytes from SPL Token program accounts into typed objects.
 * Supports both Token Account (165 bytes) and Mint (82 bytes) layouts.
 *
 * @module decoders/token
 * @since 1.1.0
 */

import type { Pubkey } from '../core/types';
import { AccountReader } from './layout';

// ── Token Account state enum ──────────────────────────────────

/** SPL Token account state. @since 1.1.0 */
export type TokenAccountState = 'uninitialized' | 'initialized' | 'frozen';

const TOKEN_ACCOUNT_STATES: readonly TokenAccountState[] = [
  'uninitialized', 'initialized', 'frozen',
];

// ── Decoded types ──────────────────────────────────────────────

/**
 * Decoded SPL Token Account (165 bytes).
 *
 * @example
 * ```ts
 * const decoded = decodeTokenAccount(rawBytes);
 * console.log(`Mint: ${decoded.mint}, Amount: ${decoded.amount}`);
 * ```
 * @since 1.1.0
 */
export interface DecodedTokenAccount {
  /** Token mint address. */
  mint: Pubkey;
  /** Account owner (wallet). */
  owner: Pubkey;
  /** Token balance (raw, not UI-adjusted). */
  amount: bigint;
  /** Delegate address (if approved). */
  delegate: Pubkey | null;
  /** Account state. */
  state: TokenAccountState;
  /** Native SOL balance if this is a wrapped SOL account. */
  isNative: bigint | null;
  /** Amount delegated to the delegate. */
  delegatedAmount: bigint;
  /** Close authority (who can close this account). */
  closeAuthority: Pubkey | null;
}

/**
 * Decoded SPL Token Mint (82 bytes).
 *
 * @example
 * ```ts
 * const mint = decodeMint(rawBytes);
 * console.log(`Supply: ${mint.supply}, Decimals: ${mint.decimals}`);
 * ```
 * @since 1.1.0
 */
export interface DecodedMint {
  /** Mint authority (who can mint new tokens). `null` if fixed supply. */
  mintAuthority: Pubkey | null;
  /** Total token supply. */
  supply: bigint;
  /** Number of decimal places. */
  decimals: number;
  /** Whether the mint is initialized. */
  isInitialized: boolean;
  /** Freeze authority (who can freeze accounts). `null` if not freezable. */
  freezeAuthority: Pubkey | null;
}

// ── Constants ──────────────────────────────────────────────────

/** Expected size of an SPL Token Account. @since 1.1.0 */
export const TOKEN_ACCOUNT_SIZE = 165;

/** Expected size of an SPL Token Mint. @since 1.1.0 */
export const MINT_SIZE = 82;

/** SPL Token Program ID. @since 1.1.0 */
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// ── Decoder functions ──────────────────────────────────────────

/**
 * Decode raw bytes into a {@link DecodedTokenAccount}.
 *
 * @param data - Raw account data (must be >= 165 bytes).
 * @returns Decoded token account.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeTokenAccount(data: Uint8Array): DecodedTokenAccount {
  if (data.length < TOKEN_ACCOUNT_SIZE) {
    throw new Error(
      `Token account data too short: expected >= ${TOKEN_ACCOUNT_SIZE} bytes, got ${data.length}`,
    );
  }

  const r = new AccountReader(data);

  const mint = r.pubkey();               // 32 bytes  [0..32]
  const owner = r.pubkey();              // 32 bytes  [32..64]
  const amount = r.u64();                // 8 bytes   [64..72]
  const delegate = r.coption(() => r.pubkey()); // 4+32=36 bytes [72..108]
  const stateIdx = r.u8();              // 1 byte    [108]
  const state = TOKEN_ACCOUNT_STATES[stateIdx] ?? 'uninitialized';
  const isNative = r.coption(() => r.u64()); // 4+8=12 bytes  [109..121]
  const delegatedAmount = r.u64();       // 8 bytes   [121..129]
  const closeAuthority = r.coption(() => r.pubkey()); // 4+32=36 bytes [129..165]

  return { mint, owner, amount, delegate, state, isNative, delegatedAmount, closeAuthority };
}

/**
 * Decode raw bytes into a {@link DecodedMint}.
 *
 * @param data - Raw account data (must be >= 82 bytes).
 * @returns Decoded mint.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeMint(data: Uint8Array): DecodedMint {
  if (data.length < MINT_SIZE) {
    throw new Error(
      `Mint data too short: expected >= ${MINT_SIZE} bytes, got ${data.length}`,
    );
  }

  const r = new AccountReader(data);

  const mintAuthority = r.coption(() => r.pubkey()); // 4+32=36 bytes [0..36]
  const supply = r.u64();                            // 8 bytes       [36..44]
  const decimals = r.u8();                           // 1 byte        [44]
  const isInitialized = r.bool();                    // 1 byte        [45]
  const freezeAuthority = r.coption(() => r.pubkey()); // 4+32=36 bytes [46..82]

  return { mintAuthority, supply, decimals, isInitialized, freezeAuthority };
}
