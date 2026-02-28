/**
 * System Program instruction encoders.
 *
 * Encodes the most common System Program instructions as raw
 * {@link TransactionInstruction} objects ready to be included in a
 * Solana transaction.
 *
 * Program ID: `11111111111111111111111111111111`
 *
 * @module programs/system
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { SystemProgram } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { Pubkey, Lamports } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const ix = SystemProgram.transfer({
 *   from: Pubkey('Sender...'),
 *   to: Pubkey('Receiver...'),
 *   lamports: Lamports(1_000_000_000n),
 * });
 * ```
 */

import { Pubkey } from '../core/types';
import type { Lamports } from '../core/types';
import type { TransactionInstruction } from './types';
import { InstructionWriter, writableSigner, writable, readonly, readonlySigner } from './types';

// ── Program ID ─────────────────────────────────────────────────

/**
 * System Program address.
 * @since 1.1.0
 */
export const SYSTEM_PROGRAM = Pubkey('11111111111111111111111111111111');

// ── Instruction indices (match on-chain enum) ──────────────────

/** @internal System instruction discriminators */
const enum SystemIx {
  CreateAccount = 0,
  Assign = 1,
  Transfer = 2,
  CreateAccountWithSeed = 3,
  AdvanceNonceAccount = 4,
  WithdrawNonceAccount = 5,
  InitializeNonceAccount = 6,
  AuthorizeNonceAccount = 7,
  Allocate = 8,
  AllocateWithSeed = 9,
  AssignWithSeed = 10,
  TransferWithSeed = 11,
}

// ── Instruction builders ───────────────────────────────────────

/**
 * Params for {@link SystemProgram.transfer}.
 * @since 1.1.0
 */
export interface TransferParams {
  /** Funding account (signer). */
  from: Pubkey;
  /** Recipient account. */
  to: Pubkey;
  /** Amount in lamports. */
  lamports: Lamports | bigint;
}

/**
 * Params for {@link SystemProgram.createAccount}.
 * @since 1.1.0
 */
export interface CreateAccountParams {
  /** Funding account (signer). */
  from: Pubkey;
  /** New account (signer). */
  newAccount: Pubkey;
  /** Lamports to transfer to the new account. */
  lamports: Lamports | bigint;
  /** Space in bytes to allocate for account data. */
  space: number;
  /** Program owner of the new account. */
  programId: Pubkey;
}

/**
 * Params for {@link SystemProgram.assign}.
 * @since 1.1.0
 */
export interface AssignParams {
  /** Account to assign (signer). */
  account: Pubkey;
  /** New program owner. */
  programId: Pubkey;
}

/**
 * Params for {@link SystemProgram.allocate}.
 * @since 1.1.0
 */
export interface AllocateParams {
  /** Account to allocate space for (signer). */
  account: Pubkey;
  /** Space in bytes. */
  space: number;
}

/**
 * Params for {@link SystemProgram.createAccountWithSeed}.
 * @since 1.1.0
 */
export interface CreateAccountWithSeedParams {
  /** Funding account (signer). */
  from: Pubkey;
  /** Created account (derived from base + seed + programId). */
  newAccount: Pubkey;
  /** Base address for seed derivation (signer). */
  base: Pubkey;
  /** Seed string (max 32 bytes UTF-8). */
  seed: string;
  /** Lamports to fund. */
  lamports: Lamports | bigint;
  /** Data space in bytes. */
  space: number;
  /** Owner program of the new account. */
  programId: Pubkey;
}

/**
 * Params for {@link SystemProgram.advanceNonce}.
 * @since 1.1.0
 */
export interface AdvanceNonceParams {
  /** Nonce account. */
  nonceAccount: Pubkey;
  /** Nonce authority (signer). */
  authority: Pubkey;
}

/**
 * Params for {@link SystemProgram.withdrawNonce}.
 * @since 1.1.0
 */
export interface WithdrawNonceParams {
  /** Nonce account. */
  nonceAccount: Pubkey;
  /** Nonce authority (signer). */
  authority: Pubkey;
  /** Destination for withdrawn lamports. */
  to: Pubkey;
  /** Amount to withdraw. */
  lamports: Lamports | bigint;
}

/**
 * Params for {@link SystemProgram.initializeNonce}.
 * @since 1.1.0
 */
export interface InitializeNonceParams {
  /** Nonce account (must be already allocated). */
  nonceAccount: Pubkey;
  /** Nonce authority. */
  authority: Pubkey;
}

/**
 * Params for {@link SystemProgram.authorizeNonce}.
 * @since 1.1.0
 */
export interface AuthorizeNonceParams {
  /** Nonce account. */
  nonceAccount: Pubkey;
  /** Current authority (signer). */
  authority: Pubkey;
  /** New authority. */
  newAuthority: Pubkey;
}

// ── Recent blockhash sysvar ────────────────────────────────────

/** @internal */
const RECENT_BLOCKHASHES_SYSVAR = Pubkey('SysvarRecentB1teleHashes11111111111111111111');
/** @internal */
const RENT_SYSVAR = Pubkey('SysvarRent111111111111111111111111111111111');

// ── SystemProgram namespace ────────────────────────────────────

/**
 * System Program instruction encoders.
 *
 * Static methods produce {@link TransactionInstruction} objects for the
 * native Solana System Program.
 *
 * @since 1.1.0
 */
export const SystemProgram = {
  /** System Program address. */
  programId: SYSTEM_PROGRAM,

  /**
   * Transfer SOL between two accounts.
   *
   * @param p - Transfer parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  transfer(p: TransferParams): TransactionInstruction {
    const w = new InstructionWriter(12);
    w.u32(SystemIx.Transfer);
    w.u64(BigInt(p.lamports));
    return {
      programId: SYSTEM_PROGRAM,
      keys: [writableSigner(p.from), writable(p.to)],
      data: w.toBytes(),
    };
  },

  /**
   * Create a new account with allocated space and program owner.
   *
   * @param p - CreateAccount parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  createAccount(p: CreateAccountParams): TransactionInstruction {
    const w = new InstructionWriter(52);
    w.u32(SystemIx.CreateAccount);
    w.u64(BigInt(p.lamports));
    w.u64(BigInt(p.space));
    w.pubkey(p.programId);
    return {
      programId: SYSTEM_PROGRAM,
      keys: [writableSigner(p.from), writableSigner(p.newAccount)],
      data: w.toBytes(),
    };
  },

  /**
   * Assign an account to a program.
   *
   * @param p - Assign parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  assign(p: AssignParams): TransactionInstruction {
    const w = new InstructionWriter(36);
    w.u32(SystemIx.Assign);
    w.pubkey(p.programId);
    return {
      programId: SYSTEM_PROGRAM,
      keys: [writableSigner(p.account)],
      data: w.toBytes(),
    };
  },

  /**
   * Allocate space for an account (without funding or assigning owner).
   *
   * @param p - Allocate parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  allocate(p: AllocateParams): TransactionInstruction {
    const w = new InstructionWriter(12);
    w.u32(SystemIx.Allocate);
    w.u64(BigInt(p.space));
    return {
      programId: SYSTEM_PROGRAM,
      keys: [writableSigner(p.account)],
      data: w.toBytes(),
    };
  },

  /**
   * Create account with a seed-derived address.
   *
   * @param p - CreateAccountWithSeed parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  createAccountWithSeed(p: CreateAccountWithSeedParams): TransactionInstruction {
    const seedBytes = new TextEncoder().encode(p.seed);
    // 4 (ix) + 32 (base) + 4 (seed len) + seedBytes + 8 (lamports) + 8 (space) + 32 (owner)
    const dataLen = 4 + 32 + 4 + seedBytes.length + 8 + 8 + 32;
    const w = new InstructionWriter(dataLen);
    w.u32(SystemIx.CreateAccountWithSeed);
    w.pubkey(p.base);
    w.u32(seedBytes.length); // Rust string length prefix
    w.raw(seedBytes);
    w.u64(BigInt(p.lamports));
    w.u64(BigInt(p.space));
    w.pubkey(p.programId);

    const keys = [writableSigner(p.from), writable(p.newAccount)];
    // If base !== from, base is also a signer
    if ((p.base as unknown as string) !== (p.from as unknown as string)) {
      keys.push(readonlySigner(p.base));
    }

    return { programId: SYSTEM_PROGRAM, keys, data: w.toBytes() };
  },

  /**
   * Advance a durable nonce account.
   *
   * @param p - AdvanceNonce parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  advanceNonce(p: AdvanceNonceParams): TransactionInstruction {
    const w = new InstructionWriter(4);
    w.u32(SystemIx.AdvanceNonceAccount);
    return {
      programId: SYSTEM_PROGRAM,
      keys: [
        writable(p.nonceAccount),
        readonly(RECENT_BLOCKHASHES_SYSVAR),
        readonlySigner(p.authority),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Withdraw lamports from a nonce account.
   *
   * @param p - WithdrawNonce parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  withdrawNonce(p: WithdrawNonceParams): TransactionInstruction {
    const w = new InstructionWriter(12);
    w.u32(SystemIx.WithdrawNonceAccount);
    w.u64(BigInt(p.lamports));
    return {
      programId: SYSTEM_PROGRAM,
      keys: [
        writable(p.nonceAccount),
        writable(p.to),
        readonly(RECENT_BLOCKHASHES_SYSVAR),
        readonly(RENT_SYSVAR),
        readonlySigner(p.authority),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Initialize a nonce account (must be pre-allocated with SystemProgram.createAccount).
   *
   * @param p - InitializeNonce parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  initializeNonce(p: InitializeNonceParams): TransactionInstruction {
    const w = new InstructionWriter(36);
    w.u32(SystemIx.InitializeNonceAccount);
    w.pubkey(p.authority);
    return {
      programId: SYSTEM_PROGRAM,
      keys: [
        writable(p.nonceAccount),
        readonly(RECENT_BLOCKHASHES_SYSVAR),
        readonly(RENT_SYSVAR),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Change the authority of a nonce account.
   *
   * @param p - AuthorizeNonce parameters.
   * @returns Encoded instruction.
   * @since 1.1.0
   */
  authorizeNonce(p: AuthorizeNonceParams): TransactionInstruction {
    const w = new InstructionWriter(36);
    w.u32(SystemIx.AuthorizeNonceAccount);
    w.pubkey(p.newAuthority);
    return {
      programId: SYSTEM_PROGRAM,
      keys: [writable(p.nonceAccount), readonlySigner(p.authority)],
      data: w.toBytes(),
    };
  },
} as const;
