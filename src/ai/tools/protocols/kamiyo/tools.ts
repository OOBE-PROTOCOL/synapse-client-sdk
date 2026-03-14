/**
 * @module ai/tools/protocols/kamiyo/tools
 * @description KAMIYO Protocol — LangChain tool factory for the OOBE partner integration.
 * @since 2.0.6
 */
import {
  ProtocolHttpClient,
  buildProtocolTools,
  type ProtocolClientConfig,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { kamiyoMethods } from './schemas';

/**
 * @description Default KAMIYO partner API base URL.
 * @since 2.0.6
 */
export const KAMIYO_API_URL = 'https://api.kamiyo.ai/api/partners/oobe';

/**
 * @description KAMIYO-specific configuration for tool creation.
 * @since 2.0.6
 */
export interface KamiyoToolsConfig {
  /** KAMIYO partner API base URL. */
  apiUrl?: string;
  /** Bearer token used to access the partner routes. */
  bearerToken?: string;
  /** Request timeout in ms. */
  timeout?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Override global fetch — useful for tests or non-standard runtimes. */
  fetch?: typeof globalThis.fetch;
}

function createKamiyoExecutor(http: ProtocolHttpClient) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const path = method.path ?? `/${method.name}`;
    const verb = method.httpMethod ?? 'GET';

    if (verb === 'POST') {
      return http.post(path, input);
    }

    return http.get(path, input);
  };
}

/**
 * @description Create LangChain-compatible tools for the KAMIYO OOBE partner surface.
 *
 * These tools call the phase-1 partner HTTP routes:
 * - `/x402/pricing`
 * - `/x402/fetch`
 * - `/escrows`
 * - `/escrows/status`
 *
 * @since 2.0.6
 */
export function createKamiyoTools(
  config: KamiyoToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const {
    apiUrl = KAMIYO_API_URL,
    bearerToken,
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
    apiKey: bearerToken,
  };

  const http = new ProtocolHttpClient(httpConfig);
  const execute = createKamiyoExecutor(http);

  return buildProtocolTools(kamiyoMethods, execute, {
    defaultPrefix: 'kamiyo_',
    httpClient: http,
    ...toolOpts,
  });
}

export { kamiyoMethods, kamiyoMethodNames } from './schemas';
