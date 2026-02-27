/**
 * Typed account fetchers with built-in decoding.
 *
 * Provides high-level methods that fetch raw account data via RPC
 * and return fully decoded, typed objects. This is the "batteries-included"
 * layer that eliminates manual base64 decoding and byte layout parsing.
 *
 * @module accounts
 * @since 1.1.0
 *
 * @example
 * ```ts
 * const client = new SynapseClient({ endpoint: '...' });
 *
 * // One call, fully decoded:
 * const mint = await client.accounts.fetchMint(mintPubkey);
 * console.log(`Supply: ${mint.decoded.supply}, Decimals: ${mint.decoded.decimals}`);
 *
 * const acct = await client.accounts.fetchTokenAccount(tokenPubkey);
 * console.log(`Balance: ${acct.decoded.amount}`);
 * ```
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment } from '../core/types';
import { fetchTokenAccount, fetchMint, fetchTokenAccountsByOwner } from './token';
import { fetchStakeAccount } from './stake';
import { fetchNonceAccount } from './nonce';
import { fetchLookupTable } from './lookup';
import { getDecodedAccount, getDecodedAccounts } from './helpers';

// ── Re-export individual fetchers for tree-shaking ─────────────
export { fetchTokenAccount, fetchMint, fetchTokenAccountsByOwner } from './token';
export { fetchStakeAccount } from './stake';
export { fetchNonceAccount } from './nonce';
export { fetchLookupTable } from './lookup';
export { getDecodedAccount, getDecodedAccounts, base64ToBytes } from './helpers';
export type { DecodedAccountResult } from './helpers';
export type { FetchedTokenAccount, FetchedMint } from './token';

/** Options for account fetch methods. @since 1.1.0 */
export type AccountFetchOpts = { commitment?: Commitment } & CallOptions;

/**
 * High-level accounts client with decoded fetch methods.
 *
 * Exposed as `client.accounts` on {@link SynapseClient}. Each method
 * fetches raw data, base64-decodes it, and runs the appropriate native
 * decoder — returning a fully typed object.
 *
 * @since 1.1.0
 */
export class AccountsClient {
  constructor(private readonly transport: HttpTransport) {}

  // ── Token ────────────────────────────────────────────────────

  /**
   * Fetch and decode a single SPL Token account.
   * Auto-detects Token vs Token-2022 and includes extensions.
   * @since 1.1.0
   */
  fetchTokenAccount(pubkey: Pubkey, opts?: AccountFetchOpts) {
    return fetchTokenAccount(this.transport, pubkey, opts);
  }

  /**
   * Fetch and decode a token mint.
   * Auto-detects Token vs Token-2022 and includes extensions.
   * @since 1.1.0
   */
  fetchMint(pubkey: Pubkey, opts?: AccountFetchOpts) {
    return fetchMint(this.transport, pubkey, opts);
  }

  /**
   * Fetch all token accounts owned by a wallet, optionally filtered by mint.
   * @since 1.1.0
   */
  fetchTokenAccountsByOwner(owner: Pubkey, mint?: Pubkey, opts?: AccountFetchOpts & { programId?: Pubkey }) {
    return fetchTokenAccountsByOwner(this.transport, owner, mint, opts);
  }

  // ── Stake ────────────────────────────────────────────────────

  /**
   * Fetch and decode a stake account.
   * @since 1.1.0
   */
  fetchStakeAccount(pubkey: Pubkey, opts?: AccountFetchOpts) {
    return fetchStakeAccount(this.transport, pubkey, opts);
  }

  // ── Nonce ────────────────────────────────────────────────────

  /**
   * Fetch and decode a durable nonce account.
   * @since 1.1.0
   */
  fetchNonceAccount(pubkey: Pubkey, opts?: AccountFetchOpts) {
    return fetchNonceAccount(this.transport, pubkey, opts);
  }

  // ── Lookup Table ─────────────────────────────────────────────

  /**
   * Fetch and decode an Address Lookup Table.
   * @since 1.1.0
   */
  fetchLookupTable(pubkey: Pubkey, opts?: AccountFetchOpts) {
    return fetchLookupTable(this.transport, pubkey, opts);
  }

  // ── Generic ──────────────────────────────────────────────────

  /**
   * Fetch any account and decode it with a custom decoder function.
   *
   * @typeParam T - The decoded type.
   * @param pubkey - Account public key.
   * @param decoder - Custom decoder function `(data: Uint8Array) => T`.
   * @param opts - RPC options.
   * @returns Decoded result or null.
   * @since 1.1.0
   */
  fetchDecoded<T>(pubkey: Pubkey, decoder: (data: Uint8Array) => T, opts?: AccountFetchOpts) {
    return getDecodedAccount(this.transport, pubkey, decoder, opts);
  }

  /**
   * Fetch multiple accounts and decode them with a custom decoder (single RPC call).
   *
   * @typeParam T - The decoded type.
   * @param pubkeys - Account public keys.
   * @param decoder - Custom decoder function.
   * @param opts - RPC options.
   * @returns Array of decoded results (null for non-existent).
   * @since 1.1.0
   */
  fetchDecodedBatch<T>(pubkeys: Pubkey[], decoder: (data: Uint8Array) => T, opts?: AccountFetchOpts) {
    return getDecodedAccounts(this.transport, pubkeys, decoder, opts);
  }
}
