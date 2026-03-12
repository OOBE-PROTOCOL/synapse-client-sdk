/**
 * @module ai/sap/provider
 * @description HMR-safe factories and React integration blueprints for SAP.
 *
 * Provides:
 *  - **`createSapProvider`** — HMR-safe singleton factory for `SynapseAnchorSap`
 *    (follows the same pattern as `createSynapseProvider` from `@oobe-protocol-labs/synapse-client-sdk/next`)
 *  - **`createSapContextBlueprint`** — Returns a typed React context + hook
 *    factory that consumers wire into their own Next.js providers
 *
 * The SDK does **not** depend on React — these utilities produce typed
 * blueprints that consumers implement with their own React installation.
 *
 * @since 2.1.0
 */

import { createSingleton, type SingletonOptions } from '../../utils/helpers';

import { SynapseAnchorSap } from './client';
import type {
  SapBridgeConfig,
  SapProviderConfig,
  SapWallet,
  SapContextValue,
} from './types';

/* ═══════════════════════════════════════════════════════════════
 *  createSapProvider — HMR-safe singleton (server-side / Node.js)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Create an HMR-safe `SynapseAnchorSap` singleton factory.
 *
 * Stores the instance on `globalThis` to survive hot-module reloads
 * in Next.js development. Identical in spirit to
 * `createSynapseProvider` and `createGatewayProvider`.
 *
 * **Server-side only** — requires a static wallet (e.g., a Keypair
 * loaded from an environment variable). For client-side usage with
 * wallet-adapter, use {@link createSapContextBlueprint} instead.
 *
 * @param wallet - Server wallet with signing capability
 * @param config - Network, region, and SAP configuration
 * @param opts   - Singleton options (version for cache busting)
 * @returns A zero-arg getter that always returns the same instance
 *
 * @example
 * ```ts
 * // lib/sap.ts (Next.js server)
 * import { createSapProvider } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 * import { loadWallet } from './wallet';
 *
 * export const getSap = createSapProvider(loadWallet(), {
 *   network: SynapseNetwork.Mainnet,
 *   commitment: 'confirmed',
 * });
 *
 * // API route
 * export async function GET() {
 *   const sap = getSap();
 *   const agent = await sap.agent.fetch();
 *   return Response.json(agent);
 * }
 * ```
 */
export function createSapProvider(
  wallet: SapWallet,
  config?: SapProviderConfig,
  opts?: SingletonOptions,
): () => SynapseAnchorSap {
  const singletonOpts: SingletonOptions = {
    ...opts,
    ...(config?.version != null ? { version: Number(config.version) || 0 } : {}),
  };
  return createSingleton<SynapseAnchorSap>(
    '__synapse_sap__',
    () => SynapseAnchorSap.create({ wallet, ...config }),
    singletonOpts,
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  createSapContextBlueprint — React integration blueprint
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Blueprint result returned by {@link createSapContextBlueprint}.
 *
 * Contains everything needed to wire SAP into a React tree,
 * without importing React in the SDK itself.
 */
export interface SapContextBlueprint {
  /**
   * The default context value (disconnected state).
   * Use as the initial value for `React.createContext<SapContextValue>()`.
   */
  defaultValue: SapContextValue<SynapseAnchorSap>;

  /**
   * Create a state manager for the SAP provider.
   *
   * Call this inside your provider component to get `connect`,
   * `disconnect`, and the current context value.
   *
   * @returns Object with `{ value, connect, disconnect }` — pass
   * `value` to your context provider.
   */
  createManager(): SapStateManager;
}

/**
 * State manager returned by `SapContextBlueprint.createManager()`.
 *
 * This is a plain-object state machine — no React hooks inside.
 * Use it in a `useEffect` + `useState` pattern in your provider.
 */
export interface SapStateManager {
  /** Connect to SAP with the given wallet. Creates a SynapseAnchorSap. */
  connect(wallet: SapWallet): void;
  /** Disconnect and clear the client. */
  disconnect(): void;
  /** Get the current context value (snapshot). */
  getValue(): SapContextValue<SynapseAnchorSap>;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/**
 * Create a React context blueprint for SAP integration.
 *
 * Returns a blueprint object with the default context value and a
 * state manager factory. The consumer wires these into their own
 * React provider using `createContext`, `useState`, and `useEffect`.
 *
 * This approach keeps the SDK free of React dependencies while
 * providing full type safety and a clear integration pattern.
 *
 * @param config - SAP bridge configuration (network, region, etc.)
 * @returns Blueprint with default value and manager factory
 *
 * @example Next.js App Router provider
 * ```tsx
 * // app/providers/sap-provider.tsx
 * 'use client';
 *
 * import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
 * import { useWallet } from '@solana/wallet-adapter-react';
 * import {
 *   createSapContextBlueprint,
 *   type SapContextValue,
 *   type SynapseAnchorSap,
 * } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 * import { SynapseNetwork } from '@oobe-protocol-labs/synapse-client-sdk/utils';
 *
 * const blueprint = createSapContextBlueprint({ network: SynapseNetwork.Mainnet });
 * const SapContext = createContext<SapContextValue<SynapseAnchorSap>>(blueprint.defaultValue);
 *
 * export function SapProvider({ children }: { children: ReactNode }) {
 *   const { wallet, connected } = useWallet();
 *   const [client, setClient] = useState<SynapseAnchorSap | null>(null);
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState<Error | null>(null);
 *
 *   const connect = useCallback(async (w: any) => {
 *     setLoading(true);
 *     setError(null);
 *     try {
 *       const mgr = blueprint.createManager();
 *       mgr.connect(w);
 *       setClient(mgr.getValue().client);
 *     } catch (e) {
 *       setError(e instanceof Error ? e : new Error(String(e)));
 *     } finally {
 *       setLoading(false);
 *     }
 *   }, []);
 *
 *   const disconnect = useCallback(() => {
 *     setClient(null);
 *     setError(null);
 *   }, []);
 *
 *   const value = useMemo(() => ({
 *     client,
 *     loading,
 *     error,
 *     connect,
 *     disconnect,
 *   }), [client, loading, error, connect, disconnect]);
 *
 *   return <SapContext.Provider value={value}>{children}</SapContext.Provider>;
 * }
 *
 * export const useSap = () => useContext(SapContext);
 * ```
 *
 * @example Using the hook
 * ```tsx
 * 'use client';
 * import { useSap } from './sap-provider';
 *
 * export function AgentDashboard() {
 *   const { client, loading, error } = useSap();
 *
 *   if (!client) return <p>Connect your wallet to use SAP</p>;
 *   if (loading) return <p>Initializing SAP...</p>;
 *   if (error) return <p>Error: {error.message}</p>;
 *
 *   return <AgentPanel sap={client} />;
 * }
 * ```
 */
export function createSapContextBlueprint(
  config?: Omit<SapBridgeConfig, 'wallet'>,
): SapContextBlueprint {
  const defaultValue: SapContextValue<SynapseAnchorSap> = {
    client: null,
    loading: false,
    error: null,
    connect: async () => {
      /* no-op until provider mounts */
    },
    disconnect: () => {
      /* no-op until provider mounts */
    },
  };

  function createManager(): SapStateManager {
    let client: SynapseAnchorSap | null = null;
    let loading = false;
    let error: Error | null = null;
    const listeners = new Set<() => void>();

    function notify() {
      for (const fn of listeners) fn();
    }

    return {
      connect(wallet: SapWallet) {
        loading = true;
        error = null;
        notify();

        try {
          client = SynapseAnchorSap.create({ wallet, ...config });
          loading = false;
          notify();
        } catch (e) {
          error = e instanceof Error ? e : new Error(String(e));
          loading = false;
          client = null;
          notify();
        }
      },

      disconnect() {
        client = null;
        error = null;
        loading = false;
        notify();
      },

      getValue(): SapContextValue<SynapseAnchorSap> {
        return {
          client,
          loading,
          error,
          connect: async (w: SapWallet) => {
            this.connect(w);
          },
          disconnect: () => {
            this.disconnect();
          },
        };
      },

      subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  }

  return { defaultValue, createManager };
}
