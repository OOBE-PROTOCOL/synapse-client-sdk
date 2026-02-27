/**
 * Solana Nonce Account decoder.
 *
 * Decodes durable nonce accounts used for offline/delayed transaction signing.
 *
 * @module decoders/nonce
 * @since 1.1.0
 */

import type { Pubkey } from '../core/types';
import { AccountReader } from './layout';

// ── Decoded type ───────────────────────────────────────────────

/** Nonce account state. @since 1.1.0 */
export type NonceState = 'uninitialized' | 'initialized';

/**
 * Decoded Solana Nonce Account (80 bytes).
 *
 * @example
 * ```ts
 * const nonce = decodeNonceAccount(rawBytes);
 * console.log(`Blockhash: ${nonce.blockhash}, Authority: ${nonce.authority}`);
 * ```
 * @since 1.1.0
 */
export interface DecodedNonceAccount {
  /** Nonce version discriminant (0 = Legacy, 1 = Current). Most nonces are Current (1). */
  version: number;
  /** Account state. */
  state: NonceState;
  /** Authority that can advance the nonce. */
  authority: Pubkey;
  /** Stored durable blockhash. */
  blockhash: string;
  /** Fee calculator lamports per signature at the stored blockhash. */
  lamportsPerSignature: bigint;
}

// ── Constants ──────────────────────────────────────────────────

/** System Program ID. @since 1.1.0 */
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/** Nonce account data size. @since 1.1.0 */
export const NONCE_ACCOUNT_SIZE = 80;

// ── Decoder ────────────────────────────────────────────────────

/**
 * Decode a Solana nonce account from raw bytes.
 *
 * Layout (80 bytes):
 * - [0..4]   u32     — version (0=Legacy, 1=Current)
 * - [4..8]   u32     — state (0=uninitialized, 1=initialized)
 * - [8..40]  [u8;32] — authority pubkey
 * - [40..72] [u8;32] — durable blockhash
 * - [72..80] u64     — lamports per signature
 *
 * @param data - Raw account data (must be >= 80 bytes).
 * @returns Decoded nonce account.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeNonceAccount(data: Uint8Array): DecodedNonceAccount {
  if (data.length < NONCE_ACCOUNT_SIZE) {
    throw new Error(
      `Nonce account data too short: expected >= ${NONCE_ACCOUNT_SIZE} bytes, got ${data.length}`,
    );
  }

  const r = new AccountReader(data);

  const version = r.u32();                           // [0..4]
  const stateVal = r.u32();                          // [4..8]
  const state: NonceState = stateVal === 1 ? 'initialized' : 'uninitialized';
  const authority = r.pubkey();                      // [8..40]
  const blockhash = r.hash();                        // [40..72]
  const lamportsPerSignature = r.u64();              // [72..80]

  return { version, state, authority, blockhash, lamportsPerSignature };
}
