/**
 * @module ai/tools/protocols/raydium/tools
 * @description Raydium Protocol — LangChain tool factory.
 *
 * Creates 16 executable tools bound to the Raydium REST API v3:
 * ```ts
 * const raydium = createRaydiumTools();
 * agent.tools.push(...raydium.tools);
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
import { raydiumMethods } from './schemas';

/* ═══════════════════════════════════════════════════════════════
 *  Default configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Raydium public API v3 base URL.
 * @since 1.0.0
 */
export const RAYDIUM_API_URL = 'https://api-v3.raydium.io';

/**
 * @description Raydium-specific configuration for tool creation.
 * @since 1.0.0
 */
export interface RaydiumToolsConfig {
  /** Raydium API base URL (default: https://api-v3.raydium.io). */
  apiUrl?: string;
  /** Request timeout in ms (default: 30 000). */
  timeout?: number;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Override global fetch. */
  fetch?: typeof globalThis.fetch;
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher
 *
 *  Raydium API v3 uses query params with specific key conventions.
 *  Array params are joined by comma (e.g. ids=a,b,c).
 * ═══════════════════════════════════════════════════════════════ */

function createRaydiumExecutor(http: ProtocolHttpClient) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const path = method.path ?? `/${method.name}`;

    // Raydium wraps all responses in { id, success, data } or { id, success, msg }
    const raw = await http.get<{ success: boolean; data?: unknown; msg?: string }>(path, input);

    // Unwrap the Raydium envelope
    if (raw && typeof raw === 'object' && 'success' in raw) {
      if (!raw.success) {
        throw new Error(`Raydium API error: ${raw.msg ?? 'Unknown error'}`);
      }
      return raw.data;
    }

    return raw;
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createRaydiumTools()
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create LangChain-compatible tools for Raydium Protocol.
 *
 * @param {RaydiumToolsConfig & CreateProtocolToolsOpts} [config={}] - Raydium API config and tool options
 * @returns {ProtocolToolkit} Toolkit with 16 Raydium tools
 *
 * @example
 * ```ts
 * const raydium = createRaydiumTools();
 * const poolTool = raydium.toolMap.getPoolsByTokenMint;
 * ```
 *
 * @since 1.0.0
 */
export function createRaydiumTools(
  config: RaydiumToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const {
    apiUrl = RAYDIUM_API_URL,
    timeout,
    headers,
    fetch: fetchFn,
    ...toolOpts
  } = config;

  const httpConfig: ProtocolClientConfig = {
    baseUrl: apiUrl,
    timeout,
    headers,
    fetch: fetchFn,
  };

  const http = new ProtocolHttpClient(httpConfig);
  const execute = createRaydiumExecutor(http);

  return buildProtocolTools(raydiumMethods, execute, {
    defaultPrefix: 'raydium_',
    httpClient: http,
    ...toolOpts,
  });
}

/** Re-export schemas for direct access. */
export { raydiumMethods, raydiumMethodNames } from './schemas';
