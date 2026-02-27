/**
 * @module ai/lazy
 * @description Lazy-loaded protocol tool factories for Next.js / webpack environments.
 *
 * These factories use dynamic `import()` so that Zod schemas, `ProtocolHttpClient`,
 * and all 22+ tool definitions are **not** bundled at static-analysis time.
 * This prevents webpack/turbopack issues with Next.js static page generation.
 *
 * Each factory is a singleton: the first call performs the dynamic import,
 * subsequent calls return the cached toolkit instantly.
 *
 * @example
 * ```ts
 * // In a Next.js API route or server action:
 * import { getJupiterTools } from '@oobe-protocol-labs/synapse-client-sdk/ai/lazy';
 *
 * export async function POST(req: Request) {
 *   const jup = await getJupiterTools({ apiKey: process.env.JUP_KEY });
 *   const quote = await jup.toolMap.getQuote.invoke({ ... });
 *   return Response.json(JSON.parse(quote));
 * }
 * ```
 *
 * @since 1.0.6
 */

import type { ProtocolToolkit } from './tools/protocols/shared';

/* ── Jupiter ────────────────────────────────────────────────── */

let _jupiterCache: ProtocolToolkit | null = null;
let _jupiterConfigHash = '';

/**
 * Lazily initialise Jupiter tools on first call.
 * Subsequent calls with the same config return the cached toolkit.
 *
 * @param config - Same options as `createJupiterTools()`
 */
export async function getJupiterTools(
  config: Record<string, unknown> = {},
): Promise<ProtocolToolkit> {
  const hash = JSON.stringify(config);
  if (_jupiterCache && _jupiterConfigHash === hash) return _jupiterCache;
  const { createJupiterTools } = await import('./tools/protocols/jupiter');
  _jupiterCache = createJupiterTools(config as any);
  _jupiterConfigHash = hash;
  return _jupiterCache;
}

/* ── Raydium ────────────────────────────────────────────────── */

let _raydiumCache: ProtocolToolkit | null = null;
let _raydiumConfigHash = '';

/**
 * Lazily initialise Raydium tools on first call.
 *
 * @param config - Same options as `createRaydiumTools()`
 */
export async function getRaydiumTools(
  config: Record<string, unknown> = {},
): Promise<ProtocolToolkit> {
  const hash = JSON.stringify(config);
  if (_raydiumCache && _raydiumConfigHash === hash) return _raydiumCache;
  const { createRaydiumTools } = await import('./tools/protocols/raydium');
  _raydiumCache = createRaydiumTools(config as any);
  _raydiumConfigHash = hash;
  return _raydiumCache;
}
