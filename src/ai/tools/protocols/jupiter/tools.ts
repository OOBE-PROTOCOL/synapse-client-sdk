/**
 * @module ai/tools/protocols/jupiter/tools
 * @description Jupiter Protocol — LangChain tool factory.
 *
 * Creates 21 executable tools bound to the Jupiter REST API:
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

/**
 * @description Jupiter public API base URL.
 * @since 1.0.0
 */
export const JUPITER_API_URL = 'https://api.jup.ag';

/**
 * @description Jupiter-specific configuration for tool creation.
 * @since 1.0.0
 */
export interface JupiterToolsConfig {
  /** Jupiter API base URL (default: https://api.jup.ag). */
  apiUrl?: string;
  /**
   * Jupiter Token API base URL.
   * Defaults to `apiUrl` (i.e. `https://api.jup.ag`).
   *
   * Token endpoints are served under `/tokens/v2/...` on this base URL.
   * Override this if Jupiter moves the token API to a different host.
   *
   * @since 1.0.7
   */
  tokensApiUrl?: string;
  /** Jupiter API key — sent via `x-api-key` header (optional, for higher rate limits). */
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
 *  Handles special cases:
 *   - getTokenList: served from tokensApiUrl /tokens/v2/tag?query=...
 *   - getTokenInfo: served from tokensApiUrl /tokens/v2/search?query=...
 * ═══════════════════════════════════════════════════════════════ */

function createJupiterExecutor(http: ProtocolHttpClient, tokensHttp: ProtocolHttpClient) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const verb = method.httpMethod ?? 'GET';
    const path = method.path ?? `/${method.name}`;

    // ── getTokenList: route to tokensApiUrl /tokens/v2/tag ────
    if (method.name === 'getTokenList') {
      return tokensHttp.get(path, input);
    }

    // ── getTokenInfo: route to tokensApiUrl /tokens/v2/search ─
    if (method.name === 'getTokenInfo') {
      return tokensHttp.get(path, input);
    }

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
 * @description Create LangChain-compatible tools for Jupiter Protocol.
 *
 * @param {JupiterToolsConfig & CreateProtocolToolsOpts} [config={}] - Jupiter API config and tool options
 * @returns {ProtocolToolkit} Toolkit with 21 Jupiter tools
 *
 * @example
 * ```ts
 * const jupiter = createJupiterTools({ apiKey: 'my-jupiter-key' });
 * const agent = createAgent({ tools: jupiter.tools });
 *
 * // Cherry-pick a specific tool:
 * const quoteTool = jupiter.toolMap.getQuote;
 * ```
 *
 * @since 1.0.0
 */
export function createJupiterTools(
  config: JupiterToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const {
    apiUrl = JUPITER_API_URL,
    tokensApiUrl,
    apiKey,
    timeout,
    headers,
    fetch: fetchFn,
    ...toolOpts
  } = config;

  // Main API client (api.jup.ag) — uses x-api-key header
  const httpConfig: ProtocolClientConfig = {
    baseUrl: apiUrl,
    apiKey,
    apiKeyHeader: 'x-api-key',
    timeout,
    headers,
    fetch: fetchFn,
  };

  // Token API client — defaults to same base URL as main API
  // (tokens.jup.ag is deprecated; tokens are now at api.jup.ag/tokens/v2/...)
  const tokensHttpConfig: ProtocolClientConfig = {
    baseUrl: tokensApiUrl ?? apiUrl,
    apiKey,
    apiKeyHeader: 'x-api-key',
    timeout,
    headers,
    fetch: fetchFn,
  };

  const http = new ProtocolHttpClient(httpConfig);
  const tokensHttp = new ProtocolHttpClient(tokensHttpConfig);
  const execute = createJupiterExecutor(http, tokensHttp);

  return buildProtocolTools(jupiterMethods, execute, {
    defaultPrefix: 'jupiter_',
    httpClient: http,
    ...toolOpts,
  });
}

/** Re-export schemas for direct access. */
export { jupiterMethods, jupiterMethodNames } from './schemas';
