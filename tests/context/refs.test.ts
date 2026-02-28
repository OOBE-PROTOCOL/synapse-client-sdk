/**
 * Tests for the memory-safe service reference system.
 *
 * Verifies:
 * - ServiceRef (acquire, release, current, alive, RAII patterns)
 * - WeakServiceRef (deref, alive, GC-safe)
 * - RefRegistry (ref counting, stats, invalidation, leak detection)
 * - MemoryGuard (thresholds, pressure alerts, periodic checks)
 * - SynapseContext integration (acquireRef, bind, refCount, dispose)
 * - Hooks integration (useSharedRef, withRef, withRefAsync, useBoundServices)
 * - ServiceBinding (lazy resolution, batch release)
 * - Edge cases (double release, released access, disposed context)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  // Context
  SynapseContext,
  createToken,
  createBareContext,

  // Refs
  ServiceRef,
  WeakServiceRef,
  RefRegistry,
  MemoryGuard,
  RefReleasedError,
  createBinding,

  // Hooks
  setGlobalContext,
  useSharedRef,
  useBoundServices,
  withRef,
  withRefAsync,
  createRefHook,

  // Errors
  ServiceNotFoundError,

  // Types
  type ServiceToken,
} from '../../src/context/index';

// ── Helpers ────────────────────────────────────────────────────

interface RpcService { getBalance(addr: string): number; getSlot(): number; }
interface DasService { getAsset(id: string): unknown; }
interface Logger { log(msg: string): void; level: string; }

const RPC = createToken<RpcService>('RPC');
const DAS = createToken<DasService>('DAS');
const LOGGER = createToken<Logger>('Logger');
const COUNTER = createToken<{ count: number }>('Counter');

function mockRpc(): RpcService {
  return { getBalance: vi.fn(() => 1000), getSlot: vi.fn(() => 42) };
}
function mockDas(): DasService {
  return { getAsset: vi.fn(() => ({ id: 'abc' })) };
}
function mockLogger(): Logger {
  return { log: vi.fn(), level: 'debug' };
}

/* ═══════════════════════════════════════════════════════════════
 *  1. ServiceRef — Core Behavior
 * ═══════════════════════════════════════════════════════════════ */

describe('ServiceRef', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('current returns the service value', () => {
    const rpc = mockRpc();
    const ref = registry.acquire(RPC, rpc);
    expect(ref.current).toBe(rpc);
  });

  it('alive is true before release', () => {
    const ref = registry.acquire(RPC, mockRpc());
    expect(ref.alive).toBe(true);
  });

  it('alive is false after release', () => {
    const ref = registry.acquire(RPC, mockRpc());
    ref.release();
    expect(ref.alive).toBe(false);
  });

  it('current throws RefReleasedError after release', () => {
    const ref = registry.acquire(RPC, mockRpc());
    ref.release();
    expect(() => ref.current).toThrow(RefReleasedError);
    expect(() => ref.current).toThrow(/released/);
  });

  it('release is idempotent', () => {
    const ref = registry.acquire(RPC, mockRpc());
    ref.release();
    ref.release(); // no-op
    expect(ref.alive).toBe(false);
    expect(registry.refCount(RPC)).toBe(0);
  });

  it('dispose is an alias for release', () => {
    const ref = registry.acquire(RPC, mockRpc());
    ref.dispose();
    expect(ref.alive).toBe(false);
  });

  it('has a unique monotonic ID', () => {
    const a = registry.acquire(RPC, mockRpc());
    const b = registry.acquire(RPC, mockRpc());
    expect(b.id).toBeGreaterThan(a.id);
  });

  it('token returns the token it was acquired for', () => {
    const ref = registry.acquire(RPC, mockRpc());
    expect(ref.token).toBe(RPC);
  });

  it('acquiredAt is set to a performance.now() timestamp', () => {
    const before = performance.now();
    const ref = registry.acquire(RPC, mockRpc());
    const after = performance.now();
    expect(ref.acquiredAt).toBeGreaterThanOrEqual(before);
    expect(ref.acquiredAt).toBeLessThanOrEqual(after);
  });

  it('ageMs increases over time', async () => {
    const ref = registry.acquire(RPC, mockRpc());
    await new Promise(r => setTimeout(r, 10));
    expect(ref.ageMs).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. ServiceRef — RAII Patterns
 * ═══════════════════════════════════════════════════════════════ */

describe('ServiceRef — RAII', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('use() executes fn and auto-releases', () => {
    const rpc = mockRpc();
    const ref = registry.acquire(RPC, rpc);

    const result = ref.use(svc => svc.getBalance('abc'));

    expect(result).toBe(1000);
    expect(rpc.getBalance).toHaveBeenCalledWith('abc');
    expect(ref.alive).toBe(false);
    expect(registry.refCount(RPC)).toBe(0);
  });

  it('use() releases even on error', () => {
    const ref = registry.acquire(RPC, mockRpc());

    expect(() => ref.use(() => { throw new Error('boom'); })).toThrow('boom');
    expect(ref.alive).toBe(false);
  });

  it('useAsync() executes async fn and auto-releases', async () => {
    const rpc = mockRpc();
    const ref = registry.acquire(RPC, rpc);

    const result = await ref.useAsync(async svc => {
      return svc.getSlot();
    });

    expect(result).toBe(42);
    expect(ref.alive).toBe(false);
  });

  it('useAsync() releases even on async error', async () => {
    const ref = registry.acquire(RPC, mockRpc());

    await expect(
      ref.useAsync(async () => { throw new Error('async-boom'); }),
    ).rejects.toThrow('async-boom');

    expect(ref.alive).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. ServiceRef — Weak References
 * ═══════════════════════════════════════════════════════════════ */

describe('ServiceRef — toWeak', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('toWeak() returns a WeakServiceRef', () => {
    const ref = registry.acquire(RPC, mockRpc());
    const weak = ref.toWeak();

    expect(weak).toBeInstanceOf(WeakServiceRef);
    expect(weak.deref()).toBe(ref.current);
    expect(weak.alive).toBe(true);
  });

  it('toWeak() throws for primitive values', () => {
    const NUM = createToken<number>('Num');
    const ref = registry.acquire(NUM, 42);

    expect(() => ref.toWeak()).toThrow(/non-object/);
  });

  it('toWeak() throws for null values', () => {
    const NULL = createToken<null>('Null');
    const ref = registry.acquire(NULL, null);

    expect(() => ref.toWeak()).toThrow(/non-object/);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  4. WeakServiceRef
 * ═══════════════════════════════════════════════════════════════ */

describe('WeakServiceRef', () => {
  it('deref returns the object while it lives', () => {
    const obj = { value: 'hello' };
    const weak = new WeakServiceRef(obj);
    expect(weak.deref()).toBe(obj);
    expect(weak.alive).toBe(true);
  });

  it('alive reflects whether the object can be deref\'d', () => {
    const weak = new WeakServiceRef({ value: 42 });
    expect(weak.alive).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. RefRegistry — Ref Counting
 * ═══════════════════════════════════════════════════════════════ */

describe('RefRegistry — Ref Counting', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('refCount starts at 0', () => {
    expect(registry.refCount(RPC)).toBe(0);
  });

  it('refCount increments on acquire', () => {
    registry.acquire(RPC, mockRpc());
    expect(registry.refCount(RPC)).toBe(1);

    registry.acquire(RPC, mockRpc());
    expect(registry.refCount(RPC)).toBe(2);
  });

  it('refCount decrements on release', () => {
    const a = registry.acquire(RPC, mockRpc());
    const b = registry.acquire(RPC, mockRpc());

    a.release();
    expect(registry.refCount(RPC)).toBe(1);

    b.release();
    expect(registry.refCount(RPC)).toBe(0);
  });

  it('totalActive tracks all tokens', () => {
    registry.acquire(RPC, mockRpc());
    registry.acquire(DAS, mockDas());
    expect(registry.totalActive()).toBe(2);
  });

  it('multiple refs to same singleton share ref count', () => {
    const singletonRpc = mockRpc();
    const a = registry.acquire(RPC, singletonRpc);
    const b = registry.acquire(RPC, singletonRpc);

    expect(a.current).toBe(b.current); // same instance
    expect(registry.refCount(RPC)).toBe(2);

    a.release();
    expect(registry.refCount(RPC)).toBe(1);
    // b still valid
    expect(b.alive).toBe(true);
    expect(b.current).toBe(singletonRpc);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. RefRegistry — Stats
 * ═══════════════════════════════════════════════════════════════ */

describe('RefRegistry — Stats', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('stats reflects acquired/released counts', () => {
    const a = registry.acquire(RPC, mockRpc());
    registry.acquire(DAS, mockDas());
    a.release();

    const stats = registry.stats;
    expect(stats.totalAcquired).toBe(2);
    expect(stats.totalReleased).toBe(1);
    expect(stats.active).toBe(1);
  });

  it('stats tracks peak active refs', () => {
    const a = registry.acquire(RPC, mockRpc());
    const b = registry.acquire(DAS, mockDas());
    const c = registry.acquire(LOGGER, mockLogger());
    expect(registry.stats.peak).toBe(3);

    a.release();
    b.release();
    c.release();
    expect(registry.stats.peak).toBe(3); // peak doesn't decrease
  });

  it('stats.byToken shows per-token breakdown', () => {
    registry.acquire(RPC, mockRpc());
    registry.acquire(RPC, mockRpc());
    registry.acquire(DAS, mockDas());

    expect(registry.stats.byToken).toEqual({ RPC: 2, DAS: 1 });
  });

  it('stats.byToken omits tokens with 0 refs', () => {
    const ref = registry.acquire(RPC, mockRpc());
    ref.release();

    expect(registry.stats.byToken).toEqual({});
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. RefRegistry — Leak Detection
 * ═══════════════════════════════════════════════════════════════ */

describe('RefRegistry — Leak Detection', () => {
  it('checkLeaks returns refs older than maxAgeMs', async () => {
    const registry = new RefRegistry();
    registry.acquire(RPC, mockRpc());

    // Nothing old yet
    expect(registry.checkLeaks(1_000_000)).toHaveLength(0);

    // Wait and check with a very short threshold
    await new Promise(r => setTimeout(r, 15));
    const leaks = registry.checkLeaks(10);
    expect(leaks).toHaveLength(1);
    expect(leaks[0].tokenName).toBe('RPC');
    expect(leaks[0].detectedAt).toBeGreaterThan(leaks[0].acquiredAt);

    registry.dispose();
  });

  it('onLeak registers a handler (FinalizationRegistry-based)', () => {
    const registry = new RefRegistry({ enableLeakDetection: true });
    const handler = vi.fn();
    registry.onLeak(handler);
    // We can't easily test GC-based leaks in a unit test,
    // but we verify the handler is registered without error
    expect(handler).not.toHaveBeenCalled();
    registry.dispose();
  });

  it('checkLeaks does not report released refs', async () => {
    const registry = new RefRegistry();
    const ref = registry.acquire(RPC, mockRpc());
    await new Promise(r => setTimeout(r, 15));
    ref.release();

    expect(registry.checkLeaks(10)).toHaveLength(0);
    registry.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. RefRegistry — Invalidation
 * ═══════════════════════════════════════════════════════════════ */

describe('RefRegistry — Invalidation', () => {
  it('invalidateAll releases all active refs', () => {
    const registry = new RefRegistry();
    const a = registry.acquire(RPC, mockRpc());
    const b = registry.acquire(DAS, mockDas());
    const c = registry.acquire(LOGGER, mockLogger());

    registry.invalidateAll();

    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(c.alive).toBe(false);
    expect(registry.totalActive()).toBe(0);

    registry.dispose();
  });

  it('dispose makes registry reject new acquisitions', () => {
    const registry = new RefRegistry();
    registry.dispose();

    expect(() => registry.acquire(RPC, mockRpc())).toThrow(/disposed/);
  });

  it('isDisposed reflects disposal state', () => {
    const registry = new RefRegistry();
    expect(registry.isDisposed).toBe(false);
    registry.dispose();
    expect(registry.isDisposed).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. MemoryGuard
 * ═══════════════════════════════════════════════════════════════ */

describe('MemoryGuard', () => {
  let registry: RefRegistry;

  beforeEach(() => { registry = new RefRegistry(); });
  afterEach(() => { registry.dispose(); });

  it('stats delegates to registry', () => {
    const guard = new MemoryGuard(registry);
    registry.acquire(RPC, mockRpc());

    expect(guard.stats.active).toBe(1);
    guard.dispose();
  });

  it('activeRefs returns count', () => {
    const guard = new MemoryGuard(registry);
    registry.acquire(RPC, mockRpc());
    registry.acquire(DAS, mockDas());

    expect(guard.activeRefs).toBe(2);
    guard.dispose();
  });

  it('underPressure detects when exceeding maxActiveRefs', () => {
    const guard = new MemoryGuard(registry, { maxActiveRefs: 2 });

    registry.acquire(RPC, mockRpc());
    expect(guard.underPressure).toBe(false);

    registry.acquire(DAS, mockDas());
    expect(guard.underPressure).toBe(true); // 2 >= 2

    guard.dispose();
  });

  it('checkLeaks uses configured maxRefAgeMs', async () => {
    const guard = new MemoryGuard(registry, { maxRefAgeMs: 10 });
    registry.acquire(RPC, mockRpc());

    await new Promise(r => setTimeout(r, 15));
    const leaks = guard.checkLeaks();
    expect(leaks.length).toBeGreaterThanOrEqual(1);

    guard.dispose();
  });

  it('onPressure fires when periodic check finds pressure', async () => {
    const handler = vi.fn();
    const guard = new MemoryGuard(registry, {
      maxActiveRefs: 1,
      checkIntervalMs: 20,
    });
    guard.onPressure(handler);

    // Exceed threshold
    registry.acquire(RPC, mockRpc());

    // Wait for periodic check to fire
    await new Promise(r => setTimeout(r, 60));

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].active).toBeGreaterThanOrEqual(1);

    guard.dispose();
  });

  it('dispose stops periodic checks', async () => {
    const handler = vi.fn();
    const guard = new MemoryGuard(registry, {
      maxActiveRefs: 1,
      checkIntervalMs: 20,
    });
    guard.onPressure(handler);

    registry.acquire(RPC, mockRpc());
    guard.dispose();

    // Wait — should NOT fire after dispose
    handler.mockClear();
    await new Promise(r => setTimeout(r, 60));
    expect(handler).not.toHaveBeenCalled();
  });

  it('onLeak delegates to registry', () => {
    const guard = new MemoryGuard(registry);
    const handler = vi.fn();
    guard.onLeak(handler);
    // Verify it was forwarded without error
    expect(handler).not.toHaveBeenCalled();
    guard.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  10. SynapseContext — acquireRef Integration
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — acquireRef', () => {
  let ctx: SynapseContext;

  beforeEach(() => {
    ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    ctx.register(DAS, { useValue: mockDas() });
    ctx.register(LOGGER, { useValue: mockLogger() });
  });
  afterEach(async () => { await ctx.dispose(); });

  it('acquireRef returns a ServiceRef', () => {
    const ref = ctx.acquireRef(RPC);
    expect(ref).toBeInstanceOf(ServiceRef);
    expect(ref.alive).toBe(true);
    ref.release();
  });

  it('acquireRef resolves the singleton and wraps it', () => {
    const direct = ctx.resolve(RPC);
    const ref = ctx.acquireRef(RPC);

    expect(ref.current).toBe(direct); // same singleton instance
    ref.release();
  });

  it('multiple acquireRef return different refs to same singleton', () => {
    const a = ctx.acquireRef(RPC);
    const b = ctx.acquireRef(RPC);

    expect(a).not.toBe(b);             // different refs
    expect(a.current).toBe(b.current); // same instance
    expect(a.id).not.toBe(b.id);

    a.release();
    b.release();
  });

  it('refCount tracks active refs per token', () => {
    expect(ctx.refCount(RPC)).toBe(0);

    const a = ctx.acquireRef(RPC);
    expect(ctx.refCount(RPC)).toBe(1);

    const b = ctx.acquireRef(RPC);
    expect(ctx.refCount(RPC)).toBe(2);

    a.release();
    expect(ctx.refCount(RPC)).toBe(1);

    b.release();
    expect(ctx.refCount(RPC)).toBe(0);
  });

  it('refs getter returns undefined before first acquireRef', async () => {
    const fresh = new SynapseContext();
    expect(fresh.refs).toBeUndefined();
    await fresh.dispose();
  });

  it('refs getter returns RefRegistry after acquireRef', () => {
    ctx.acquireRef(RPC).release();
    expect(ctx.refs).toBeInstanceOf(RefRegistry);
  });

  it('acquireRef throws for unregistered tokens', () => {
    const UNKNOWN = createToken<string>('Unknown');
    expect(() => ctx.acquireRef(UNKNOWN)).toThrow(ServiceNotFoundError);
  });

  it('acquireRef throws after disposal', async () => {
    await ctx.dispose();
    expect(() => ctx.acquireRef(RPC)).toThrow(/disposed/);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  11. SynapseContext — bind
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — bind', () => {
  let ctx: SynapseContext;

  beforeEach(() => {
    ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    ctx.register(DAS, { useValue: mockDas() });
    ctx.register(LOGGER, { useValue: mockLogger() });
  });
  afterEach(async () => { await ctx.dispose(); });

  it('bind returns a ServiceBinding with lazy services', () => {
    const binding = ctx.bind({ rpc: RPC, das: DAS });

    // Services are lazily resolved
    expect(binding.services.rpc).toBeDefined();
    expect(binding.services.das).toBeDefined();
    expect(binding.alive).toBe(true);

    binding.release();
  });

  it('bind services resolve to correct instances', () => {
    const directRpc = ctx.resolve(RPC);
    const directDas = ctx.resolve(DAS);
    const binding = ctx.bind({ rpc: RPC, das: DAS });

    expect(binding.services.rpc).toBe(directRpc);
    expect(binding.services.das).toBe(directDas);

    binding.release();
  });

  it('bind release frees all refs at once', () => {
    const binding = ctx.bind({ rpc: RPC, das: DAS, logger: LOGGER });

    // Access all services to trigger acquisition
    void binding.services.rpc;
    void binding.services.das;
    void binding.services.logger;

    expect(ctx.refCount(RPC)).toBe(1);
    expect(ctx.refCount(DAS)).toBe(1);
    expect(ctx.refCount(LOGGER)).toBe(1);

    binding.release();

    expect(ctx.refCount(RPC)).toBe(0);
    expect(ctx.refCount(DAS)).toBe(0);
    expect(ctx.refCount(LOGGER)).toBe(0);
  });

  it('bind services throw after release', () => {
    const binding = ctx.bind({ rpc: RPC });
    binding.release();

    expect(() => binding.services.rpc).toThrow(/released/);
  });

  it('bind release is idempotent', () => {
    const binding = ctx.bind({ rpc: RPC });
    void binding.services.rpc;
    binding.release();
    binding.release(); // no-op
    expect(ctx.refCount(RPC)).toBe(0);
  });

  it('bind has/ownKeys work like autoWire', () => {
    const binding = ctx.bind({ rpc: RPC, das: DAS });

    expect('rpc' in binding.services).toBe(true);
    expect('missing' in binding.services).toBe(false);
    expect(Object.keys(binding.services)).toEqual(['rpc', 'das']);

    binding.release();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  12. SynapseContext — enableMemoryGuard
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — enableMemoryGuard', () => {
  it('enableMemoryGuard creates a MemoryGuard', async () => {
    const ctx = new SynapseContext();
    const guard = ctx.enableMemoryGuard({ maxActiveRefs: 10 });

    expect(guard).toBeInstanceOf(MemoryGuard);
    expect(ctx.memoryGuard).toBe(guard);

    await ctx.dispose();
  });

  it('enableMemoryGuard returns same guard on second call', async () => {
    const ctx = new SynapseContext();
    const g1 = ctx.enableMemoryGuard();
    const g2 = ctx.enableMemoryGuard();

    expect(g1).toBe(g2);
    await ctx.dispose();
  });

  it('memoryGuard is undefined before enabling', async () => {
    const ctx = new SynapseContext();
    expect(ctx.memoryGuard).toBeUndefined();
    await ctx.dispose();
  });

  it('dispose cleans up memoryGuard', async () => {
    const ctx = new SynapseContext();
    ctx.enableMemoryGuard({ checkIntervalMs: 10 });
    await ctx.dispose();

    expect(ctx.memoryGuard).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  13. SynapseContext — Disposal invalidates refs
 * ═══════════════════════════════════════════════════════════════ */

describe('SynapseContext — Disposal & Refs', () => {
  it('disposal invalidates all active refs', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });

    const a = ctx.acquireRef(RPC);
    const b = ctx.acquireRef(RPC);
    expect(a.alive).toBe(true);

    await ctx.dispose();

    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(() => a.current).toThrow(RefReleasedError);
  });

  it('child scope disposal invalidates child refs only', async () => {
    const parent = new SynapseContext('parent');
    parent.register(RPC, { useValue: mockRpc() });

    const child = parent.createScope('child');
    const parentRef = parent.acquireRef(RPC);
    const childRef = child.acquireRef(RPC);

    await child.dispose();

    expect(childRef.alive).toBe(false);
    expect(parentRef.alive).toBe(true); // parent ref survives

    parentRef.release();
    await parent.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  14. Hooks — useSharedRef
 * ═══════════════════════════════════════════════════════════════ */

describe('Hooks — useSharedRef', () => {
  afterEach(() => { setGlobalContext(undefined); });

  it('useSharedRef acquires from global context', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    setGlobalContext(ctx);

    const ref = useSharedRef(RPC);
    expect(ref).toBeInstanceOf(ServiceRef);
    expect(ref.alive).toBe(true);
    expect(ctx.refCount(RPC)).toBe(1);

    ref.release();
    expect(ctx.refCount(RPC)).toBe(0);
    await ctx.dispose();
  });

  it('useSharedRef throws without global context', () => {
    setGlobalContext(undefined);
    expect(() => useSharedRef(RPC)).toThrow(/No Synapse context/);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  15. Hooks — useBoundServices
 * ═══════════════════════════════════════════════════════════════ */

describe('Hooks — useBoundServices', () => {
  afterEach(() => { setGlobalContext(undefined); });

  it('useBoundServices creates a binding from global context', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    ctx.register(DAS, { useValue: mockDas() });
    setGlobalContext(ctx);

    const binding = useBoundServices({ rpc: RPC, das: DAS });
    expect(binding.services.rpc).toBeDefined();
    expect(binding.services.das).toBeDefined();

    binding.release();
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  16. Hooks — withRef (RAII)
 * ═══════════════════════════════════════════════════════════════ */

describe('Hooks — withRef', () => {
  let ctx: SynapseContext;

  beforeEach(() => {
    ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
  });
  afterEach(async () => { await ctx.dispose(); });

  it('withRef acquires, runs fn, and releases', () => {
    const result = withRef(ctx, RPC, rpc => {
      expect(ctx.refCount(RPC)).toBe(1);
      return rpc.getBalance('test');
    });

    expect(result).toBe(1000);
    expect(ctx.refCount(RPC)).toBe(0); // released
  });

  it('withRef releases on error', () => {
    expect(() =>
      withRef(ctx, RPC, () => { throw new Error('fail'); }),
    ).toThrow('fail');

    expect(ctx.refCount(RPC)).toBe(0); // still released
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  17. Hooks — withRefAsync (Async RAII)
 * ═══════════════════════════════════════════════════════════════ */

describe('Hooks — withRefAsync', () => {
  let ctx: SynapseContext;

  beforeEach(() => {
    ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
  });
  afterEach(async () => { await ctx.dispose(); });

  it('withRefAsync acquires, awaits fn, and releases', async () => {
    const result = await withRefAsync(ctx, RPC, async rpc => {
      expect(ctx.refCount(RPC)).toBe(1);
      return rpc.getSlot();
    });

    expect(result).toBe(42);
    expect(ctx.refCount(RPC)).toBe(0);
  });

  it('withRefAsync releases on async error', async () => {
    await expect(
      withRefAsync(ctx, RPC, async () => { throw new Error('async-fail'); }),
    ).rejects.toThrow('async-fail');

    expect(ctx.refCount(RPC)).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  18. Hooks — createRefHook
 * ═══════════════════════════════════════════════════════════════ */

describe('Hooks — createRefHook', () => {
  afterEach(() => { setGlobalContext(undefined); });

  it('createRefHook returns a hook that acquires refs', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    setGlobalContext(ctx);

    const useRpcRef = createRefHook(RPC);
    const ref = useRpcRef();

    expect(ref).toBeInstanceOf(ServiceRef);
    expect(ref.alive).toBe(true);

    ref.release();
    await ctx.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  19. createBinding (standalone)
 * ═══════════════════════════════════════════════════════════════ */

describe('createBinding', () => {
  it('lazily resolves services on access', () => {
    const registry = new RefRegistry();
    const rpc = mockRpc();
    const das = mockDas();

    const binding = createBinding(
      ((token: ServiceToken<any>) => {
        if (token === RPC) return registry.acquire(RPC, rpc);
        if (token === DAS) return registry.acquire(DAS, das);
        throw new Error('unknown');
      }) as <U>(token: ServiceToken<U>) => ServiceRef<U>,
      { rpc: RPC, das: DAS },
    );

    // Nothing acquired yet
    expect(registry.totalActive()).toBe(0);

    // Access rpc → acquires ref
    expect(binding.services.rpc).toBe(rpc);
    expect(registry.totalActive()).toBe(1);

    // Access das → acquires ref
    expect(binding.services.das).toBe(das);
    expect(registry.totalActive()).toBe(2);

    binding.release();
    expect(registry.totalActive()).toBe(0);
    registry.dispose();
  });

  it('caches refs — second access does not re-acquire', () => {
    const registry = new RefRegistry();
    const rpc = mockRpc();
    let acquireCount = 0;

    const binding = createBinding(
      ((token: ServiceToken<any>) => { acquireCount++; return registry.acquire(token, rpc); }) as <U>(token: ServiceToken<U>) => ServiceRef<U>,
      { rpc: RPC },
    );

    binding.services.rpc;
    binding.services.rpc;
    expect(acquireCount).toBe(1);

    binding.release();
    registry.dispose();
  });

  it('alive is false when no refs acquired', () => {
    const registry = new RefRegistry();
    const binding = createBinding(
      ((token: ServiceToken<any>) => registry.acquire(token, mockRpc())) as <U>(token: ServiceToken<U>) => ServiceRef<U>,
      { rpc: RPC },
    );

    expect(binding.alive).toBe(false); // no refs yet
    registry.dispose();
  });

  it('alive is true while refs exist', () => {
    const registry = new RefRegistry();

    const binding = createBinding(
      ((token: ServiceToken<any>) => registry.acquire(token, mockRpc())) as <U>(token: ServiceToken<U>) => ServiceRef<U>,
      { rpc: RPC },
    );

    void binding.services.rpc;
    expect(binding.alive).toBe(true);

    binding.release();
    expect(binding.alive).toBe(false);
    registry.dispose();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  20. Cross-component sharing scenario
 * ═══════════════════════════════════════════════════════════════ */

describe('Cross-component sharing scenario', () => {
  it('two components share the same RPC singleton via refs', async () => {
    const ctx = new SynapseContext();
    const rpc = mockRpc();
    ctx.register(RPC, { useValue: rpc });

    // Component A mounts — acquires ref
    const componentA = ctx.acquireRef(RPC);

    // Component B mounts — acquires ref to SAME singleton
    const componentB = ctx.acquireRef(RPC);

    // Both use the exact same instance
    expect(componentA.current).toBe(componentB.current);
    expect(componentA.current).toBe(rpc);

    // Container tracks 2 refs
    expect(ctx.refCount(RPC)).toBe(2);

    // Component A uses the service
    componentA.current.getBalance('wallet-A');
    expect(rpc.getBalance).toHaveBeenCalledWith('wallet-A');

    // Component B uses the same service concurrently
    componentB.current.getSlot();
    expect(rpc.getSlot).toHaveBeenCalled();

    // Component A unmounts
    componentA.release();
    expect(ctx.refCount(RPC)).toBe(1);
    expect(componentA.alive).toBe(false);

    // Component B still has valid access
    expect(componentB.alive).toBe(true);
    componentB.current.getBalance('wallet-B');

    // Component B unmounts
    componentB.release();
    expect(ctx.refCount(RPC)).toBe(0);

    await ctx.dispose();
  });

  it('RAII pattern for request-scoped work', async () => {
    const ctx = new SynapseContext();
    const rpc = mockRpc();
    ctx.register(RPC, { useValue: rpc });

    // Handler uses withRef — guaranteed cleanup
    const balance = withRef(ctx, RPC, svc => svc.getBalance('addr'));
    expect(balance).toBe(1000);
    expect(ctx.refCount(RPC)).toBe(0); // no leak

    // Async handler — same guarantee
    const slot = await withRefAsync(ctx, RPC, async svc => svc.getSlot());
    expect(slot).toBe(42);
    expect(ctx.refCount(RPC)).toBe(0);

    await ctx.dispose();
  });

  it('component binding with batch release', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });
    ctx.register(DAS, { useValue: mockDas() });
    ctx.register(LOGGER, { useValue: mockLogger() });

    // Component needs multiple services
    const binding = ctx.bind({
      rpc: RPC,
      das: DAS,
      logger: LOGGER,
    });

    // Access services (lazy acquisition)
    binding.services.rpc.getBalance('addr');
    binding.services.das.getAsset('nft-1');
    binding.services.logger.log('hello');

    // All refs tracked
    expect(ctx.refCount(RPC)).toBe(1);
    expect(ctx.refCount(DAS)).toBe(1);
    expect(ctx.refCount(LOGGER)).toBe(1);

    // Single release for all
    binding.release();
    expect(ctx.refCount(RPC)).toBe(0);
    expect(ctx.refCount(DAS)).toBe(0);
    expect(ctx.refCount(LOGGER)).toBe(0);

    await ctx.dispose();
  });

  it('memory guard detects pressure during heavy usage', async () => {
    const ctx = new SynapseContext();
    ctx.register(RPC, { useValue: mockRpc() });

    const guard = ctx.enableMemoryGuard({ maxActiveRefs: 3 });
    expect(guard.underPressure).toBe(false);

    const refs = [
      ctx.acquireRef(RPC),
      ctx.acquireRef(RPC),
      ctx.acquireRef(RPC),
    ];

    expect(guard.underPressure).toBe(true);
    expect(guard.activeRefs).toBe(3);

    // Release all
    for (const r of refs) r.release();
    expect(guard.underPressure).toBe(false);

    await ctx.dispose();
  });

  it('weak ref allows optional sharing without preventing GC', async () => {
    const ctx = new SynapseContext();
    const rpc = mockRpc();
    ctx.register(RPC, { useValue: rpc });

    const strongRef = ctx.acquireRef(RPC);
    const weakRef = strongRef.toWeak();

    // Weak ref resolves while strong ref lives
    expect(weakRef.deref()).toBe(rpc);
    expect(weakRef.alive).toBe(true);

    strongRef.release();
    // Weak ref may still resolve (GC hasn't run), but strong is gone
    expect(strongRef.alive).toBe(false);

    await ctx.dispose();
  });
});
