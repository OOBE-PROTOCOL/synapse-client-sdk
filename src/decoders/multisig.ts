/**
 * SPL Token Multisig account decoder.
 *
 * Decodes the SPL Token multisig account layout (355 bytes).
 *
 * @module decoders/multisig
 * @since 1.1.0
 */

import type { Pubkey } from '../core/types';
import { AccountReader } from './layout';

// ── Decoded type ───────────────────────────────────────────────

/**
 * Decoded SPL Multisig account (355 bytes).
 *
 * @example
 * ```ts
 * const ms = decodeMultisig(rawBytes);
 * console.log(`Threshold: ${ms.m} of ${ms.n}, Signers: ${ms.signers.length}`);
 * ```
 * @since 1.1.0
 */
export interface DecodedMultisig {
  /** Number of signers required (threshold). */
  m: number;
  /** Number of valid signers in the list. */
  n: number;
  /** Whether the multisig is initialized. */
  isInitialized: boolean;
  /** List of valid signer public keys (up to 11). */
  signers: Pubkey[];
}

// ── Constants ──────────────────────────────────────────────────

/** Maximum number of signers in a multisig. @since 1.1.0 */
export const MAX_MULTISIG_SIGNERS = 11;

/** SPL Multisig account size. @since 1.1.0 */
export const MULTISIG_SIZE = 355;

// ── Decoder ────────────────────────────────────────────────────

/**
 * Decode an SPL Token Multisig account from raw bytes.
 *
 * Layout (355 bytes):
 * - [0]       u8         — m (threshold)
 * - [1]       u8         — n (total valid signers)
 * - [2]       u8         — is_initialized
 * - [3..355]  [Pubkey;11] — signer slots (32 bytes each, only first n are valid)
 *
 * @param data - Raw account data (must be >= 355 bytes).
 * @returns Decoded multisig account.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeMultisig(data: Uint8Array): DecodedMultisig {
  if (data.length < MULTISIG_SIZE) {
    throw new Error(
      `Multisig data too short: expected >= ${MULTISIG_SIZE} bytes, got ${data.length}`,
    );
  }

  const r = new AccountReader(data);

  const m = r.u8();              // [0]
  const n = r.u8();              // [1]
  const isInitialized = r.bool(); // [2]

  const signers: Pubkey[] = [];
  for (let i = 0; i < MAX_MULTISIG_SIGNERS; i++) {
    const pk = r.pubkey();
    if (i < n) signers.push(pk);
  }

  return { m, n, isInitialized, signers };
}
