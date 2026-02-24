/**
 * SDK utility helpers — minimal, zero-dependency.
 */
import type { Pubkey, Lamports } from '../core/types';
import { Pubkey as mkPubkey, Lamports as mkLamports } from '../core/types';

/** Convert lamports to SOL (9 decimals) */
export const lamportsToSol = (lamports: Lamports | bigint): number =>
  Number(lamports) / 1e9;

/** Convert SOL to lamports */
export const solToLamports = (sol: number): Lamports =>
  mkLamports(Math.round(sol * 1e9));

/** Validate a base58-encoded Solana public key (32 bytes → 32-44 chars) */
export const isValidPubkey = (s: string): s is Pubkey =>
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/** Validate a transaction signature (64 bytes → 87-88 base58 chars) */
export const isValidSignature = (s: string): boolean =>
  /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(s);

/** Sleep utility */
export const sleep = (ms: number): Promise<void> =>
  new Promise(r => setTimeout(r, ms));

/** Chunk an array for batch operations */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size) as T[]);
  }
  return result;
}

/** Retry with exponential backoff */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }
  throw lastErr;
}
