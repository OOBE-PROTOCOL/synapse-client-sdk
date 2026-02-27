/**
 * Tests for native Solana account data decoders.
 *
 * Uses known byte layouts to verify each decoder produces the correct
 * typed output. All test data is hand-crafted to match on-chain layouts.
 */

import { describe, it, expect } from 'vitest';
import {
  AccountReader,
  encodeBase58,
  decodeTokenAccount,
  decodeMint,
  decodeToken2022Account,
  decodeToken2022Mint,
  TokenExtensionType,
  decodeStakeAccount,
  decodeNonceAccount,
  decodeLookupTable,
  decodeMultisig,
  TOKEN_ACCOUNT_SIZE,
  MINT_SIZE,
  NONCE_ACCOUNT_SIZE,
  LOOKUP_TABLE_HEADER_SIZE,
  MULTISIG_SIZE,
} from '../../src/decoders/index';
import { Pubkey } from '../../src/core/types';

// ── Helpers ────────────────────────────────────────────────────

/** Create a 32-byte "pubkey" filled with a single byte value. */
function fakePubkey(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

/** Write a u32 LE at offset. */
function writeU32(buf: Uint8Array, offset: number, val: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint32(offset, val, true);
}

/** Write a u64 LE at offset (as bigint). */
function writeU64(buf: Uint8Array, offset: number, val: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(offset, val, true);
}

/** Write a i64 LE at offset (as bigint). */
function writeI64(buf: Uint8Array, offset: number, val: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigInt64(offset, val, true);
}

/** Write a f64 LE at offset. */
function writeF64(buf: Uint8Array, offset: number, val: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setFloat64(offset, val, true);
}

// ═══════════════════════════════════════════════════════════════
//  AccountReader
// ═══════════════════════════════════════════════════════════════

describe('AccountReader', () => {
  it('reads u8, u16, u32, u64 in little-endian', () => {
    const buf = new Uint8Array(15);
    buf[0] = 0xAB;
    buf[1] = 0x34; buf[2] = 0x12; // u16 = 0x1234
    new DataView(buf.buffer).setUint32(3, 0xDEADBEEF, true);
    new DataView(buf.buffer).setBigUint64(7, 0x0102030405060708n, true);

    const r = new AccountReader(buf);
    expect(r.u8()).toBe(0xAB);
    expect(r.u16()).toBe(0x1234);
    expect(r.u32()).toBe(0xDEADBEEF);
    expect(r.u64()).toBe(0x0102030405060708n);
    expect(r.position).toBe(15);
    expect(r.remaining).toBe(0);
  });

  it('reads i64 signed values', () => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigInt64(0, -42n, true);
    const r = new AccountReader(buf);
    expect(r.i64()).toBe(-42n);
  });

  it('reads bool as u8 !== 0', () => {
    const buf = new Uint8Array([0, 1, 2]);
    const r = new AccountReader(buf);
    expect(r.bool()).toBe(false);
    expect(r.bool()).toBe(true);
    expect(r.bool()).toBe(true);
  });

  it('reads pubkey as base58 string', () => {
    // All zeros = "1" repeated (base58 for 32 zero-bytes = 32 '1's)
    const zeros = new Uint8Array(32);
    const r = new AccountReader(zeros);
    const pk = r.pubkey();
    expect(pk).toBe('11111111111111111111111111111111');
    expect(r.position).toBe(32);
  });

  it('reads COption<Pubkey> with None (always advances past data)', () => {
    const buf = new Uint8Array(36); // u32 tag + 32 bytes
    writeU32(buf, 0, 0); // None
    const r = new AccountReader(buf);
    expect(r.coption(() => r.pubkey())).toBeNull();
    expect(r.position).toBe(36); // Always reads tag + inner data (C ABI)
  });

  it('reads COption<Pubkey> with Some', () => {
    const buf = new Uint8Array(36);
    writeU32(buf, 0, 1); // Some
    buf.set(fakePubkey(0xFF), 4);
    const r = new AccountReader(buf);
    const result = r.coption(() => r.pubkey());
    expect(result).not.toBeNull();
    expect(r.position).toBe(36);
  });

  it('skip and seek work correctly', () => {
    const buf = new Uint8Array(10);
    buf[5] = 42;
    const r = new AccountReader(buf);
    r.skip(5);
    expect(r.u8()).toBe(42);
    r.seek(0);
    expect(r.position).toBe(0);
  });

  it('slice returns correct sub-array', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    const r = new AccountReader(buf);
    r.skip(1);
    const s = r.slice(3);
    expect(s).toEqual(new Uint8Array([2, 3, 4]));
    expect(r.position).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
//  encodeBase58
// ═══════════════════════════════════════════════════════════════

describe('encodeBase58', () => {
  it('encodes system program (32 zeros) correctly', () => {
    const result = encodeBase58(new Uint8Array(32));
    expect(result).toBe('11111111111111111111111111111111');
  });

  it('encodes non-zero bytes', () => {
    // Known: [1] encodes to "2" in base58
    expect(encodeBase58(new Uint8Array([1]))).toBe('2');
    // Known: [0, 1] encodes to "12"
    expect(encodeBase58(new Uint8Array([0, 1]))).toBe('12');
  });

  it('encodes empty array to empty string', () => {
    expect(encodeBase58(new Uint8Array(0))).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
//  SPL Token Account decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeTokenAccount', () => {
  function buildTokenAccount(overrides: {
    mint?: Uint8Array;
    owner?: Uint8Array;
    amount?: bigint;
    hasDelegate?: boolean;
    delegate?: Uint8Array;
    state?: number;
    hasNative?: boolean;
    nativeAmount?: bigint;
    delegatedAmount?: bigint;
    hasCloseAuth?: boolean;
    closeAuth?: Uint8Array;
  } = {}): Uint8Array {
    const buf = new Uint8Array(TOKEN_ACCOUNT_SIZE);
    let offset = 0;

    // mint (32)
    buf.set(overrides.mint ?? fakePubkey(0x01), offset); offset += 32;
    // owner (32)
    buf.set(overrides.owner ?? fakePubkey(0x02), offset); offset += 32;
    // amount (8)
    writeU64(buf, offset, overrides.amount ?? 1000000n); offset += 8;
    // delegate COption (4 + 32)
    writeU32(buf, offset, overrides.hasDelegate ? 1 : 0); offset += 4;
    buf.set(overrides.delegate ?? fakePubkey(0x03), offset); offset += 32;
    // state (1)
    buf[offset++] = overrides.state ?? 1; // initialized
    // isNative COption (4 + 8)
    writeU32(buf, offset, overrides.hasNative ? 1 : 0); offset += 4;
    writeU64(buf, offset, overrides.nativeAmount ?? 0n); offset += 8;
    // delegatedAmount (8)
    writeU64(buf, offset, overrides.delegatedAmount ?? 0n); offset += 8;
    // closeAuthority COption (4 + 32)
    writeU32(buf, offset, overrides.hasCloseAuth ? 1 : 0); offset += 4;
    buf.set(overrides.closeAuth ?? fakePubkey(0x04), offset); offset += 32;

    return buf;
  }

  it('decodes a basic initialized token account', () => {
    const data = buildTokenAccount({ amount: 5000000n });
    const decoded = decodeTokenAccount(data);

    expect(decoded.amount).toBe(5000000n);
    expect(decoded.state).toBe('initialized');
    expect(decoded.delegate).toBeNull();
    expect(decoded.isNative).toBeNull();
    expect(decoded.closeAuthority).toBeNull();
    expect(decoded.delegatedAmount).toBe(0n);
  });

  it('decodes delegate and close authority when present', () => {
    const data = buildTokenAccount({
      hasDelegate: true,
      delegatedAmount: 100n,
      hasCloseAuth: true,
    });
    const decoded = decodeTokenAccount(data);

    expect(decoded.delegate).not.toBeNull();
    expect(decoded.delegatedAmount).toBe(100n);
    expect(decoded.closeAuthority).not.toBeNull();
  });

  it('decodes wrapped SOL (isNative = Some)', () => {
    const data = buildTokenAccount({
      hasNative: true,
      nativeAmount: 890880n,
    });
    const decoded = decodeTokenAccount(data);
    expect(decoded.isNative).toBe(890880n);
  });

  it('decodes frozen state', () => {
    const data = buildTokenAccount({ state: 2 });
    const decoded = decodeTokenAccount(data);
    expect(decoded.state).toBe('frozen');
  });

  it('throws on data too short', () => {
    expect(() => decodeTokenAccount(new Uint8Array(100))).toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════════════
//  SPL Token Mint decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeMint', () => {
  function buildMint(overrides: {
    hasMintAuth?: boolean;
    mintAuth?: Uint8Array;
    supply?: bigint;
    decimals?: number;
    isInitialized?: boolean;
    hasFreezeAuth?: boolean;
    freezeAuth?: Uint8Array;
  } = {}): Uint8Array {
    const buf = new Uint8Array(MINT_SIZE);
    let offset = 0;

    // mintAuthority COption (4 + 32)
    writeU32(buf, offset, overrides.hasMintAuth !== false ? 1 : 0); offset += 4;
    buf.set(overrides.mintAuth ?? fakePubkey(0x10), offset); offset += 32;
    // supply (8)
    writeU64(buf, offset, overrides.supply ?? 1000000000n); offset += 8;
    // decimals (1)
    buf[offset++] = overrides.decimals ?? 6;
    // isInitialized (1)
    buf[offset++] = overrides.isInitialized !== false ? 1 : 0;
    // freezeAuthority COption (4 + 32)
    writeU32(buf, offset, overrides.hasFreezeAuth ? 1 : 0); offset += 4;
    buf.set(overrides.freezeAuth ?? fakePubkey(0x11), offset); offset += 32;

    return buf;
  }

  it('decodes a standard mint', () => {
    const data = buildMint({ supply: 21000000000n, decimals: 9 });
    const decoded = decodeMint(data);

    expect(decoded.supply).toBe(21000000000n);
    expect(decoded.decimals).toBe(9);
    expect(decoded.isInitialized).toBe(true);
    expect(decoded.mintAuthority).not.toBeNull();
    expect(decoded.freezeAuthority).toBeNull();
  });

  it('decodes fixed-supply mint (no mint authority)', () => {
    const data = buildMint({ hasMintAuth: false });
    const decoded = decodeMint(data);
    expect(decoded.mintAuthority).toBeNull();
  });

  it('decodes freeze authority', () => {
    const data = buildMint({ hasFreezeAuth: true });
    const decoded = decodeMint(data);
    expect(decoded.freezeAuthority).not.toBeNull();
  });

  it('throws on data too short', () => {
    expect(() => decodeMint(new Uint8Array(50))).toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════════════
//  Token-2022 decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeToken2022Account', () => {
  it('decodes base account without extensions', () => {
    // Just a 165-byte standard account — no extensions
    const buf = new Uint8Array(TOKEN_ACCOUNT_SIZE);
    let offset = 0;
    buf.set(fakePubkey(0x01), offset); offset += 32; // mint
    buf.set(fakePubkey(0x02), offset); offset += 32; // owner
    writeU64(buf, offset, 42n); offset += 8;          // amount
    writeU32(buf, offset, 0); offset += 4;             // delegate: None
    offset += 32;                                       // delegate slot
    buf[offset++] = 1;                                  // state: initialized
    writeU32(buf, offset, 0); offset += 4;             // isNative: None
    offset += 8;                                        // native slot
    writeU64(buf, offset, 0n); offset += 8;            // delegatedAmount
    writeU32(buf, offset, 0); offset += 4;             // closeAuth: None

    const decoded = decodeToken2022Account(buf);
    expect(decoded.amount).toBe(42n);
    expect(decoded.extensions).toHaveLength(0);
  });

  it('decodes account with ImmutableOwner extension', () => {
    // 165 base + 1 account type + TLV: [type=7, len=0]
    const buf = new Uint8Array(TOKEN_ACCOUNT_SIZE + 1 + 4);
    // Fill base layout
    buf.set(fakePubkey(0x01), 0);   // mint
    buf.set(fakePubkey(0x02), 32);  // owner
    writeU64(buf, 64, 100n);         // amount
    writeU32(buf, 72, 0);            // delegate: None
    buf[108] = 1;                    // state: initialized
    writeU32(buf, 109, 0);           // isNative: None
    writeU64(buf, 121, 0n);          // delegatedAmount
    writeU32(buf, 129, 0);           // closeAuth: None

    // Account type byte
    buf[TOKEN_ACCOUNT_SIZE] = 2; // AccountType::Account

    // TLV: ImmutableOwner (type=7, length=0)
    const tlvOffset = TOKEN_ACCOUNT_SIZE + 1;
    buf[tlvOffset] = 7;     // type LE low byte
    buf[tlvOffset + 1] = 0; // type LE high byte
    buf[tlvOffset + 2] = 0; // length LE low
    buf[tlvOffset + 3] = 0; // length LE high

    const decoded = decodeToken2022Account(buf);
    expect(decoded.amount).toBe(100n);
    expect(decoded.extensions).toHaveLength(1);
    expect(decoded.extensions[0].type).toBe('ImmutableOwner');
  });
});

describe('decodeToken2022Mint', () => {
  it('decodes mint with MintCloseAuthority extension', () => {
    // 82 base + 1 account type + TLV: [type=3, len=32, pubkey]
    const buf = new Uint8Array(MINT_SIZE + 1 + 4 + 32);
    // Fill base mint layout
    writeU32(buf, 0, 1);             // mintAuthority: Some
    buf.set(fakePubkey(0x10), 4);    // mintAuthority pubkey
    writeU64(buf, 36, 1000000n);     // supply
    buf[44] = 6;                     // decimals
    buf[45] = 1;                     // isInitialized
    writeU32(buf, 46, 0);            // freezeAuthority: None

    // Account type byte
    buf[MINT_SIZE] = 1; // AccountType::Mint

    // TLV: MintCloseAuthority (type=3, length=32)
    const tlvOffset = MINT_SIZE + 1;
    buf[tlvOffset] = 3;      // type LE low
    buf[tlvOffset + 1] = 0;  // type LE high
    buf[tlvOffset + 2] = 32; // length LE low
    buf[tlvOffset + 3] = 0;  // length LE high
    buf.set(fakePubkey(0xCC), tlvOffset + 4);

    const decoded = decodeToken2022Mint(buf);
    expect(decoded.supply).toBe(1000000n);
    expect(decoded.decimals).toBe(6);
    expect(decoded.extensions).toHaveLength(1);
    expect(decoded.extensions[0].type).toBe('MintCloseAuthority');
    if (decoded.extensions[0].type === 'MintCloseAuthority') {
      expect(decoded.extensions[0].closeAuthority).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  Stake Account decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeStakeAccount', () => {
  function buildStakeAccount(type: number, opts?: { includeStake?: boolean }): Uint8Array {
    const size = type === 2 ? 200 : 124;
    const buf = new Uint8Array(size);

    writeU32(buf, 0, type);                     // discriminator
    writeU64(buf, 4, 2282880n);                 // rentExemptReserve
    buf.set(fakePubkey(0xAA), 12);              // staker
    buf.set(fakePubkey(0xBB), 44);              // withdrawer
    writeI64(buf, 76, 0n);                      // lockup.unixTimestamp
    writeU64(buf, 84, 0n);                      // lockup.epoch
    buf.set(fakePubkey(0x00), 92);              // lockup.custodian

    if (type === 2 && size >= 200) {
      buf.set(fakePubkey(0xCC), 124);           // voterPubkey
      writeU64(buf, 156, 5000000000n);          // stake
      writeU64(buf, 164, 100n);                 // activationEpoch
      writeU64(buf, 172, 0xFFFFFFFFFFFFFFFFn);  // deactivationEpoch (MAX)
      writeF64(buf, 180, 0.25);                 // warmupCooldownRate
      writeU64(buf, 188, 50n);                  // creditsObserved
    }

    return buf;
  }

  it('decodes uninitialized (type=0)', () => {
    const buf = new Uint8Array(4);
    writeU32(buf, 0, 0);
    const decoded = decodeStakeAccount(buf);
    expect(decoded.type).toBe('uninitialized');
    expect(decoded.meta).toBeNull();
    expect(decoded.stake).toBeNull();
  });

  it('decodes initialized (type=1) with meta', () => {
    const data = buildStakeAccount(1);
    const decoded = decodeStakeAccount(data);

    expect(decoded.type).toBe('initialized');
    expect(decoded.meta).not.toBeNull();
    expect(decoded.meta!.rentExemptReserve).toBe(2282880n);
    expect(decoded.stake).toBeNull();
  });

  it('decodes delegated (type=2) with full stake', () => {
    const data = buildStakeAccount(2);
    const decoded = decodeStakeAccount(data);

    expect(decoded.type).toBe('delegated');
    expect(decoded.meta).not.toBeNull();
    expect(decoded.stake).not.toBeNull();
    expect(decoded.stake!.stake).toBe(5000000000n);
    expect(decoded.stake!.activationEpoch).toBe(100n);
    expect(decoded.stake!.warmupCooldownRate).toBe(0.25);
    expect(decoded.creditsObserved).toBe(50n);
  });

  it('throws on data too short for meta', () => {
    const buf = new Uint8Array(10);
    writeU32(buf, 0, 1); // initialized
    expect(() => decodeStakeAccount(buf)).toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════════════
//  Nonce Account decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeNonceAccount', () => {
  function buildNonce(): Uint8Array {
    const buf = new Uint8Array(NONCE_ACCOUNT_SIZE);
    writeU32(buf, 0, 0);            // version
    writeU32(buf, 4, 1);            // state: initialized
    buf.set(fakePubkey(0xDD), 8);   // authority
    buf.set(fakePubkey(0xEE), 40);  // blockhash
    writeU64(buf, 72, 5000n);       // lamportsPerSignature
    return buf;
  }

  it('decodes an initialized nonce account', () => {
    const data = buildNonce();
    const decoded = decodeNonceAccount(data);

    expect(decoded.version).toBe(0);
    expect(decoded.state).toBe('initialized');
    expect(decoded.authority).toBeTruthy();
    expect(decoded.blockhash).toBeTruthy();
    expect(decoded.lamportsPerSignature).toBe(5000n);
  });

  it('decodes uninitialized nonce', () => {
    const buf = new Uint8Array(NONCE_ACCOUNT_SIZE);
    writeU32(buf, 0, 0); // version
    writeU32(buf, 4, 0); // state: uninitialized
    const decoded = decodeNonceAccount(buf);
    expect(decoded.state).toBe('uninitialized');
  });

  it('throws on data too short', () => {
    expect(() => decodeNonceAccount(new Uint8Array(20))).toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════════════
//  Address Lookup Table decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeLookupTable', () => {
  function buildLookupTable(numAddresses: number, opts?: { deactivated?: boolean; hasAuth?: boolean }): Uint8Array {
    const size = LOOKUP_TABLE_HEADER_SIZE + numAddresses * 32;
    const buf = new Uint8Array(size);

    writeU32(buf, 0, 1);  // discriminator
    writeU64(buf, 4, opts?.deactivated ? 500n : 0xFFFFFFFFFFFFFFFFn); // deactivation slot
    writeU64(buf, 12, 100n); // lastExtendedSlot
    buf[20] = 0;              // lastExtendedSlotStartIndex
    buf[21] = opts?.hasAuth !== false ? 1 : 0; // has authority
    // [22..24] padding
    buf.set(fakePubkey(0xAA), 24); // authority

    // Fill addresses
    for (let i = 0; i < numAddresses; i++) {
      buf.set(fakePubkey(i + 1), LOOKUP_TABLE_HEADER_SIZE + i * 32);
    }

    return buf;
  }

  it('decodes a lookup table with addresses', () => {
    const data = buildLookupTable(3);
    const decoded = decodeLookupTable(data);

    expect(decoded.discriminator).toBe(1);
    expect(decoded.isDeactivated).toBe(false);
    expect(decoded.authority).not.toBeNull();
    expect(decoded.addresses).toHaveLength(3);
    expect(decoded.lastExtendedSlot).toBe(100n);
  });

  it('decodes a deactivated table', () => {
    const data = buildLookupTable(0, { deactivated: true });
    const decoded = decodeLookupTable(data);
    expect(decoded.isDeactivated).toBe(true);
    expect(decoded.deactivationSlot).toBe(500n);
    expect(decoded.addresses).toHaveLength(0);
  });

  it('decodes frozen table (no authority)', () => {
    const data = buildLookupTable(1, { hasAuth: false });
    const decoded = decodeLookupTable(data);
    expect(decoded.authority).toBeNull();
    expect(decoded.addresses).toHaveLength(1);
  });

  it('throws on data too short', () => {
    expect(() => decodeLookupTable(new Uint8Array(10))).toThrow('too short');
  });
});

// ═══════════════════════════════════════════════════════════════
//  SPL Multisig decoder
// ═══════════════════════════════════════════════════════════════

describe('decodeMultisig', () => {
  function buildMultisig(m: number, n: number): Uint8Array {
    const buf = new Uint8Array(MULTISIG_SIZE);
    buf[0] = m;
    buf[1] = n;
    buf[2] = 1; // isInitialized

    for (let i = 0; i < 11; i++) {
      buf.set(fakePubkey(i + 1), 3 + i * 32);
    }

    return buf;
  }

  it('decodes a 2-of-3 multisig', () => {
    const data = buildMultisig(2, 3);
    const decoded = decodeMultisig(data);

    expect(decoded.m).toBe(2);
    expect(decoded.n).toBe(3);
    expect(decoded.isInitialized).toBe(true);
    expect(decoded.signers).toHaveLength(3);
  });

  it('decodes a 1-of-1 multisig', () => {
    const data = buildMultisig(1, 1);
    const decoded = decodeMultisig(data);

    expect(decoded.m).toBe(1);
    expect(decoded.n).toBe(1);
    expect(decoded.signers).toHaveLength(1);
  });

  it('throws on data too short', () => {
    expect(() => decodeMultisig(new Uint8Array(100))).toThrow('too short');
  });
});
