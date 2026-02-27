/**
 * High-level typed token account fetchers.
 *
 * Wraps RPC calls + decoders to provide a one-call API for fetching
 * decoded SPL Token accounts and mints.
 *
 * @module accounts/token
 * @since 1.1.0
 */

import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey, Commitment } from '../core/types';
import { Pubkey as mkPubkey } from '../core/types';
import { decodeTokenAccount, decodeMint, TOKEN_PROGRAM_ID } from '../decoders/token';
import { decodeToken2022Account, decodeToken2022Mint, TOKEN_2022_PROGRAM_ID } from '../decoders/token-2022';
import type { DecodedTokenAccount, DecodedMint } from '../decoders/token';
import type { DecodedToken2022Account, DecodedToken2022Mint } from '../decoders/token-2022';
import { getDecodedAccount, base64ToBytes } from './helpers';
import type { DecodedAccountResult } from './helpers';

// ── Result types ───────────────────────────────────────────────

/**
 * Fetched token account with owner program metadata.
 * @since 1.1.0
 */
export interface FetchedTokenAccount extends DecodedAccountResult<DecodedTokenAccount> {
  /** The token program that owns this account ('token' or 'token-2022'). */
  program: 'token' | 'token-2022';
  /** Account public key. */
  address: Pubkey;
}

/**
 * Fetched mint with owner program metadata.
 * @since 1.1.0
 */
export interface FetchedMint extends DecodedAccountResult<DecodedMint> {
  /** The token program that owns this mint ('token' or 'token-2022'). */
  program: 'token' | 'token-2022';
  /** Mint public key. */
  address: Pubkey;
}

// ── Fetchers ───────────────────────────────────────────────────

/**
 * Fetch and decode a single SPL Token account.
 *
 * Automatically detects Token vs Token-2022 from the on-chain owner
 * and applies the appropriate decoder (including extensions for 2022).
 *
 * @param transport - HTTP transport.
 * @param pubkey - Token account public key.
 * @param opts - RPC options.
 * @returns Decoded token account, or `null` if not found.
 *
 * @example
 * ```ts
 * const acct = await fetchTokenAccount(transport, tokenAccountPubkey);
 * if (acct) console.log(`Balance: ${acct.decoded.amount}, Mint: ${acct.decoded.mint}`);
 * ```
 *
 * @since 1.1.0
 */
export async function fetchTokenAccount(
  transport: HttpTransport,
  pubkey: Pubkey,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<FetchedTokenAccount | null> {
  const result = await getDecodedAccount(transport, pubkey, decodeTokenAccount, opts);
  if (!result) return null;

  const owner = String(result.raw.owner);
  const program: 'token' | 'token-2022' = owner === TOKEN_2022_PROGRAM_ID ? 'token-2022' : 'token';

  // Re-decode with Token-2022 decoder to capture extensions
  if (program === 'token-2022') {
    const bytes = base64ToBytes(result.raw.data);
    const decoded = decodeToken2022Account(bytes);
    return { decoded, raw: result.raw, slot: result.slot, program, address: pubkey };
  }

  return { decoded: result.decoded, raw: result.raw, slot: result.slot, program, address: pubkey };
}

/**
 * Fetch and decode a token mint.
 *
 * Automatically detects Token vs Token-2022 and applies the appropriate decoder.
 *
 * @param transport - HTTP transport.
 * @param pubkey - Mint public key.
 * @param opts - RPC options.
 * @returns Decoded mint, or `null` if not found.
 *
 * @example
 * ```ts
 * const mint = await fetchMint(transport, mintPubkey);
 * if (mint) console.log(`Supply: ${mint.decoded.supply}, Decimals: ${mint.decoded.decimals}`);
 * ```
 *
 * @since 1.1.0
 */
export async function fetchMint(
  transport: HttpTransport,
  pubkey: Pubkey,
  opts: { commitment?: Commitment } & CallOptions = {},
): Promise<FetchedMint | null> {
  const result = await getDecodedAccount(transport, pubkey, decodeMint, opts);
  if (!result) return null;

  const owner = String(result.raw.owner);
  const program: 'token' | 'token-2022' = owner === TOKEN_2022_PROGRAM_ID ? 'token-2022' : 'token';

  if (program === 'token-2022') {
    const bytes = base64ToBytes(result.raw.data);
    const decoded = decodeToken2022Mint(bytes);
    return { decoded, raw: result.raw, slot: result.slot, program, address: pubkey };
  }

  return { decoded: result.decoded, raw: result.raw, slot: result.slot, program, address: pubkey };
}

/**
 * Fetch all token accounts owned by a wallet, optionally filtered by mint.
 *
 * @param transport - HTTP transport.
 * @param owner - Wallet public key.
 * @param mint - Token mint to filter by (optional).
 * @param opts - RPC options. Include `programId` to target Token-2022 specifically.
 * @returns Array of decoded token accounts.
 *
 * @example
 * ```ts
 * const accounts = await fetchTokenAccountsByOwner(transport, walletPubkey, usdcMint);
 * for (const a of accounts) console.log(`${a.address}: ${a.decoded.amount}`);
 * ```
 *
 * @since 1.1.0
 */
export async function fetchTokenAccountsByOwner(
  transport: HttpTransport,
  owner: Pubkey,
  mint?: Pubkey,
  opts: { commitment?: Commitment; programId?: Pubkey } & CallOptions = {},
): Promise<FetchedTokenAccount[]> {
  const { commitment, programId, ...callOpts } = opts;

  const filter = mint
    ? { mint: String(mint) }
    : { programId: String(programId ?? TOKEN_PROGRAM_ID) };

  const cfg: Record<string, unknown> = { encoding: 'base64' };
  if (commitment) cfg.commitment = commitment;

  /** @internal RPC response shape for getTokenAccountsByOwner. */
  interface RpcTokenEntry {
    pubkey: string;
    account: {
      data: [string, string];
      executable: boolean;
      lamports: number;
      owner: string;
      rentEpoch: number;
      space: number;
    };
  }

  const result = await transport.request<{
    context: { slot: number };
    value: RpcTokenEntry[];
  }>(
    'getTokenAccountsByOwner',
    [owner, filter, cfg],
    callOpts,
  );

  return result.value.map((entry) => {
    const bytes = base64ToBytes(entry.account.data);
    const entryOwner = entry.account.owner;
    const program: 'token' | 'token-2022' =
      entryOwner === TOKEN_2022_PROGRAM_ID ? 'token-2022' : 'token';

    const decoded = program === 'token-2022'
      ? decodeToken2022Account(bytes)
      : decodeTokenAccount(bytes);

    return {
      decoded,
      raw: entry.account,
      slot: result.context.slot,
      program,
      address: mkPubkey(entry.pubkey),
    };
  });
}
