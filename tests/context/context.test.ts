/**
 * Tests for the Synapse Context Provider system.
 *
 * Verifies:
 * - Service tokens (creation, identity, type safety)
 * - Container (register, resolve, lifecycle, disposal)
 * - Provider variants (value, factory, class, alias, async)
 * - Scoping (child inherits parent, scoped lifecycle isolation)
 * - Circular dependency detection
 * - Middleware (resolve interception, chaining)
 * - Error handling (not found, async guard, disposed)
 * - Events (registered, resolved, disposed)
 * - Hooks (global context, useService, createServiceHook)
 * - Auto-wire (proxy-based lazy service bag)
 * - Built-in providers (Tokens, createSynapseContext)
 * - Server middleware (request-scoped contexts)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  // Core
  SynapseContext,
  createToken,
  createBareContext,
  Tokens,

  // Providers
  createSynapseContext,

  // Hooks
  setGlobalContext,
  getContext,
  tryGetContext,
  useService,
  tryUseService,
  createServiceHook,
  createBoundHook,
  createReactAdapter,
  createServerMiddleware,
  autoWire,

  // Errors
  ServiceNotFoundError,
  CircularDependencyError,
  AsyncProviderError,

  // Utils
  isDisposable,

  // Types
  type ServiceToken,
  type ServiceResolver,
  type Disposable,
  type ContextModule,
  ResolveMiddleware,
} from '../../src/context/index';

// ── Helpers ────────────────────────────────────────────────────

interface Logger { log(msg: string): void; level: string; }
interface Database { query(sql: string): string; }
interface Cache { get(key: string): string | undefined; set(key: string, val: string): void; }

const LOGGER = createToken<Logger>('Logger');
const DB = createToken<Database>('Database');
const CACHE = createToken<Cache>('Cache');
const COUNTER = createToken<{ count: number }>('Counter');
const ASYNC_SVC = createToken<{ ready: boolean }>('AsyncService');

function mockLogger(): Logger {
  return { log: vi.fn(), level: 'debug' };
}

function mockDb(): Database {
  return { query: vi.fn(() => 'result') };
}

/* ═══════════════════════════════════════════════════════════════
 *  1. Service Tokens
 * ═══════════════════════════════════════════════════════════════ */

describe('Service Tokens', () => {
  it('createToken returns a frozen object with the given name', () => {
    const token = createToken<string>('MyService');
    expect(token.name).toBe('MyService');
    expect(Object.isFrozen(token)).toBe(true);
  });

  it('each token is a unique identity', () => {
    const a = createToken<string>('Svc');
    const b = createToken<string>('Svc');
    expect(a).not.toBe(b); // Different objects even with same name
  });

  it('tokens work as Map keys', () => {
    const token = createToken<number>('Num');
    const map = new Map<ServiceToken, number>();
    map.set(token, 42);
    expect(map.get(token)).toBe(42);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. Container — Registration & Resolution
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Registration & Resolution', () => {
  let ctx: SynapseContext;

  beforeEach(() => { ctx = new SynapseContext(); });
  afterEach(async () => { await ctx.dispose(); });

  it('registers and resolves a value provider', () => {
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });
    expect(ctx.resolve(LOGGER)).toBe(logger);
  });

  it('registers and resolves a factory provider', () => {
    ctx.register(LOGGER, { useFactory: () => mockLogger() });
    const result = ctx.resolve(LOGGER);
    expect(result.level).toBe('debug');
  });

  it('registers and resolves a class provider', () => {
    class MyLogger implements Logger {
      level = 'info';
      log = vi.fn();
      constructor(_resolver: ServiceResolver) {}
    }

    ctx.register(LOGGER, { useClass: MyLogger });
    const result = ctx.resolve(LOGGER);
    expect(result).toBeInstanceOf(MyLogger);
    expect(result.level).toBe('info');
  });

  it('registers and resolves an alias provider', () => {
    const logger = mockLogger();
    const ALIAS = createToken<Logger>('LoggerAlias');
    ctx.register(LOGGER, { useValue: logger });
    ctx.register(ALIAS, { useExisting: LOGGER });
    expect(ctx.resolve(ALIAS)).toBe(logger);
  });

  it('resolves async factory with resolveAsync', async () => {
    ctx.register(ASYNC_SVC, {
      useAsyncFactory: async () => {
        return { ready: true };
      },
    });
    const result = await ctx.resolveAsync(ASYNC_SVC);
    expect(result.ready).toBe(true);
  });

  it('throws AsyncProviderError when resolving async factory synchronously', () => {
    ctx.register(ASYNC_SVC, {
      useAsyncFactory: async () => ({ ready: true }),
    });
    expect(() => ctx.resolve(ASYNC_SVC)).toThrow(AsyncProviderError);
  });

  it('factory receives the resolver for dependency injection', () => {
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });
    ctx.register(DB, {
      useFactory: (r) => {
        const log = r.resolve(LOGGER);
        return { query: (sql: string) => { log.log(sql); return 'ok'; } };
      },
    });

    const db = ctx.resolve(DB);
    db.query('SELECT 1');
    expect(logger.log).toHaveBeenCalledWith('SELECT 1');
  });

  it('registerMany registers multiple services', () => {
    ctx.registerMany([
      { token: LOGGER, provider: { useValue: mockLogger() } },
      { token: DB, provider: { useValue: mockDb() } },
    ]);
    expect(ctx.has(LOGGER)).toBe(true);
    expect(ctx.has(DB)).toBe(true);
  });

  it('registerIfMissing does not override existing', () => {
    const first = mockLogger();
    const second = mockLogger();
    ctx.register(LOGGER, { useValue: first });
    ctx.registerIfMissing(LOGGER, { useValue: second });
    expect(ctx.resolve(LOGGER)).toBe(first);
  });

  it('registerIfMissing registers when missing', () => {
    const logger = mockLogger();
    ctx.registerIfMissing(LOGGER, { useValue: logger });
    expect(ctx.resolve(LOGGER)).toBe(logger);
  });

  it('has returns true for registered tokens', () => {
    ctx.register(LOGGER, { useValue: mockLogger() });
    expect(ctx.has(LOGGER)).toBe(true);
    expect(ctx.has(DB)).toBe(false);
  });

  it('tryResolve returns undefined for missing tokens', () => {
    expect(ctx.tryResolve(LOGGER)).toBeUndefined();
  });

  it('tryResolve returns the service when present', () => {
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });
    expect(ctx.tryResolve(LOGGER)).toBe(logger);
  });

  it('throws ServiceNotFoundError for unregistered tokens', () => {
    expect(() => ctx.resolve(LOGGER)).toThrow(ServiceNotFoundError);
  });

  it('supports method chaining on register', () => {
    const result = ctx
      .register(LOGGER, { useValue: mockLogger() })
      .register(DB, { useValue: mockDb() });
    expect(result).toBe(ctx);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. Lifecycles
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Lifecycles', () => {
  let ctx: SynapseContext;

  beforeEach(() => { ctx = new SynapseContext(); });
  afterEach(async () => { await ctx.dispose(); });

  it('singleton: returns the same instance on multiple resolves', () => {
    let callCount = 0;
    ctx.register(COUNTER, {
      useFactory: () => ({ count: ++callCount }),
      lifecycle: 'singleton',
    });

    const a = ctx.resolve(COUNTER);
    const b = ctx.resolve(COUNTER);
    expect(a).toBe(b);
    expect(a.count).toBe(1);
  });

  it('transient: creates new instance on each resolve', () => {
    let callCount = 0;
    ctx.register(COUNTER, {
      useFactory: () => ({ count: ++callCount }),
      lifecycle: 'transient',
    });

    const a = ctx.resolve(COUNTER);
    const b = ctx.resolve(COUNTER);
    expect(a).not.toBe(b);
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
  });

  it('scoped: creates one instance per scope', () => {
    let callCount = 0;
    ctx.register(COUNTER, {
      useFactory: () => ({ count: ++callCount }),
      lifecycle: 'scoped',
    });

    const scope1 = ctx.createScope('s1');
    const scope2 = ctx.createScope('s2');

    const a = scope1.resolve(COUNTER);
    const b = scope1.resolve(COUNTER);
    const c = scope2.resolve(COUNTER);

    expect(a).toBe(b); // Same within scope1
    expect(a).not.toBe(c); // Different across scopes
    expect(a.count).toBe(1);
    expect(c.count).toBe(2);

    scope1.dispose();
    scope2.dispose();
  });

  it('value providers are always singletons', () => {
    const obj = { count: 1 };
    ctx.register(COUNTER, { useValue: obj });

    const a = ctx.resolve(COUNTER);
    const b = ctx.resolve(COUNTER);
    expect(a).toBe(b);
    expect(a).toBe(obj);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  4. Scoping
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Scoping', () => {
  let root: SynapseContext;

  beforeEach(() => { root = new SynapseContext('root'); });
  afterEach(async () => { await root.dispose(); });

  it('child scope inherits parent registrations', () => {
    const logger = mockLogger();
    root.register(LOGGER, { useValue: logger });

    const child = root.createScope('child');
    expect(child.resolve(LOGGER)).toBe(logger);
  });

  it('child scope can override parent registrations', () => {
    const parentLogger = mockLogger();
    const childLogger = mockLogger();
    root.register(LOGGER, { useValue: parentLogger });

    const child = root.createScope('child');
    child.register(LOGGER, { useValue: childLogger });

    expect(root.resolve(LOGGER)).toBe(parentLogger);
    expect(child.resolve(LOGGER)).toBe(childLogger);
  });

  it('child scope has returns true for parent tokens', () => {
    root.register(LOGGER, { useValue: mockLogger() });
    const child = root.createScope('child');
    expect(child.has(LOGGER)).toBe(true);
  });

  it('createScope generates unique IDs when none provided', () => {
    const a = root.createScope();
    const b = root.createScope();
    expect(a.scopeId).not.toBe(b.scopeId);
    expect(a.scopeId.startsWith('scope-')).toBe(true);
  });

  it('disposing parent disposes children', async () => {
    const child = root.createScope('child');
    const grandchild = child.createScope('grandchild');

    await root.dispose();

    expect(root.isDisposed).toBe(true);
    expect(child.isDisposed).toBe(true);
    expect(grandchild.isDisposed).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. Circular Dependency Detection
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Circular Dependencies', () => {
  it('detects direct circular dependency', async () => {
    const A = createToken<string>('A');
    const B = createToken<string>('B');

    const ctx = new SynapseContext();
    ctx.register(A, { useFactory: (r) => r.resolve(B) + '!' });
    ctx.register(B, { useFactory: (r) => r.resolve(A) + '?' });

    expect(() => ctx.resolve(A)).toThrow(CircularDependencyError);
    await ctx.dispose();
  });

  it('detects self-referential dependency', async () => {
    const SELF = createToken<string>('Self');
    const ctx = new SynapseContext();
    ctx.register(SELF, { useFactory: (r) => r.resolve(SELF) });
    expect(() => ctx.resolve(SELF)).toThrow(CircularDependencyError);
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. Middleware
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Middleware', () => {
  it('middleware wraps resolve calls', async () => {
    const ctx = new SynapseContext();
    const calls: string[] = [];

    ctx.use((token, next) => {
      calls.push(`before:${token.name}`);
      const result = next();
      calls.push(`after:${token.name}`);
      return result;
    });

    ctx.register(LOGGER, { useValue: mockLogger() });
    ctx.resolve(LOGGER);

    expect(calls).toEqual(['before:Logger', 'after:Logger']);
    await ctx.dispose();
  });

  it('multiple middlewares execute in order (first-in = outermost)', async () => {
    const ctx = new SynapseContext();
    const order: number[] = [];

    ctx.use((_token, next) => { order.push(1); const r = next(); order.push(4); return r; });
    ctx.use((_token, next) => { order.push(2); const r = next(); order.push(3); return r; });

    ctx.register(LOGGER, { useValue: mockLogger() });
    ctx.resolve(LOGGER);

    expect(order).toEqual([1, 2, 3, 4]);
    await ctx.dispose();
  });

  it('middleware can decorate the resolved service', async () => {
    const ctx = new SynapseContext();

    ctx.use(((_token, next) => {
      const svc = next() as Logger;
      return { ...svc, level: 'warn' };
    }) as ResolveMiddleware);

    ctx.register(LOGGER, {
      useFactory: () => mockLogger(),
      lifecycle: 'transient', // so middleware runs each time
    });

    const result = ctx.resolve(LOGGER);
    expect(result.level).toBe('warn');
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. Disposal
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Disposal', () => {
  it('calls dispose on Disposable services', async () => {
    const ctx = new SynapseContext();
    const disposeFn = vi.fn();

    const SVC = createToken<Disposable & { active: boolean }>('DisposableSvc');
    ctx.register(SVC, {
      useValue: { active: true, dispose: disposeFn },
    });

    // Must resolve to cache the instance
    ctx.resolve(SVC);

    const count = await ctx.dispose();
    expect(disposeFn).toHaveBeenCalledOnce();
    expect(count).toBe(1);
  });

  it('throws on resolve after disposal', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });
    await ctx.dispose();

    expect(() => ctx.resolve(LOGGER)).toThrow(/disposed/);
  });

  it('dispose is idempotent', async () => {
    const ctx = new SynapseContext();
    const count1 = await ctx.dispose();
    const count2 = await ctx.dispose();
    expect(count2).toBe(0);
  });

  it('isDisposable type guard works correctly', () => {
    expect(isDisposable({ dispose: () => {} })).toBe(true);
    expect(isDisposable({ dispose: 'not a function' })).toBe(false);
    expect(isDisposable({})).toBe(false);
    expect(isDisposable(null)).toBe(false);
    expect(isDisposable(42)).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. Events
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Events', () => {
  it('emits registered event on registration', async () => {
    const ctx = new SynapseContext();
    const handler = vi.fn();
    ctx.on('registered', handler);

    ctx.register(LOGGER, { useValue: mockLogger() }, ['core']);

    expect(handler).toHaveBeenCalledWith({ token: LOGGER, tags: ['core'] });
    await ctx.dispose();
  });

  it('emits resolved event on resolution', async () => {
    const ctx = new SynapseContext();
    const handler = vi.fn();
    ctx.on('resolved', handler);

    ctx.register(LOGGER, { useValue: mockLogger() });
    ctx.resolve(LOGGER);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        token: LOGGER,
        lifecycle: 'singleton',
      }),
    );
    await ctx.dispose();
  });

  it('emits error event on resolution failure', async () => {
    const ctx = new SynapseContext();
    const handler = vi.fn();
    ctx.on('error', handler);

    try { ctx.resolve(LOGGER); } catch { /* expected */ }

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        token: LOGGER,
        error: expect.any(ServiceNotFoundError),
      }),
    );
    await ctx.dispose();
  });

  it('emits scopeCreated event', async () => {
    const ctx = new SynapseContext();
    const handler = vi.fn();
    ctx.on('scopeCreated', handler);

    ctx.createScope('test-scope');

    expect(handler).toHaveBeenCalledWith({ scopeId: 'test-scope' });
    await ctx.dispose();
  });

  it('off removes event handler', async () => {
    const ctx = new SynapseContext();
    const handler = vi.fn();
    ctx.on('registered', handler);
    ctx.off('registered', handler);

    ctx.register(LOGGER, { useValue: mockLogger() });
    expect(handler).not.toHaveBeenCalled();
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. Tags & resolveByTag
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Tags', () => {
  it('resolveByTag returns services matching the tag', async () => {
    const ctx = new SynapseContext();
    const logger = mockLogger();
    const db = mockDb();
    const OTHER = createToken<number>('Other');

    ctx.register(LOGGER, { useValue: logger }, ['core']);
    ctx.register(DB, { useValue: db }, ['core', 'data']);
    ctx.register(OTHER, { useValue: 42 }, ['misc']);

    const coreServices = ctx.resolveByTag('core');
    expect(coreServices).toHaveLength(2);
    expect(coreServices).toContain(logger);
    expect(coreServices).toContain(db);

    const dataServices = ctx.resolveByTag('data');
    expect(dataServices).toHaveLength(1);
    expect(dataServices).toContain(db);

    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  10. Introspection
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Introspection', () => {
  it('tokens returns registered tokens for this scope', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });
    ctx.register(DB, { useValue: mockDb() });

    expect(ctx.tokens).toHaveLength(2);
    expect(ctx.tokens).toContain(LOGGER);
    expect(ctx.tokens).toContain(DB);
    await ctx.dispose();
  });

  it('size returns registration count', async () => {
    const ctx = new SynapseContext();
    expect(ctx.size).toBe(0);
    ctx.register(LOGGER, { useValue: mockLogger() });
    expect(ctx.size).toBe(1);
    await ctx.dispose();
  });

  it('allTokens includes parent scope tokens', async () => {
    const parent = new SynapseContext();
    parent.register(LOGGER, { useValue: mockLogger() });

    const child = parent.createScope('child');
    child.register(DB, { useValue: mockDb() });

    expect(child.allTokens).toHaveLength(2);
    await parent.dispose();
  });

  it('snapshot returns debug info', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() }, ['core']);
    ctx.resolve(LOGGER);

    const snap = ctx.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toEqual({
      token: 'Logger',
      lifecycle: 'singleton',
      resolved: true,
      tags: ['core'],
    });
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  11. Global Context & Hooks
 * ═══════════════════════════════════════════════════════════════ */

describe('Global Context & Hooks', () => {
  afterEach(() => { setGlobalContext(undefined); });

  it('getContext throws when no global context is set', () => {
    setGlobalContext(undefined);
    expect(() => getContext()).toThrow(/No Synapse context/);
  });

  it('tryGetContext returns undefined when not set', () => {
    setGlobalContext(undefined);
    expect(tryGetContext()).toBeUndefined();
  });

  it('setGlobalContext + getContext round-trips', () => {
    const ctx = new SynapseContext();
    setGlobalContext(ctx);
    expect(getContext()).toBe(ctx);
    expect(tryGetContext()).toBe(ctx);
  });

  it('useService resolves from global context', async () => {
    const ctx = new SynapseContext();
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });
    setGlobalContext(ctx);

    expect(useService(LOGGER)).toBe(logger);
    await ctx.dispose();
  });

  it('tryUseService returns undefined when no global context', () => {
    setGlobalContext(undefined);
    expect(tryUseService(LOGGER)).toBeUndefined();
  });

  it('createServiceHook returns a callable hook', async () => {
    const ctx = new SynapseContext();
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });
    setGlobalContext(ctx);

    const useLogger = createServiceHook(LOGGER);
    expect(useLogger()).toBe(logger);
    await ctx.dispose();
  });

  it('createBoundHook binds to a specific context', async () => {
    const ctx = new SynapseContext();
    const logger = mockLogger();
    ctx.register(LOGGER, { useValue: logger });

    const useLogger = createBoundHook(ctx, LOGGER);
    // Works without global context
    expect(useLogger()).toBe(logger);
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  12. autoWire
 * ═══════════════════════════════════════════════════════════════ */

describe('autoWire', () => {
  it('creates a proxy that lazily resolves services', async () => {
    const ctx = new SynapseContext();
    const logger = mockLogger();
    const db = mockDb();
    ctx.register(LOGGER, { useValue: logger });
    ctx.register(DB, { useValue: db });

    const services = autoWire(ctx, { logger: LOGGER, db: DB });

    expect(services.logger).toBe(logger);
    expect(services.db).toBe(db);
    await ctx.dispose();
  });

  it('caches resolved services', async () => {
    const ctx = new SynapseContext();
    let calls = 0;
    ctx.register(COUNTER, {
      useFactory: () => ({ count: ++calls }),
      lifecycle: 'transient', // Would normally create new each time
    });

    const services = autoWire(ctx, { counter: COUNTER });

    const a = services.counter;
    const b = services.counter;
    // autoWire caches internally, so even transient only resolves once
    expect(a).toBe(b);
    expect(calls).toBe(1);
    await ctx.dispose();
  });

  it('has() works on the proxy', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });

    const services = autoWire(ctx, { logger: LOGGER });

    expect('logger' in services).toBe(true);
    expect('missing' in services).toBe(false);
    await ctx.dispose();
  });

  it('ownKeys returns the token property names', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });
    ctx.register(DB, { useValue: mockDb() });

    const services = autoWire(ctx, { logger: LOGGER, db: DB });

    expect(Object.keys(services)).toEqual(['logger', 'db']);
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  13. React Adapter
 * ═══════════════════════════════════════════════════════════════ */

describe('React Adapter', () => {
  afterEach(() => { setGlobalContext(undefined); });

  it('createReactAdapter returns an adapter with the context', () => {
    const ctx = new SynapseContext();
    const adapter = createReactAdapter(ctx);

    expect(adapter.name).toBe('react');
    expect(adapter.context).toBe(ctx);
  });

  it('init sets global context by default', () => {
    const ctx = new SynapseContext();
    const adapter = createReactAdapter(ctx);
    adapter.init();

    expect(tryGetContext()).toBe(ctx);
  });

  it('init with setGlobal=false does not set global', () => {
    const ctx = new SynapseContext();
    const adapter = createReactAdapter(ctx);
    adapter.init({ setGlobal: false });

    expect(tryGetContext()).toBeUndefined();
  });

  it('destroy clears the global context', () => {
    const ctx = new SynapseContext();
    const adapter = createReactAdapter(ctx);
    adapter.init();
    expect(tryGetContext()).toBe(ctx);

    adapter.destroy();
    expect(tryGetContext()).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  14. Server Middleware
 * ═══════════════════════════════════════════════════════════════ */

describe('Server Middleware', () => {
  it('creates scoped context per request', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });

    const middleware = createServerMiddleware(ctx);

    const req: Record<string, unknown> = {};
    const res = { on: vi.fn() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(req['synapseCtx']).toBeDefined();
    expect((req['synapseCtx'] as SynapseContext).scopeId).toMatch(/^req-/);
    expect(next).toHaveBeenCalled();

    // Scoped context should inherit parent
    const scoped = req['synapseCtx'] as SynapseContext;
    expect(scoped.resolve(LOGGER)).toBeDefined();

    await ctx.dispose();
  });

  it('uses custom context key', async () => {
    const ctx = new SynapseContext();
    const middleware = createServerMiddleware(ctx, { contextKey: 'sdk' });

    const req: Record<string, unknown> = {};
    const next = vi.fn();

    middleware(req, {}, next);

    expect(req['sdk']).toBeDefined();
    await ctx.dispose();
  });

  it('non-scoped mode passes root context', async () => {
    const ctx = new SynapseContext();
    const middleware = createServerMiddleware(ctx, { scopePerRequest: false });

    const req: Record<string, unknown> = {};
    const next = vi.fn();

    middleware(req, {}, next);

    expect(req['synapseCtx']).toBe(ctx);
    await ctx.dispose();
  });

  it('auto-disposes scope on response finish', async () => {
    const ctx = new SynapseContext();
    const middleware = createServerMiddleware(ctx);

    const finishHandlers: Array<() => void> = [];
    const req: Record<string, unknown> = {};
    const res = { on: vi.fn((event: string, fn: () => void) => { if (event === 'finish') finishHandlers.push(fn); }) };
    const next = vi.fn();

    middleware(req, res, next);

    const scope = req['synapseCtx'] as SynapseContext;
    expect(scope.isDisposed).toBe(false);

    // Simulate response finish
    for (const fn of finishHandlers) fn();

    // Give the async dispose a tick
    await new Promise(r => setTimeout(r, 10));
    expect(scope.isDisposed).toBe(true);

    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  15. Built-in Tokens
 * ═══════════════════════════════════════════════════════════════ */

describe('Built-in Tokens', () => {
  it('Tokens object contains all expected token keys', () => {
    expect(Tokens.CONFIG).toBeDefined();
    expect(Tokens.CLIENT).toBeDefined();
    expect(Tokens.TRANSPORT).toBeDefined();
    expect(Tokens.RPC).toBeDefined();
    expect(Tokens.DAS).toBeDefined();
    expect(Tokens.WS).toBeDefined();
    expect(Tokens.GRPC).toBeDefined();
    expect(Tokens.ACCOUNTS).toBeDefined();
    expect(Tokens.PROGRAMS).toBeDefined();
    expect(Tokens.AI_TOOLS).toBeDefined();
    expect(Tokens.PROTOCOL_TOOLS).toBeDefined();
  });

  it('all tokens have unique names', () => {
    const names = Object.values(Tokens).map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tokens are frozen', () => {
    for (const token of Object.values(Tokens)) {
      expect(Object.isFrozen(token)).toBe(true);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  16. createBareContext
 * ═══════════════════════════════════════════════════════════════ */

describe('createBareContext', () => {
  it('creates an empty context', async () => {
    const ctx = createBareContext();
    expect(ctx.size).toBe(0);
    expect(ctx.scopeId).toBe('bare');
    await ctx.dispose();
  });

  it('accepts custom scope ID', async () => {
    const ctx = createBareContext('custom');
    expect(ctx.scopeId).toBe('custom');
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  17. ContextModule interface
 * ═══════════════════════════════════════════════════════════════ */

describe('ContextModule', () => {
  it('custom modules can register services', async () => {
    const ANALYTICS = createToken<{ track: (e: string) => void }>('Analytics');

    const analyticsModule: ContextModule = {
      name: 'analytics',
      register(ctx) {
        ctx.register(ANALYTICS, {
          useValue: { track: vi.fn() },
        }, ['analytics']);
      },
    };

    const ctx = createBareContext();
    analyticsModule.register(ctx);

    const analytics = ctx.resolve(ANALYTICS);
    expect(analytics.track).toBeDefined();
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  18. Edge cases
 * ═══════════════════════════════════════════════════════════════ */

describe('Edge cases', () => {
  it('resolving from a disposed scope throws', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });
    await ctx.dispose();

    expect(() => ctx.resolve(LOGGER)).toThrow(/disposed/);
  });

  it('registering on a disposed context throws', async () => {
    const ctx = new SynapseContext();
    await ctx.dispose();

    expect(() => ctx.register(LOGGER, { useValue: mockLogger() })).toThrow(/disposed/);
  });

  it('creating scope on disposed context throws', async () => {
    const ctx = new SynapseContext();
    await ctx.dispose();

    expect(() => ctx.createScope()).toThrow(/disposed/);
  });

  it('deep dependency chain resolves correctly', async () => {
    const A = createToken<string>('A');
    const B = createToken<string>('B');
    const C = createToken<string>('C');

    const ctx = new SynapseContext();
    ctx.register(C, { useValue: 'hello' });
    ctx.register(B, { useFactory: (r) => r.resolve(C) + ' world' });
    ctx.register(A, { useFactory: (r) => r.resolve(B) + '!' });

    expect(ctx.resolve(A)).toBe('hello world!');
    await ctx.dispose();
  });

  it('re-registering a token overrides the previous provider', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: { log: vi.fn(), level: 'debug' } as Logger });
    ctx.register(LOGGER, { useValue: { log: vi.fn(), level: 'error' } as Logger });

    expect(ctx.resolve(LOGGER).level).toBe('error');
    await ctx.dispose();
  });

  it('async resolveAsync works for sync providers too', async () => {
    const ctx = new SynapseContext();
    ctx.register(LOGGER, { useValue: mockLogger() });

    const result = await ctx.resolveAsync(LOGGER);
    expect(result.level).toBe('debug');
    await ctx.dispose();
  });
});
