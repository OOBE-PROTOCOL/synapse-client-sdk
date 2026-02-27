/**
 * High-level typed stake account fetcher.
 *
 * @module accounts/stake
 * @since 1.1.0
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment } from '../core/types';
import { decodeStakeAccount } from '../decoders/stake';
import type { DecodedStakeAccount } from '../decoders/stake';
import { getDecodedAccount } from './helpers';
import type { DecodedAccountResult } from './helpers';

/**
 * Fetch and decode a Solana stake account.
 *
 * @param transport - HTTP transport.
 * @param pubkey - Stake account public key.
 * @param opts - RPC options.
 * @returns Decoded stake account, or `null` if not found.
 *
 * @example
 * ```ts
 * const stake = await fetchStakeAccount(transport, stakeAccountPubkey);
 * if (stake?.decoded.type === 'delegated') {
 *   console.log(`Delegated to: ${stake.decoded.stake!.voterPubkey}`);
 *   console.log(`Stake amount: ${stake.decoded.stake!.stake} lamports`);
 * }
 * ```
 *
 * @since 1.1.0
 */
export async function fetchStakeAccount(
  transport: HttpTransport,
  pubkey: Pubkey,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<DecodedAccountResult<DecodedStakeAccount> | null> {
  return getDecodedAccount(transport, pubkey, decodeStakeAccount, opts);
}
