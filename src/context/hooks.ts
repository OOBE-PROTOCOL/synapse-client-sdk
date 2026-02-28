/**
 * Framework-agnostic hooks and adapters for the Synapse context provider.
 *
 * Provides utilities to integrate the IoC container with any UI framework
 * (React, Vue, Svelte, etc.) or backend framework (Express, Fastify,
 * NestJS, etc.) via a simple adapter interface.
 *
 * ## Architecture
 *
 * ```
 *  ┌──────────────────────────────────────────────────┐
 *  │  ContextAdapter<Framework>                        │
 *  │  ┌────────────────────┐  ┌─────────────────────┐ │
 *  │  │ React: useService  │  │ Express: middleware  │ │
 *  │  │ Vue:   inject      │  │ Fastify: decorator   │ │
 *  │  └────────────────────┘  └─────────────────────┘ │
 *  │           │                        │              │
 *  │           ▼                        ▼              │
 *  │  ┌──────────────────────────────────────────────┐ │
 *  │  │           SynapseContext (IoC core)           │ │
 *  │  └──────────────────────────────────────────────┘ │
 *  └──────────────────────────────────────────────────┘
 * ```
 *
 * @module context/hooks
 * @since 1.2.0
 */

import type { ServiceToken, ServiceResolver } from './types';
import type { SynapseContext } from './container';
import type { ServiceRef, ServiceBinding } from './refs';

// ── Global context holder ──────────────────────────────────────

/**
 * Module-level reference to the "current" context.
 *
 * Framework adapters can set this to make `getContext()` and
 * `useService()` work without passing the context explicitly.
 *
 * @since 1.2.0
 */
let _globalContext: SynapseContext | undefined;

/**
 * Set the global context reference.
 *
 * Call this once during application bootstrap. Framework adapters
 * call this automatically.
 *
 * @param ctx - The context to make globally available.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const ctx = createSynapseContext(config);
 * setGlobalContext(ctx);
 * ```
 */
export function setGlobalContext(ctx: SynapseContext | undefined): void {
  _globalContext = ctx;
}

/**
 * Get the current global context.
 *
 * @throws {Error} If no context has been set.
 * @since 1.2.0
 */
export function getContext(): SynapseContext {
  if (!_globalContext) {
    throw new Error(
      'No Synapse context set. Call setGlobalContext(ctx) or use a framework adapter ' +
      '(e.g. SynapseProvider for React) before calling getContext().'
    );
  }
  return _globalContext;
}

/**
 * Try to get the global context; returns `undefined` if not set.
 * @since 1.2.0
 */
export function tryGetContext(): SynapseContext | undefined {
  return _globalContext;
}

// ── Framework-agnostic service accessor ────────────────────────

/**
 * Resolve a service from the global context.
 *
 * This is the simplest way to access services without dependency on
 * any specific framework. Works in Node.js, Deno, Bun, and browsers.
 *
 * @typeParam T - The service type.
 * @param token - The service token to resolve.
 * @returns The resolved service instance.
 * @throws {Error} If no context is set.
 * @throws {ServiceNotFoundError} If the token is not registered.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * import { useService, Tokens } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * const rpc = useService(Tokens.RPC);
 * const balance = await rpc.getBalance(pubkey);
 * ```
 */
export function useService<T>(token: ServiceToken<T>): T {
  return getContext().resolve(token);
}

/**
 * Try to resolve a service from the global context.
 * Returns `undefined` if no context is set or the token is not registered.
 *
 * @since 1.2.0
 */
export function tryUseService<T>(token: ServiceToken<T>): T | undefined {
  const ctx = tryGetContext();
  if (!ctx) return undefined;
  return ctx.tryResolve(token);
}

// ── Framework adapter interface ────────────────────────────────

/**
 * Base interface for framework-specific context adapters.
 *
 * Implement this interface to create adapters for React, Vue, Express,
 * or any other framework. The adapter wraps a `SynapseContext` and
 * provides framework-idiomatic access patterns.
 *
 * @typeParam TFrameworkOpts - Framework-specific options.
 * @since 1.2.0
 */
export interface ContextAdapter<TFrameworkOpts = unknown> {
  /** Adapter name (e.g. 'react', 'express', 'vue'). */
  readonly name: string;
  /** The underlying context. */
  readonly context: SynapseContext;
  /** Initialize the adapter with framework-specific options. */
  init(opts?: TFrameworkOpts): void;
  /** Tear down the adapter. */
  destroy(): void | Promise<void>;
}

// ── React adapter (blueprint) ──────────────────────────────────

/**
 * React adapter configuration.
 * @since 1.2.0
 */
export interface ReactAdapterConfig {
  /** If true, sets the global context on mount. @default true */
  setGlobal?: boolean;
}

/**
 * Creates a React adapter blueprint.
 *
 * This does NOT depend on React — it returns plain functions and
 * descriptors that a React wrapper can use. This keeps React as
 * an optional peer dependency.
 *
 * @param ctx - The Synapse context to wrap.
 * @returns Adapter blueprint with `Provider` props and hook factories.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * // In your React app:
 * import React, { createContext, useContext } from 'react';
 * import { createReactAdapter, Tokens } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * const adapter = createReactAdapter(ctx);
 * const SynapseReactContext = createContext(adapter.context);
 *
 * function SynapseProvider({ children }) {
 *   adapter.init({ setGlobal: true });
 *   return <SynapseReactContext.Provider value={adapter.context}>{children}</SynapseReactContext.Provider>;
 * }
 *
 * function useRpc() {
 *   const ctx = useContext(SynapseReactContext);
 *   return ctx.resolve(Tokens.RPC);
 * }
 * ```
 */
export function createReactAdapter(ctx: SynapseContext): ContextAdapter<ReactAdapterConfig> {
  return {
    name: 'react',
    context: ctx,
    init(opts?: ReactAdapterConfig) {
      if (opts?.setGlobal !== false) {
        setGlobalContext(ctx);
      }
    },
    destroy() {
      if (_globalContext === ctx) {
        setGlobalContext(undefined);
      }
    },
  };
}

// ── Server middleware adapter ──────────────────────────────────

/**
 * Server middleware adapter configuration.
 * @since 1.2.0
 */
export interface ServerAdapterConfig {
  /** Create a new scope per request. @default true */
  scopePerRequest?: boolean;
  /** Key on the request object to store the scoped context. @default 'synapseCtx' */
  contextKey?: string;
}

/**
 * Create request-scoped middleware for Express/Fastify-style servers.
 *
 * Returns a middleware function that creates a child scope per
 * request and attaches it to `req[contextKey]`.
 *
 * @param ctx  - The root Synapse context.
 * @param opts - Server adapter options.
 * @returns A middleware function `(req, res, next) => void`.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createSynapseContext, createServerMiddleware, Tokens } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * const ctx = createSynapseContext(config);
 * const app = express();
 *
 * app.use(createServerMiddleware(ctx));
 *
 * app.get('/balance/:address', async (req, res) => {
 *   const scope = req.synapseCtx;
 *   const rpc = scope.resolve(Tokens.RPC);
 *   const balance = await rpc.getBalance(Pubkey(req.params.address));
 *   res.json({ balance });
 * });
 * ```
 */
export function createServerMiddleware(
  ctx: SynapseContext,
  opts: ServerAdapterConfig = {},
): (req: Record<string, unknown>, res: unknown, next: () => void) => void {
  const key = opts.contextKey ?? 'synapseCtx';
  const scoped = opts.scopePerRequest !== false;

  return (req, _res, next) => {
    if (scoped) {
      const requestId = (req as Record<string, unknown>)['id'] as string
        ?? `req-${Math.random().toString(36).slice(2, 9)}`;
      const scope = ctx.createScope(requestId);
      (req as Record<string, unknown>)[key] = scope;

      // Auto-dispose the scope when the response finishes
      const res = _res as { on?: (event: string, fn: () => void) => void };
      if (res && typeof res.on === 'function') {
        res.on('finish', () => { scope.dispose().catch(() => {}); });
      }
    } else {
      (req as Record<string, unknown>)[key] = ctx;
    }
    next();
  };
}

// ── Composable service "hooks" (framework-agnostic) ────────────

/**
 * Create a typed accessor function bound to a specific token.
 *
 * Returns a zero-argument function that resolves the service from
 * the global context. Perfect for composable patterns.
 *
 * @param token - The service token.
 * @returns A function `() => T` that resolves on each call.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * // Define once:
 * const useRpc = createServiceHook(Tokens.RPC);
 * const useDas = createServiceHook(Tokens.DAS);
 *
 * // Use anywhere:
 * const rpc = useRpc();
 * ```
 */
export function createServiceHook<T>(token: ServiceToken<T>): () => T {
  return () => useService(token);
}

/**
 * Create a typed accessor bound to a specific context instance.
 *
 * Unlike `createServiceHook`, this does not use the global context —
 * it's bound directly to the provided context.
 *
 * @param ctx   - The context to bind to.
 * @param token - The service token.
 * @returns A function `() => T`.
 * @since 1.2.0
 */
export function createBoundHook<T>(ctx: SynapseContext, token: ServiceToken<T>): () => T {
  return () => ctx.resolve(token);
}

// ── Utility: auto-wire ─────────────────────────────────────────

/**
 * Wire a plain object's methods to use services from the context.
 *
 * Creates a Proxy that resolves services lazily on property access.
 * Useful for creating "service bags" that group multiple services.
 *
 * @param ctx    - The context to resolve from.
 * @param tokens - A record of property names → service tokens.
 * @returns A proxy object with lazy-resolved properties.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const services = autoWire(ctx, {
 *   rpc: Tokens.RPC,
 *   das: Tokens.DAS,
 *   programs: Tokens.PROGRAMS,
 * });
 *
 * // Each property is resolved lazily:
 * const balance = await services.rpc.getBalance(pubkey);
 * const asset = await services.das.getAsset(assetId);
 * ```
 */
export function autoWire<T extends Record<string, ServiceToken>>(
  ctx: SynapseContext,
  tokens: T,
): { [K in keyof T]: T[K] extends ServiceToken<infer U> ? U : never } {
  const cache = new Map<string | symbol, unknown>();

  return new Proxy({} as { [K in keyof T]: T[K] extends ServiceToken<infer U> ? U : never }, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;
      if (cache.has(prop)) return cache.get(prop);

      const token = tokens[prop];
      if (!token) return undefined;

      const instance = ctx.resolve(token);
      cache.set(prop, instance);
      return instance;
    },

    has(_target, prop: string | symbol) {
      return typeof prop === 'string' && prop in tokens;
    },

    ownKeys() {
      return Object.keys(tokens);
    },

    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && prop in tokens) {
        return { configurable: true, enumerable: true, writable: false };
      }
      return undefined;
    },
  });
}

// ── Memory-safe ref hooks ──────────────────────────────────────

/**
 * Acquire a tracked, ref-counted reference from the global context.
 *
 * The returned {@link ServiceRef} **must** be `.release()`'d when the
 * component/module is done with the service. This ensures the SDK can
 * track how many consumers hold a service and detect leaks.
 *
 * @typeParam T - The service type.
 * @param token - The service token.
 * @returns A new `ServiceRef<T>`.
 * @throws {Error} If no global context is set.
 * @throws {ServiceNotFoundError} If the token is not registered.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * // In a React component:
 * useEffect(() => {
 *   const rpcRef = useSharedRef(Tokens.RPC);
 *   rpcRef.current.getBalance(pubkey).then(setBalance);
 *   return () => rpcRef.release(); // cleanup on unmount
 * }, []);
 * ```
 */
export function useSharedRef<T>(token: ServiceToken<T>): ServiceRef<T> {
  return getContext().acquireRef(token);
}

/**
 * Acquire tracked refs for multiple tokens from the global context.
 *
 * Returns a {@link ServiceBinding} whose `.services` proxy lazily
 * resolves each token. A single `.release()` frees all refs at once.
 *
 * @param tokens - Record mapping property names to service tokens.
 * @returns A binding with lazy services and batch release.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const binding = useBoundServices({
 *   rpc: Tokens.RPC,
 *   das: Tokens.DAS,
 * });
 *
 * await binding.services.rpc.getBalance(pubkey);
 * binding.release(); // releases all
 * ```
 */
export function useBoundServices<T extends Record<string, ServiceToken>>(
  tokens: T,
): ServiceBinding<T> {
  return getContext().bind(tokens);
}

/**
 * RAII pattern: acquire a ref, run `fn`, auto-release.
 *
 * The ref is released in a `finally` block so cleanup is guaranteed
 * even if `fn` throws. Zero chance of leaking.
 *
 * @typeParam T - The service type.
 * @typeParam R - The return type of `fn`.
 * @param ctx   - The context to acquire from.
 * @param token - The service token.
 * @param fn    - Receives the unwrapped service value.
 * @returns The return value of `fn`.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const balance = withRef(ctx, Tokens.RPC, rpc => rpc.getBalance(pubkey));
 * // ref is auto-released — no leak
 * ```
 */
export function withRef<T, R>(
  ctx: SynapseContext,
  token: ServiceToken<T>,
  fn: (service: T) => R,
): R {
  const ref = ctx.acquireRef(token);
  try {
    return fn(ref.current);
  } finally {
    ref.release();
  }
}

/**
 * Async RAII pattern: acquire a ref, await `fn`, auto-release.
 *
 * @typeParam T - The service type.
 * @typeParam R - The return type of `fn`.
 * @param ctx   - The context to acquire from.
 * @param token - The service token.
 * @param fn    - Async function that receives the unwrapped service.
 * @returns The return value of `fn`.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const balance = await withRefAsync(ctx, Tokens.RPC, async rpc => {
 *   return rpc.getBalance(pubkey);
 * });
 * // ref is auto-released after await
 * ```
 */
export async function withRefAsync<T, R>(
  ctx: SynapseContext,
  token: ServiceToken<T>,
  fn: (service: T) => Promise<R>,
): Promise<R> {
  const ref = ctx.acquireRef(token);
  try {
    return await fn(ref.current);
  } finally {
    ref.release();
  }
}

/**
 * Create a reusable hook that acquires a tracked ref on each call.
 *
 * Unlike `createServiceHook` (which returns the raw service),
 * this returns a `ServiceRef<T>` that must be released.
 *
 * @param token - The service token.
 * @returns A function `() => ServiceRef<T>`.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const useRpcRef = createRefHook(Tokens.RPC);
 *
 * // In a component:
 * const rpcRef = useRpcRef();
 * await rpcRef.current.getBalance(pubkey);
 * rpcRef.release();
 * ```
 */
export function createRefHook<T>(token: ServiceToken<T>): () => ServiceRef<T> {
  return () => useSharedRef(token);
}
