/**
 * Shared types for Solana native instruction encoders.
 *
 * Provides the low-level building blocks ({@link AccountMeta},
 * {@link TransactionInstruction}, {@link InstructionWriter}) used by
 * every program encoder in this module.
 *
 * These types mirror the Solana runtime ABI and are fully compatible with
 * `@solana/kit`'s `IInstruction` interface, so they can be appended to a
 * Kit `TransactionMessage` without any conversion.
 *
 * @module programs/types
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { InstructionWriter } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 *
 * const w = new InstructionWriter(12); // 12-byte data buffer
 * w.u32(2);         // instruction discriminator
 * w.u64(1_000_000_000n); // lamports
 * const data = w.toBytes();
 * ```
 */

import type { Pubkey } from '../core/types';

// ── Account Meta ───────────────────────────────────────────────

/**
 * Describes a single account input for a Solana instruction.
 *
 * @since 1.1.0
 */
export interface AccountMeta {
  /** Account public key (base58). */
  pubkey: Pubkey;
  /** Must the account sign the transaction? */
  isSigner: boolean;
  /** Will the instruction modify this account's data or lamports? */
  isWritable: boolean;
}

// ── Transaction Instruction ────────────────────────────────────

/**
 * A fully encoded Solana transaction instruction.
 *
 * This is the SDK-native representation. Use `toKitInstruction()` from
 * the `programs` module to convert to a `@solana/kit` `IInstruction`.
 *
 * @since 1.1.0
 */
export interface TransactionInstruction {
  /** Program that will process this instruction. */
  programId: Pubkey;
  /** Ordered list of account inputs. */
  keys: AccountMeta[];
  /** Serialised instruction data (Borsh / custom binary). */
  data: Uint8Array;
}

// ── Instruction Writer ─────────────────────────────────────────

/**
 * Zero-allocation binary writer for instruction data.
 *
 * Little-endian, offset-tracking — the write-side counterpart of
 * {@link AccountReader} from the `decoders` module.
 *
 * @since 1.1.0
 */
export class InstructionWriter {
  private offset = 0;
  private readonly view: DataView;
  private readonly bytes: Uint8Array;

  /**
   * @param size - Exact byte length of the instruction data buffer.
   */
  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  /** Current write position. @since 1.1.0 */
  get position(): number { return this.offset; }

  /** Write an unsigned 8-bit integer. @since 1.1.0 */
  u8(val: number): this {
    this.view.setUint8(this.offset, val);
    this.offset += 1;
    return this;
  }

  /** Write an unsigned 16-bit integer (little-endian). @since 1.1.0 */
  u16(val: number): this {
    this.view.setUint16(this.offset, val, true);
    this.offset += 2;
    return this;
  }

  /** Write an unsigned 32-bit integer (little-endian). @since 1.1.0 */
  u32(val: number): this {
    this.view.setUint32(this.offset, val, true);
    this.offset += 4;
    return this;
  }

  /** Write an unsigned 64-bit integer (little-endian). @since 1.1.0 */
  u64(val: bigint): this {
    this.view.setBigUint64(this.offset, val, true);
    this.offset += 8;
    return this;
  }

  /** Write a signed 64-bit integer (little-endian). @since 1.1.0 */
  i64(val: bigint): this {
    this.view.setBigInt64(this.offset, val, true);
    this.offset += 8;
    return this;
  }

  /**
   * Write a 32-byte public key from base58 into the buffer.
   *
   * **Note:** For instruction data that embeds raw pubkeys (rare — most
   * programs reference accounts via the `keys` array). Uses the SDK's
   * built-in base58 decoder.
   *
   * @since 1.1.0
   */
  pubkey(key: Pubkey): this {
    const decoded = decodeBase58(key as unknown as string);
    this.bytes.set(decoded, this.offset);
    this.offset += 32;
    return this;
  }

  /** Write raw bytes. @since 1.1.0 */
  raw(data: Uint8Array): this {
    this.bytes.set(data, this.offset);
    this.offset += data.length;
    return this;
  }

  /** Return the completed instruction data buffer. @since 1.1.0 */
  toBytes(): Uint8Array {
    return this.bytes;
  }
}

// ── Base58 decoder (self-contained) ────────────────────────────

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Uint8Array(128).fill(255);
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP[B58_ALPHABET.charCodeAt(i)] = i;

/**
 * Decode a base58 string to bytes. Self-contained, zero-dep.
 * @internal
 */
export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;

  const size = ((str.length - zeros) * 733 / 1000 + 1) >>> 0;
  const b256 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < str.length; i++) {
    let carry = B58_MAP[str.charCodeAt(i)];
    if (carry === 255) throw new Error(`Invalid base58 character: ${str[i]}`);
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 58 * b256[k];
      b256[k] = carry % 256;
      carry = (carry / 256) >>> 0;
    }
    length = j;
  }

  let idx = size - length;
  const result = new Uint8Array(zeros + length);
  // Leading zeros are already 0 in the result
  for (let i = 0; idx < size; i++, idx++) result[zeros + i] = b256[idx];
  return result;
}

// ── Helper constructors ────────────────────────────────────────

/** Create a writable, signer account meta. @since 1.1.0 */
export function writableSigner(pubkey: Pubkey): AccountMeta {
  return { pubkey, isSigner: true, isWritable: true };
}

/** Create a writable, non-signer account meta. @since 1.1.0 */
export function writable(pubkey: Pubkey): AccountMeta {
  return { pubkey, isSigner: false, isWritable: true };
}

/** Create a read-only, signer account meta. @since 1.1.0 */
export function readonlySigner(pubkey: Pubkey): AccountMeta {
  return { pubkey, isSigner: true, isWritable: false };
}

/** Create a read-only, non-signer account meta. @since 1.1.0 */
export function readonly(pubkey: Pubkey): AccountMeta {
  return { pubkey, isSigner: false, isWritable: false };
}
