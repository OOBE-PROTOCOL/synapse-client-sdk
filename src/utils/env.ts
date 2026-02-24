/**
 * Runtime environment detection — browser vs. server.
 *
 * Provides a lightweight, deterministic check used across the SDK to
 * branch behaviour (e.g. WebSocket adapter, gRPC guard). Follows the
 * same pattern as Helius SDK (`typeof window !== 'undefined'`).
 *
 * @module utils/env
 * @since 1.0.2
 */

/** Detected runtime environment. */
export type RuntimeEnv = 'browser' | 'server';

/**
 * Detect the current runtime environment.
 *
 * - `'browser'` — Standard browser, Web Worker, React Native, Cloudflare Workers,
 *    Deno Deploy, Vercel Edge, Next.js Client Component.
 * - `'server'` — Node.js, Bun, or any runtime where `globalThis.window` is absent.
 *
 * @returns `'browser'` or `'server'`.
 * @since 1.0.2
 *
 * @example
 * ```ts
 * import { getEnvironment } from '@oobe-protocol-labs/synapse-client-sdk/utils';
 * if (getEnvironment() === 'browser') {
 *   // safe to use native WebSocket
 * }
 * ```
 */
export const getEnvironment = (): RuntimeEnv =>
  typeof window !== 'undefined' ? 'browser' : 'server';

/**
 * Returns `true` when running in a browser-like environment.
 * @since 1.0.2
 */
export const isBrowser = (): boolean => getEnvironment() === 'browser';

/**
 * Returns `true` when running in a server-side (Node.js / Bun) environment.
 * @since 1.0.2
 */
export const isServer = (): boolean => getEnvironment() === 'server';

/**
 * SDK user-agent string with environment tag.
 *
 * @example `synapse-client-sdk/1.0.1 (browser)` or `synapse-client-sdk/1.0.1 (server)`
 * @since 1.0.2
 */
export const SDK_USER_AGENT = `synapse-client-sdk/1.0.1 (${getEnvironment()})`;
