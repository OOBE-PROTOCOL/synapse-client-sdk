/**
 * High-level typed nonce account fetcher.
 *
 * @module accounts/nonce
 * @since 1.1.0
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment } from '../core/types';
import { decodeNonceAccount } from '../decoders/nonce';
import type { DecodedNonceAccount } from '../decoders/nonce';
import { getDecodedAccount } from './helpers';
import type { DecodedAccountResult } from './helpers';

/**
 * Fetch and decode a Solana nonce account.
 *
 * @param transport - HTTP transport.
 * @param pubkey - Nonce account public key.
 * @param opts - RPC options.
 * @returns Decoded nonce account, or `null` if not found.
 *
 * @example
 * ```ts
 * const nonce = await fetchNonceAccount(transport, noncePubkey);
 * if (nonce) console.log(`Blockhash: ${nonce.decoded.blockhash}`);
 * ```
 *
 * @since 1.1.0
 */
export async function fetchNonceAccount(
  transport: HttpTransport,
  pubkey: Pubkey,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<DecodedAccountResult<DecodedNonceAccount> | null> {
  return getDecodedAccount(transport, pubkey, decodeNonceAccount, opts);
}
