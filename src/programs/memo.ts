/**
 * Memo Program instruction encoder.
 *
 * Encodes a memo instruction that attaches an arbitrary UTF-8 string
 * to a transaction. Supports both Memo v1 and v2.
 *
 * Program ID (v2): `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
 * Program ID (v1): `Memo1UhkJBfCR6MNcUpSSKvyfcY7YFW5p5JHblJRK9R`
 *
 * @module programs/memo
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { Memo } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const ix = Memo.addMemo({
 *   message: 'Hello from Synapse SDK!',
 *   signer: Pubkey('MyWallet...'),
 * });
 * ```
 */

import { Pubkey } from '../core/types';
import type { TransactionInstruction } from './types';
import { readonlySigner } from './types';

// ── Program IDs ────────────────────────────────────────────────

/**
 * SPL Memo Program v2 address.
 * @since 1.1.0
 */
export const MEMO_PROGRAM_V2 = Pubkey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * SPL Memo Program v1 address (deprecated, but still supported on-chain).
 * @since 1.1.0
 */
export const MEMO_PROGRAM_V1 = Pubkey('Memo1UhkJBfCR6MNcUpSSKvyfcY7YFW5p5JHblJRK9R');

// ── Param types ────────────────────────────────────────────────

/**
 * Params for {@link Memo.addMemo}.
 * @since 1.1.0
 */
export interface AddMemoParams {
  /** UTF-8 memo string (max ~566 bytes for a single instruction). */
  message: string;
  /** Signer pubkey (optional — if provided, the memo is signed). */
  signer?: Pubkey;
  /** Additional signers. */
  additionalSigners?: Pubkey[];
  /** Use Memo v1 program instead of v2 (default: false). */
  useV1?: boolean;
}

// ── Memo namespace ─────────────────────────────────────────────

/**
 * SPL Memo Program instruction encoders.
 *
 * @since 1.1.0
 */
export const Memo = {
  /** Memo v2 program ID. */
  programId: MEMO_PROGRAM_V2,
  /** Memo v1 program ID. */
  v1ProgramId: MEMO_PROGRAM_V1,

  /**
   * Add a memo to a transaction.
   *
   * The memo content is the raw instruction data (no discriminator).
   * If a signer is provided, the memo is validated on-chain.
   *
   * @since 1.1.0
   */
  addMemo(p: AddMemoParams): TransactionInstruction {
    const pid = p.useV1 ? MEMO_PROGRAM_V1 : MEMO_PROGRAM_V2;
    const data = new TextEncoder().encode(p.message);
    const keys = [];

    if (p.signer) {
      keys.push(readonlySigner(p.signer));
    }
    if (p.additionalSigners) {
      for (const s of p.additionalSigners) {
        keys.push(readonlySigner(s));
      }
    }

    return { programId: pid, keys, data };
  },
} as const;
