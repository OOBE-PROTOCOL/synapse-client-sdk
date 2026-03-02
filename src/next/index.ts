/**
 * @module next
 * @description Synapse Client SDK — Next.js integration helpers.
 *
 * Drop-in utilities for using the Synapse SDK in Next.js 13+ (App Router)
 * with zero boilerplate for the most common patterns:
 *
 * - **`synapseResponse()`** — wraps `NextResponse.json()` with BigInt serialization
 * - **`withSynapseError()`** — API Route error boundary / handler wrapper
 * - **`createSynapseProvider()`** — HMR-safe SynapseClient singleton factory
 * - **`createGatewayProvider()`** — HMR-safe AgentGateway singleton factory
 *
 * All exports are framework-independent at the type level: they work with
 * any object that has `json()` and `status` — so they can be tested outside
 * of a Next.js environment.
 *
 * @example API Route (App Router)
 * ```ts
 * // app/api/balance/route.ts
 * import { synapseResponse, withSynapseError, createSynapseProvider } from '@oobe-protocol-labs/synapse-client-sdk/next';
 * import { Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const getClient = createSynapseProvider({ endpoint: process.env.SYNAPSE_RPC! });
 *
 * export const GET = withSynapseError(async (req) => {
 *   const address = new URL(req.url).searchParams.get('address')!;
 *   const balance = await getClient().rpc.getBalance(Pubkey(address));
 *   return synapseResponse({ balance });
 * });
 * ```
 *
 * @since 1.2.2
 */

import { toJsonSafe } from '../utils/helpers';
import { createSingleton, type SingletonOptions } from '../utils/helpers';
import { SynapseClient, type SynapseClientConfig } from '../core/client';

/* ═══════════════════════════════════════════════════════════════
 *  synapseResponse — BigInt-safe NextResponse.json() replacement
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Options for {@link synapseResponse}.
 * @since 1.2.2
 */
export interface SynapseResponseInit {
  /** HTTP status code (default: 200). */
  status?: number;
  /** Extra headers to include. */
  headers?: Record<string, string>;
}

/**
 * @description Create a JSON `Response` with automatic BigInt serialization.
 *
 * Works with Next.js App Router, edge functions, or any Web-standard
 * `Response` environment.
 *
 * @param data - Any value (may contain `BigInt`).
 * @param init - Optional status code and headers.
 * @returns A `Response` with `Content-Type: application/json`.
 * @since 1.2.2
 *
 * @example
 * ```ts
 * return synapseResponse({ budget: 100_000n, status: 'ok' });
 * // → Response { body: '{"budget":"100000","status":"ok"}', status: 200 }
 * ```
 */
export function synapseResponse(
  data: unknown,
  init: SynapseResponseInit = {},
): Response {
  const safe = toJsonSafe(data);
  const body = JSON.stringify(safe);
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
 *  withSynapseError — API Route error boundary
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Wrap a Next.js API Route handler with error handling.
 *
 * Catches thrown errors and returns a structured JSON error response
 * with the appropriate status code. SDK errors include the error code.
 *
 * @param handler - Async handler function `(req) => Response`
 * @returns Wrapped handler with the same signature
 * @since 1.2.2
 *
 * @example
 * ```ts
 * export const GET = withSynapseError(async (req) => {
 *   // If this throws, caller gets { error: '...', code: '...' } with 500
 *   const data = await client.rpc.getBalance(Pubkey('...'));
 *   return synapseResponse({ data });
 * });
 * ```
 */
export function withSynapseError<T extends Request = Request>(
  handler: (req: T, ...args: unknown[]) => Promise<Response>,
): (req: T, ...args: unknown[]) => Promise<Response> {
  return async (req: T, ...args: unknown[]): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
      const status = (err as { status?: number }).status ?? 500;

      return synapseResponse(
        { error: message, code, timestamp: Date.now() },
        { status },
      );
    }
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createSynapseProvider — HMR-safe client singleton
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create an HMR-safe SynapseClient singleton for Next.js.
 *
 * Uses {@link createSingleton} under the hood to store the instance
 * on `globalThis`, surviving hot-module reloads in development.
 *
 * @param config - SynapseClient configuration
 * @param opts   - Optional singleton options (version for cache busting)
 * @returns A zero-arg getter that returns the singleton client
 * @since 1.2.2
 *
 * @example
 * ```ts
 * // lib/synapse.ts
 * import { createSynapseProvider } from '@oobe-protocol-labs/synapse-client-sdk/next';
 *
 * export const getSynapseClient = createSynapseProvider({
 *   endpoint: process.env.SYNAPSE_RPC!,
 *   apiKey: process.env.SYNAPSE_API_KEY,
 * });
 *
 * // Then in any route/server component:
 * const client = getSynapseClient();
 * ```
 */
export function createSynapseProvider(
  config: SynapseClientConfig,
  opts?: SingletonOptions,
): () => SynapseClient {
  return createSingleton<SynapseClient>(
    '__synapse_client__',
    () => new SynapseClient(config),
    opts,
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  createGatewayProvider — HMR-safe gateway singleton
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create an HMR-safe AgentGateway singleton for Next.js.
 *
 * Lazily imports `AgentGateway` to avoid pulling the full AI module
 * into routes that don't need it.
 *
 * @param clientProvider - A getter that returns the SynapseClient (from {@link createSynapseProvider})
 * @param configFactory  - Function returning the GatewayConfig (evaluated once)
 * @param opts           - Optional singleton options
 * @returns A zero-arg getter that returns the singleton gateway
 * @since 1.2.2
 *
 * @example
 * ```ts
 * import { createSynapseProvider, createGatewayProvider } from '@oobe-protocol-labs/synapse-client-sdk/next';
 * import { AgentId, DEFAULT_TIERS } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const getClient = createSynapseProvider({ endpoint: process.env.SYNAPSE_RPC! });
 *
 * export const getGateway = createGatewayProvider(getClient, () => ({
 *   identity: {
 *     id: AgentId('did:synapse:agent:my-agent'),
 *     name: 'My Agent',
 *     walletPubkey: process.env.AGENT_WALLET!,
 *     createdAt: Date.now(),
 *   },
 *   defaultTiers: DEFAULT_TIERS,
 * }));
 * ```
 */
export function createGatewayProvider(
  clientProvider: () => SynapseClient,
  configFactory: () => import('../ai/gateway/types').GatewayConfig,
  opts?: SingletonOptions,
): () => import('../ai/gateway/index').AgentGateway {
  return createSingleton(
    '__synapse_gateway__',
    () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AgentGateway } = require('../ai/gateway/index') as typeof import('../ai/gateway/index');
      return new AgentGateway(clientProvider(), configFactory());
    },
    opts,
  );
}
