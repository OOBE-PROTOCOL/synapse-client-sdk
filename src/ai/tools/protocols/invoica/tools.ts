/**
 * @module ai/tools/protocols/invoica/tools
 * @description Invoica — LangChain tool factory for x402 invoice middleware.
 * @see https://invoica.ai
 * @since 2.1.0
 */
import {
  ProtocolHttpClient,
  buildProtocolTools,
  type ProtocolClientConfig,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { invoicaMethods } from './schemas';

/**
 * @description Default Invoica API base URL.
 * @since 2.1.0
 */
export const INVOICA_API_URL = 'https://api.invoica.ai/v1';

/**
 * @description Invoica-specific configuration for tool creation.
 * @since 2.1.0
 */
export interface InvoicaToolsConfig {
  /** Invoica API base URL. */
  apiUrl?: string;
  /** Invoica API key (x-api-key header). Obtain from https://invoica.ai/dashboard/settings. */
  apiKey?: string;
  /** Request timeout in ms (default 10 000). */
  timeout?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Override global fetch — useful for tests or non-standard runtimes. */
  fetch?: typeof globalThis.fetch;
}

function createInvoicaExecutor(http: ProtocolHttpClient) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    const path = method.path ?? `/${method.name}`;
    const verb = method.httpMethod ?? 'GET';

    // Interpolate path params (e.g. /invoices/:invoiceId → /invoices/abc-123)
    const resolvedPath = path.replace(/:(\w+)/g, (_, key) => {
      const value = input[key];
      if (value === undefined) return `:${key}`;
      // Remove path param from body so it isn't double-sent
      const { [key]: _removed, ...rest } = input;
      input = rest;
      return String(value);
    });

    if (verb === 'POST') {
      return http.post(resolvedPath, input);
    }

    return http.get(resolvedPath, input);
  };
}

/**
 * @description Create LangChain-compatible tools for the Invoica invoice middleware.
 *
 * Provides four tools:
 * - `invoica_createInvoice`     — request payment from a payer agent
 * - `invoica_getInvoice`        — poll invoice status / confirm payment
 * - `invoica_checkSettlement`   — verify on-chain USDC transfer (Base, Polygon, Solana)
 * - `invoica_detectSapSettlement` — detect SAP x402 escrow settlement on Solana
 *
 * @example
 * ```ts
 * const tools = createInvoicaTools({ apiKey: process.env.INVOICA_API_KEY });
 * const agent = await createOpenAIToolsAgent({ tools: tools.tools, ... });
 * ```
 * @since 2.1.0
 */
export function createInvoicaTools(
  config: InvoicaToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const {
    apiUrl = INVOICA_API_URL,
    apiKey,
    timeout = 10_000,
    headers,
    fetch: fetchFn,
    ...toolOpts
  } = config;

  const httpConfig: ProtocolClientConfig = {
    baseUrl: apiUrl,
    timeout,
    headers,
    fetch: fetchFn,
    apiKey,
  };

  const http = new ProtocolHttpClient(httpConfig);
  const execute = createInvoicaExecutor(http);

  return buildProtocolTools(invoicaMethods, execute, {
    defaultPrefix: 'invoica_',
    httpClient: http,
    ...toolOpts,
  });
}

export { invoicaMethods, invoicaMethodNames } from './schemas';
