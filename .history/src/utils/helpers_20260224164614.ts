/**
 * SDK utility helpers — minimal, zero-dependency.
 *
 * Pure functions for common Solana value conversions, validation,
 * and async control flow.
 *
 * @module utils/helpers
 * @since 1.0.0
 */
import type { Pubkey, Lamports } from '../core/types';
import { Pubkey as mkPubkey, Lamports as mkLamports } from '../core/types';

/**
 * Convert lamports to SOL (9 decimal places).
 *
 * @param lamports - Amount in lamports (bigint or branded).
 * @returns Amount in SOL as a floating-point number.
 * @since 1.0.0
 *
 * @example
 * ```ts
 * lamportsToSol(Lamports(1_000_000_000n)); // 1.0
 * ```
 */
export const lamportsToSol = (lamports: Lamports | bigint): number =>
  Number(lamports) / 1e9;

/**
 * Convert SOL to lamports.
 *
 * @param sol - Amount in SOL.
 * @returns Branded {@link Lamports} value.
 * @since 1.0.0
 *
 * @example
 * ```ts
 * solToLamports(1.5); // Lamports(1_500_000_000n)
 * ```
 */
export const solToLamports = (sol: number): Lamports =>
  mkLamports(Math.round(sol * 1e9));

/**
 * Validate a base58-encoded Solana public key.
 *
 * Checks character set and length (32–44 chars for 32-byte keys).
 *
 * @param s - String to validate.
 * @returns `true` if valid, and narrows the type to {@link Pubkey}.
 * @since 1.0.0
 */
export const isValidPubkey = (s: string): s is Pubkey =>
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/**
 * Validate a base58-encoded transaction signature.
 *
 * @param s - String to validate (87–88 base58 chars for 64 bytes).
 * @returns `true` if valid.
 * @since 1.0.0
 */
export const isValidSignature = (s: string): boolean =>
  /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(s);

/**
 * Sleep for a given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 * @returns Promise that resolves after `ms`.
 * @since 1.0.0
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(r => setTimeout(r, ms));

/**
 * Split an array into chunks of a given size.
 *
 * Useful for batching RPC calls.
 *
 * @typeParam T - Array element type.
 * @param arr  - Source array.
 * @param size - Maximum chunk size.
 * @returns Array of sub-arrays, each at most `size` long.
 * @since 1.0.0
 *
 * @example
 * ```ts
 * chunk([1,2,3,4,5], 2); // [[1,2],[3,4],[5]]
 * ```
 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size) as T[]);
  }
  return result;
}

/**
 * Retry a function with exponential backoff.
 *
 * @typeParam T - Return type of the function.
 * @param fn          - Async function to retry.
 * @param maxAttempts - Maximum number of attempts (default `3`).
 * @param baseDelayMs - Base delay between retries in ms (default `500`). Doubles each attempt.
 * @returns The result of the first successful invocation.
 * @throws The last error if all attempts fail.
 * @since 1.0.0
 *
 * @example
 * ```ts
 * const data = await retry(() => fetch('/api'), 5, 1000);
 * ```
 */
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
