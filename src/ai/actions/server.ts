/**
 * @module ai/actions/server
 * @description Solana Actions Server — framework-agnostic request handler.
 *
 * Registers action definitions and processes incoming HTTP requests
 * according to the Solana Actions specification. Works with any
 * HTTP framework (Express, Hono, Next.js, Bun, raw fetch).
 *
 * @example
 * ```ts
 * import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const server = new ActionServer({
 *   baseUrl: 'https://myagent.xyz',
 * });
 *
 * // Register a Jupiter swap action
 * server.defineAction({
 *   id: 'jupiter-swap',
 *   icon: 'https://myagent.xyz/icon.png',
 *   title: 'Swap Tokens',
 *   description: 'Swap any SPL token via Jupiter aggregator',
 *   label: 'Swap',
 *   parameters: [
 *     { name: 'inputMint', label: 'From Token', required: true },
 *     { name: 'outputMint', label: 'To Token', required: true },
 *     { name: 'amount', label: 'Amount (lamports)', type: 'number', required: true },
 *   ],
 *   handler: async (ctx) => {
 *     // Build swap transaction using Jupiter tools
 *     return { transaction: base64EncodedTx };
 *   },
 * });
 *
 * // Framework-agnostic handler
 * const response = await server.handleRequest(request);
 *
 * // Express middleware
 * app.use('/api/actions', server.toExpressMiddleware());
 *
 * // Fetch handler (Bun, Cloudflare Workers, Deno)
 * export default { fetch: server.toFetchHandler() };
 * ```
 *
 * @since 1.3.0
 */

import type {
  ActionDefinition,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ActionContext,
  ActionsJson,
  ActionsJsonRule,
  ActionServerConfig,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Error
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error class for action server failures.
 * @since 1.3.0
 */
export class ActionServerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ACTION_ERROR',
  ) {
    super(message);
    this.name = 'ActionServerError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  ActionServer
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Framework-agnostic Solana Actions server.
 *
 * Manages action definitions, generates `actions.json`, and processes
 * GET (metadata) / POST (execution) requests.
 *
 * Features:
 * - Multiple action registration
 * - Automatic `actions.json` generation
 * - CORS header management
 * - Parameter validation
 * - x402 payment gating (optional)
 * - Framework adapters (Express, fetch)
 *
 * @since 1.3.0
 */
export class ActionServer {
  private readonly config: Required<ActionServerConfig>;
  private readonly actions: Map<string, ActionDefinition> = new Map();

  /**
   * @param {ActionServerConfig} config - Server configuration
   */
  constructor(config: ActionServerConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      pathPrefix: config.pathPrefix ?? '/api/actions',
      defaultIcon: config.defaultIcon ?? `${config.baseUrl.replace(/\/$/, '')}/icon.png`,
      corsOrigins: config.corsOrigins ?? ['*'],
      extraHeaders: config.extraHeaders ?? {},
    };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Action Registration
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Register an action definition.
   *
   * @param {ActionDefinition} definition - The action to register
   * @returns {ActionServer} `this` for chaining
   * @throws {ActionServerError} If an action with the same ID already exists
   *
   * @example
   * ```ts
   * server.defineAction({
   *   id: 'swap',
   *   title: 'Swap',
   *   // ...
   * }).defineAction({
   *   id: 'stake',
   *   title: 'Stake',
   *   // ...
   * });
   * ```
   *
   * @since 1.3.0
   */
  defineAction(definition: ActionDefinition): this {
    if (this.actions.has(definition.id)) {
      throw new ActionServerError(`Action '${definition.id}' already exists`, 409, 'DUPLICATE_ACTION');
    }
    this.actions.set(definition.id, definition);
    return this;
  }

  /**
   * @description Remove a registered action.
   * @param {string} id - Action ID to remove
   * @returns {boolean} `true` if the action was found and removed
   * @since 1.3.0
   */
  removeAction(id: string): boolean {
    return this.actions.delete(id);
  }

  /**
   * @description Get a registered action by ID.
   * @param {string} id - Action ID
   * @returns {ActionDefinition | undefined} Action definition or undefined
   * @since 1.3.0
   */
  getAction(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  /**
   * @description Get all registered action IDs.
   * @returns {string[]} Array of action IDs
   * @since 1.3.0
   */
  listActions(): string[] {
    return [...this.actions.keys()];
  }

  /* ═══════════════════════════════════════════════════════════
   *  Request Handling
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Handle an incoming HTTP request (framework-agnostic).
   *
   * Routes:
   * - `GET  /actions.json`            → Actions routing metadata
   * - `GET  /<prefix>/<actionId>`     → Action definition (metadata)
   * - `POST /<prefix>/<actionId>`     → Execute action
   * - `OPTIONS *`                     → CORS preflight
   *
   * @param {Request} request - Standard Fetch API Request object
   * @returns {Promise<Response>} Standard Fetch API Response object
   *
   * @example
   * ```ts
   * // Works with any framework that uses standard Request/Response
   * const response = await server.handleRequest(new Request('https://...'));
   * ```
   *
   * @since 1.3.0
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return this.corsResponse(new Response(null, { status: 204 }));
    }

    // actions.json
    if (url.pathname === '/actions.json' || url.pathname === '/.well-known/actions.json') {
      return this.corsResponse(this.jsonResponse(this.getActionsJson()));
    }

    // Parse action ID from path
    const prefix = this.config.pathPrefix;
    if (!url.pathname.startsWith(prefix)) {
      return this.corsResponse(this.jsonResponse({ error: 'Not found' }, 404));
    }

    const actionId = url.pathname.slice(prefix.length).replace(/^\//, '').split('/')[0];
    if (!actionId) {
      return this.corsResponse(this.jsonResponse({ error: 'Action ID required' }, 400));
    }

    const action = this.actions.get(actionId);
    if (!action) {
      return this.corsResponse(this.jsonResponse({ error: `Action '${actionId}' not found` }, 404));
    }

    // GET — return action metadata
    if (method === 'GET') {
      return this.corsResponse(this.jsonResponse(this.buildGetResponse(action)));
    }

    // POST — execute action
    if (method === 'POST') {
      try {
        const body = await request.json() as ActionPostRequest;
        if (!body.account) {
          return this.corsResponse(this.jsonResponse({ error: '"account" is required' }, 400));
        }

        // Extract query params
        const params: Record<string, string> = {};
        for (const [key, value] of url.searchParams.entries()) {
          params[key] = value;
        }

        // Validate required parameters
        if (action.parameters) {
          for (const param of action.parameters) {
            if (param.required !== false && !params[param.name]) {
              return this.corsResponse(
                this.jsonResponse({ error: `Missing required parameter: '${param.name}'` }, 400),
              );
            }
          }
        }

        // Build context
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        const ctx: ActionContext = {
          account: body.account,
          params,
          action,
          headers,
        };

        // Execute handler
        const result = await action.handler(ctx);
        return this.corsResponse(this.jsonResponse(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof ActionServerError ? err.statusCode : 500;
        return this.corsResponse(this.jsonResponse({ error: message }, status));
      }
    }

    return this.corsResponse(this.jsonResponse({ error: 'Method not allowed' }, 405));
  }

  /* ═══════════════════════════════════════════════════════════
   *  actions.json
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Generate the `actions.json` routing metadata.
   *
   * @returns {ActionsJson} Actions routing rules for all registered actions
   *
   * @since 1.3.0
   */
  getActionsJson(): ActionsJson {
    const rules: ActionsJsonRule[] = [];

    for (const [id] of this.actions) {
      rules.push({
        pathPattern: `${this.config.pathPrefix}/${id}/**`,
        apiPath: `${this.config.pathPrefix}/${id}`,
      });
    }

    return { rules };
  }

  /* ═══════════════════════════════════════════════════════════
   *  Framework Adapters
   * ═══════════════════════════════════════════════════════════ */

  /**
   * @description Create an Express/Connect-compatible middleware.
   *
   * @returns {Function} Express middleware `(req, res, next) => void`
   *
   * @example
   * ```ts
   * import express from 'express';
   * const app = express();
   * app.use(server.toExpressMiddleware());
   * ```
   *
   * @since 1.3.0
   */
  toExpressMiddleware(): (req: any, res: any, next: any) => void {
    const server = this;
    return async (req: any, res: any, next: any) => {
      try {
        // Convert Express request to Fetch Request
        const protocol = req.protocol ?? 'https';
        const host = req.get?.('host') ?? req.headers?.host ?? 'localhost';
        const url = `${protocol}://${host}${req.originalUrl ?? req.url}`;
        const headers = new Headers();
        if (req.headers) {
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
          }
        }

        const fetchRequest = new Request(url, {
          method: req.method,
          headers,
          body: req.method !== 'GET' && req.method !== 'HEAD'
            ? JSON.stringify(req.body)
            : undefined,
        });

        const response = await server.handleRequest(fetchRequest);

        // Write response
        res.status(response.status);
        response.headers.forEach((value: string, key: string) => {
          res.set(key, value);
        });

        const body = await response.text();
        res.send(body);
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * @description Create a Fetch API handler (Bun, Deno, Cloudflare Workers).
   *
   * @returns {(request: Request) => Promise<Response>} Fetch handler
   *
   * @example
   * ```ts
   * // Bun
   * export default { fetch: server.toFetchHandler() };
   *
   * // Cloudflare Workers
   * export default { fetch: server.toFetchHandler() };
   * ```
   *
   * @since 1.3.0
   */
  toFetchHandler(): (request: Request) => Promise<Response> {
    return (request: Request) => this.handleRequest(request);
  }

  /* ═══════════════════════════════════════════════════════════
   *  Internal Helpers
   * ═══════════════════════════════════════════════════════════ */

  private buildGetResponse(action: ActionDefinition): ActionGetResponse {
    const response: ActionGetResponse = {
      type: action.type ?? 'action',
      icon: action.icon || this.config.defaultIcon,
      title: action.title,
      description: action.description,
      label: action.label,
    };

    if (action.disabled) {
      response.disabled = true;
      response.error = { message: action.disabledMessage ?? 'Action is currently unavailable' };
    }

    if (action.linkedActions && action.linkedActions.length > 0) {
      response.links = { actions: action.linkedActions };
    } else if (action.parameters && action.parameters.length > 0) {
      // Auto-generate linked action from parameters
      const paramString = action.parameters
        .map(p => `${p.name}={${p.name}}`)
        .join('&');
      response.links = {
        actions: [{
          href: `${this.config.pathPrefix}/${action.id}?${paramString}`,
          label: action.label,
          parameters: action.parameters,
        }],
      };
    }

    return response;
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.extraHeaders,
      },
    });
  }

  private corsResponse(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', this.config.corsOrigins.join(', '));
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Identity, X-Accept-Blockchain-Ids');
    headers.set('Access-Control-Expose-Headers', 'X-Action-Version, X-Blockchain-Ids');
    headers.set('X-Action-Version', '2.4');
    headers.set('X-Blockchain-Ids', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
