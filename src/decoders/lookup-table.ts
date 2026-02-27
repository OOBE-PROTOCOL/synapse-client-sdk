/**
 * Address Lookup Table decoder.
 *
 * Decodes v0 transaction lookup table accounts used for compressing
 * transaction address lists.
 *
 * @module decoders/lookup-table
 * @since 1.1.0
 */

import type { Pubkey } from '../core/types';
import { Pubkey as mkPubkey } from '../core/types';
import { AccountReader, encodeBase58 } from './layout';

// ── Decoded type ───────────────────────────────────────────────

/**
 * Decoded Address Lookup Table account.
 *
 * @example
 * ```ts
 * const lut = decodeLookupTable(rawBytes);
 * console.log(`Addresses: ${lut.addresses.length}, Active: ${!lut.isDeactivated}`);
 * ```
 * @since 1.1.0
 */
export interface DecodedLookupTable {
  /** Discriminator (always 1 for lookup tables). */
  discriminator: number;
  /** Slot at which deactivation was requested. `MAX_U64` if still active. */
  deactivationSlot: bigint;
  /** Last slot during which the table was extended. */
  lastExtendedSlot: bigint;
  /** Start index within the last extension batch. */
  lastExtendedSlotStartIndex: number;
  /** Authority that can extend/close the table. `null` if frozen. */
  authority: Pubkey | null;
  /** List of addresses stored in the table. */
  addresses: Pubkey[];
  /** Whether the table has been deactivated. */
  isDeactivated: boolean;
}

// ── Constants ──────────────────────────────────────────────────

/** Address Lookup Table Program ID. @since 1.1.0 */
export const LOOKUP_TABLE_PROGRAM_ID = 'AddressLookupTab1e1111111111111111111111111';

/** Header size of a lookup table account. @since 1.1.0 */
export const LOOKUP_TABLE_HEADER_SIZE = 56;

/** Sentinel value for "no deactivation scheduled". @since 1.1.0 */
const MAX_U64 = 0xFFFFFFFFFFFFFFFFn;

// ── Decoder ────────────────────────────────────────────────────

/**
 * Decode an Address Lookup Table account from raw bytes.
 *
 * Layout:
 * - [0..4]   u32     — discriminator (always 1)
 * - [4..12]  u64     — deactivation slot (MAX_U64 = active)
 * - [12..20] u64     — last extended slot
 * - [20]     u8      — last extended slot start index
 * - [21]     u8      — has authority (0 or 1)
 * - [22..24] [u8;2]  — padding
 * - [24..56] [u8;32] — authority (meaningful only if has_authority=1)
 * - [56..]   [Pubkey] — addresses (32 bytes each)
 *
 * @param data - Raw account data (must be >= 56 bytes).
 * @returns Decoded lookup table.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeLookupTable(data: Uint8Array): DecodedLookupTable {
  if (data.length < LOOKUP_TABLE_HEADER_SIZE) {
    throw new Error(
      `Lookup table data too short: expected >= ${LOOKUP_TABLE_HEADER_SIZE} bytes, got ${data.length}`,
    );
  }

  const r = new AccountReader(data);

  const discriminator = r.u32();                       // [0..4]
  const deactivationSlot = r.u64();                    // [4..12]
  const lastExtendedSlot = r.u64();                    // [12..20]
  const lastExtendedSlotStartIndex = r.u8();           // [20]
  const hasAuthority = r.u8();                         // [21]
  r.skip(2);                                           // [22..24] padding
  const authorityPubkey = r.pubkey();                  // [24..56]

  const authority = hasAuthority === 1 ? authorityPubkey : null;
  const isDeactivated = deactivationSlot !== MAX_U64;

  // Parse addresses (remaining data, 32 bytes each)
  const addressesData = data.slice(LOOKUP_TABLE_HEADER_SIZE);
  const numAddresses = Math.floor(addressesData.length / 32);
  const addresses: Pubkey[] = [];

  for (let i = 0; i < numAddresses; i++) {
    const offset = i * 32;
    const addrBytes = addressesData.slice(offset, offset + 32);
    addresses.push(mkPubkey(encodeBase58(addrBytes)));
  }

  return {
    discriminator,
    deactivationSlot,
    lastExtendedSlot,
    lastExtendedSlotStartIndex,
    authority,
    addresses,
    isDeactivated,
  };
}
