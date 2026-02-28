/**
 * Associated Token Account Program instruction encoders.
 *
 * Encodes the instructions for creating Associated Token Accounts (ATAs),
 * which are deterministically derived from the owner wallet and token mint.
 *
 * Program ID: `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
 *
 * @module programs/associated-token
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { AssociatedToken } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const ix = AssociatedToken.create({
 *   payer: Pubkey('PayerWallet...'),
 *   owner: Pubkey('OwnerWallet...'),
 *   mint: Pubkey('TokenMint...'),
 * });
 * ```
 */

import { Pubkey } from '../core/types';
import type { TransactionInstruction } from './types';
import { writableSigner, writable, readonly } from './types';
import { TOKEN_PROGRAM } from './spl-token';

// ── Program ID ─────────────────────────────────────────────────

/**
 * Associated Token Account Program address.
 * @since 1.1.0
 */
export const ASSOCIATED_TOKEN_PROGRAM = Pubkey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** @internal System Program for account creation. */
const SYSTEM_PROGRAM = Pubkey('11111111111111111111111111111111');

// ── Instruction discriminators ─────────────────────────────────

/** @internal ATA instruction indices */
const enum AtaIx {
  Create = 0,
  CreateIdempotent = 1,
  RecoverNested = 2,
}

// ── Param types ────────────────────────────────────────────────

/**
 * Params for {@link AssociatedToken.create} / {@link AssociatedToken.createIdempotent}.
 * @since 1.1.0
 */
export interface CreateATAParams {
  /** Payer for the account creation (signer). */
  payer: Pubkey;
  /** The ATA address (derived off-chain). */
  associatedToken: Pubkey;
  /** Wallet owner of the new ATA. */
  owner: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Token program ID (default: Token v1). */
  tokenProgramId?: Pubkey;
}

/**
 * Params for {@link AssociatedToken.recoverNested}.
 * @since 1.1.0
 */
export interface RecoverNestedParams {
  /** The nested ATA to recover from. */
  nestedAssociatedToken: Pubkey;
  /** The nested mint. */
  nestedMint: Pubkey;
  /** The parent ATA (destination for recovered tokens). */
  destinationAssociatedToken: Pubkey;
  /** The owner's main ATA mint. */
  ownerMint: Pubkey;
  /** The wallet owner. */
  owner: Pubkey;
  /** Token program ID (default: Token v1). */
  tokenProgramId?: Pubkey;
}

// ── AssociatedToken namespace ──────────────────────────────────

/**
 * Associated Token Account Program instruction encoders.
 *
 * @since 1.1.0
 */
export const AssociatedToken = {
  /** ATA Program address. */
  programId: ASSOCIATED_TOKEN_PROGRAM,

  /**
   * Create a new Associated Token Account.
   *
   * Fails if the ATA already exists. For an idempotent version that
   * succeeds even if the ATA exists, use {@link createIdempotent}.
   *
   * @since 1.1.0
   */
  create(p: CreateATAParams): TransactionInstruction {
    const tokenPid = p.tokenProgramId ?? TOKEN_PROGRAM;
    return {
      programId: ASSOCIATED_TOKEN_PROGRAM,
      keys: [
        writableSigner(p.payer),
        writable(p.associatedToken),
        readonly(p.owner),
        readonly(p.mint),
        readonly(SYSTEM_PROGRAM),
        readonly(tokenPid),
      ],
      data: new Uint8Array([AtaIx.Create]),
    };
  },

  /**
   * Create an ATA idempotently — succeeds even if the account already exists.
   *
   * This is the recommended way to create ATAs in production.
   *
   * @since 1.1.0
   */
  createIdempotent(p: CreateATAParams): TransactionInstruction {
    const tokenPid = p.tokenProgramId ?? TOKEN_PROGRAM;
    return {
      programId: ASSOCIATED_TOKEN_PROGRAM,
      keys: [
        writableSigner(p.payer),
        writable(p.associatedToken),
        readonly(p.owner),
        readonly(p.mint),
        readonly(SYSTEM_PROGRAM),
        readonly(tokenPid),
      ],
      data: new Uint8Array([AtaIx.CreateIdempotent]),
    };
  },

  /**
   * Recover tokens from a nested associated token account.
   *
   * @since 1.1.0
   */
  recoverNested(p: RecoverNestedParams): TransactionInstruction {
    const tokenPid = p.tokenProgramId ?? TOKEN_PROGRAM;
    return {
      programId: ASSOCIATED_TOKEN_PROGRAM,
      keys: [
        writable(p.nestedAssociatedToken),
        readonly(p.nestedMint),
        writable(p.destinationAssociatedToken),
        readonly(p.ownerMint),
        writableSigner(p.owner),
        readonly(tokenPid),
      ],
      data: new Uint8Array([AtaIx.RecoverNested]),
    };
  },
} as const;
