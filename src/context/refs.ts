/**
 * Memory-safe service references — ref counting, leak detection, WeakRef sharing.
 *
 * ## Why refs?
 *
 * In an SDK, memory management is critical. Raw `resolve()` returns
 * a direct reference with no tracking. `acquireRef()` returns a
 * `ServiceRef<T>` that:
 *
 * 1. **Tracks** how many components hold the service (ref counting)
 * 2. **Invalidates** automatically when the context is disposed
 * 3. **Detects leaks** via `FinalizationRegistry` (if a ref is GC'd without release)
 * 4. **Supports RAII** via `use()` / `useAsync()` / `withRef()`
 *
 * ## Architecture
 *
 * ```
 * ┌──────────────────────────────────────────────────────────┐
 * │ Component A                   Component B                │
 * │  acquireRef(RPC) ──┐    ┌── acquireRef(RPC)              │
 * │    ServiceRef #1   │    │    ServiceRef #2                │
 * │     refCount: 2    ▼    ▼    refCount: 2                 │
 * │               ┌──────────┐                               │
 * │               │ Registry │  ← FinalizationRegistry       │
 * │               │  RPC → 2 │     (leak detection)          │
 * │               └────┬─────┘                               │
 * │                    │                                      │
 * │               ┌────▼─────┐                               │
 * │               │ Singleton│  (one instance, N refs)        │
 * │               │  RPC svc │                               │
 * │               └──────────┘                               │
 * │                                                          │
 * │ A.release() → refCount: 1 │ B.release() → refCount: 0   │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Component sharing pattern
 *
 * ```ts
 * // Component A — acquires a tracked reference
 * const rpcRef = ctx.acquireRef(Tokens.RPC);
 * const balance = await rpcRef.current.getBalance(pubkey);
 *
 * // Component B — acquires its own tracked ref to the SAME instance
 * const rpcRef2 = ctx.acquireRef(Tokens.RPC);
 * const slot = await rpcRef2.current.getSlot();
 *
 * // Both hold the SAME singleton — ref count is 2
 * ctx.refCount(Tokens.RPC); // → 2
 *
 * // Component A unmounts
 * rpcRef.release();         // ref count → 1
 *
 * // Component B unmounts
 * rpcRef2.release();        // ref count → 0
 * ```
 *
 * ## RAII pattern (auto-release)
 *
 * ```ts
 * // Sync — ref released in finally block
 * const balance = withRef(ctx, Tokens.RPC, rpc => rpc.getBalance(pubkey));
 *
 * // Async — ref released after await completes
 * const slot = await withRefAsync(ctx, Tokens.RPC, rpc => rpc.getSlot());
 *
 * // On the ref itself
 * const result = ref.use(rpc => rpc.getBalance(pubkey));
 * ```
 *
 * @module context/refs
 * @since 1.2.0
 */

import { SynapseError } from '../core/errors';
import type { ServiceToken, Disposable } from './types';

// ── Errors ─────────────────────────────────────────────────────

/**
 * Thrown when accessing `.current` on a released or invalidated reference.
 * @since 1.2.0
 */
export class RefReleasedError extends SynapseError {
  constructor(tokenName: string) {
    super(
      `Service reference for "${tokenName}" has been released. ` +
      'Acquire a new ref with acquireRef() or check ref.alive before access.',
      -32104,
    );
    this.name = 'RefReleasedError';
  }
}

// ── Interfaces ─────────────────────────────────────────────────

/**
 * Leak report entry — one per ref that was GC'd without release
 * or that has exceeded the maximum age threshold.
 * @since 1.2.0
 */
export interface LeakReport {
  /** Name of the service token. */
  tokenName: string;
  /** Unique ID of the leaked ref. */
  refId: number;
  /** `performance.now()` when the ref was acquired. */
  acquiredAt: number;
  /** `performance.now()` when the leak was detected. */
  detectedAt: number;
}

/**
 * Aggregate statistics from the {@link RefRegistry}.
 * @since 1.2.0
 */
export interface RefStats {
  /** Total refs acquired since creation. */
  totalAcquired: number;
  /** Total refs released since creation. */
  totalReleased: number;
  /** Currently active (unreleased) refs. */
  active: number;
  /** Peak concurrent active refs. */
  peak: number;
  /** Refs detected as leaked (GC'd without release). */
  leaked: number;
  /** Active ref count per token name. */
  byToken: Record<string, number>;
}

/**
 * Configuration for the {@link RefRegistry}.
 * @since 1.2.0
 */
export interface RefRegistryConfig {
  /**
   * Enable FinalizationRegistry-based leak detection.
   * Falls back to disabled if the runtime doesn't support it.
   * @default true
   */
  enableLeakDetection?: boolean;
}

/**
 * Configuration for the {@link MemoryGuard}.
 * @since 1.2.0
 */
export interface MemoryGuardConfig {
  /**
   * Max age in ms before a ref is considered a potential leak.
   * Used by `checkLeaks()`.
   * @default 60000
   */
  maxRefAgeMs?: number;

  /**
   * Max total active refs before emitting a pressure warning.
   * @default 100
   */
  maxActiveRefs?: number;

  /**
   * Interval in ms for automatic leak checks. `0` = disabled.
   * The timer is `unref()`'d so it won't keep the process alive.
   * @default 0
   */
  checkIntervalMs?: number;
}

// ── ServiceRef ─────────────────────────────────────────────────

/**
 * A tracked, ref-counted reference to a resolved service.
 *
 * Provides memory-safe access: accessing `.current` after `.release()`
 * throws {@link RefReleasedError} instead of returning a stale value.
 *
 * @typeParam T - The service type.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const rpcRef = ctx.acquireRef(Tokens.RPC);
 *
 * // Use the service
 * const balance = await rpcRef.current.getBalance(pubkey);
 *
 * // Release when done (e.g. on unmount)
 * rpcRef.release();
 *
 * // Accessing after release throws
 * rpcRef.current; // ❌ RefReleasedError
 * ```
 */
export class ServiceRef<T> implements Disposable {
  private _released = false;
  private readonly _acquiredAt: number;

  /**
   * @internal Use `ctx.acquireRef(token)` or `RefRegistry.acquire()` to create refs.
   */
  constructor(
    private readonly _value: T,
    private readonly _token: ServiceToken<T>,
    private readonly _onRelease: (ref: ServiceRef<T>) => void,
    /** Unique reference ID (monotonically increasing within a registry). */
    readonly id: number,
  ) {
    this._acquiredAt = performance.now();
  }

  // ── Accessors ──────────────────────────────────────────────

  /**
   * The resolved service instance.
   *
   * @throws {RefReleasedError} If the ref has been released or invalidated.
   */
  get current(): T {
    if (this._released) {
      throw new RefReleasedError(this._token.name);
    }
    return this._value;
  }

  /** Whether this reference is still valid (not released). */
  get alive(): boolean { return !this._released; }

  /** The token this ref was acquired for. */
  get token(): ServiceToken<T> { return this._token; }

  /** `performance.now()` timestamp when this ref was acquired. */
  get acquiredAt(): number { return this._acquiredAt; }

  /** How long this ref has been alive, in ms. */
  get ageMs(): number { return performance.now() - this._acquiredAt; }

  // ── Release ────────────────────────────────────────────────

  /**
   * Release this reference, decrementing the ref count.
   *
   * After release:
   * - `.current` throws {@link RefReleasedError}
   * - `.alive` returns `false`
   * - The ref count for this token decreases by 1
   *
   * Safe to call multiple times (idempotent).
   */
  release(): void {
    if (this._released) return;
    this._released = true;
    this._onRelease(this);
  }

  /** Alias for {@link release}. Implements {@link Disposable}. */
  dispose(): void { this.release(); }

  // ── RAII patterns ──────────────────────────────────────────

  /**
   * Execute a function with this reference, auto-releasing afterward.
   *
   * The ref is released in a `finally` block, guaranteeing cleanup
   * even if the function throws.
   *
   * @param fn - Receives the unwrapped service value.
   * @returns The return value of `fn`.
   *
   * @example
   * ```ts
   * const balance = rpcRef.use(rpc => rpc.getBalance(pubkey));
   * // rpcRef is now released — no leak possible
   * ```
   */
  use<R>(fn: (service: T) => R): R {
    try {
      return fn(this.current);
    } finally {
      this.release();
    }
  }

  /**
   * Async version of {@link use}. Awaits the function, then releases.
   *
   * @example
   * ```ts
   * const balance = await rpcRef.useAsync(rpc => rpc.getBalance(pubkey));
   * ```
   */
  async useAsync<R>(fn: (service: T) => Promise<R>): Promise<R> {
    try {
      return await fn(this.current);
    } finally {
      this.release();
    }
  }

  // ── Sharing ────────────────────────────────────────────────

  /**
   * Create a weak reference that does **not** prevent garbage collection.
   *
   * The returned `WeakServiceRef` can be shared to components that
   * only need the service optionally — if the strong refs are all
   * released and the GC collects the object, `.deref()` returns
   * `undefined` instead of throwing.
   *
   * @throws {SynapseError} If the service value is a primitive (not weakly referenceable).
   *
   * @example
   * ```ts
   * const weakRpc = rpcRef.toWeak();
   * // Later:
   * const rpc = weakRpc.deref();
   * if (rpc) rpc.getBalance(pubkey);
   * ```
   */
  toWeak(): WeakServiceRef<T & object> {
    if (typeof this._value !== 'object' || this._value === null) {
      throw new SynapseError(
        `Cannot create WeakRef for non-object service "${this._token.name}". ` +
        'WeakRef requires an object target.',
        -32105,
      );
    }
    return new WeakServiceRef(this._value as T & object);
  }
}

// ── WeakServiceRef ─────────────────────────────────────────────

/**
 * A non-preventing (weak) reference to a service.
 *
 * Unlike {@link ServiceRef}, this does **not** keep the service alive
 * in memory. The garbage collector can collect the underlying object
 * even while this ref exists. Use `.deref()` to check if the service
 * is still available.
 *
 * @typeParam T - The service type (must be an object).
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const weakRpc = strongRef.toWeak();
 *
 * // In another component — check before use
 * const rpc = weakRpc.deref();
 * if (rpc) {
 *   await rpc.getBalance(pubkey);
 * } else {
 *   // Service was GC'd — re-acquire if needed
 * }
 * ```
 */
export class WeakServiceRef<T extends object> {
  private readonly _ref: WeakRef<T>;

  constructor(value: T) {
    this._ref = new WeakRef(value);
  }

  /**
   * Dereference the weak ref.
   * @returns The service instance, or `undefined` if it was GC'd.
   */
  deref(): T | undefined {
    return this._ref.deref();
  }

  /** Whether the underlying object is still alive (not yet GC'd). */
  get alive(): boolean {
    return this._ref.deref() !== undefined;
  }
}

// ── RefRegistry ────────────────────────────────────────────────

/**
 * Centralized registry that tracks all active {@link ServiceRef}s.
 *
 * Provides ref counting, introspection, and leak detection via
 * `FinalizationRegistry`. Each `SynapseContext` owns at most one
 * `RefRegistry` (created lazily on first `acquireRef()`).
 *
 * @since 1.2.0
 */
export class RefRegistry implements Disposable {
  /** @internal Active refs grouped by token. */
  private readonly _entries = new Map<ServiceToken, Set<ServiceRef<unknown>>>();

  /** @internal FinalizationRegistry for GC-based leak detection. */
  private readonly _leakDetector?: FinalizationRegistry<{
    tokenName: string;
    refId: number;
    acquiredAt: number;
  }>;

  /** @internal Track which ref IDs are still active (for leak detection). */
  private readonly _activeRefIds = new Set<number>();

  /** @internal Monotonically increasing ref ID. */
  private _nextId = 1;

  /** @internal Counters. */
  private _totalAcquired = 0;
  private _totalReleased = 0;
  private _peakActive = 0;
  private _leakedCount = 0;

  /** @internal Leak handlers. */
  private readonly _leakHandlers: Array<(report: LeakReport) => void> = [];

  /** @internal Whether the registry has been disposed. */
  private _disposed = false;

  constructor(config: RefRegistryConfig = {}) {
    const enableLeaks = config.enableLeakDetection !== false;

    if (enableLeaks && typeof FinalizationRegistry !== 'undefined') {
      this._leakDetector = new FinalizationRegistry((held) => {
        // This ref was GC'd without release() being called → leak
        if (this._activeRefIds.has(held.refId)) {
          this._activeRefIds.delete(held.refId);
          this._leakedCount++;

          const report: LeakReport = {
            tokenName: held.tokenName,
            refId: held.refId,
            acquiredAt: held.acquiredAt,
            detectedAt: performance.now(),
          };

          for (const handler of this._leakHandlers) {
            try { handler(report); } catch { /* swallow listener errors */ }
          }
        }
      });
    }
  }

  // ── Acquire & Release ──────────────────────────────────────

  /**
   * Create a tracked ref for a resolved service value.
   *
   * @param token - The service token.
   * @param value - The resolved service instance.
   * @returns A new `ServiceRef<T>` linked to this registry.
   */
  acquire<T>(token: ServiceToken<T>, value: T): ServiceRef<T> {
    if (this._disposed) {
      throw new SynapseError('RefRegistry has been disposed', -32106);
    }

    const id = this._nextId++;
    this._totalAcquired++;

    const ref = new ServiceRef<T>(
      value,
      token,
      (r) => this._handleRelease(token, r as ServiceRef<unknown>),
      id,
    );

    // Track in entries map
    let set = this._entries.get(token);
    if (!set) { set = new Set(); this._entries.set(token, set); }
    set.add(ref as ServiceRef<unknown>);

    // Track active ID
    this._activeRefIds.add(id);
    if (this._activeRefIds.size > this._peakActive) {
      this._peakActive = this._activeRefIds.size;
    }

    // Register with leak detector
    if (this._leakDetector) {
      this._leakDetector.register(
        ref,
        { tokenName: token.name, refId: id, acquiredAt: ref.acquiredAt },
        ref, // unregister token
      );
    }

    return ref;
  }

  /** @internal Handle a ref being released. */
  private _handleRelease(token: ServiceToken, ref: ServiceRef<unknown>): void {
    this._activeRefIds.delete(ref.id);
    this._totalReleased++;

    const set = this._entries.get(token);
    if (set) {
      set.delete(ref);
      if (set.size === 0) this._entries.delete(token);
    }

    // Unregister from leak detector (ref was properly released)
    if (this._leakDetector) {
      this._leakDetector.unregister(ref);
    }
  }

  // ── Ref Counting ───────────────────────────────────────────

  /**
   * Number of active refs for a specific token.
   */
  refCount(token: ServiceToken): number {
    return this._entries.get(token)?.size ?? 0;
  }

  /**
   * Total number of active (unreleased) refs across all tokens.
   */
  totalActive(): number {
    return this._activeRefIds.size;
  }

  // ── Stats & Introspection ──────────────────────────────────

  /**
   * Aggregate statistics snapshot.
   */
  get stats(): RefStats {
    return {
      totalAcquired: this._totalAcquired,
      totalReleased: this._totalReleased,
      active: this._activeRefIds.size,
      peak: this._peakActive,
      leaked: this._leakedCount,
      byToken: this._tokenBreakdown(),
    };
  }

  /** @internal Build per-token breakdown. */
  private _tokenBreakdown(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [token, set] of this._entries) {
      if (set.size > 0) result[token.name] = set.size;
    }
    return result;
  }

  // ── Leak Detection ─────────────────────────────────────────

  /**
   * Check for potential leaks: refs that have been alive longer
   * than `maxAgeMs` without being released.
   *
   * This is a **heuristic** — long-lived refs (e.g. for the lifetime
   * of the app) are expected. Use this for debugging / dev mode.
   *
   * @param maxAgeMs - Threshold in ms. @default 60_000
   */
  checkLeaks(maxAgeMs: number = 60_000): LeakReport[] {
    const now = performance.now();
    const reports: LeakReport[] = [];

    for (const [token, set] of this._entries) {
      for (const ref of set) {
        if (ref.ageMs > maxAgeMs) {
          reports.push({
            tokenName: token.name,
            refId: ref.id,
            acquiredAt: ref.acquiredAt,
            detectedAt: now,
          });
        }
      }
    }

    return reports;
  }

  /**
   * Register a handler for GC-detected leaks.
   *
   * Called when a `ServiceRef` is garbage collected without
   * `.release()` having been called first.
   *
   * @param handler - Receives a {@link LeakReport} for each leak.
   */
  onLeak(handler: (report: LeakReport) => void): void {
    this._leakHandlers.push(handler);
  }

  // ── Cleanup ────────────────────────────────────────────────

  /**
   * Force-release all active refs.
   *
   * Called automatically when the owning `SynapseContext` is disposed.
   * After this, all refs' `.current` will throw {@link RefReleasedError}.
   */
  invalidateAll(): void {
    for (const set of this._entries.values()) {
      // Iterate a copy because release() modifies the set
      for (const ref of [...set]) {
        ref.release();
      }
    }
    this._entries.clear();
    this._activeRefIds.clear();
  }

  /** Dispose the registry — invalidates all refs, clears handlers. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.invalidateAll();
    this._leakHandlers.length = 0;
  }

  /** Whether this registry has been disposed. */
  get isDisposed(): boolean { return this._disposed; }
}

// ── MemoryGuard ────────────────────────────────────────────────

/**
 * Memory safety monitor that wraps a {@link RefRegistry}.
 *
 * Provides configurable thresholds, periodic leak checks, and
 * pressure alerts. Designed for dev-mode diagnostics or production
 * monitoring of SDK memory usage.
 *
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const guard = new MemoryGuard(registry, {
 *   maxRefAgeMs: 30_000,
 *   maxActiveRefs: 50,
 *   checkIntervalMs: 10_000,
 * });
 *
 * guard.onPressure(stats => {
 *   console.warn('⚠️ Memory pressure:', stats.active, 'active refs');
 * });
 *
 * guard.onLeak(report => {
 *   console.error('🔴 Leaked ref:', report.tokenName, '#' + report.refId);
 * });
 * ```
 */
export class MemoryGuard implements Disposable {
  private _timer?: ReturnType<typeof setInterval>;
  private readonly _pressureHandlers: Array<(stats: RefStats) => void> = [];
  private readonly _config: Required<MemoryGuardConfig>;

  constructor(
    private readonly _registry: RefRegistry,
    config: MemoryGuardConfig = {},
  ) {
    this._config = {
      maxRefAgeMs: config.maxRefAgeMs ?? 60_000,
      maxActiveRefs: config.maxActiveRefs ?? 100,
      checkIntervalMs: config.checkIntervalMs ?? 0,
    };

    // Forward leak events from registry
    // (no extra wiring needed — users subscribe via guard.onLeak())

    // Periodic check timer
    if (this._config.checkIntervalMs > 0) {
      this._timer = setInterval(
        () => this._periodicCheck(),
        this._config.checkIntervalMs,
      );
      // unref() so the timer doesn't prevent process.exit()
      if (typeof this._timer === 'object' && 'unref' in this._timer) {
        (this._timer as NodeJS.Timeout).unref();
      }
    }
  }

  // ── Stats ──────────────────────────────────────────────────

  /** Current ref statistics from the underlying registry. */
  get stats(): RefStats { return this._registry.stats; }

  /** Whether the active ref count exceeds the threshold. */
  get underPressure(): boolean {
    return this._registry.totalActive() >= this._config.maxActiveRefs;
  }

  /** Number of currently active refs. */
  get activeRefs(): number {
    return this._registry.totalActive();
  }

  // ── Checks ─────────────────────────────────────────────────

  /**
   * Check for potential leaks (refs older than `maxRefAgeMs`).
   */
  checkLeaks(): LeakReport[] {
    return this._registry.checkLeaks(this._config.maxRefAgeMs);
  }

  // ── Events ─────────────────────────────────────────────────

  /**
   * Subscribe to memory pressure events.
   *
   * Fires when the active ref count exceeds `maxActiveRefs`
   * during a periodic check.
   */
  onPressure(handler: (stats: RefStats) => void): void {
    this._pressureHandlers.push(handler);
  }

  /**
   * Subscribe to GC-detected leak events.
   *
   * Delegates to the underlying {@link RefRegistry.onLeak}.
   */
  onLeak(handler: (report: LeakReport) => void): void {
    this._registry.onLeak(handler);
  }

  // ── Internal ───────────────────────────────────────────────

  /** @internal Periodic check callback. */
  private _periodicCheck(): void {
    if (this.underPressure) {
      const stats = this.stats;
      for (const handler of this._pressureHandlers) {
        try { handler(stats); } catch { /* swallow */ }
      }
    }
  }

  /** Dispose the guard — stops the timer, clears handlers. */
  dispose(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
    this._pressureHandlers.length = 0;
  }
}

// ── ServiceBinding ─────────────────────────────────────────────

/**
 * A batch of acquired refs, bound to a set of tokens.
 *
 * Provides a single `.release()` call that frees all refs at once —
 * ideal for components that consume multiple services and need
 * guaranteed cleanup.
 *
 * @since 1.2.0
 */
export interface ServiceBinding<T extends Record<string, ServiceToken>> {
  /**
   * Lazy-resolved services. Each property resolves and acquires a ref
   * on first access.
   */
  readonly services: { [K in keyof T]: T[K] extends ServiceToken<infer U> ? U : never };
  /** All acquired refs (populated as services are accessed). */
  readonly refs: Map<string, ServiceRef<unknown>>;
  /** Whether any ref is still alive. */
  readonly alive: boolean;
  /** Release all acquired refs. Safe to call multiple times. */
  release(): void;
  /** Alias for {@link release}. */
  dispose(): void;
}

/**
 * Create a binding that acquires tracked refs for multiple tokens.
 *
 * Services are resolved **lazily** on first property access. All refs
 * are released together with a single `.release()` call.
 *
 * @param acquireFn - Function that acquires a ref for a token (usually `ctx.acquireRef.bind(ctx)`).
 * @param tokens    - Record mapping property names to service tokens.
 * @returns A {@link ServiceBinding} with lazy services and batch release.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const binding = createBinding(
 *   token => ctx.acquireRef(token),
 *   { rpc: Tokens.RPC, das: Tokens.DAS, programs: Tokens.PROGRAMS },
 * );
 *
 * // Use services (each is acquired on first access):
 * await binding.services.rpc.getBalance(pubkey);
 * await binding.services.das.getAsset(assetId);
 *
 * // Release ALL refs at once:
 * binding.release();
 * ```
 */
export function createBinding<T extends Record<string, ServiceToken>>(
  acquireFn: <U>(token: ServiceToken<U>) => ServiceRef<U>,
  tokens: T,
): ServiceBinding<T> {
  const refs = new Map<string, ServiceRef<unknown>>();
  let released = false;

  type Services = { [K in keyof T]: T[K] extends ServiceToken<infer U> ? U : never };

  const services = new Proxy({} as Services, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;
      if (released) {
        throw new SynapseError(
          'ServiceBinding has been released. Cannot access services after release.',
          -32107,
        );
      }

      // Return cached if already acquired
      const existing = refs.get(prop);
      if (existing) return existing.current;

      // Acquire new ref
      const token = tokens[prop];
      if (!token) return undefined;

      const ref = acquireFn(token);
      refs.set(prop, ref as ServiceRef<unknown>);
      return ref.current;
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

  return {
    services,
    refs,
    get alive() { return !released && [...refs.values()].some(r => r.alive); },
    release() {
      if (released) return;
      released = true;
      for (const ref of refs.values()) {
        ref.release();
      }
    },
    dispose() { this.release(); },
  };
}
