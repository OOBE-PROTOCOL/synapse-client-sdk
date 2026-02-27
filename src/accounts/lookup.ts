/**
 * High-level Address Lookup Table fetcher.
 *
 * @module accounts/lookup
 * @since 1.1.0
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment } from '../core/types';
import { decodeLookupTable } from '../decoders/lookup-table';
import type { DecodedLookupTable } from '../decoders/lookup-table';
import { getDecodedAccount } from './helpers';
import type { DecodedAccountResult } from './helpers';

/**
 * Fetch and decode an Address Lookup Table account.
 *
 * @param transport - HTTP transport.
 * @param pubkey - Lookup table account public key.
 * @param opts - RPC options.
 * @returns Decoded lookup table, or `null` if not found.
 *
 * @example
 * ```ts
 * const lut = await fetchLookupTable(transport, lutPubkey);
 * if (lut) console.log(`Contains ${lut.decoded.addresses.length} addresses`);
 * ```
 *
 * @since 1.1.0
 */
export async function fetchLookupTable(
  transport: HttpTransport,
  pubkey: Pubkey,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<DecodedAccountResult<DecodedLookupTable> | null> {
  return getDecodedAccount(transport, pubkey, decodeLookupTable, opts);
}
