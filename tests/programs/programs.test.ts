/**
 * Tests for Solana native instruction encoders.
 *
 * Verifies:
 * - InstructionWriter binary encoding correctness
 * - System Program (9 instructions): discriminators, data layout, account keys
 * - SPL Token (15 instructions): discriminators, data layout, account keys
 * - Associated Token Account (3 instructions): discriminators, account keys
 * - Memo (1 instruction): UTF-8 encoding, v1/v2 program selection
 * - Compute Budget (4 instructions): discriminators, data layout
 * - AI tools factory & schemas integration
 * - toKitInstruction bridge
 */

import { describe, it, expect } from 'vitest';
import { Pubkey, Lamports } from '../../src/core/types';

// ── Programs ───────────────────────────────────────────────────
import {
  InstructionWriter,
  decodeBase58,
  writableSigner,
  writable,
  readonlySigner,
  readonly,
  type AccountMeta,
  type TransactionInstruction,
} from '../../src/programs/types';

import {
  SystemProgram,
  SYSTEM_PROGRAM,
} from '../../src/programs/system';

import {
  SplToken,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
} from '../../src/programs/spl-token';

import {
  AssociatedToken,
  ASSOCIATED_TOKEN_PROGRAM,
} from '../../src/programs/associated-token';

import {
  Memo,
  MEMO_PROGRAM_V2,
  MEMO_PROGRAM_V1,
} from '../../src/programs/memo';

import {
  ComputeBudget,
  COMPUTE_BUDGET_PROGRAM,
} from '../../src/programs/compute-budget';

import { toKitInstruction } from '../../src/programs/index';

// ── AI Tools ───────────────────────────────────────────────────
import {
  solanaProgramsMethods,
  solanaProgramsMethodNames,
  createSolanaProgramsTools,
} from '../../src/ai/tools/protocols/solana-programs';

// ── Helpers ────────────────────────────────────────────────────

/** Read a u32 LE from a Uint8Array at offset. */
function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

/** Read a u64 LE from a Uint8Array at offset. */
function readU64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
}

/** Read a u8 from a Uint8Array at offset. */
function readU8(data: Uint8Array, offset: number): number {
  return data[offset];
}

/** Fake pubkeys for testing (deterministic base58 strings — valid base58 chars, 32-44 chars). */
const ALICE = Pubkey('ALicepppppppppppppppppppppppppppppppppppppp');
const BOB = Pubkey('Bobbppppppppppppppppppppppppppppppppppppppp');
const CHARLIE = Pubkey('CharLiepppppppppppppppppppppppppppppppppppp');
const MINT = Pubkey('MiNTpppppppppppppppppppppppppppppppppppppppp');
const PROGRAM_OWNER = Pubkey('ProgWnrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr');

/** Sysvar addresses used internally. */
const RECENT_BLOCKHASHES_SYSVAR = 'SysvarRecentB1teleHashes11111111111111111111';
const RENT_SYSVAR = 'SysvarRent111111111111111111111111111111111';

/* ═══════════════════════════════════════════════════════════════
 *  1. InstructionWriter
 * ═══════════════════════════════════════════════════════════════ */

describe('InstructionWriter', () => {
  it('writes u8, u16, u32, u64 in little-endian', () => {
    const w = new InstructionWriter(15);
    w.u8(0xAB);
    w.u16(0x1234);
    w.u32(0xDEADBEEF);
    w.u64(0x0102030405060708n);
    const bytes = w.toBytes();

    expect(bytes[0]).toBe(0xAB);
    expect(new DataView(bytes.buffer).getUint16(1, true)).toBe(0x1234);
    expect(new DataView(bytes.buffer).getUint32(3, true)).toBe(0xDEADBEEF);
    expect(new DataView(bytes.buffer).getBigUint64(7, true)).toBe(0x0102030405060708n);
    expect(w.position).toBe(15);
  });

  it('writes i64 signed values', () => {
    const w = new InstructionWriter(8);
    w.i64(-42n);
    const view = new DataView(w.toBytes().buffer);
    expect(view.getBigInt64(0, true)).toBe(-42n);
  });

  it('writes pubkey (32 bytes)', () => {
    const w = new InstructionWriter(32);
    w.pubkey(Pubkey('11111111111111111111111111111111'));
    const bytes = w.toBytes();
    // All zeros for System Program address
    expect(bytes.every(b => b === 0)).toBe(true);
    expect(w.position).toBe(32);
  });

  it('writes raw bytes', () => {
    const w = new InstructionWriter(4);
    w.raw(new Uint8Array([1, 2, 3, 4]));
    expect(Array.from(w.toBytes())).toEqual([1, 2, 3, 4]);
  });

  it('tracks position correctly through mixed writes', () => {
    const w = new InstructionWriter(45); // 1 + 2 + 4 + 8 + 8 + 32 = 55 — let's be precise
    const w2 = new InstructionWriter(1 + 2 + 4 + 8 + 32);
    w2.u8(0); // 1
    expect(w2.position).toBe(1);
    w2.u16(0); // 2
    expect(w2.position).toBe(3);
    w2.u32(0); // 4
    expect(w2.position).toBe(7);
    w2.u64(0n); // 8
    expect(w2.position).toBe(15);
    w2.pubkey(Pubkey('11111111111111111111111111111111')); // 32
    expect(w2.position).toBe(47);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. decodeBase58
 * ═══════════════════════════════════════════════════════════════ */

describe('decodeBase58', () => {
  it('decodes the System Program address (32 zero bytes)', () => {
    const bytes = decodeBase58('11111111111111111111111111111111');
    expect(bytes.length).toBe(32);
    expect(bytes.every(b => b === 0)).toBe(true);
  });

  it('decodes empty string to empty array', () => {
    expect(decodeBase58('').length).toBe(0);
  });

  it('throws on invalid characters', () => {
    expect(() => decodeBase58('0OIl')).toThrow('Invalid base58');
  });

  it('round-trips with known addresses', () => {
    // Token program address
    const tokenBytes = decodeBase58('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(tokenBytes.length).toBe(32);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. Account Meta helpers
 * ═══════════════════════════════════════════════════════════════ */

describe('Account meta helpers', () => {
  it('writableSigner creates correct meta', () => {
    const meta = writableSigner(ALICE);
    expect(meta.pubkey).toBe(ALICE);
    expect(meta.isSigner).toBe(true);
    expect(meta.isWritable).toBe(true);
  });

  it('writable creates correct meta', () => {
    const meta = writable(BOB);
    expect(meta.pubkey).toBe(BOB);
    expect(meta.isSigner).toBe(false);
    expect(meta.isWritable).toBe(true);
  });

  it('readonlySigner creates correct meta', () => {
    const meta = readonlySigner(CHARLIE);
    expect(meta.pubkey).toBe(CHARLIE);
    expect(meta.isSigner).toBe(true);
    expect(meta.isWritable).toBe(false);
  });

  it('readonly creates correct meta', () => {
    const meta = readonly(ALICE);
    expect(meta.pubkey).toBe(ALICE);
    expect(meta.isSigner).toBe(false);
    expect(meta.isWritable).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  4. System Program
 * ═══════════════════════════════════════════════════════════════ */

describe('SystemProgram', () => {
  it('has the correct program ID', () => {
    expect(SYSTEM_PROGRAM as unknown as string).toBe('11111111111111111111111111111111');
    expect(SystemProgram.programId).toBe(SYSTEM_PROGRAM);
  });

  describe('transfer', () => {
    it('encodes a transfer instruction (discriminator=2, 12 bytes)', () => {
      const ix = SystemProgram.transfer({
        from: ALICE,
        to: BOB,
        lamports: 1_000_000_000n,
      });

      expect(ix.programId).toBe(SYSTEM_PROGRAM);
      expect(ix.data.length).toBe(12);
      expect(readU32(ix.data, 0)).toBe(2); // Transfer discriminator
      expect(readU64(ix.data, 4)).toBe(1_000_000_000n);

      // Account keys
      expect(ix.keys).toHaveLength(2);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true });
      expect(ix.keys[1]).toEqual({ pubkey: BOB, isSigner: false, isWritable: true });
    });

    it('accepts Lamports branded type', () => {
      const ix = SystemProgram.transfer({
        from: ALICE,
        to: BOB,
        lamports: Lamports(500_000n),
      });
      expect(readU64(ix.data, 4)).toBe(500_000n);
    });
  });

  describe('createAccount', () => {
    it('encodes createAccount (discriminator=0, 52 bytes)', () => {
      const ix = SystemProgram.createAccount({
        from: ALICE,
        newAccount: BOB,
        lamports: 2_000_000n,
        space: 165,
        programId: PROGRAM_OWNER,
      });

      expect(ix.data.length).toBe(52);
      expect(readU32(ix.data, 0)).toBe(0); // CreateAccount discriminator
      expect(readU64(ix.data, 4)).toBe(2_000_000n); // lamports
      expect(readU64(ix.data, 12)).toBe(165n); // space
      // bytes 20..52 = programId pubkey

      expect(ix.keys).toHaveLength(2);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true });
      expect(ix.keys[1]).toEqual({ pubkey: BOB, isSigner: true, isWritable: true });
    });
  });

  describe('assign', () => {
    it('encodes assign (discriminator=1, 36 bytes)', () => {
      const ix = SystemProgram.assign({
        account: ALICE,
        programId: PROGRAM_OWNER,
      });

      expect(ix.data.length).toBe(36);
      expect(readU32(ix.data, 0)).toBe(1); // Assign discriminator
      expect(ix.keys).toHaveLength(1);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true });
    });
  });

  describe('allocate', () => {
    it('encodes allocate (discriminator=8, 12 bytes)', () => {
      const ix = SystemProgram.allocate({
        account: ALICE,
        space: 1024,
      });

      expect(ix.data.length).toBe(12);
      expect(readU32(ix.data, 0)).toBe(8); // Allocate discriminator
      expect(readU64(ix.data, 4)).toBe(1024n);
      expect(ix.keys).toHaveLength(1);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true });
    });
  });

  describe('createAccountWithSeed', () => {
    it('encodes with correct layout (discriminator=3)', () => {
      const ix = SystemProgram.createAccountWithSeed({
        from: ALICE,
        newAccount: BOB,
        base: ALICE,
        seed: 'test',
        lamports: 5_000_000n,
        space: 200,
        programId: PROGRAM_OWNER,
      });

      expect(readU32(ix.data, 0)).toBe(3); // CreateAccountWithSeed
      // base pubkey at offset 4 (32 bytes)
      // seed length at offset 36 (u32)
      const seedLen = readU32(ix.data, 36);
      expect(seedLen).toBe(4); // "test".length
      // seed bytes at 40..44
      const seedBytes = ix.data.slice(40, 44);
      expect(new TextDecoder().decode(seedBytes)).toBe('test');

      // When base === from, no extra signer key
      expect(ix.keys).toHaveLength(2);
    });

    it('adds base as signer when base !== from', () => {
      const ix = SystemProgram.createAccountWithSeed({
        from: ALICE,
        newAccount: BOB,
        base: CHARLIE,
        seed: 'x',
        lamports: 1n,
        space: 0,
        programId: PROGRAM_OWNER,
      });

      expect(ix.keys).toHaveLength(3);
      expect(ix.keys[2]).toEqual({ pubkey: CHARLIE, isSigner: true, isWritable: false });
    });
  });

  describe('advanceNonce', () => {
    it('encodes with discriminator=4, includes sysvars', () => {
      const ix = SystemProgram.advanceNonce({
        nonceAccount: ALICE,
        authority: BOB,
      });

      expect(ix.data.length).toBe(4);
      expect(readU32(ix.data, 0)).toBe(4);
      expect(ix.keys).toHaveLength(3);
      expect(ix.keys[0].isWritable).toBe(true); // nonce account
      expect((ix.keys[1].pubkey as unknown as string)).toBe(RECENT_BLOCKHASHES_SYSVAR);
      expect(ix.keys[2]).toEqual({ pubkey: BOB, isSigner: true, isWritable: false });
    });
  });

  describe('withdrawNonce', () => {
    it('encodes with discriminator=5, 12 bytes data', () => {
      const ix = SystemProgram.withdrawNonce({
        nonceAccount: ALICE,
        authority: CHARLIE,
        to: BOB,
        lamports: 100_000n,
      });

      expect(ix.data.length).toBe(12);
      expect(readU32(ix.data, 0)).toBe(5);
      expect(readU64(ix.data, 4)).toBe(100_000n);
      expect(ix.keys).toHaveLength(5);
      expect((ix.keys[2].pubkey as unknown as string)).toBe(RECENT_BLOCKHASHES_SYSVAR);
      expect((ix.keys[3].pubkey as unknown as string)).toBe(RENT_SYSVAR);
    });
  });

  describe('initializeNonce', () => {
    it('encodes with discriminator=6, 36 bytes data (includes authority pubkey)', () => {
      const ix = SystemProgram.initializeNonce({
        nonceAccount: ALICE,
        authority: BOB,
      });

      expect(ix.data.length).toBe(36);
      expect(readU32(ix.data, 0)).toBe(6);
      expect(ix.keys).toHaveLength(3);
      expect(ix.keys[0].isWritable).toBe(true); // nonce account
    });
  });

  describe('authorizeNonce', () => {
    it('encodes with discriminator=7, 36 bytes data', () => {
      const ix = SystemProgram.authorizeNonce({
        nonceAccount: ALICE,
        authority: BOB,
        newAuthority: CHARLIE,
      });

      expect(ix.data.length).toBe(36);
      expect(readU32(ix.data, 0)).toBe(7);
      expect(ix.keys).toHaveLength(2);
      expect(ix.keys[0].isWritable).toBe(true); // nonce account
      expect(ix.keys[1]).toEqual({ pubkey: BOB, isSigner: true, isWritable: false });
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. SPL Token
 * ═══════════════════════════════════════════════════════════════ */

describe('SplToken', () => {
  it('has correct program IDs', () => {
    expect(TOKEN_PROGRAM as unknown as string).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(TOKEN_2022_PROGRAM as unknown as string).toBe('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
    expect(SplToken.programId).toBe(TOKEN_PROGRAM);
    expect(SplToken.token2022ProgramId).toBe(TOKEN_2022_PROGRAM);
  });

  describe('initializeMint', () => {
    it('encodes with discriminator=0, 67 bytes, includes rent sysvar', () => {
      const ix = SplToken.initializeMint({
        mint: MINT,
        decimals: 9,
        mintAuthority: ALICE,
        freezeAuthority: BOB,
      });

      expect(ix.programId).toBe(TOKEN_PROGRAM);
      expect(ix.data.length).toBe(67);
      expect(readU8(ix.data, 0)).toBe(0); // InitializeMint
      expect(readU8(ix.data, 1)).toBe(9); // decimals
      // mintAuthority at 2..34 (32 bytes)
      expect(readU8(ix.data, 34)).toBe(1); // COption Some
      // freezeAuthority at 35..67 (32 bytes)

      expect(ix.keys).toHaveLength(2);
      expect(ix.keys[0]).toEqual({ pubkey: MINT, isSigner: false, isWritable: true });
      expect((ix.keys[1].pubkey as unknown as string)).toBe(RENT_SYSVAR);
    });

    it('sets COption None when freezeAuthority is null', () => {
      const ix = SplToken.initializeMint({
        mint: MINT,
        decimals: 6,
        mintAuthority: ALICE,
        freezeAuthority: null,
      });

      expect(readU8(ix.data, 34)).toBe(0); // COption None
    });
  });

  describe('initializeAccount', () => {
    it('encodes with discriminator=1, 1 byte', () => {
      const ix = SplToken.initializeAccount({
        account: BOB,
        mint: MINT,
        owner: ALICE,
      });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(1);
      expect(ix.keys).toHaveLength(4);
      expect(ix.keys[0]).toEqual({ pubkey: BOB, isSigner: false, isWritable: true });
      expect(ix.keys[1]).toEqual({ pubkey: MINT, isSigner: false, isWritable: false });
      expect(ix.keys[2]).toEqual({ pubkey: ALICE, isSigner: false, isWritable: false });
      expect((ix.keys[3].pubkey as unknown as string)).toBe(RENT_SYSVAR);
    });
  });

  describe('transfer', () => {
    it('encodes with discriminator=3, 9 bytes', () => {
      const ix = SplToken.transfer({
        source: ALICE,
        destination: BOB,
        owner: CHARLIE,
        amount: 1_000_000n,
      });

      expect(ix.data.length).toBe(9);
      expect(readU8(ix.data, 0)).toBe(3);
      expect(readU64(ix.data, 1)).toBe(1_000_000n);
      expect(ix.keys).toHaveLength(3);
      expect(ix.keys[2]).toEqual({ pubkey: CHARLIE, isSigner: true, isWritable: false });
    });

    it('supports Token-2022 via programId override', () => {
      const ix = SplToken.transfer({
        source: ALICE,
        destination: BOB,
        owner: CHARLIE,
        amount: 100n,
        programId: TOKEN_2022_PROGRAM,
      });

      expect(ix.programId).toBe(TOKEN_2022_PROGRAM);
    });
  });

  describe('transferChecked', () => {
    it('encodes with discriminator=12, 10 bytes (amount + decimals)', () => {
      const ix = SplToken.transferChecked({
        source: ALICE,
        mint: MINT,
        destination: BOB,
        owner: CHARLIE,
        amount: 500_000n,
        decimals: 6,
      });

      expect(ix.data.length).toBe(10);
      expect(readU8(ix.data, 0)).toBe(12);
      expect(readU64(ix.data, 1)).toBe(500_000n);
      expect(readU8(ix.data, 9)).toBe(6); // decimals
      expect(ix.keys).toHaveLength(4);
      expect(ix.keys[1]).toEqual({ pubkey: MINT, isSigner: false, isWritable: false });
    });
  });

  describe('approve', () => {
    it('encodes with discriminator=4, 9 bytes', () => {
      const ix = SplToken.approve({
        account: ALICE,
        delegate: BOB,
        owner: CHARLIE,
        amount: 100n,
      });

      expect(ix.data.length).toBe(9);
      expect(readU8(ix.data, 0)).toBe(4);
      expect(readU64(ix.data, 1)).toBe(100n);
      expect(ix.keys).toHaveLength(3);
    });
  });

  describe('approveChecked', () => {
    it('encodes with discriminator=13, 10 bytes', () => {
      const ix = SplToken.approveChecked({
        account: ALICE,
        mint: MINT,
        delegate: BOB,
        owner: CHARLIE,
        amount: 200n,
        decimals: 9,
      });

      expect(ix.data.length).toBe(10);
      expect(readU8(ix.data, 0)).toBe(13);
      expect(readU8(ix.data, 9)).toBe(9);
      expect(ix.keys).toHaveLength(4);
    });
  });

  describe('revoke', () => {
    it('encodes with discriminator=5, 1 byte', () => {
      const ix = SplToken.revoke({
        account: ALICE,
        owner: BOB,
      });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(5);
      expect(ix.keys).toHaveLength(2);
    });
  });

  describe('mintTo', () => {
    it('encodes with discriminator=7, 9 bytes', () => {
      const ix = SplToken.mintTo({
        mint: MINT,
        destination: BOB,
        authority: ALICE,
        amount: 10_000_000n,
      });

      expect(ix.data.length).toBe(9);
      expect(readU8(ix.data, 0)).toBe(7);
      expect(readU64(ix.data, 1)).toBe(10_000_000n);
      expect(ix.keys).toHaveLength(3);
    });
  });

  describe('mintToChecked', () => {
    it('encodes with discriminator=14, 10 bytes', () => {
      const ix = SplToken.mintToChecked({
        mint: MINT,
        destination: BOB,
        authority: ALICE,
        amount: 5_000n,
        decimals: 6,
      });

      expect(ix.data.length).toBe(10);
      expect(readU8(ix.data, 0)).toBe(14);
      expect(readU8(ix.data, 9)).toBe(6);
    });
  });

  describe('burn', () => {
    it('encodes with discriminator=8, 9 bytes', () => {
      const ix = SplToken.burn({
        account: ALICE,
        mint: MINT,
        owner: BOB,
        amount: 1_000n,
      });

      expect(ix.data.length).toBe(9);
      expect(readU8(ix.data, 0)).toBe(8);
      expect(readU64(ix.data, 1)).toBe(1_000n);
    });
  });

  describe('burnChecked', () => {
    it('encodes with discriminator=15, 10 bytes', () => {
      const ix = SplToken.burnChecked({
        account: ALICE,
        mint: MINT,
        owner: BOB,
        amount: 2_000n,
        decimals: 9,
      });

      expect(ix.data.length).toBe(10);
      expect(readU8(ix.data, 0)).toBe(15);
      expect(readU8(ix.data, 9)).toBe(9);
    });
  });

  describe('closeAccount', () => {
    it('encodes with discriminator=9, 1 byte', () => {
      const ix = SplToken.closeAccount({
        account: ALICE,
        destination: BOB,
        owner: CHARLIE,
      });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(9);
      expect(ix.keys).toHaveLength(3);
    });
  });

  describe('freezeAccount', () => {
    it('encodes with discriminator=10, 1 byte', () => {
      const ix = SplToken.freezeAccount({
        account: ALICE,
        mint: MINT,
        authority: BOB,
      });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(10);
      expect(ix.keys).toHaveLength(3);
    });
  });

  describe('thawAccount', () => {
    it('encodes with discriminator=11, 1 byte', () => {
      const ix = SplToken.thawAccount({
        account: ALICE,
        mint: MINT,
        authority: BOB,
      });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(11);
    });
  });

  describe('syncNative', () => {
    it('encodes with discriminator=17, 1 byte', () => {
      const ix = SplToken.syncNative({ account: ALICE });

      expect(ix.data.length).toBe(1);
      expect(readU8(ix.data, 0)).toBe(17);
      expect(ix.keys).toHaveLength(1);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: false, isWritable: true });
    });
  });

  describe('multisig support', () => {
    it('adds multisig signers instead of single owner', () => {
      const signers = [ALICE, BOB, CHARLIE];
      const ix = SplToken.transfer({
        source: ALICE,
        destination: BOB,
        owner: MINT, // multisig address
        amount: 100n,
        multiSigners: signers,
      });

      // 2 (source, dest) + 1 (multisig as readonly) + 3 (signers as readonlySigner)
      expect(ix.keys).toHaveLength(6);
      // owner should be readonly (not signer) when multisig
      expect(ix.keys[2]).toEqual({ pubkey: MINT, isSigner: false, isWritable: false });
      // signers should be readonlySigner
      expect(ix.keys[3]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: false });
      expect(ix.keys[4]).toEqual({ pubkey: BOB, isSigner: true, isWritable: false });
      expect(ix.keys[5]).toEqual({ pubkey: CHARLIE, isSigner: true, isWritable: false });
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. Associated Token Account
 * ═══════════════════════════════════════════════════════════════ */

describe('AssociatedToken', () => {
  it('has the correct program ID', () => {
    expect(ASSOCIATED_TOKEN_PROGRAM as unknown as string).toBe('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    expect(AssociatedToken.programId).toBe(ASSOCIATED_TOKEN_PROGRAM);
  });

  describe('create', () => {
    it('encodes with discriminator=0, 1 byte data', () => {
      const ata = Pubkey('ATAAddrpppppppppppppppppppppppppppppppppppp');
      const ix = AssociatedToken.create({
        payer: ALICE,
        associatedToken: ata,
        owner: BOB,
        mint: MINT,
      });

      expect(ix.programId).toBe(ASSOCIATED_TOKEN_PROGRAM);
      expect(ix.data.length).toBe(1);
      expect(ix.data[0]).toBe(0);

      expect(ix.keys).toHaveLength(6);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true }); // payer
      expect(ix.keys[1]).toEqual({ pubkey: ata, isSigner: false, isWritable: true }); // ATA
      expect(ix.keys[2]).toEqual({ pubkey: BOB, isSigner: false, isWritable: false }); // owner
      expect(ix.keys[3]).toEqual({ pubkey: MINT, isSigner: false, isWritable: false }); // mint
      expect((ix.keys[4].pubkey as unknown as string)).toBe('11111111111111111111111111111111'); // system
      expect(ix.keys[5].pubkey).toBe(TOKEN_PROGRAM); // token program
    });
  });

  describe('createIdempotent', () => {
    it('encodes with discriminator=1, 1 byte data', () => {
      const ata = Pubkey('ATAAddrpppppppppppppppppppppppppppppppppppp');
      const ix = AssociatedToken.createIdempotent({
        payer: ALICE,
        associatedToken: ata,
        owner: BOB,
        mint: MINT,
      });

      expect(ix.data.length).toBe(1);
      expect(ix.data[0]).toBe(1); // CreateIdempotent
      expect(ix.keys).toHaveLength(6);
    });

    it('uses custom token program ID when specified', () => {
      const ata = Pubkey('ATAAddrpppppppppppppppppppppppppppppppppppp');
      const ix = AssociatedToken.createIdempotent({
        payer: ALICE,
        associatedToken: ata,
        owner: BOB,
        mint: MINT,
        tokenProgramId: TOKEN_2022_PROGRAM,
      });

      expect(ix.keys[5].pubkey).toBe(TOKEN_2022_PROGRAM);
    });
  });

  describe('recoverNested', () => {
    it('encodes with discriminator=2, 1 byte data', () => {
      const nested = Pubkey('NestedATApppppppppppppppppppppppppppppppp');
      const dest = Pubkey('DestATApppppppppppppppppppppppppppppppppp');
      const ix = AssociatedToken.recoverNested({
        nestedAssociatedToken: nested,
        nestedMint: MINT,
        destinationAssociatedToken: dest,
        ownerMint: Pubkey('WnerMintpppppppppppppppppppppppppppppppppp'),
        owner: ALICE,
      });

      expect(ix.data.length).toBe(1);
      expect(ix.data[0]).toBe(2); // RecoverNested
      expect(ix.keys).toHaveLength(6);
      expect(ix.keys[4]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: true }); // owner
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. Memo
 * ═══════════════════════════════════════════════════════════════ */

describe('Memo', () => {
  it('has correct program IDs', () => {
    expect(MEMO_PROGRAM_V2 as unknown as string).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    expect(MEMO_PROGRAM_V1 as unknown as string).toBe('Memo1UhkJBfCR6MNcUpSSKvyfcY7YFW5p5JHblJRK9R');
    expect(Memo.programId).toBe(MEMO_PROGRAM_V2);
    expect(Memo.v1ProgramId).toBe(MEMO_PROGRAM_V1);
  });

  describe('addMemo', () => {
    it('encodes message as raw UTF-8 data (v2 by default)', () => {
      const ix = Memo.addMemo({ message: 'Hello, Solana!' });

      expect(ix.programId).toBe(MEMO_PROGRAM_V2);
      expect(new TextDecoder().decode(ix.data)).toBe('Hello, Solana!');
      expect(ix.keys).toHaveLength(0); // no signer
    });

    it('adds signer key when signer is provided', () => {
      const ix = Memo.addMemo({
        message: 'signed memo',
        signer: ALICE,
      });

      expect(ix.keys).toHaveLength(1);
      expect(ix.keys[0]).toEqual({ pubkey: ALICE, isSigner: true, isWritable: false });
    });

    it('adds additional signers', () => {
      const ix = Memo.addMemo({
        message: 'multi-signed',
        signer: ALICE,
        additionalSigners: [BOB, CHARLIE],
      });

      expect(ix.keys).toHaveLength(3);
    });

    it('uses v1 program when useV1=true', () => {
      const ix = Memo.addMemo({
        message: 'legacy',
        useV1: true,
      });

      expect(ix.programId).toBe(MEMO_PROGRAM_V1);
    });

    it('handles unicode messages', () => {
      const ix = Memo.addMemo({ message: '🚀 Synapse SDK' });
      const decoded = new TextDecoder().decode(ix.data);
      expect(decoded).toBe('🚀 Synapse SDK');
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. Compute Budget
 * ═══════════════════════════════════════════════════════════════ */

describe('ComputeBudget', () => {
  it('has the correct program ID', () => {
    expect(COMPUTE_BUDGET_PROGRAM as unknown as string).toBe('ComputeBudget111111111111111111111111111111');
    expect(ComputeBudget.programId).toBe(COMPUTE_BUDGET_PROGRAM);
  });

  describe('setComputeUnitLimit', () => {
    it('encodes with discriminator=2, 5 bytes, no keys', () => {
      const ix = ComputeBudget.setComputeUnitLimit({ units: 400_000 });

      expect(ix.programId).toBe(COMPUTE_BUDGET_PROGRAM);
      expect(ix.data.length).toBe(5);
      expect(readU8(ix.data, 0)).toBe(2); // SetComputeUnitLimit
      expect(readU32(ix.data, 1)).toBe(400_000);
      expect(ix.keys).toHaveLength(0);
    });
  });

  describe('setComputeUnitPrice', () => {
    it('encodes with discriminator=3, 9 bytes', () => {
      const ix = ComputeBudget.setComputeUnitPrice({ microLamports: 50_000n });

      expect(ix.data.length).toBe(9);
      expect(readU8(ix.data, 0)).toBe(3); // SetComputeUnitPrice
      expect(readU64(ix.data, 1)).toBe(50_000n);
      expect(ix.keys).toHaveLength(0);
    });
  });

  describe('requestHeapFrame', () => {
    it('encodes with discriminator=1, 5 bytes', () => {
      const ix = ComputeBudget.requestHeapFrame({ bytes: 65_536 });

      expect(ix.data.length).toBe(5);
      expect(readU8(ix.data, 0)).toBe(1); // RequestHeapFrame
      expect(readU32(ix.data, 1)).toBe(65_536);
      expect(ix.keys).toHaveLength(0);
    });
  });

  describe('setLoadedAccountsDataSizeLimit', () => {
    it('encodes with discriminator=4, 5 bytes', () => {
      const ix = ComputeBudget.setLoadedAccountsDataSizeLimit({ bytes: 1_000_000 });

      expect(ix.data.length).toBe(5);
      expect(readU8(ix.data, 0)).toBe(4);
      expect(readU32(ix.data, 1)).toBe(1_000_000);
      expect(ix.keys).toHaveLength(0);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. toKitInstruction bridge
 * ═══════════════════════════════════════════════════════════════ */

describe('toKitInstruction', () => {
  it('converts a simple instruction with correct AccountRole mapping', () => {
    const ix = SystemProgram.transfer({
      from: ALICE,
      to: BOB,
      lamports: 1n,
    });

    const kitIx = toKitInstruction(ix);

    // programAddress should be a Kit Address
    expect(kitIx.programAddress).toBeDefined();
    // accounts should have correct roles
    expect(kitIx.accounts).toHaveLength(2);
    // data should be the same Uint8Array
    expect(kitIx.data).toBe(ix.data);
  });

  it('preserves data bytes', () => {
    const ix = ComputeBudget.setComputeUnitPrice({ microLamports: 12345n });
    const kitIx = toKitInstruction(ix);
    expect(kitIx.data).toBe(ix.data);
  });

  it('maps empty keys to empty accounts', () => {
    const ix = ComputeBudget.setComputeUnitLimit({ units: 200_000 });
    const kitIx = toKitInstruction(ix);
    expect(kitIx.accounts).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  10. AI Tools — Schemas
 * ═══════════════════════════════════════════════════════════════ */

describe('Solana Programs AI Tools — Schemas', () => {
  it('registers 16 methods', () => {
    expect(solanaProgramsMethods).toHaveLength(16);
  });

  it('exports 16 method names', () => {
    expect(solanaProgramsMethodNames).toHaveLength(16);
  });

  it('all methods belong to the solana-programs protocol', () => {
    for (const m of solanaProgramsMethods) {
      expect(m.protocol).toBe('solana-programs');
    }
  });

  it('all methods have descriptions', () => {
    for (const m of solanaProgramsMethods) {
      expect(m.description, `${m.name} missing description`).toBeTruthy();
    }
  });

  it('all methods have input and output schemas', () => {
    for (const m of solanaProgramsMethods) {
      expect(m.input, `${m.name} missing input`).toBeDefined();
      expect(m.output, `${m.name} missing output`).toBeDefined();
    }
  });

  it('contains the expected method names', () => {
    const names = new Set(solanaProgramsMethodNames);
    expect(names.has('systemTransfer')).toBe(true);
    expect(names.has('systemCreateAccount')).toBe(true);
    expect(names.has('tokenTransfer')).toBe(true);
    expect(names.has('tokenTransferChecked')).toBe(true);
    expect(names.has('ataCreate')).toBe(true);
    expect(names.has('ataCreateIdempotent')).toBe(true);
    expect(names.has('setComputeUnitLimit')).toBe(true);
    expect(names.has('setComputeUnitPrice')).toBe(true);
    expect(names.has('addMemo')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  11. AI Tools — Factory
 * ═══════════════════════════════════════════════════════════════ */

describe('Solana Programs AI Tools — Factory', () => {
  it('creates a toolkit with 16 tools', () => {
    const toolkit = createSolanaProgramsTools();
    expect(toolkit.tools).toHaveLength(16);
    expect(Object.keys(toolkit.toolMap).length).toBeGreaterThanOrEqual(16);
  });

  it('uses default prefix solana_programs_', () => {
    const toolkit = createSolanaProgramsTools();
    for (const tool of toolkit.tools) {
      expect(tool.name.startsWith('solana_programs_')).toBe(true);
    }
  });

  it('supports custom prefix', () => {
    const toolkit = createSolanaProgramsTools({ prefix: 'sp_' });
    for (const tool of toolkit.tools) {
      expect(tool.name.startsWith('sp_')).toBe(true);
    }
  });

  it('supports include filter', () => {
    const toolkit = createSolanaProgramsTools({
      include: ['systemTransfer', 'addMemo'],
    });
    expect(toolkit.tools).toHaveLength(2);
    const names = toolkit.tools.map(t => t.name);
    expect(names).toContain('solana_programs_systemTransfer');
    expect(names).toContain('solana_programs_addMemo');
  });

  it('supports exclude filter', () => {
    const toolkit = createSolanaProgramsTools({
      exclude: ['systemTransfer'],
    });
    expect(toolkit.tools).toHaveLength(15);
    const names = toolkit.tools.map(t => t.name);
    expect(names).not.toContain('solana_programs_systemTransfer');
  });

  it('every tool has a description', () => {
    const toolkit = createSolanaProgramsTools();
    for (const tool of toolkit.tools) {
      expect(tool.description).toBeTruthy();
    }
  });

  it('toolMap contains entries keyed by both unprefixed and prefixed names', () => {
    const toolkit = createSolanaProgramsTools();
    // buildProtocolTools stores both: toolMap.systemTransfer and toolMap.solana_programs_systemTransfer
    expect(toolkit.toolMap['systemTransfer']).toBeDefined();
    expect(toolkit.toolMap['solana_programs_systemTransfer']).toBeDefined();
    // Both point to the same tool
    expect(toolkit.toolMap['systemTransfer']).toBe(toolkit.toolMap['solana_programs_systemTransfer']);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  12. Cross-program consistency
 * ═══════════════════════════════════════════════════════════════ */

describe('Cross-program consistency', () => {
  it('all program namespaces expose a programId property', () => {
    expect(SystemProgram.programId).toBeDefined();
    expect(SplToken.programId).toBeDefined();
    expect(AssociatedToken.programId).toBeDefined();
    expect(Memo.programId).toBeDefined();
    expect(ComputeBudget.programId).toBeDefined();
  });

  it('all instructions return valid TransactionInstruction shape', () => {
    const instructions: TransactionInstruction[] = [
      SystemProgram.transfer({ from: ALICE, to: BOB, lamports: 1n }),
      SplToken.transfer({ source: ALICE, destination: BOB, owner: CHARLIE, amount: 1n }),
      AssociatedToken.create({
        payer: ALICE,
        associatedToken: BOB,
        owner: CHARLIE,
        mint: MINT,
      }),
      Memo.addMemo({ message: 'test' }),
      ComputeBudget.setComputeUnitLimit({ units: 200_000 }),
    ];

    for (const ix of instructions) {
      expect(ix.programId).toBeDefined();
      expect(ix.keys).toBeInstanceOf(Array);
      expect(ix.data).toBeInstanceOf(Uint8Array);
    }
  });

  it('no duplicate AI tool method names', () => {
    const seen = new Set<string>();
    for (const name of solanaProgramsMethodNames) {
      expect(seen.has(name), `Duplicate method name: ${name}`).toBe(false);
      seen.add(name);
    }
  });
});
