/**
 * Built-in service tokens and pre-wired providers for Synapse SDK modules.
 *
 * Registers all core SDK services (SynapseClient, RPC, DAS, WebSocket,
 * gRPC, Accounts, Programs, Decoders, AI Tools) as injectable tokens
 * so any layer of the application can resolve them via the context
 * container.
 *
 * ## Quick start
 *
 * ```ts
 * import { createSynapseContext } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * const ctx = createSynapseContext({
 *   endpoint: 'https://rpc.synapse.com',
 *   apiKey: 'sk-...',
 * });
 *
 * const rpc = ctx.resolve(Tokens.RPC);      // SolanaRpc
 * const ws  = ctx.resolve(Tokens.WS);       // WsClient
 * const das = ctx.resolve(Tokens.DAS);       // DasClient
 * const enc = ctx.resolve(Tokens.PROGRAMS);  // Program encoders
 * ```
 *
 * @module context/providers
 * @since 1.2.0
 */

import { createToken, type ServiceToken } from './types';
import { SynapseContext } from './container';
import type { SynapseClient, SynapseClientConfig } from '../core/client';
import type { HttpTransport } from '../core/transport';
import type { SolanaRpc } from '../rpc/solana-rpc';
import type { DasClient } from '../das/client';
import type { WsClient } from '../websocket/client';
import type { GrpcTransport } from '../grpc/transport';
import type { AccountsClient } from '../accounts/index';

// ── Service Tokens ─────────────────────────────────────────────

/**
 * Pre-defined service tokens for all Synapse SDK modules.
 *
 * These tokens are type-safe: `ctx.resolve(Tokens.RPC)` returns
 * `SolanaRpc`, `ctx.resolve(Tokens.CLIENT)` returns `SynapseClient`, etc.
 *
 * @since 1.2.0
 */
export const Tokens = {
  // ── Core ────────────────────────────────────────────────────
  /** SynapseClient configuration. */
  CONFIG: createToken<SynapseClientConfig>('SynapseClientConfig'),
  /** The SynapseClient instance — top-level orchestrator. */
  CLIENT: createToken<SynapseClient>('SynapseClient'),
  /** Raw HTTP transport for RPC calls. */
  TRANSPORT: createToken<HttpTransport>('HttpTransport'),

  // ── Sub-clients ─────────────────────────────────────────────
  /** Typed Solana JSON-RPC facade (53 methods). */
  RPC: createToken<SolanaRpc>('SolanaRpc'),
  /** Digital Asset Standard (DAS) client — Metaplex Read API. */
  DAS: createToken<DasClient>('DasClient'),
  /** WebSocket real-time subscription client. */
  WS: createToken<WsClient>('WsClient'),
  /** gRPC transport for Yellowstone/Geyser streaming. */
  GRPC: createToken<GrpcTransport>('GrpcTransport'),
  /** Typed account fetchers with built-in decoding. */
  ACCOUNTS: createToken<AccountsClient>('AccountsClient'),

  // ── Programs (static namespaces, accessed as value tokens) ──
  /** Program instruction encoders bundle. */
  PROGRAMS: createToken<ProgramsBundle>('Programs'),

  // ── AI ──────────────────────────────────────────────────────
  /** AI tools toolkit (LangChain-compatible). */
  AI_TOOLS: createToken<unknown>('AITools'),
  /** Protocol tools (Jupiter, Raydium, Metaplex, etc.). */
  PROTOCOL_TOOLS: createToken<unknown>('ProtocolTools'),
} as const;

/**
 * Bundle of all program instruction encoder namespaces.
 * @since 1.2.0
 */
export interface ProgramsBundle {
  SystemProgram: typeof import('../programs/system').SystemProgram;
  SplToken: typeof import('../programs/spl-token').SplToken;
  AssociatedToken: typeof import('../programs/associated-token').AssociatedToken;
  Memo: typeof import('../programs/memo').Memo;
  ComputeBudget: typeof import('../programs/compute-budget').ComputeBudget;
}

// ── Module registry ────────────────────────────────────────────

/**
 * A pluggable module that registers its services into the container.
 *
 * Implement this interface to create custom modules that integrate
 * with the Synapse context provider system.
 *
 * @since 1.2.0
 *
 * @example
 * ```ts
 * const MyModule: ContextModule = {
 *   name: 'analytics',
 *   register(ctx) {
 *     ctx.register(ANALYTICS, {
 *       useFactory: r => new AnalyticsService(r.resolve(Tokens.RPC)),
 *     });
 *   },
 * };
 *
 * const ctx = createSynapseContext(config, { modules: [MyModule] });
 * ```
 */
export interface ContextModule {
  /** Human-readable module name (used in debug output). */
  readonly name: string;
  /** Called during context creation to register services. */
  register(ctx: SynapseContext): void;
}

// ── Built-in module registrations ──────────────────────────────

/** @internal Registers core services (client, transport, sub-clients). */
function registerCoreModule(ctx: SynapseContext): void {
  // Transport: derived from config
  ctx.registerIfMissing(Tokens.TRANSPORT, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).transport,
  }, ['core']);

  // RPC: lazy from client
  ctx.registerIfMissing(Tokens.RPC, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).rpc,
  }, ['core', 'rpc']);

  // DAS: lazy from client
  ctx.registerIfMissing(Tokens.DAS, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).das,
  }, ['core', 'das']);

  // WebSocket: lazy from client
  ctx.registerIfMissing(Tokens.WS, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).ws,
  }, ['core', 'ws']);

  // gRPC: lazy from client
  ctx.registerIfMissing(Tokens.GRPC, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).grpc,
  }, ['core', 'grpc']);

  // Accounts: lazy from client
  ctx.registerIfMissing(Tokens.ACCOUNTS, {
    useFactory: (r) => r.resolve(Tokens.CLIENT).accounts,
  }, ['core', 'accounts']);
}

/** @internal Registers program encoder namespaces. */
function registerProgramsModule(ctx: SynapseContext): void {
  ctx.registerIfMissing(Tokens.PROGRAMS, {
    useFactory: () => {
      // Lazy-load programs to keep tree-shakeability
      const { SystemProgram } = require('../programs/system') as typeof import('../programs/system');
      const { SplToken } = require('../programs/spl-token') as typeof import('../programs/spl-token');
      const { AssociatedToken } = require('../programs/associated-token') as typeof import('../programs/associated-token');
      const { Memo } = require('../programs/memo') as typeof import('../programs/memo');
      const { ComputeBudget } = require('../programs/compute-budget') as typeof import('../programs/compute-budget');
      return { SystemProgram, SplToken, AssociatedToken, Memo, ComputeBudget };
    },
  }, ['programs']);
}

// ── Context factory ────────────────────────────────────────────

/**
 * Options for {@link createSynapseContext}.
 * @since 1.2.0
 */
export interface CreateSynapseContextOpts {
  /**
   * Custom modules to register alongside the built-in modules.
   * Modules are registered in order, so later modules can override
   * earlier registrations.
   */
  modules?: ContextModule[];

  /**
   * Skip registering built-in modules (core, programs).
   * Useful for testing or when you want full control.
   * @default false
   */
  skipBuiltins?: boolean;

  /**
   * Scope ID for the root context.
   * @default 'synapse'
   */
  scopeId?: string;
}

/**
 * Create a fully-wired Synapse context with all SDK services registered.
 *
 * This is the recommended entry point for the context provider system.
 * It creates a `SynapseClient`, registers all built-in modules, and
 * applies any custom modules.
 *
 * @param config  - SynapseClient configuration.
 * @param opts    - Additional context options.
 * @returns A ready-to-use `SynapseContext` with all services registered.
 * @since 1.2.0
 *
 * @example
 * ```ts
 * import { createSynapseContext, Tokens } from '@oobe-protocol-labs/synapse-client-sdk/context';
 *
 * const ctx = createSynapseContext({
 *   endpoint: 'https://rpc.synapse.com',
 *   apiKey: 'sk-...',
 * });
 *
 * // Resolve services — fully typed
 * const rpc = ctx.resolve(Tokens.RPC);
 * const balance = await rpc.getBalance(Pubkey('...'));
 *
 * // Create a scoped context for a specific request
 * const scope = ctx.createScope('request-42');
 * // ... use scope ...
 * scope.dispose();
 *
 * // Clean up everything
 * await ctx.dispose();
 * ```
 */
export function createSynapseContext(
  config: SynapseClientConfig,
  opts: CreateSynapseContextOpts = {},
): SynapseContext {
  const ctx = new SynapseContext(opts.scopeId ?? 'synapse');

  // Register config
  ctx.register(Tokens.CONFIG, { useValue: config }, ['core']);

  // Register client (singleton)
  ctx.register(Tokens.CLIENT, {
    useFactory: (r) => {
      const { SynapseClient: Ctor } = require('../core/client') as typeof import('../core/client');
      return new Ctor(r.resolve(Tokens.CONFIG));
    },
  }, ['core']);

  // Built-in modules
  if (!opts.skipBuiltins) {
    registerCoreModule(ctx);
    registerProgramsModule(ctx);
  }

  // Custom modules
  if (opts.modules) {
    for (const mod of opts.modules) {
      mod.register(ctx);
    }
  }

  return ctx;
}

/**
 * Create a bare context with no pre-registered services.
 *
 * Useful for testing or custom setups where you want full control.
 *
 * @param scopeId - Optional scope identifier.
 * @returns An empty `SynapseContext`.
 * @since 1.2.0
 */
export function createBareContext(scopeId?: string): SynapseContext {
  return new SynapseContext(scopeId ?? 'bare');
}
