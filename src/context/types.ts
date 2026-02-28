/**
 * Context Provider type system — tokens, interfaces, lifecycle.
 *
 * Implements a type-safe **Inversion of Control (IoC)** container that
 * lets any layer of the application resolve SDK services without tight
 * coupling. Inspired by Angular's DI, InversifyJS, and React Context.
 *
 * ## Key concepts
 *
 * | Concept           | Description |
 * |-------------------|-------------|
 * | **ServiceToken**  | A branded key that identifies a service (`createToken<T>('rpc')`) |
 * | **Provider**      | A recipe that tells the container *how* to create a service |
 * | **Lifecycle**     | `singleton` (shared), `transient` (new instance per resolve), `scoped` (per scope) |
 * | **Scope**         | An isolated child context that inherits parent services |
 * | **Middleware**     | Cross-cutting logic (logging, metrics, caching) applied on resolve |
 *
 * @module context/types
 * @since 1.2.0
 */

// ── Brand utility ──────────────────────────────────────────────

/** @internal Unique symbol for the service token brand. */
declare const __tokenBrand: unique symbol;

/** @internal Unique symbol that carries the phantom type on a token. */
declare const __tokenType: unique symbol;

/**
 * A strongly-typed key that identifies a service in the container.
 *
 * Tokens are created with {@link createToken} and carry the service type
 * as a phantom parameter, so `container.resolve(RPC_TOKEN)` always
 * returns `SolanaRpc` — no casts needed.
 *
 * @typeParam T - The service type this token resolves to.
 * @since 1.2.0
 */
export interface ServiceToken<T = unknown> {
  /** Human-readable debug name. */
  readonly name: string;
  /** @internal phantom brand — never set at runtime. */
  readonly [__tokenBrand]: 'ServiceToken';
  /** @internal phantom type carrier — never set at runtime. */
  readonly [__tokenType]: T;
}

/**
 * Create a type-safe service token.
 *
 * @typeParam T - The service type this token resolves to.
 * @param name - Human-readable identifier (used in error messages / debug).
 * @returns A frozen `ServiceToken<T>`.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * interface Logger { log(msg: string): void; }
 * const LOGGER = createToken<Logger>('Logger');
 * container.register(LOGGER, { useFactory: () => console });
 * const logger = container.resolve(LOGGER); // typed as Logger
 * ```
 */
export function createToken<T>(name: string): ServiceToken<T> {
  return Object.freeze({ name }) as unknown as ServiceToken<T>;
}

// ── Service lifecycle ──────────────────────────────────────────

/**
 * Controls how many instances the container creates for a given token.
 *
 * | Value       | Behaviour |
 * |-------------|-----------|
 * | `singleton` | One shared instance for the container's lifetime |
 * | `transient` | New instance on every `resolve()` call |
 * | `scoped`    | One instance per {@link SynapseContext.createScope | scope} |
 *
 * @since 1.2.0
 */
export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped';

// ── Provider variants ──────────────────────────────────────────

/**
 * Provide a service by supplying the instance directly.
 * @since 1.2.0
 */
export interface ValueProvider<T> {
  useValue: T;
}

/**
 * Provide a service via a factory function.
 *
 * The factory receives the current {@link ServiceResolver} so it can
 * resolve its own dependencies, enabling composition.
 *
 * @since 1.2.0
 */
export interface FactoryProvider<T> {
  useFactory: (resolver: ServiceResolver) => T;
  lifecycle?: ServiceLifecycle;
}

/**
 * Provide a service via a constructor (class).
 *
 * The constructor receives the resolver as its single argument.
 *
 * @since 1.2.0
 */
export interface ClassProvider<T> {
  useClass: new (resolver: ServiceResolver) => T;
  lifecycle?: ServiceLifecycle;
}

/**
 * Provide a service by aliasing another token.
 *
 * When the container resolves this token it follows the alias chain
 * until it finds a concrete provider.
 *
 * @since 1.2.0
 */
export interface AliasProvider<T> {
  useExisting: ServiceToken<T>;
}

/**
 * Provide a service via an async factory.
 *
 * Resolved with {@link ServiceResolver.resolveAsync}. Useful for services
 * that need I/O during initialization (e.g. fetching config, opening DB).
 *
 * @since 1.2.0
 */
export interface AsyncFactoryProvider<T> {
  useAsyncFactory: (resolver: ServiceResolver) => Promise<T>;
  lifecycle?: ServiceLifecycle;
}

/**
 * Union of all provider shapes.
 * @since 1.2.0
 */
export type ServiceProvider<T> =
  | ValueProvider<T>
  | FactoryProvider<T>
  | ClassProvider<T>
  | AliasProvider<T>
  | AsyncFactoryProvider<T>;

// ── Registration descriptor ────────────────────────────────────

/**
 * Full registration entry: token + provider + optional metadata.
 * @since 1.2.0
 */
export interface ServiceRegistration<T = unknown> {
  token: ServiceToken<T>;
  provider: ServiceProvider<T>;
  /** Tags for filtering (e.g. `['core', 'rpc']`). */
  tags?: string[];
}

// ── Resolver interface ─────────────────────────────────────────

/**
 * Read-only service resolver — the interface that factories and
 * classes receive to pull in their own dependencies.
 *
 * @since 1.2.0
 */
export interface ServiceResolver {
  /**
   * Resolve a service synchronously.
   * @throws {ServiceNotFoundError} If no provider is registered for the token.
   */
  resolve<T>(token: ServiceToken<T>): T;

  /**
   * Resolve a service asynchronously (for async factory providers).
   * @throws {ServiceNotFoundError} If no provider is registered for the token.
   */
  resolveAsync<T>(token: ServiceToken<T>): Promise<T>;

  /**
   * Attempt to resolve; return `undefined` if the token is not registered.
   */
  tryResolve<T>(token: ServiceToken<T>): T | undefined;

  /**
   * Check if a token has been registered.
   */
  has(token: ServiceToken): boolean;

  /**
   * Resolve all services whose registrations contain the given tag.
   */
  resolveByTag(tag: string): unknown[];
}

// ── Middleware ──────────────────────────────────────────────────

/**
 * Intercept every `resolve()` call — enables logging, metrics,
 * caching, permission checks, or decoration.
 *
 * @since 1.2.0
 */
export interface ResolveMiddleware {
  /**
   * Called around each resolution.
   *
   * @param token - The token being resolved.
   * @param next  - Call to continue to the next middleware (or the actual provider).
   * @returns The resolved service (possibly wrapped / decorated).
   */
  <T>(token: ServiceToken<T>, next: () => T): T;
}

// ── Disposable ─────────────────────────────────────────────────

/**
 * Services that implement `Disposable` will have `.dispose()` called
 * when the container or scope is destroyed.
 *
 * @since 1.2.0
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/** Type guard for {@link Disposable}. @since 1.2.0 */
export function isDisposable(obj: unknown): obj is Disposable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'dispose' in obj &&
    typeof (obj as Disposable).dispose === 'function'
  );
}

// ── Errors ─────────────────────────────────────────────────────

import { SynapseError } from '../core/errors';

/**
 * Thrown when resolving a token that has no registered provider.
 * @since 1.2.0
 */
export class ServiceNotFoundError extends SynapseError {
  constructor(tokenName: string) {
    super(`No provider registered for service "${tokenName}"`, -32100);
    this.name = 'ServiceNotFoundError';
  }
}

/**
 * Thrown when a circular dependency is detected during resolution.
 * @since 1.2.0
 */
export class CircularDependencyError extends SynapseError {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' → ')}`, -32101);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Thrown when attempting to resolve an async provider synchronously.
 * @since 1.2.0
 */
export class AsyncProviderError extends SynapseError {
  constructor(tokenName: string) {
    super(
      `Service "${tokenName}" has an async factory — use resolveAsync() instead of resolve()`,
      -32102,
    );
    this.name = 'AsyncProviderError';
  }
}

// ── Container event types ──────────────────────────────────────

/**
 * Events emitted by the context container for observability.
 * @since 1.2.0
 */
export interface ContextEvents {
  /** Fires after a service is registered. */
  registered: { token: ServiceToken; tags?: string[] };
  /** Fires after a service is resolved. */
  resolved: { token: ServiceToken; lifecycle: ServiceLifecycle; durationMs: number };
  /** Fires when a scope is created. */
  scopeCreated: { scopeId: string };
  /** Fires when the container or a scope is disposed. */
  disposed: { scopeId?: string; servicesDisposed: number };
  /** Fires when an error occurs during resolution. */
  error: { token: ServiceToken; error: Error };
}
