/**
 * Synapse Context Provider — IoC service container with DI, scoping, and
 * framework-agnostic hooks.
 *
 * Provides a type-safe dependency injection system for the Synapse SDK,
 * enabling components, modules, and frameworks to access SDK services
 * (RPC, DAS, WebSocket, Programs, AI Tools, etc.) through a unified
 * context without tight coupling.
 *
 * ## Key exports
 *
 * | Export | Description |
 * |--------|-------------|
 * | {@link SynapseContext} | Core IoC container with register/resolve/scope |
 * | {@link createSynapseContext} | Factory that wires all SDK services |
 * | {@link Tokens} | Pre-defined tokens for every SDK module |
 * | {@link useService} | Framework-agnostic service accessor |
 * | {@link createServiceHook} | Composable typed accessor factory |
 * | {@link autoWire} | Proxy-based lazy service bag |
 * | {@link createReactAdapter} | React integration blueprint |
 * | {@link createServerMiddleware} | Express/Fastify request-scoped DI |
 *
 * @module context
 * @since 1.2.0
 *
 * @example Quick start
 * ```ts
 * import {
 *   createSynapseContext,
 *   Tokens,
 *   useService,
 *   setGlobalContext,
 * } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * // 1. Create context
 * const ctx = createSynapseContext({
 *   endpoint: 'https://rpc.synapse.com',
 *   apiKey: 'sk-...',
 * });
 *
 * // 2. Set as global (optional — enables useService())
 * setGlobalContext(ctx);
 *
 * // 3. Resolve services anywhere
 * const rpc = useService(Tokens.RPC);
 * const programs = useService(Tokens.PROGRAMS);
 *
 * // 4. Create scoped contexts
 * const scope = ctx.createScope('user-session');
 * scope.register(USER_TOKEN, { useValue: currentUser });
 *
 * // 5. Cleanup
 * await ctx.dispose();
 * ```
 *
 * @example Custom module
 * ```ts
 * import { createSynapseContext, createToken, type ContextModule } from '...';
 *
 * interface Analytics { track(event: string): void; }
 * const ANALYTICS = createToken<Analytics>('Analytics');
 *
 * const analyticsModule: ContextModule = {
 *   name: 'analytics',
 *   register(ctx) {
 *     ctx.register(ANALYTICS, {
 *       useFactory: () => new MixpanelAnalytics(),
 *       lifecycle: 'singleton',
 *     });
 *   },
 * };
 *
 * const ctx = createSynapseContext(config, { modules: [analyticsModule] });
 * ```
 */

// ── Types & tokens ─────────────────────────────────────────────
export {
  // Token creation
  createToken,
  isDisposable,
  // Error classes
  ServiceNotFoundError,
  CircularDependencyError,
  AsyncProviderError,
  // Types
  type ServiceToken,
  type ServiceLifecycle,
  type ServiceProvider,
  type ValueProvider,
  type FactoryProvider,
  type ClassProvider,
  type AliasProvider,
  type AsyncFactoryProvider,
  type ServiceRegistration,
  type ServiceResolver,
  type ResolveMiddleware,
  type Disposable,
  type ContextEvents,
} from './types';

// ── Container ──────────────────────────────────────────────────
export { SynapseContext } from './container';

// ── Memory-safe references ─────────────────────────────────────
export {
  ServiceRef,
  WeakServiceRef,
  RefRegistry,
  MemoryGuard,
  RefReleasedError,
  createBinding,
  type LeakReport,
  type RefStats,
  type RefRegistryConfig,
  type MemoryGuardConfig,
  type ServiceBinding,
} from './refs';

// ── Built-in providers & tokens ────────────────────────────────
export {
  Tokens,
  createSynapseContext,
  createBareContext,
  type ProgramsBundle,
  type ContextModule,
  type CreateSynapseContextOpts,
} from './providers';

// ── Hooks & adapters ───────────────────────────────────────────
export {
  // Global context
  setGlobalContext,
  getContext,
  tryGetContext,
  // Service accessors
  useService,
  tryUseService,
  createServiceHook,
  createBoundHook,
  // Memory-safe ref hooks
  useSharedRef,
  useBoundServices,
  withRef,
  withRefAsync,
  createRefHook,
  // Framework adapters
  createReactAdapter,
  createServerMiddleware,
  autoWire,
  // Types
  type ContextAdapter,
  type ReactAdapterConfig,
  type ServerAdapterConfig,
} from './hooks';
