/**
 * SPL Token Program instruction encoders.
 *
 * Encodes the most common SPL Token v1 instructions. Also works for
 * Token-2022 when using the basic instruction set (the program ID is
 * the only difference — pass `TOKEN_2022_PROGRAM` as `programId`).
 *
 * Program ID (v1): `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
 * Program ID (2022): `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
 *
 * @module programs/spl-token
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { SplToken } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const ix = SplToken.transferChecked({
 *   source: Pubkey('SourceTokenAccount...'),
 *   mint: Pubkey('TokenMint...'),
 *   destination: Pubkey('DestTokenAccount...'),
 *   owner: Pubkey('WalletOwner...'),
 *   amount: 1_000_000n,
 *   decimals: 6,
 * });
 * ```
 */

import { Pubkey } from '../core/types';
import type { TransactionInstruction } from './types';
import { InstructionWriter, writableSigner, writable, readonly, readonlySigner } from './types';

// ── Program IDs ────────────────────────────────────────────────

/**
 * SPL Token Program v1 address.
 * @since 1.1.0
 */
export const TOKEN_PROGRAM = Pubkey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * SPL Token-2022 (Token Extensions) Program address.
 * @since 1.1.0
 */
export const TOKEN_2022_PROGRAM = Pubkey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// ── Instruction discriminators ─────────────────────────────────

/** @internal SPL Token instruction indices */
const enum TokenIx {
  InitializeMint = 0,
  InitializeAccount = 1,
  InitializeMultisig = 2,
  Transfer = 3,
  Approve = 4,
  Revoke = 5,
  SetAuthority = 6,
  MintTo = 7,
  Burn = 8,
  CloseAccount = 9,
  FreezeAccount = 10,
  ThawAccount = 11,
  TransferChecked = 12,
  ApproveChecked = 13,
  MintToChecked = 14,
  BurnChecked = 15,
  SyncNative = 17,
}

// ── Sysvar ─────────────────────────────────────────────────────

/** @internal */
const RENT_SYSVAR = Pubkey('SysvarRent111111111111111111111111111111111');

// ── Param types ────────────────────────────────────────────────

/**
 * Params for {@link SplToken.initializeMint}.
 * @since 1.1.0
 */
export interface InitializeMintParams {
  /** Mint account (must be pre-allocated). */
  mint: Pubkey;
  /** Number of decimals. */
  decimals: number;
  /** Mint authority. */
  mintAuthority: Pubkey;
  /** Optional freeze authority. */
  freezeAuthority?: Pubkey | null;
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.initializeAccount}.
 * @since 1.1.0
 */
export interface InitializeAccountParams {
  /** Token account (must be pre-allocated). */
  account: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Account owner. */
  owner: Pubkey;
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.transfer}.
 * @since 1.1.0
 */
export interface TransferParams {
  /** Source token account. */
  source: Pubkey;
  /** Destination token account. */
  destination: Pubkey;
  /** Owner of the source account (signer). */
  owner: Pubkey;
  /** Amount of tokens (raw, no decimals). */
  amount: bigint;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.transferChecked}.
 * @since 1.1.0
 */
export interface TransferCheckedParams {
  /** Source token account. */
  source: Pubkey;
  /** Token mint (used for decimal verification). */
  mint: Pubkey;
  /** Destination token account. */
  destination: Pubkey;
  /** Owner of the source account (signer). */
  owner: Pubkey;
  /** Amount of tokens (raw, no decimals). */
  amount: bigint;
  /** Expected number of decimals for the mint. */
  decimals: number;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.approve}.
 * @since 1.1.0
 */
export interface ApproveParams {
  /** Token account. */
  account: Pubkey;
  /** Delegate to approve. */
  delegate: Pubkey;
  /** Owner of the token account (signer). */
  owner: Pubkey;
  /** Amount to approve. */
  amount: bigint;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.approveChecked}.
 * @since 1.1.0
 */
export interface ApproveCheckedParams {
  /** Token account. */
  account: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Delegate to approve. */
  delegate: Pubkey;
  /** Owner of the token account (signer). */
  owner: Pubkey;
  /** Amount to approve. */
  amount: bigint;
  /** Expected number of decimals. */
  decimals: number;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.revoke}.
 * @since 1.1.0
 */
export interface RevokeParams {
  /** Token account. */
  account: Pubkey;
  /** Owner (signer). */
  owner: Pubkey;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.mintTo}.
 * @since 1.1.0
 */
export interface MintToParams {
  /** Token mint. */
  mint: Pubkey;
  /** Destination token account. */
  destination: Pubkey;
  /** Mint authority (signer). */
  authority: Pubkey;
  /** Amount to mint. */
  amount: bigint;
  /** Additional signer pubkeys for multisig authority. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.mintToChecked}.
 * @since 1.1.0
 */
export interface MintToCheckedParams {
  /** Token mint. */
  mint: Pubkey;
  /** Destination token account. */
  destination: Pubkey;
  /** Mint authority (signer). */
  authority: Pubkey;
  /** Amount to mint. */
  amount: bigint;
  /** Expected number of decimals. */
  decimals: number;
  /** Additional signer pubkeys for multisig authority. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.burn}.
 * @since 1.1.0
 */
export interface BurnParams {
  /** Token account to burn from. */
  account: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Owner of the token account (signer). */
  owner: Pubkey;
  /** Amount to burn. */
  amount: bigint;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.burnChecked}.
 * @since 1.1.0
 */
export interface BurnCheckedParams {
  /** Token account to burn from. */
  account: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Owner of the token account (signer). */
  owner: Pubkey;
  /** Amount to burn. */
  amount: bigint;
  /** Expected number of decimals. */
  decimals: number;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.closeAccount}.
 * @since 1.1.0
 */
export interface CloseAccountParams {
  /** Token account to close. */
  account: Pubkey;
  /** Destination for remaining SOL rent. */
  destination: Pubkey;
  /** Owner of the token account (signer). */
  owner: Pubkey;
  /** Additional signer pubkeys for multisig owner. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.freezeAccount} / {@link SplToken.thawAccount}.
 * @since 1.1.0
 */
export interface FreezeThawParams {
  /** Token account to freeze/thaw. */
  account: Pubkey;
  /** Token mint. */
  mint: Pubkey;
  /** Freeze authority (signer). */
  authority: Pubkey;
  /** Additional signer pubkeys for multisig authority. */
  multiSigners?: Pubkey[];
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

/**
 * Params for {@link SplToken.syncNative}.
 * @since 1.1.0
 */
export interface SyncNativeParams {
  /** Native SOL token account (wrapped SOL). */
  account: Pubkey;
  /** Token program ID (default: Token v1). */
  programId?: Pubkey;
}

// ── Helpers ────────────────────────────────────────────────────

/** @internal Build owner key(s) — single signer or multisig */
function ownerKeys(owner: Pubkey, multiSigners?: Pubkey[], ownerWritable = false) {
  if (multiSigners && multiSigners.length > 0) {
    return [
      ownerWritable ? writable(owner) : readonly(owner),
      ...multiSigners.map(s => readonlySigner(s)),
    ];
  }
  return [ownerWritable ? writableSigner(owner) : readonlySigner(owner)];
}

// ── SplToken namespace ─────────────────────────────────────────

/**
 * SPL Token Program instruction encoders.
 *
 * Static methods produce {@link TransactionInstruction} objects for the
 * SPL Token Program (v1) and Token-2022.
 *
 * @since 1.1.0
 */
export const SplToken = {
  /** SPL Token v1 program ID. */
  programId: TOKEN_PROGRAM,
  /** Token-2022 program ID. */
  token2022ProgramId: TOKEN_2022_PROGRAM,

  /**
   * Initialize a new token mint.
   * @since 1.1.0
   */
  initializeMint(p: InitializeMintParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const hasFreezeAuth = p.freezeAuthority != null;
    const w = new InstructionWriter(67);
    w.u8(TokenIx.InitializeMint);
    w.u8(p.decimals);
    w.pubkey(p.mintAuthority);
    w.u8(hasFreezeAuth ? 1 : 0); // COption tag
    if (hasFreezeAuth) {
      w.pubkey(p.freezeAuthority!);
    } else {
      w.raw(new Uint8Array(32)); // padding
    }
    return {
      programId: pid,
      keys: [writable(p.mint), readonly(RENT_SYSVAR)],
      data: w.toBytes(),
    };
  },

  /**
   * Initialize a token account for a given mint and owner.
   * @since 1.1.0
   */
  initializeAccount(p: InitializeAccountParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.InitializeAccount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        readonly(p.mint),
        readonly(p.owner),
        readonly(RENT_SYSVAR),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Transfer tokens (unchecked — no decimal verification).
   * Prefer {@link transferChecked} for safety.
   * @since 1.1.0
   */
  transfer(p: TransferParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(9);
    w.u8(TokenIx.Transfer);
    w.u64(p.amount);
    return {
      programId: pid,
      keys: [
        writable(p.source),
        writable(p.destination),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Transfer tokens with decimal verification (recommended).
   * @since 1.1.0
   */
  transferChecked(p: TransferCheckedParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(10);
    w.u8(TokenIx.TransferChecked);
    w.u64(p.amount);
    w.u8(p.decimals);
    return {
      programId: pid,
      keys: [
        writable(p.source),
        readonly(p.mint),
        writable(p.destination),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Approve a delegate to spend tokens from the account.
   * @since 1.1.0
   */
  approve(p: ApproveParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(9);
    w.u8(TokenIx.Approve);
    w.u64(p.amount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        readonly(p.delegate),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Approve a delegate with decimal verification.
   * @since 1.1.0
   */
  approveChecked(p: ApproveCheckedParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(10);
    w.u8(TokenIx.ApproveChecked);
    w.u64(p.amount);
    w.u8(p.decimals);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        readonly(p.mint),
        readonly(p.delegate),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Revoke a previously approved delegate.
   * @since 1.1.0
   */
  revoke(p: RevokeParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.Revoke);
    return {
      programId: pid,
      keys: [writable(p.account), ...ownerKeys(p.owner, p.multiSigners)],
      data: w.toBytes(),
    };
  },

  /**
   * Mint new tokens to a destination account.
   * @since 1.1.0
   */
  mintTo(p: MintToParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(9);
    w.u8(TokenIx.MintTo);
    w.u64(p.amount);
    return {
      programId: pid,
      keys: [
        writable(p.mint),
        writable(p.destination),
        ...ownerKeys(p.authority, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Mint new tokens with decimal verification.
   * @since 1.1.0
   */
  mintToChecked(p: MintToCheckedParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(10);
    w.u8(TokenIx.MintToChecked);
    w.u64(p.amount);
    w.u8(p.decimals);
    return {
      programId: pid,
      keys: [
        writable(p.mint),
        writable(p.destination),
        ...ownerKeys(p.authority, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Burn tokens from an account.
   * @since 1.1.0
   */
  burn(p: BurnParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(9);
    w.u8(TokenIx.Burn);
    w.u64(p.amount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        writable(p.mint),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Burn tokens with decimal verification.
   * @since 1.1.0
   */
  burnChecked(p: BurnCheckedParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(10);
    w.u8(TokenIx.BurnChecked);
    w.u64(p.amount);
    w.u8(p.decimals);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        writable(p.mint),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Close a token account, reclaiming SOL rent.
   * @since 1.1.0
   */
  closeAccount(p: CloseAccountParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.CloseAccount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        writable(p.destination),
        ...ownerKeys(p.owner, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Freeze a token account (prevents transfers).
   * @since 1.1.0
   */
  freezeAccount(p: FreezeThawParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.FreezeAccount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        readonly(p.mint),
        ...ownerKeys(p.authority, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Thaw a previously frozen token account.
   * @since 1.1.0
   */
  thawAccount(p: FreezeThawParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.ThawAccount);
    return {
      programId: pid,
      keys: [
        writable(p.account),
        readonly(p.mint),
        ...ownerKeys(p.authority, p.multiSigners),
      ],
      data: w.toBytes(),
    };
  },

  /**
   * Sync the lamport balance of a native SOL token account.
   * @since 1.1.0
   */
  syncNative(p: SyncNativeParams): TransactionInstruction {
    const pid = p.programId ?? TOKEN_PROGRAM;
    const w = new InstructionWriter(1);
    w.u8(TokenIx.SyncNative);
    return {
      programId: pid,
      keys: [writable(p.account)],
      data: w.toBytes(),
    };
  },
} as const;
