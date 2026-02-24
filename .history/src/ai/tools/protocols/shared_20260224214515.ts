/**
 * @module ai/tools/protocols/shared
 * @description Shared infrastructure for protocol-specific AI tools.
 *
 * Provides:
 * - `ProtocolMethod` — typed schema descriptor for LLM tool discovery
 * - `ProtocolHttpClient` — lightweight REST client for external APIs (Jupiter, Raydium)
 * - `buildProtocolTools` — generic factory that wires schemas → LangChain tools
 *
 * @since 1.0.0
 */
import { z } from 'zod';
import { tool } from '@langchain/core/tools';

/* ═══════════════════════════════════════════════════════════════
 *  Protocol Method descriptor
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A registered protocol method with Zod schemas for agent discovery.
 * @since 1.0.0
 */
export interface ProtocolMethod {
  /** Unique method name within the protocol (e.g. 'getQuote'). */
  name: string;
  /** Human-readable description for the LLM. */
  description?: string;
  /** Zod schema for validated input parameters. */
  input: z.ZodTypeAny;
  /** Zod schema documenting the expected output shape. */
  output: z.ZodTypeAny;
  /** Protocol identifier (e.g. 'jupiter', 'raydium', 'metaplex'). */
  protocol: string;
  /** HTTP verb for REST APIs — ignored for RPC-based protocols. */
  httpMethod?: 'GET' | 'POST';
  /** API path relative to the protocol base URL. */
  path?: string;
}

/**
 * @description Creates an isolated method registry scoped to a single protocol.
 *
 * Each schema file calls `register()` to push methods into the
 * protocol-local array, avoiding any cross-protocol collisions.
 *
 * @param {string} protocol - The protocol identifier (e.g. 'jupiter', 'raydium', 'metaplex')
 * @returns {{ register: Function, methods: ProtocolMethod[] }} Registry with register function and methods array
 * @since 1.0.0
 */
export function createMethodRegistry(protocol: string) {
  const methods: ProtocolMethod[] = [];

  function register<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
    name: string,
    input: I,
    output: O,
    description: string,
    opts?: { httpMethod?: 'GET' | 'POST'; path?: string },
  ): ProtocolMethod {
    const method: ProtocolMethod = {
      name,
      input,
      output,
      description,
      protocol,
      httpMethod: opts?.httpMethod,
      path: opts?.path,
    };
    methods.push(method);
    return method;
  }

  return { register, methods } as const;
}

/* ═══════════════════════════════════════════════════════════════
 *  Protocol HTTP Client — lightweight REST wrapper
 *
 *  Used by Jupiter and Raydium tools to call external REST APIs.
 *  Keeps zero runtime dependencies (uses native fetch).
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for a protocol HTTP client instance.
 * @since 1.0.0
 */
export interface ProtocolClientConfig {
  /** Base URL (e.g. 'https://api.jup.ag'). Trailing slash stripped. */
  baseUrl: string;
  /** Request timeout in ms (default: 30 000). */
  timeout?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Bearer token — set as Authorization header. */
  apiKey?: string;
  /** Override the global fetch (useful for testing / Node 16). */
  fetch?: typeof globalThis.fetch;
}

/**
 * @description Lightweight HTTP client for protocol REST APIs.
 * Uses native fetch with timeout support, header management, and error handling.
 * @since 1.0.0
 */
export class ProtocolHttpClient {
  readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: ProtocolClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeout = config.timeout ?? 30_000;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.headers,
    };
    if (config.apiKey) {
      this.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  /** HTTP GET with query-string serialisation. */
  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          url.searchParams.set(k, v.join(','));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await this._fetch(url.toString(), {
        method: 'GET',
        headers: this.headers,
        signal: controller.signal,
      });
      if (!res.ok) throw new ProtocolApiError(res.status, await res.text(), path);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** HTTP POST with JSON body. */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await this._fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) throw new ProtocolApiError(res.status, await res.text(), path);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * @description Typed error for protocol REST API failures.
 * Contains HTTP status code, response body, and the request path.
 * @since 1.0.0
 */
export class ProtocolApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`Protocol API error ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = 'ProtocolApiError';
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Protocol Toolkit — return type for all protocol factories
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A single LangChain-compatible tool for a protocol method.
 * @since 1.0.0
 */
export type ProtocolTool = ReturnType<typeof tool>;

/**
 * @description Toolkit shape returned by every `createXxxTools()` factory.
 * Contains tools array, keyed map, and method metadata.
 * @since 1.0.0
 */
export interface ProtocolToolkit {
  /** Protocol identifier. */
  protocol: string;
  /** Flat tool array — pass directly to an agent. */
  tools: ProtocolTool[];
  /** Keyed map for cherry-picking individual tools. */
  toolMap: Record<string, ProtocolTool>;
  /** Registered method schemas (useful for introspection). */
  methods: ProtocolMethod[];
  /** All method names available in this toolkit. */
  methodNames: string[];
}

/**
 * @description Common options accepted by every `createXxxTools()` factory.
 * @since 1.0.0
 */
export interface CreateProtocolToolsOpts {
  /** Prefix prepended to every tool name (default: `"<protocol>_"`). */
  prefix?: string;
  /** Restrict to a subset of method names. */
  include?: string[];
  /** Exclude specific method names (applied after include). */
  exclude?: string[];
  /** Pretty-print JSON output (default: true). */
  prettyJson?: boolean;
}

/* ═══════════════════════════════════════════════════════════════
 *  buildProtocolTools() — generic factory wiring
 *
 *  Every protocol provides an `execute` callback; this function
 *  wraps each ProtocolMethod into a real LangChain tool.
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Generic factory that wires ProtocolMethod schemas into real LangChain tools.
 * Every protocol provides an `execute` callback; this function wraps each method.
 *
 * @param {readonly ProtocolMethod[]} methods - Registered protocol methods with Zod schemas
 * @param {Function} execute - Async callback that executes a method with validated input
 * @param {CreateProtocolToolsOpts & { defaultPrefix?: string }} [opts={}] - Tool creation options
 * @returns {ProtocolToolkit} Toolkit with tools array, toolMap, and method metadata
 * @since 1.0.0
 */
export function buildProtocolTools(
  methods: readonly ProtocolMethod[],
  execute: (method: ProtocolMethod, input: Record<string, unknown>) => Promise<unknown>,
  opts: CreateProtocolToolsOpts & { defaultPrefix?: string } = {},
): ProtocolToolkit {
  const protocol = methods[0]?.protocol ?? 'unknown';
  const {
    prefix = opts.defaultPrefix ?? `${protocol}_`,
    include,
    exclude,
    prettyJson = true,
  } = opts;

  const tools: ProtocolTool[] = [];
  const toolMap: Record<string, ProtocolTool> = {};

  for (const method of methods) {
    if (include && !include.includes(method.name)) continue;
    if (exclude && exclude.includes(method.name)) continue;

    const toolName = `${prefix}${method.name}`;

    const t = tool(
      async (input) => {
        try {
          const result = await execute(method, input as Record<string, unknown>);
          return prettyJson ? JSON.stringify(result, null, 2) : JSON.stringify(result);
        } catch (err: any) {
          return JSON.stringify({
            error: true,
            protocol,
            method: method.name,
            message: err?.message ?? String(err),
          });
        }
      },
      {
        name: toolName,
        description: method.description ?? `${protocol}: ${method.name}`,
        schema: method.input as import('zod').ZodObject<any>,
      },
    );

    tools.push(t);
    toolMap[method.name] = t;
  }

  return {
    protocol,
    tools,
    toolMap,
    methods: methods as ProtocolMethod[],
    methodNames: methods.map((m) => m.name),
  };
}
