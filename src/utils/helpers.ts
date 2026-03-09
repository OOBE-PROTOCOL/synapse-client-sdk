/**
 * SDK utility helpers — minimal, zero-dependency.
 *
 * Pure functions for common Solana value conversions, validation,
 * async control flow, BigInt serialization, and HMR-safe singletons.
 *
 * @module utils/helpers
 * @since 1.0.0
 */
import type { Pubkey, Lamports } from '../core/types';
import { Lamports as mkLamports } from '../core/types';

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

/* ═══════════════════════════════════════════════════════════════
 *  BigInt-safe JSON serialization
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Recursively convert `BigInt` values to `string` so the result is
 * safe for `JSON.stringify()`.
 *
 * Useful in Next.js API Routes, Express handlers, or anywhere you
 * need to serialize gateway / x402 objects that contain `BigInt`
 * fields like `pricePerCall`, `maxBudget`, or `amountCharged`.
 *
 * @param obj - Any value (object, array, primitive, BigInt).
 * @returns A deep clone with every `BigInt` replaced by its string
 *          representation.
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { toJsonSafe } from '@oobe-protocol-labs/synapse-client-sdk/utils';
 *
 * return NextResponse.json(toJsonSafe({ budget: 100_000n, data }));
 * ```
 */
export function toJsonSafe(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString();
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toJsonSafe);
  if (obj instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of obj) out[String(k)] = toJsonSafe(v);
    return out;
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return obj;
}

/**
 * `JSON.stringify` replacer that converts `BigInt` → `string`.
 *
 * @example
 * ```ts
 * import { bigIntReplacer } from '@oobe-protocol-labs/synapse-client-sdk/utils';
 *
 * const json = JSON.stringify(data, bigIntReplacer);
 * ```
 *
 * @since 1.2.2
 */
export function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

/* ═══════════════════════════════════════════════════════════════
 *  HMR-safe singleton (Next.js / Vite / Webpack dev mode)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Options for {@link createSingleton}.
 * @since 1.2.2
 */
export interface SingletonOptions {
  /**
   * Bump this number to invalidate a cached instance (e.g. after
   * changing the factory config). The old instance is replaced on
   * the next call.
   */
  version?: number;
}

// Shared registry on globalThis — survives HMR reloads.
const _singletonRegistry: Record<string, unknown> =
  ((globalThis as Record<string, unknown>).__synapse_singletons as Record<string, unknown>) ??= {};

/**
 * Create an HMR-safe singleton accessor.
 *
 * In Next.js (and other HMR-enabled environments) module scope is
 * re-evaluated on every hot reload, destroying any `let` / `const`
 * singleton. This helper stores the instance on `globalThis` so it
 * survives reloads.
 *
 * @typeParam T - Type of the singleton instance.
 * @param key     - Unique global key (e.g. `'synapseClient'`).
 * @param factory - Function that creates the instance.
 * @param options - Optional version for cache invalidation.
 * @returns A zero-arg getter that returns the singleton.
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { createSingleton } from '@oobe-protocol-labs/synapse-client-sdk/utils';
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * export const getSynapseClient = createSingleton('synapseClient', () =>
 *   SynapseClient.fromEndpoint({ network: 'mainnet', region: 'US', apiKey: process.env.SYNAPSE_API_KEY! }),
 * );
 *
 * // With version invalidation — bump to recreate:
 * export const getGateway = createSingleton('agentGateway', () =>
 *   createAgentGateway(getSynapseClient(), config),
 *   { version: 4 },
 * );
 * ```
 */
export function createSingleton<T>(
  key: string,
  factory: () => T,
  options?: SingletonOptions,
): () => T {
  const versionKey = `${key}__v`;
  return () => {
    const versionMismatch =
      options?.version != null && _singletonRegistry[versionKey] !== options.version;
    if (!_singletonRegistry[key] || versionMismatch) {
      _singletonRegistry[key] = factory();
      if (options?.version != null) {
        _singletonRegistry[versionKey] = options.version;
      }
    }
    return _singletonRegistry[key] as T;
  };
}
