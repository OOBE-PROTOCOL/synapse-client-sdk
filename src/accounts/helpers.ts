/**
 * Generic decoded account fetcher utilities.
 *
 * Provides a reusable pattern for fetching raw account data via RPC
 * and decoding it with a typed decoder function.
 *
 * @module accounts/helpers
 * @since 1.1.0
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment, Slot } from '../core/types';

// ── Internal RPC response shapes ───────────────────────────────

/** @internal Mirrors RpcContext shape from transport response. */
interface RpcContextResponse<T> {
  context: { slot: number };
  value: T;
}

/** @internal Minimal account info from base64-encoded RPC response. */
interface RawAccountInfo {
  data: [string, string] | string;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch: number;
  space: number;
}

// ── Public types ───────────────────────────────────────────────

/**
 * Result of a decoded account fetch.
 *
 * @typeParam T - The decoded account type.
 * @since 1.1.0
 */
export interface DecodedAccountResult<T> {
  /** Decoded account data. */
  decoded: T;
  /** Raw account info as returned by the RPC (base64 encoding). */
  raw: RawAccountInfo;
  /** Slot at which the data was fetched. */
  slot: number;
}

// ── Base64 decoding ────────────────────────────────────────────

/**
 * Base64-decode a Solana RPC account data field.
 *
 * The RPC returns account data as `[base64String, "base64"]` when
 * `encoding: "base64"` is used.
 *
 * @param data - The raw data field from getAccountInfo.
 * @returns Decoded Uint8Array.
 * @since 1.1.0
 */
export function base64ToBytes(data: [string, string] | string | unknown): Uint8Array {
  let b64: string;
  if (Array.isArray(data) && typeof data[0] === 'string') {
    b64 = data[0];
  } else if (typeof data === 'string') {
    b64 = data;
  } else {
    throw new Error('Unexpected account data format: expected [base64, "base64"] or string');
  }

  // Node.js Buffer path (fast)
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  // Browser / edge path
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Core fetcher ───────────────────────────────────────────────

/**
 * Fetch a raw account and decode its data using the provided decoder.
 *
 * This is the core building block for all typed account fetchers.
 * It handles the RPC call, base64 decoding, and applies the decoder.
 *
 * @typeParam T - The decoded account type.
 * @param transport - HTTP transport for RPC calls.
 * @param pubkey - Account public key to fetch.
 * @param decoder - Function that decodes raw bytes into type T.
 * @param opts - RPC options (commitment, call overrides).
 * @returns Decoded result, or `null` if the account doesn't exist.
 *
 * @example
 * ```ts
 * import { getDecodedAccount } from '@oobe-protocol-labs/synapse-client-sdk/accounts';
 * import { decodeTokenAccount } from '@oobe-protocol-labs/synapse-client-sdk/decoders';
 *
 * const result = await getDecodedAccount(transport, pubkey, decodeTokenAccount);
 * if (result) console.log(`Amount: ${result.decoded.amount}`);
 * ```
 *
 * @since 1.1.0
 */
export async function getDecodedAccount<T>(
  transport: HttpTransport,
  pubkey: Pubkey,
  decoder: (data: Uint8Array) => T,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<DecodedAccountResult<T> | null> {
  const { commitment, ...callOpts } = opts;
  const cfg: Record<string, unknown> = { encoding: 'base64' };
  if (commitment) cfg.commitment = commitment;

  const result = await transport.request<RpcContextResponse<RawAccountInfo | null>>(
    'getAccountInfo',
    [pubkey, cfg],
    callOpts,
  );

  if (!result.value) return null;

  const bytes = base64ToBytes(result.value.data);
  const decoded = decoder(bytes);

  return {
    decoded,
    raw: result.value,
    slot: result.context.slot,
  };
}

/**
 * Fetch multiple accounts and decode them in batch (single RPC call).
 *
 * @typeParam T - The decoded account type.
 * @param transport - HTTP transport for RPC calls.
 * @param pubkeys - Account public keys to fetch.
 * @param decoder - Function that decodes raw bytes into type T.
 * @param opts - RPC options.
 * @returns Array of decoded results (null entries for non-existent accounts).
 * @since 1.1.0
 */
export async function getDecodedAccounts<T>(
  transport: HttpTransport,
  pubkeys: Pubkey[],
  decoder: (data: Uint8Array) => T,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<(DecodedAccountResult<T> | null)[]> {
  const { commitment, ...callOpts } = opts;
  const cfg: Record<string, unknown> = { encoding: 'base64' };
  if (commitment) cfg.commitment = commitment;

  const result = await transport.request<RpcContextResponse<(RawAccountInfo | null)[]>>(
    'getMultipleAccounts',
    [pubkeys, cfg],
    callOpts,
  );

  return result.value.map((acct) => {
    if (!acct) return null;
    const bytes = base64ToBytes(acct.data);
    return {
      decoded: decoder(bytes),
      raw: acct,
      slot: result.context.slot,
    };
  });
}
