/**
 * @module ai/tools/protocols/jupiter/tools
 * @description Jupiter Protocol — LangChain tool factory.
 *
 * Creates 22 executable tools bound to the Jupiter REST API:
 * ```ts
 * const jupiter = createJupiterTools({ apiKey: '...' });
 * agent.tools.push(...jupiter.tools);
 * ```
 *
 * @since 1.0.0
 */
import {
  ProtocolHttpClient,
  buildProtocolTools,
  type ProtocolClientConfig,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { jupiterMethods } from './schemas';

/* ═══════════════════════════════════════════════════════════════
 *  Default configuration
 * ═══════════════════════════════════════════════════════════════ */

/** Jupiter public API base URL. */
export const JUPITER_API_URL = 'https://api.jup.ag';

/** Jupiter-specific configuration. */
export interface JupiterToolsConfig {
  /** Jupiter API base URL (default: https://api.jup.ag). */
  apiUrl?: string;
  /** API key / bearer token (optional, for higher rate limits). */
  apiKey?: string;
  /** Request timeout in ms (default: 30 000). */
  timeout?: number;
  /** Extra headers (e.g. origin). */
  headers?: Record<string, string>;
  /** Override global fetch — useful for tests or polyfills. */
  fetch?: typeof globalThis.fetch;
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher
 *
 *  Routes each ProtocolMethod to the correct HTTP call based on
 *  the `httpMethod` and `path` stored in the schema registration.
 * ═══════════════════════════════════════════════════════════════ */

function createJupiterExecutor(http: ProtocolHttpClient) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const verb = method.httpMethod ?? 'GET';
    const path = method.path ?? `/${method.name}`;

    if (verb === 'POST') {
      return http.post(path, input);
    }

    // GET — all input fields become query params
    return http.get(path, input);
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createJupiterTools()
 *
 *  Public factory — the single entry-point for consumers.
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Create LangChain-compatible tools for Jupiter Protocol.
 *
 * @example
 * ```ts
 * const jupiter = createJupiterTools();
 * const agent = createAgent({ tools: jupiter.tools });
 *
 * // Cherry-pick a specific tool:
 * const quoteTool = jupiter.toolMap.getQuote;
 * ```
 */
export function createJupiterTools(
  config: JupiterToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const {
    apiUrl = JUPITER_API_URL,
    apiKey,
    timeout,
    headers,
    fetch: fetchFn,
    ...toolOpts
  } = config;

  const httpConfig: ProtocolClientConfig = {
    baseUrl: apiUrl,
    apiKey,
    timeout,
    headers,
    fetch: fetchFn,
  };

  const http = new ProtocolHttpClient(httpConfig);
  const execute = createJupiterExecutor(http);

  return buildProtocolTools(jupiterMethods, execute, {
    defaultPrefix: 'jupiter_',
    ...toolOpts,
  });
}

/** Re-export schemas for direct access. */
export { jupiterMethods, jupiterMethodNames } from './schemas';
