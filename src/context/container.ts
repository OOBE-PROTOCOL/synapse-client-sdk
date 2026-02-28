/**
 * SynapseContext — IoC service container with scoping, middleware, and lifecycle management.
 *
 * This is the core runtime of the context provider system. It holds all
 * service registrations and resolves them on demand, respecting lifecycle
 * rules (singleton / transient / scoped), circular-dependency detection,
 * and middleware chains.
 *
 * ## Usage
 *
 * ```ts
 * import { SynapseContext, createToken } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * interface Logger { log(msg: string): void; }
 * const LOGGER = createToken<Logger>('Logger');
 *
 * const ctx = new SynapseContext();
 * ctx.register(LOGGER, { useValue: console });
 * const logger = ctx.resolve(LOGGER); // typed as Logger
 * ```
 *
 * ## Scoping
 *
 * ```ts
 * const scope = ctx.createScope('request-123');
 * scope.register(REQUEST_ID, { useValue: '123' });
 * scope.resolve(LOGGER);      // inherits from parent
 * scope.resolve(REQUEST_ID);  // scoped value
 * scope.dispose();
 * ```
 *
 * @module context/container
 * @since 1.2.0
 */

import type {
  ServiceToken,
  ServiceProvider,
  ServiceLifecycle,
  ServiceRegistration,
  ServiceResolver,
  ResolveMiddleware,
  Disposable,
  ContextEvents,
  ValueProvider,
  FactoryProvider,
  ClassProvider,
  AliasProvider,
  AsyncFactoryProvider,
} from './types';
import {
  isDisposable,
  ServiceNotFoundError,
  CircularDependencyError,
  AsyncProviderError,
} from './types';
import {
  ServiceRef,
  WeakServiceRef,
  RefRegistry,
  MemoryGuard,
  type RefRegistryConfig,
  type MemoryGuardConfig,
  type ServiceBinding,
  createBinding,
} from './refs';

// ── Internal registration record ───────────────────────────────

/** @internal Full entry for a registered service. */
interface RegistryEntry<T = unknown> {
  provider: ServiceProvider<T>;
  lifecycle: ServiceLifecycle;
  tags: string[];
  /** Singleton instance cache (for singleton & scoped lifecycles). */
  instance?: T;
  /** Whether the singleton has been resolved at least once. */
  resolved: boolean;
}

// ── Type guards for provider shapes ────────────────────────────

function isValue<T>(p: ServiceProvider<T>): p is ValueProvider<T> {
  return 'useValue' in p;
}
function isFactory<T>(p: ServiceProvider<T>): p is FactoryProvider<T> {
  return 'useFactory' in p;
}
function isClass<T>(p: ServiceProvider<T>): p is ClassProvider<T> {
  return 'useClass' in p;
}
function isAlias<T>(p: ServiceProvider<T>): p is AliasProvider<T> {
  return 'useExisting' in p;
}
function isAsyncFactory<T>(p: ServiceProvider<T>): p is AsyncFactoryProvider<T> {
  return 'useAsyncFactory' in p;
}

// ── Event emitter (tiny, self-contained) ───────────────────────

type EventHandler<T = unknown> = (payload: T) => void;

class TinyEmitter<Events extends { [K in keyof Events]: unknown }> {
  private handlers = new Map<keyof Events, Set<EventHandler>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    let set = this.handlers.get(event);
    if (!set) { set = new Set(); this.handlers.set(event, set); }
    set.add(handler as EventHandler);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach(fn => {
      try { (fn as EventHandler<Events[K]>)(payload); } catch { /* swallow listener errors */ }
    });
  }

  removeAll(): void { this.handlers.clear(); }
}

// ── SynapseContext ─────────────────────────────────────────────

/**
 * The main IoC service container.
 *
 * Provides type-safe dependency injection with support for:
 * - Value, factory, class, alias, and async factory providers
 * - Singleton, transient, and scoped lifecycles
 * - Hierarchical scopes (child inherits parent registrations)
 * - Circular dependency detection
 * - Resolve middleware (logging, metrics, decoration)
 * - Automatic disposal of services implementing `Disposable`
 * - Event-driven observability
 *
 * @since 1.2.0
 */
export class SynapseContext implements ServiceResolver {
  private readonly registry = new Map<ServiceToken, RegistryEntry>();
  private readonly middlewares: ResolveMiddleware[] = [];
  private readonly events = new TinyEmitter<ContextEvents>();
  private readonly resolutionStack = new Set<ServiceToken>();
  private readonly children = new Set<SynapseContext>();
  private disposed = false;

  /** @internal Lazy ref registry — created on first acquireRef(). */
  private _refRegistry?: RefRegistry;
  /** @internal Optional memory guard. */
  private _memoryGuard?: MemoryGuard;

  /**
   * @param scopeId - Unique scope identifier (auto-generated for child scopes).
   * @param parent  - Parent context for hierarchical resolution.
   */
  constructor(
    public readonly scopeId: string = 'root',
    private readonly parent?: SynapseContext,
  ) {}

  // ── Ref Registry (lazy) ───────────────────────────────────────

  /** @internal Get or create the ref registry. */
  private getRefRegistry(): RefRegistry {
    if (!this._refRegistry) {
      this._refRegistry = new RefRegistry({ enableLeakDetection: true });
    }
    return this._refRegistry;
  }

  /**
   * Acquire a tracked, ref-counted reference to a service.
   *
   * Returns a {@link ServiceRef} that must be `.release()`'d when no
   * longer needed. Multiple `acquireRef()` calls for the same singleton
   * token return different refs to the **same** instance — the ref count
   * tracks how many holders exist.
   *
   * @typeParam T - The service type.
   * @param token - The service token to resolve.
   * @returns A new `ServiceRef<T>` linked to this context's ref registry.
   * @throws {ServiceNotFoundError} If no provider is registered for the token.
   * @since 1.2.0
   *
   * @example
   * ```ts
   * // Component A
   * const rpcRef = ctx.acquireRef(Tokens.RPC);
   * await rpcRef.current.getBalance(pubkey);
   *
   * // Component B — same singleton, separate ref
   * const rpcRef2 = ctx.acquireRef(Tokens.RPC);
   * ctx.refCount(Tokens.RPC); // → 2
   *
   * // Cleanup
   * rpcRef.release();   // ref count → 1
   * rpcRef2.release();  // ref count → 0
   * ```
   */
  acquireRef<T>(token: ServiceToken<T>): ServiceRef<T> {
    this.assertNotDisposed();
    const value = this.resolve(token);
    return this.getRefRegistry().acquire(token, value);
  }

  /**
   * Acquire tracked refs for multiple tokens at once.
   *
   * Returns a {@link ServiceBinding} whose `.services` proxy lazily
   * resolves each token. A single `.release()` frees all refs.
   *
   * @param tokens - Record mapping property names to service tokens.
   * @returns A binding with lazy services and batch release.
   * @since 1.2.0
   *
   * @example
   * ```ts
   * const binding = ctx.bind({
   *   rpc: Tokens.RPC,
   *   das: Tokens.DAS,
   *   programs: Tokens.PROGRAMS,
   * });
   *
   * await binding.services.rpc.getBalance(pubkey);
   * binding.release(); // releases all at once
   * ```
   */
  bind<T extends Record<string, ServiceToken>>(tokens: T): ServiceBinding<T> {
    this.assertNotDisposed();
    return createBinding(
      <U>(t: ServiceToken<U>) => this.acquireRef(t),
      tokens,
    );
  }

  /**
   * Number of active (unreleased) refs for a specific token.
   *
   * Returns `0` if no refs have been acquired or the ref registry
   * hasn't been initialized yet.
   *
   * @since 1.2.0
   */
  refCount(token: ServiceToken): number {
    return this._refRegistry?.refCount(token) ?? 0;
  }

  /**
   * The ref registry for this context, if any refs have been acquired.
   *
   * Returns `undefined` if `acquireRef()` has never been called.
   * @since 1.2.0
   */
  get refs(): RefRegistry | undefined {
    return this._refRegistry;
  }

  /**
   * Enable a memory guard with configurable thresholds.
   *
   * The guard monitors ref counts and emits pressure/leak events.
   * Can only be called once per context.
   *
   * @param config - Guard thresholds.
   * @returns The created `MemoryGuard`.
   * @since 1.2.0
   *
   * @example
   * ```ts
   * const guard = ctx.enableMemoryGuard({
   *   maxRefAgeMs: 30_000,
   *   maxActiveRefs: 50,
   *   checkIntervalMs: 10_000,
   * });
   *
   * guard.onPressure(stats => console.warn('Memory pressure:', stats));
   * guard.onLeak(leak => console.error('Leaked ref:', leak));
   * ```
   */
  enableMemoryGuard(config?: MemoryGuardConfig): MemoryGuard {
    this.assertNotDisposed();
    if (this._memoryGuard) return this._memoryGuard;
    this._memoryGuard = new MemoryGuard(this.getRefRegistry(), config);
    return this._memoryGuard;
  }

  /**
   * The active memory guard, if enabled.
   * @since 1.2.0
   */
  get memoryGuard(): MemoryGuard | undefined {
    return this._memoryGuard;
  }

  // ── Registration ──────────────────────────────────────────────

  /**
   * Register a service provider for a token.
   *
   * @param token    - The service token.
   * @param provider - How to create the service.
   * @param tags     - Optional tags for filtering.
   * @returns `this` for chaining.
   *
   * @example
   * ```ts
   * ctx.register(DB, { useFactory: r => new PostgresDB(r.resolve(CONFIG)) });
   * ctx.register(LOGGER, { useValue: console }, ['core']);
   * ctx.register(CACHE, { useClass: RedisCache, lifecycle: 'singleton' });
   * ```
   *
   * @since 1.2.0
   */
  register<T>(
    token: ServiceToken<T>,
    provider: ServiceProvider<T>,
    tags?: string[],
  ): this {
    this.assertNotDisposed();

    const lifecycle: ServiceLifecycle = isValue(provider)
      ? 'singleton' // values are always singletons
      : (provider as FactoryProvider<T> | ClassProvider<T> | AsyncFactoryProvider<T>).lifecycle ?? 'singleton';

    this.registry.set(token, {
      provider,
      lifecycle,
      tags: tags ?? [],
      resolved: false,
    });

    this.events.emit('registered', { token, tags });
    return this;
  }

  /**
   * Register multiple services at once.
   *
   * @param registrations - Array of `{ token, provider, tags? }` descriptors.
   * @returns `this` for chaining.
   * @since 1.2.0
   */
  registerMany(registrations: ServiceRegistration[]): this {
    for (const reg of registrations) {
      this.register(reg.token, reg.provider, reg.tags);
    }
    return this;
  }

  /**
   * Register a service only if the token is not already registered.
   *
   * Useful for default/fallback providers that should not override
   * user-provided registrations.
   *
   * @since 1.2.0
   */
  registerIfMissing<T>(
    token: ServiceToken<T>,
    provider: ServiceProvider<T>,
    tags?: string[],
  ): this {
    if (!this.has(token)) {
      this.register(token, provider, tags);
    }
    return this;
  }

  // ── Resolution ────────────────────────────────────────────────

  /**
   * Resolve a service synchronously.
   *
   * @throws {ServiceNotFoundError} If no provider is registered.
   * @throws {CircularDependencyError} If a circular dependency is detected.
   * @throws {AsyncProviderError} If the provider is async.
   * @since 1.2.0
   */
  resolve<T>(token: ServiceToken<T>): T {
    this.assertNotDisposed();
    const start = performance.now();

    try {
      const result = this.applyMiddleware(token, () => this.doResolve(token));
      this.events.emit('resolved', {
        token,
        lifecycle: this.getLifecycle(token),
        durationMs: performance.now() - start,
      });
      return result;
    } catch (err) {
      this.events.emit('error', { token, error: err as Error });
      throw err;
    }
  }

  /**
   * Resolve a service asynchronously.
   *
   * Required for services registered with `useAsyncFactory`.
   * Also works for sync providers (wraps result in a resolved promise).
   *
   * @since 1.2.0
   */
  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    this.assertNotDisposed();
    const start = performance.now();

    try {
      const result = await this.doResolveAsync(token);
      this.events.emit('resolved', {
        token,
        lifecycle: this.getLifecycle(token),
        durationMs: performance.now() - start,
      });
      return result;
    } catch (err) {
      this.events.emit('error', { token, error: err as Error });
      throw err;
    }
  }

  /**
   * Try to resolve a service; return `undefined` if not registered.
   * @since 1.2.0
   */
  tryResolve<T>(token: ServiceToken<T>): T | undefined {
    if (!this.has(token)) return undefined;
    return this.resolve(token);
  }

  /**
   * Check if a token has a provider (searches parent scopes too).
   * @since 1.2.0
   */
  has(token: ServiceToken): boolean {
    return this.registry.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Resolve all services whose registrations contain the given tag.
   * @since 1.2.0
   */
  resolveByTag(tag: string): unknown[] {
    const results: unknown[] = [];
    for (const [token, entry] of this.registry) {
      if (entry.tags.includes(tag)) {
        results.push(this.resolve(token as ServiceToken<unknown>));
      }
    }
    // Also search parent
    if (this.parent) {
      results.push(...this.parent.resolveByTag(tag));
    }
    return results;
  }

  // ── Scoping ───────────────────────────────────────────────────

  /**
   * Create a child scope that inherits all parent registrations.
   *
   * Scoped services get fresh instances in the child scope.
   * The child scope is tracked and disposed when the parent is disposed.
   *
   * @param scopeId - Unique identifier for the child scope.
   * @returns A new `SynapseContext` linked to this parent.
   * @since 1.2.0
   *
   * @example
   * ```ts
   * const reqScope = ctx.createScope(`request-${id}`);
   * reqScope.register(REQUEST_CTX, { useValue: { id, user } });
   * // ... handle request ...
   * reqScope.dispose();
   * ```
   */
  createScope(scopeId?: string): SynapseContext {
    this.assertNotDisposed();
    const id = scopeId ?? `scope-${Math.random().toString(36).slice(2, 9)}`;
    const child = new SynapseContext(id, this);
    this.children.add(child);
    this.events.emit('scopeCreated', { scopeId: id });
    return child;
  }

  // ── Middleware ─────────────────────────────────────────────────

  /**
   * Add a resolve middleware.
   *
   * Middleware functions wrap every `resolve()` call. They execute in
   * the order they are added (first-in, outermost).
   *
   * @param mw - Middleware function.
   * @returns `this` for chaining.
   * @since 1.2.0
   *
   * @example
   * ```ts
   * ctx.use((token, next) => {
   *   console.time(token.name);
   *   const result = next();
   *   console.timeEnd(token.name);
   *   return result;
   * });
   * ```
   */
  use(mw: ResolveMiddleware): this {
    this.middlewares.push(mw);
    return this;
  }

  // ── Events ────────────────────────────────────────────────────

  /**
   * Subscribe to a container event.
   * @since 1.2.0
   */
  on<K extends keyof ContextEvents>(event: K, handler: (payload: ContextEvents[K]) => void): this {
    this.events.on(event, handler);
    return this;
  }

  /**
   * Unsubscribe from a container event.
   * @since 1.2.0
   */
  off<K extends keyof ContextEvents>(event: K, handler: (payload: ContextEvents[K]) => void): this {
    this.events.off(event, handler);
    return this;
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  /**
   * Dispose this context and all child scopes.
   *
   * Calls `.dispose()` on all singleton/scoped services that implement
   * {@link Disposable}. After disposal, any call to `resolve()` throws.
   *
   * @returns Number of services disposed.
   * @since 1.2.0
   */
  async dispose(): Promise<number> {
    if (this.disposed) return 0;
    this.disposed = true;

    let count = 0;

    // Dispose children first (innermost to outermost)
    for (const child of this.children) {
      count += await child.dispose();
    }
    this.children.clear();

    // Invalidate all tracked refs before disposing services
    if (this._refRegistry) {
      this._refRegistry.dispose();
      this._refRegistry = undefined;
    }
    if (this._memoryGuard) {
      this._memoryGuard.dispose();
      this._memoryGuard = undefined;
    }

    // Dispose own singletons & scoped instances
    for (const entry of this.registry.values()) {
      if (entry.resolved && entry.instance != null && isDisposable(entry.instance)) {
        try {
          await (entry.instance as Disposable).dispose();
          count++;
        } catch { /* best effort */ }
      }
    }

    this.registry.clear();
    this.events.emit('disposed', { scopeId: this.scopeId, servicesDisposed: count });
    this.events.removeAll();

    // Unlink from parent
    if (this.parent) {
      this.parent.children.delete(this);
    }

    return count;
  }

  // ── Introspection ─────────────────────────────────────────────

  /**
   * Get all registered tokens (this scope only, not parent).
   * @since 1.2.0
   */
  get tokens(): ServiceToken[] {
    return [...this.registry.keys()];
  }

  /**
   * Get all registered tokens across this scope and all parents.
   * @since 1.2.0
   */
  get allTokens(): ServiceToken[] {
    const parentTokens = this.parent?.allTokens ?? [];
    return [...new Set([...this.registry.keys(), ...parentTokens])];
  }

  /**
   * Number of services registered in this scope.
   * @since 1.2.0
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Whether this context has been disposed.
   * @since 1.2.0
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Return a snapshot of registered services for debugging.
   * @since 1.2.0
   */
  snapshot(): Array<{ token: string; lifecycle: ServiceLifecycle; resolved: boolean; tags: string[] }> {
    return [...this.registry.entries()].map(([token, entry]) => ({
      token: token.name,
      lifecycle: entry.lifecycle,
      resolved: entry.resolved,
      tags: entry.tags,
    }));
  }

  // ── Private resolution logic ──────────────────────────────────

  /** @internal Synchronous resolution (no middleware). */
  private doResolve<T>(token: ServiceToken<T>): T {
    // Check for circular deps
    if (this.resolutionStack.has(token)) {
      const chain = [...this.resolutionStack].map(t => t.name);
      chain.push(token.name);
      throw new CircularDependencyError(chain);
    }

    // Find entry (local first, then parent)
    const entry = this.findEntry(token);
    if (!entry) throw new ServiceNotFoundError(token.name);

    const { provider, lifecycle } = entry;

    // Singleton / scoped: return cached instance
    if (lifecycle !== 'transient' && entry.resolved && entry.instance !== undefined) {
      return entry.instance as T;
    }

    // Async guard
    if (isAsyncFactory(provider)) {
      throw new AsyncProviderError(token.name);
    }

    // Track resolution for circular-dep detection
    this.resolutionStack.add(token);
    try {
      const instance = this.instantiate(provider);

      // Cache for singleton / scoped
      if (lifecycle !== 'transient') {
        entry.instance = instance;
        entry.resolved = true;
      }

      return instance as T;
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /** @internal Async resolution. */
  private async doResolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    const entry = this.findEntry(token);
    if (!entry) throw new ServiceNotFoundError(token.name);

    const { provider, lifecycle } = entry;

    // Singleton / scoped: return cached instance
    if (lifecycle !== 'transient' && entry.resolved && entry.instance !== undefined) {
      return entry.instance as T;
    }

    if (isAsyncFactory(provider)) {
      this.resolutionStack.add(token);
      try {
        const instance = await provider.useAsyncFactory(this);

        if (lifecycle !== 'transient') {
          entry.instance = instance;
          entry.resolved = true;
        }

        return instance as T;
      } finally {
        this.resolutionStack.delete(token);
      }
    }

    // For non-async providers, delegate to sync resolve
    return this.doResolve(token);
  }

  /** @internal Instantiate a sync provider. */
  private instantiate<T>(provider: ServiceProvider<T>): T {
    if (isValue(provider)) return provider.useValue;
    if (isFactory(provider)) return provider.useFactory(this);
    if (isClass(provider)) return new provider.useClass(this);
    if (isAlias(provider)) return this.doResolve(provider.useExisting);
    // Should never reach here
    throw new SynapseError(`Unknown provider type`);
  }

  /** @internal Find registry entry (local scope first, then parent). */
  private findEntry<T>(token: ServiceToken<T>): RegistryEntry<T> | undefined {
    const local = this.registry.get(token) as RegistryEntry<T> | undefined;
    if (local) return local;

    // For scoped lifecycle, the parent entry needs a local copy
    const parentEntry = this.parent?.findEntry(token);
    if (!parentEntry) return undefined;

    if (parentEntry.lifecycle === 'scoped') {
      // Create a local copy for scoped resolution
      const localCopy: RegistryEntry<T> = {
        provider: parentEntry.provider,
        lifecycle: 'scoped',
        tags: parentEntry.tags,
        resolved: false,
      };
      this.registry.set(token, localCopy as RegistryEntry);
      return localCopy;
    }

    return parentEntry;
  }

  /** @internal Get lifecycle for a token (for event emission). */
  private getLifecycle(token: ServiceToken): ServiceLifecycle {
    const entry = this.findEntry(token);
    return entry?.lifecycle ?? 'singleton';
  }

  /** @internal Apply middleware chain. */
  private applyMiddleware<T>(token: ServiceToken<T>, resolve: () => T): T {
    // Combine parent middlewares + own
    const allMw = [...(this.parent?.middlewares ?? []), ...this.middlewares];

    if (allMw.length === 0) return resolve();

    // Build the chain: last middleware calls resolve(), each prior calls next
    let current = resolve;
    for (let i = allMw.length - 1; i >= 0; i--) {
      const mw = allMw[i];
      const next = current;
      current = () => mw(token, next);
    }
    return current();
  }

  /** @internal Guard against usage after disposal. */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new SynapseError('Context has been disposed and can no longer be used', -32103);
    }
  }
}

// ── Re-export error for convenience ────────────────────────────
import { SynapseError } from '../core/errors';
