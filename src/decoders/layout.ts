/**
 * AccountReader — zero-dependency DataView-based binary reader for Solana account data.
 *
 * Provides typed reading primitives (u8, u16, u32, u64, i64, f64, pubkey, bool)
 * with automatic offset tracking and little-endian byte order (Solana standard).
 *
 * @module decoders/layout
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { AccountReader } from '@oobe-protocol-labs/synapse-client-sdk/decoders';
 *
 * const reader = new AccountReader(rawBytes);
 * const mint   = reader.pubkey();
 * const owner  = reader.pubkey();
 * const amount = reader.u64();
 * ```
 */

import { Pubkey } from '../core/types';

// ── Minimal base58 encoder (self-contained, no deps) ──────────

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode a Uint8Array to a base58 string.
 *
 * Used internally for converting 32-byte pubkey buffers to base58.
 * Self-contained — no external dependencies.
 *
 * @param bytes - Raw byte array to encode.
 * @returns Base58-encoded string.
 * @since 1.1.0
 */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const size = ((bytes.length - zeros) * 138 / 100 + 1) >>> 0;
  const b58 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 256 * b58[k];
      b58[k] = carry % 58;
      carry = (carry / 58) >>> 0;
    }
    length = j;
  }

  let idx = size - length;
  while (idx < size && b58[idx] === 0) idx++;

  let str = '1'.repeat(zeros);
  for (; idx < size; idx++) str += B58_ALPHABET[b58[idx]];
  return str;
}

// ── AccountReader ──────────────────────────────────────────────

/**
 * Zero-allocation binary reader for Solana account data.
 *
 * Reads little-endian integers, pubkeys, booleans, and COption fields
 * from a Uint8Array with automatic offset tracking. All reads advance
 * the internal cursor.
 *
 * @since 1.1.0
 */
export class AccountReader {
  private offset = 0;
  private readonly view: DataView;
  private readonly bytes: Uint8Array;

  constructor(data: Uint8Array) {
    this.bytes = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /** Current read position. @since 1.1.0 */
  get position(): number { return this.offset; }

  /** Total data length. @since 1.1.0 */
  get length(): number { return this.bytes.byteLength; }

  /** Remaining bytes after current position. @since 1.1.0 */
  get remaining(): number { return this.bytes.byteLength - this.offset; }

  /** Read an unsigned 8-bit integer. @since 1.1.0 */
  u8(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  /** Read an unsigned 16-bit integer (little-endian). @since 1.1.0 */
  u16(): number {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  /** Read an unsigned 32-bit integer (little-endian). @since 1.1.0 */
  u32(): number {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  /** Read an unsigned 64-bit integer (little-endian). @since 1.1.0 */
  u64(): bigint {
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }

  /** Read a signed 64-bit integer (little-endian). @since 1.1.0 */
  i64(): bigint {
    const v = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return v;
  }

  /** Read a 64-bit float (little-endian). @since 1.1.0 */
  f64(): number {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  /** Read a boolean (1 byte, 0 = false, non-zero = true). @since 1.1.0 */
  bool(): boolean {
    return this.u8() !== 0;
  }

  /**
   * Read a 32-byte Solana public key and return as branded {@link Pubkey}.
   * @since 1.1.0
   */
  pubkey(): Pubkey {
    const slice = this.bytes.slice(this.offset, this.offset + 32);
    this.offset += 32;
    return Pubkey(encodeBase58(slice));
  }

  /**
   * Read a 32-byte hash and return as base58 string.
   * @since 1.1.0
   */
  hash(): string {
    const slice = this.bytes.slice(this.offset, this.offset + 32);
    this.offset += 32;
    return encodeBase58(slice);
  }

  /**
   * Read a raw byte slice of the given length.
   * @since 1.1.0
   */
  slice(length: number): Uint8Array {
    const s = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return s;
  }

  /**
   * Read a Solana COption — 4-byte discriminator (0 = None, 1 = Some)
   * followed by the inner value.
   *
   * **Important:** The reader function is ALWAYS called to advance the
   * offset past the fixed-size data region (C ABI: data is always present,
   * only the tag indicates validity).
   *
   * @param reader - Function to read the inner value.
   * @returns The inner value or `null` if tag is 0 (None).
   * @since 1.1.0
   */
  coption<T>(reader: () => T): T | null {
    const tag = this.u32();
    const value = reader(); // Always read to advance offset past fixed-size data
    return tag === 0 ? null : value;
  }

  /**
   * Skip N bytes without reading.
   * @since 1.1.0
   */
  skip(n: number): void {
    this.offset += n;
  }

  /**
   * Seek to an absolute offset.
   * @since 1.1.0
   */
  seek(offset: number): void {
    this.offset = offset;
  }
}
