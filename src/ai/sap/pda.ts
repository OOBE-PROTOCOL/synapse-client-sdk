/**
 * @module ai/sap/pda
 * @description SAP — PDA derivation, account serialization & deserialization.
 *
 * Provides Solana Program Derived Address (PDA) computation for agent
 * identity accounts, plus Borsh-compatible binary serialization for
 * reading and writing on-chain agent data.
 *
 * PDA seeds: `["synapse_agent", <wallet_pubkey_32_bytes>]`
 *
 * @example
 * ```ts
 * import { deriveAgentPDA, deserializeAgentAccount } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const { address, bump } = deriveAgentPDA(walletPubkey, programId);
 * const account = deserializeAgentAccount(address, rawBytes);
 * ```
 *
 * @since 1.3.0
 */

import { createHash, createPublicKey } from 'crypto';
import type { AgentPDAAccount, AgentCapability, AgentPricingOnChain, AgentReputationOnChain } from './types';
import { SAP_SEED_PREFIX, SAP_ACCOUNT_DISCRIMINATOR } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Base58 codec (minimal, zero-dependency)
 * ═══════════════════════════════════════════════════════════════ */

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * @description Decode a base58-encoded string to raw bytes.
 * @param {string} str - Base58-encoded string
 * @returns {Uint8Array} Decoded bytes
 * @since 1.3.0
 */
export function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of str) {
    let carry = B58_ALPHABET.indexOf(char);
    if (carry < 0) throw new Error(`Invalid base58 character: '${char}'`);
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const c of str) {
    if (c !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * @description Encode raw bytes to a base58 string.
 * @param {Uint8Array} bytes - Raw bytes
 * @returns {string} Base58-encoded string
 * @since 1.3.0
 */
export function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (const b of bytes) {
    if (b !== 0) break;
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += B58_ALPHABET[digits[i]];
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════
 *  Ed25519 on-curve check (via Node.js crypto)
 * ═══════════════════════════════════════════════════════════════ */

/** @internal DER SPKI prefix for ed25519 public keys (12 bytes). */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * @description Check whether a 32-byte hash lies on the ed25519 curve.
 * Uses Node.js `crypto.createPublicKey` to attempt point decompression.
 *
 * @param {Uint8Array} point - 32-byte candidate
 * @returns {boolean} `true` if the point is a valid ed25519 public key (on curve)
 * @since 1.3.0
 */
export function isOnCurve(point: Uint8Array): boolean {
  try {
    createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(point)]),
      format: 'der',
      type: 'spki',
    });
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  PDA Derivation
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Result of a PDA derivation.
 * @since 1.3.0
 */
export interface DerivedPDA {
  /** PDA address (base58). */
  address: string;
  /** Bump seed used (255 → 0). */
  bump: number;
  /** Raw 32-byte PDA address. */
  bytes: Uint8Array;
}

/**
 * @description Derive the agent PDA address for a given wallet public key.
 *
 * Algorithm (Solana `findProgramAddress`):
 * 1. For bump = 255 → 0:
 *    - candidate = SHA-256(seed_prefix + wallet_bytes + [bump] + program_id + "ProgramDerivedAddress")
 *    - If candidate is NOT on the ed25519 curve → return (candidate, bump)
 *
 * @param {string} walletPubkey - Agent's wallet pubkey (base58)
 * @param {string} programId - SAP program ID (base58)
 * @returns {DerivedPDA} The derived PDA address and bump seed
 * @throws {Error} If no valid PDA can be found (theoretically impossible)
 *
 * @example
 * ```ts
 * const pda = deriveAgentPDA('7xKX...wallet', 'SAPAgnt1...');
 * console.log(pda.address); // base58 PDA address
 * console.log(pda.bump);    // 254
 * ```
 *
 * @since 1.3.0
 */
export function deriveAgentPDA(walletPubkey: string, programId: string): DerivedPDA {
  const seedPrefix = Buffer.from(SAP_SEED_PREFIX, 'utf-8');
  const walletBytes = base58Decode(walletPubkey);
  const programBytes = base58Decode(programId);
  const suffix = Buffer.from('ProgramDerivedAddress', 'utf-8');

  for (let bump = 255; bump >= 0; bump--) {
    const hash = createHash('sha256')
      .update(seedPrefix)
      .update(walletBytes)
      .update(Uint8Array.from([bump]))
      .update(programBytes)
      .update(suffix)
      .digest();

    const candidate = new Uint8Array(hash);

    if (!isOnCurve(candidate)) {
      return {
        address: base58Encode(candidate),
        bump,
        bytes: candidate,
      };
    }
  }

  throw new Error('Could not derive PDA — no valid bump seed found');
}

/* ═══════════════════════════════════════════════════════════════
 *  Borsh-compatible binary helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Minimal Borsh-compatible binary reader for deserializing
 * agent PDA account data from the Solana blockchain.
 * @since 1.3.0
 */
export class BorshReader {
  private offset = 0;

  /**
   * @param {Buffer | Uint8Array} data - Raw account data bytes
   */
  constructor(private readonly data: Buffer | Uint8Array) {}

  /** Current read position. */
  get position(): number { return this.offset; }

  /** Remaining unread bytes. */
  get remaining(): number { return this.data.length - this.offset; }

  /**
   * @description Read a single unsigned byte.
   * @returns {number} u8 value
   */
  readU8(): number {
    const val = this.data[this.offset];
    this.offset += 1;
    return val;
  }

  /**
   * @description Read a 32-bit unsigned integer (little-endian).
   * @returns {number} u32 value
   */
  readU32(): number {
    const val =
      this.data[this.offset] |
      (this.data[this.offset + 1] << 8) |
      (this.data[this.offset + 2] << 16) |
      (this.data[this.offset + 3] << 24);
    this.offset += 4;
    return val >>> 0;
  }

  /**
   * @description Read a 64-bit signed integer (little-endian) as bigint.
   * @returns {bigint} i64 value
   */
  readI64(): bigint {
    const lo = BigInt(this.readU32());
    const hi = BigInt(this.readU32());
    return (hi << 32n) | lo;
  }

  /**
   * @description Read a 64-bit unsigned integer (little-endian) as bigint.
   * @returns {bigint} u64 value
   */
  readU64(): bigint {
    const lo = BigInt(this.readU32());
    const hi = BigInt(this.readU32());
    return (hi << 32n) | lo;
  }

  /**
   * @description Read a fixed-length byte array.
   * @param {number} len - Number of bytes to read
   * @returns {Uint8Array} Raw bytes
   */
  readBytes(len: number): Uint8Array {
    const slice = this.data.slice(this.offset, this.offset + len);
    this.offset += len;
    return new Uint8Array(slice);
  }

  /**
   * @description Read a Borsh-encoded string (u32 length prefix + UTF-8 bytes).
   * @returns {string} Decoded string
   */
  readString(): string {
    const len = this.readU32();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }

  /**
   * @description Read an optional value (1 byte flag + value if present).
   * @param {() => T} readFn - Reader function for the inner value
   * @returns {T | undefined}
   */
  readOption<T>(readFn: () => T): T | undefined {
    const flag = this.readU8();
    return flag === 1 ? readFn() : undefined;
  }

  /**
   * @description Read a Borsh-encoded Vec (u32 length prefix + elements).
   * @param {() => T} readFn - Reader function for each element
   * @returns {T[]} Array of decoded elements
   */
  readVec<T>(readFn: () => T): T[] {
    const len = this.readU32();
    const items: T[] = [];
    for (let i = 0; i < len; i++) items.push(readFn());
    return items;
  }
}

/**
 * @description Minimal Borsh-compatible binary writer for serializing
 * instruction data to send to the SAP program.
 * @since 1.3.0
 */
export class BorshWriter {
  private buf: number[] = [];

  /** Get the serialized bytes. */
  toBytes(): Uint8Array {
    return new Uint8Array(this.buf);
  }

  /** @description Write a single unsigned byte. */
  writeU8(val: number): this {
    this.buf.push(val & 0xff);
    return this;
  }

  /** @description Write a 32-bit unsigned integer (little-endian). */
  writeU32(val: number): this {
    this.buf.push(val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff);
    return this;
  }

  /** @description Write a 64-bit signed integer (little-endian) as bigint. */
  writeI64(val: bigint): this {
    const lo = Number(val & 0xffffffffn);
    const hi = Number((val >> 32n) & 0xffffffffn);
    this.writeU32(lo);
    this.writeU32(hi);
    return this;
  }

  /** @description Write a 64-bit unsigned integer (little-endian) as bigint. */
  writeU64(val: bigint): this {
    return this.writeI64(val);
  }

  /** @description Write raw bytes. */
  writeBytes(bytes: Uint8Array): this {
    for (const b of bytes) this.buf.push(b);
    return this;
  }

  /** @description Write a Borsh-encoded string (u32 length + UTF-8 bytes). */
  writeString(str: string): this {
    const bytes = new TextEncoder().encode(str);
    this.writeU32(bytes.length);
    this.writeBytes(bytes);
    return this;
  }

  /** @description Write an optional value (1-byte flag + value). */
  writeOption<T>(val: T | undefined, writeFn: (v: T) => void): this {
    if (val !== undefined) {
      this.writeU8(1);
      writeFn(val);
    } else {
      this.writeU8(0);
    }
    return this;
  }

  /** @description Write a Borsh-encoded Vec (u32 length + elements). */
  writeVec<T>(items: T[], writeFn: (v: T) => void): this {
    this.writeU32(items.length);
    for (const item of items) writeFn(item);
    return this;
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Account Deserialization
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Deserialize raw account bytes into an {@link AgentPDAAccount}.
 *
 * @param {string} address - PDA address (base58)
 * @param {Buffer | Uint8Array} data - Raw account data from `getAccountInfo`
 * @returns {AgentPDAAccount} Fully deserialized agent account
 * @throws {Error} If discriminator doesn't match or data is malformed
 *
 * @example
 * ```ts
 * const raw = await transport.request('getAccountInfo', [pdaAddress, { encoding: 'base64' }]);
 * const decoded = Buffer.from(raw.value.data[0], 'base64');
 * const agent = deserializeAgentAccount(pdaAddress, decoded);
 * ```
 *
 * @since 1.3.0
 */
export function deserializeAgentAccount(address: string, data: Buffer | Uint8Array): AgentPDAAccount {
  const reader = new BorshReader(data);

  // Discriminator (8 bytes)
  const disc = reader.readBytes(8);
  for (let i = 0; i < 8; i++) {
    if (disc[i] !== SAP_ACCOUNT_DISCRIMINATOR[i]) {
      throw new Error(`Invalid SAP account discriminator at address ${address}`);
    }
  }

  // Fixed fields
  const version = reader.readU8();
  const isActive = reader.readU8() === 1;
  const walletBytes = reader.readBytes(32);
  const walletPubkey = base58Encode(walletBytes);
  const createdAt = Number(reader.readI64());
  const updatedAt = Number(reader.readI64());
  const totalCallsServed = reader.readU64();
  const avgLatencyMs = reader.readU32();
  const uptimePercent = reader.readU8();

  // Variable-length fields
  const name = reader.readString();
  const description = reader.readString();
  const agentId = reader.readOption(() => reader.readString());

  // Capabilities
  const capabilities = reader.readVec((): AgentCapability => ({
    id: reader.readString(),
    description: reader.readOption(() => reader.readString()),
    protocol: reader.readOption(() => reader.readString()),
  }));

  // Pricing (v1.4 micropayment layout)
  const pricing = reader.readVec((): AgentPricingOnChain => {
    const tierId = reader.readString();
    const pricePerCall = reader.readU64();
    const rateLimit = reader.readU32();
    const maxCallsPerSession = reader.readU32();
    const tokenType = (['SOL', 'USDC', 'SPL'] as const)[reader.readU8()];
    const tokenMint = reader.readOption(() => reader.readString());

    // v1.4 extended fields (backward-compatible via Option encoding)
    const minPricePerCall = reader.readOption(() => reader.readU64());
    const maxPricePerCall = reader.readOption(() => reader.readU64());
    const volumeCurve = reader.readOption(() =>
      reader.readVec(() => ({
        afterCalls: reader.readU32(),
        pricePerCall: reader.readU64(),
      })),
    );
    const burstLimit = reader.readOption(() => reader.readU32());
    const settlementMode = reader.readOption(() =>
      (['instant', 'escrow', 'batched', 'x402'] as const)[reader.readU8()],
    );
    const minEscrowDeposit = reader.readOption(() => reader.readU64());
    const batchIntervalSec = reader.readOption(() => reader.readU32());
    const tokenDecimals = reader.readOption(() => reader.readU8());

    return {
      tierId,
      pricePerCall,
      minPricePerCall: minPricePerCall ?? undefined,
      maxPricePerCall: maxPricePerCall ?? undefined,
      volumeCurve: volumeCurve ?? undefined,
      rateLimit,
      maxCallsPerSession,
      burstLimit: burstLimit ?? undefined,
      tokenType,
      tokenMint,
      tokenDecimals: tokenDecimals ?? undefined,
      settlementMode: settlementMode ?? undefined,
      minEscrowDeposit: minEscrowDeposit ?? undefined,
      batchIntervalSec: batchIntervalSec ?? undefined,
    };
  });

  // x402 endpoint
  const x402Endpoint = reader.readOption(() => reader.readString());

  // Reputation score (stored after variable data)
  const score = reader.remaining >= 4 ? reader.readU32() : 500;

  return {
    address,
    version,
    isActive,
    walletPubkey,
    name,
    description,
    agentId,
    capabilities,
    pricing,
    reputation: {
      totalCallsServed,
      avgLatencyMs,
      uptimePercent,
      score,
      lastUpdatedAt: updatedAt,
    },
    x402Endpoint,
    createdAt,
    updatedAt,
  };
}

/**
 * @description Serialize agent data into instruction data for the `register` instruction.
 * Does NOT include the instruction discriminator — that is prepended by
 * {@link SAPInstructionBuilder}.
 *
 * @param {RegisterAgentParams} params - Registration parameters
 * @returns {Uint8Array} Borsh-serialized instruction data (without discriminator)
 *
 * @since 1.3.0
 */
export function serializeRegisterData(params: import('./types').RegisterAgentParams): Uint8Array {
  const w = new BorshWriter();

  w.writeString(params.name);
  w.writeString(params.description);
  w.writeOption(params.agentId, (v) => w.writeString(v));

  // Capabilities
  w.writeVec(params.capabilities ?? [], (cap) => {
    w.writeString(cap.id);
    w.writeOption(cap.description, (v) => w.writeString(v));
    w.writeOption(cap.protocol, (v) => w.writeString(v));
  });

  // Pricing (v1.4 micropayment layout)
  w.writeVec(params.pricing ?? [], (p) => {
    w.writeString(p.tierId);
    w.writeU64(p.pricePerCall);
    w.writeU32(p.rateLimit);
    w.writeU32(p.maxCallsPerSession);
    w.writeU8(['SOL', 'USDC', 'SPL'].indexOf(p.tokenType));
    w.writeOption(p.tokenMint, (v) => w.writeString(v));

    // v1.4 extended fields
    w.writeOption(p.minPricePerCall, (v) => w.writeU64(v));
    w.writeOption(p.maxPricePerCall, (v) => w.writeU64(v));
    w.writeOption(p.volumeCurve, (curve) => {
      w.writeVec(curve, (bp) => {
        w.writeU32(bp.afterCalls);
        w.writeU64(bp.pricePerCall);
      });
    });
    w.writeOption(p.burstLimit, (v) => w.writeU32(v));
    w.writeOption(p.settlementMode, (v) =>
      w.writeU8(['instant', 'escrow', 'batched', 'x402'].indexOf(v)),
    );
    w.writeOption(p.minEscrowDeposit, (v) => w.writeU64(v));
    w.writeOption(p.batchIntervalSec, (v) => w.writeU32(v));
    w.writeOption(p.tokenDecimals, (v) => w.writeU8(v));
  });

  // x402 endpoint
  w.writeOption(params.x402Endpoint, (v) => w.writeString(v));

  return w.toBytes();
}

/**
 * @description Serialize update data for the `update` instruction.
 * Uses Option encoding for each field — `None` means "don't change".
 *
 * @param {UpdateAgentParams} params - Fields to update
 * @returns {Uint8Array} Borsh-serialized instruction data (without discriminator)
 *
 * @since 1.4.0
 */
export function serializeUpdateData(params: import('./types').UpdateAgentParams): Uint8Array {
  const w = new BorshWriter();

  w.writeOption(params.name, (v) => w.writeString(v));
  w.writeOption(params.description, (v) => w.writeString(v));
  w.writeOption(params.isActive, (v) => w.writeU8(v ? 1 : 0));

  // Capabilities (Option<Vec>)
  w.writeOption(params.capabilities, (caps) => {
    w.writeVec(caps, (cap) => {
      w.writeString(cap.id);
      w.writeOption(cap.description, (v) => w.writeString(v));
      w.writeOption(cap.protocol, (v) => w.writeString(v));
    });
  });

  // Pricing (Option<Vec>) — v1.4 micropayment layout
  w.writeOption(params.pricing, (tiers) => {
    w.writeVec(tiers, (p) => {
      w.writeString(p.tierId);
      w.writeU64(p.pricePerCall);
      w.writeU32(p.rateLimit);
      w.writeU32(p.maxCallsPerSession);
      w.writeU8(['SOL', 'USDC', 'SPL'].indexOf(p.tokenType));
      w.writeOption(p.tokenMint, (v) => w.writeString(v));

      // v1.4 extended fields
      w.writeOption(p.minPricePerCall, (v) => w.writeU64(v));
      w.writeOption(p.maxPricePerCall, (v) => w.writeU64(v));
      w.writeOption(p.volumeCurve, (curve) => {
        w.writeVec(curve, (bp) => {
          w.writeU32(bp.afterCalls);
          w.writeU64(bp.pricePerCall);
        });
      });
      w.writeOption(p.burstLimit, (v) => w.writeU32(v));
      w.writeOption(p.settlementMode, (v) =>
        w.writeU8(['instant', 'escrow', 'batched', 'x402'].indexOf(v)),
      );
      w.writeOption(p.minEscrowDeposit, (v) => w.writeU64(v));
      w.writeOption(p.batchIntervalSec, (v) => w.writeU32(v));
      w.writeOption(p.tokenDecimals, (v) => w.writeU8(v));
    });
  });

  w.writeOption(params.x402Endpoint, (v) => w.writeString(v));

  return w.toBytes();
}
