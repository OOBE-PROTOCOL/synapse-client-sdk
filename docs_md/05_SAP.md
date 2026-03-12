# 05 — SAP: Solana Agent Protocol (Integration Bridge)

> **Import**: `@oobe-protocol-labs/synapse-client-sdk/ai/sap`
> **Source**: `src/ai/sap/`
> **Peer deps**: `@oobe-protocol-labs/synapse-sap-sdk`, `@coral-xyz/anchor`, `@solana/web3.js`

---

## Overview

SAP (Solana Agent Protocol) is a **standalone on-chain protocol** for AI agent identity, discovery, reputation, memory, and commerce on Solana. The full protocol and its dedicated SDK live in their own repositories:

| Resource | Link |
|----------|------|
| **Protocol (Anchor/Rust)** | [github.com/OOBE-PROTOCOL/synapse-sap](https://github.com/OOBE-PROTOCOL/synapse-sap) |
| **SAP SDK (TypeScript)** | [github.com/OOBE-PROTOCOL/synapse-sap-sdk](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk) |
| **SAP SDK package** | `@oobe-protocol-labs/synapse-sap-sdk` |
| **Program ID** | `SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL` |

This module provides a **thin integration bridge** (`SynapseAnchorSap`) that connects the Synapse Client SDK's infrastructure — endpoint resolution, network registry, HMR-safe singletons — with the SAP SDK's `SapClient` for on-chain agent operations.

### What the bridge provides

- **Automatic endpoint resolution** — `SynapseAnchorSap.create({ wallet })` resolves Synapse's RPC endpoint, creates an Anchor provider, and initializes a `SapClient` in one call
- **SynapseClient chaining** — `SynapseAnchorSap.fromSynapseClient(client, wallet)` reuses an existing client's RPC endpoint
- **HMR-safe singleton** — `createSapProvider(wallet, config)` for Next.js server-side routes
- **React context blueprint** — `createSapContextBlueprint(config)` provides typed state management for client-side providers (no React dependency in the SDK)
- **Full SapClient access** — all modules proxied as getters: `agent`, `builder`, `session`, `escrow`, `tools`, `discovery`, `feedback`, `attestation`

> **For the full SAP protocol** — memory systems, x402 escrow, trustless feedback, attestations, tool schemas, discovery indexes, and all 72 on-chain instructions — use the dedicated **`@oobe-protocol-labs/synapse-sap-sdk`** and the [protocol documentation](https://github.com/OOBE-PROTOCOL/synapse-sap/tree/main/docs).

### SAP Protocol at a Glance

| | |
|---|---|
| **Program** | Anchor 0.32.1 · Solana SVM |
| **Instructions** | 72 across 6 composable layers |
| **Account types** | 22 PDA structs |
| **Events / Errors** | 45 / 91 |
| **Tests** | 187 |
| **Layers** | Identity · Memory · Reputation · Commerce · Tools · Discovery |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Solana Blockchain                              │
│              SAP Program: SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL  │
└───────────────────┬─────────────────────────┬──────────────────────────┘
                    │                         │
     ┌──────────────┴──────────────┐   ┌──────┴──────────────────────────┐
     │  synapse-sap-sdk            │   │  synapse-client-sdk/ai/sap      │
     │  @oobe-protocol-labs/       │   │  (this module)                  │
     │    synapse-sap-sdk          │   │                                 │
     │                             │   │  SynapseAnchorSap bridge:       │
     │  Full protocol client:      │   │  • Synapse endpoint resolution  │
     │  • SapClient.from(provider) │   │  • Anchor provider creation     │
     │  • 8 modules, 4 registries  │   │  • SapClient initialization     │
     │  • Memory, escrow, tools    │   │  • HMR-safe singleton factory   │
     │  • Feedback, attestation    │   │  • React context blueprint      │
     │  • Discovery indexes        │   │  • All SapClient modules via    │
     │  • Plugin adapter           │   │    pass-through getters         │
     └──────────────┬──────────────┘   └──────────────┬─────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │  Synapse Network Registry   │
                    │  resolveEndpoint(net, region)│
                    │  • Mainnet US / EU           │
                    │  • Devnet / Testnet          │
                    └─────────────────────────────┘
```

---

## Module Map

| File | Export | Purpose |
|------|--------|---------|
| `types.ts` | `SapWallet`, `SapBridgeConfig`, `SapContextValue`, `SAP_PROGRAM_ID`, `SapDependencyError` | Configuration, wallet interface, context types |
| `client.ts` | `SynapseAnchorSap` | Bridge class — endpoint resolution + SapClient init |
| `provider.ts` | `createSapProvider`, `createSapContextBlueprint` | HMR-safe singleton + React blueprint |
| `index.ts` | barrel | Re-exports everything |

---

## Quick Start

### Install peer dependencies

```bash
pnpm add @oobe-protocol-labs/synapse-sap-sdk @coral-xyz/anchor @solana/web3.js
```

### 1. Standalone (Node.js / scripts)

```ts
import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { SynapseNetwork } from '@oobe-protocol-labs/synapse-client-sdk/utils';
import { Keypair } from '@solana/web3.js';

// Load your wallet
const kp = Keypair.fromSecretKey(/* ... */);
const wallet = {
  publicKey: kp.publicKey,
  signTransaction: async <T>(tx: T) => { (tx as any).partialSign(kp); return tx; },
  signAllTransactions: async <T>(txs: T[]) => { txs.forEach(t => (t as any).partialSign(kp)); return txs; },
};

// Create the bridge — resolves Synapse US-1 Mainnet endpoint automatically
const sap = SynapseAnchorSap.create({
  wallet,
  network: SynapseNetwork.Mainnet,
  commitment: 'confirmed',
});

// Register an agent using the fluent builder
await sap.builder
  .agent('TradeBot')
  .description('AI-powered Jupiter swap agent')
  .addCapability('jupiter:swap', { protocol: 'jupiter', version: '6.0' })
  .addPricingTier({
    tierId: 'standard',
    pricePerCall: 10_000,
    rateLimit: 60,
    tokenType: 'sol',
    settlementMode: 'x402',
  })
  .addProtocol('A2A')
  .register();
```

### 2. From existing SynapseClient

```ts
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { SynapseAnchorSap } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

// If you already have a SynapseClient, reuse its endpoint
const client = new SynapseClient({ endpoint: process.env.SYNAPSE_RPC! });
const sap = SynapseAnchorSap.fromSynapseClient(client, wallet);

// Both share the same RPC endpoint
const agent = await sap.agent.fetch();
```

### 3. Agent lifecycle

```ts
// Register
await sap.agent.register({
  name: 'MyAgent',
  description: 'A helpful Solana agent',
  capabilities: [{ id: 'chat:respond', protocolId: 'A2A', version: '1.0', description: null }],
  pricing: [],
  protocols: ['A2A'],
});

// Update
await sap.agent.update({ description: 'An even more helpful agent' });

// Report usage
await sap.agent.reportCalls(42);
await sap.agent.updateReputation(30, 99);

// Maintenance
await sap.agent.deactivate();
await sap.agent.reactivate();

// End of life
await sap.agent.close();
```

### 4. Memory sessions

```ts
// Start a memory session (creates vault + ledger)
const session = await sap.session.start('conversation-001');

// Write entries (TX fee only — ~0.000005 SOL)
await sap.session.write(session, 'User requested SOL→USDC swap');

// Read latest entries from ring buffer (FREE — just getAccountInfo)
const entries = await sap.session.readLatest(session);

// Seal into permanent archive (~0.031 SOL)
await sap.session.seal(session);

// Teardown — reclaims all rent
await sap.session.close(session);
```

### 5. Discovery

```ts
// Find agents by capability
const agents = await sap.discovery.findByCapability('jupiter:swap');

// Find by protocol
const a2aAgents = await sap.discovery.findByProtocol('A2A');
```

---

## Next.js Integration

### Server-side: HMR-safe singleton

```ts
// lib/sap.ts
import { createSapProvider } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { SynapseNetwork } from '@oobe-protocol-labs/synapse-client-sdk/utils';
import { loadServerWallet } from './wallet';

export const getSap = createSapProvider(loadServerWallet(), {
  network: SynapseNetwork.Mainnet,
  commitment: 'confirmed',
});
```

```ts
// app/api/agent/route.ts
import { getSap } from '@/lib/sap';

export async function GET() {
  const sap = getSap();
  const agent = await sap.agent.fetch();
  return Response.json(agent);
}
```

### Client-side: React Context Provider

```tsx
// app/providers/sap-provider.tsx
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  SynapseAnchorSap,
  createSapContextBlueprint,
  type SapContextValue,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
import { SynapseNetwork } from '@oobe-protocol-labs/synapse-client-sdk/utils';

// 1. Create the blueprint (once, at module level)
const blueprint = createSapContextBlueprint({
  network: SynapseNetwork.Mainnet,
  commitment: 'confirmed',
});

// 2. Create React context
const SapContext = createContext<SapContextValue<SynapseAnchorSap>>(
  blueprint.defaultValue,
);

// 3. Provider component
export function SapProvider({ children }: { children: ReactNode }) {
  const { wallet, connected, publicKey, signTransaction, signAllTransactions } = useWallet();
  const [client, setClient] = useState<SynapseAnchorSap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Auto-connect when wallet connects
  useEffect(() => {
    if (connected && publicKey && signTransaction && signAllTransactions) {
      setLoading(true);
      setError(null);
      try {
        const mgr = blueprint.createManager();
        mgr.connect({
          publicKey,
          signTransaction,
          signAllTransactions,
        });
        setClient(mgr.getValue().client);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    } else {
      setClient(null);
    }
  }, [connected, publicKey, signTransaction, signAllTransactions]);

  const connect = useCallback(async (w: any) => {
    setLoading(true);
    setError(null);
    try {
      const mgr = blueprint.createManager();
      mgr.connect(w);
      setClient(mgr.getValue().client);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setClient(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ client, loading, error, connect, disconnect }),
    [client, loading, error, connect, disconnect],
  );

  return <SapContext.Provider value={value}>{children}</SapContext.Provider>;
}

// 4. Hook
export const useSap = () => useContext(SapContext);
```

### Using the hook in components

```tsx
// app/components/agent-dashboard.tsx
'use client';

import { useSap } from '../providers/sap-provider';
import { useEffect, useState } from 'react';

export function AgentDashboard() {
  const { client, loading, error } = useSap();
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    if (client) {
      client.agent.fetchNullable().then(setAgent);
    }
  }, [client]);

  if (!client) return <p>Connect wallet to use SAP</p>;
  if (loading) return <p>Initializing...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>{agent?.name ?? 'No agent registered'}</h2>
      <p>Wallet: {client.walletPubkey}</p>
      <p>Endpoint: {client.endpoint.rpc}</p>
      <p>Program: {client.programId}</p>
    </div>
  );
}
```

### Wiring into layout

```tsx
// app/layout.tsx
import { WalletProvider } from '@solana/wallet-adapter-react';
import { SapProvider } from './providers/sap-provider';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider wallets={[]}>
      <SapProvider>
        {children}
      </SapProvider>
    </WalletProvider>
  );
}
```

---

## Exported API

### Classes

| Class | Purpose |
|-------|---------|
| `SynapseAnchorSap` | Bridge — resolves Synapse endpoint, creates Anchor provider, initializes SapClient |

### Static methods

| Method | Description |
|--------|-------------|
| `SynapseAnchorSap.create(config)` | Create from `SapBridgeConfig` — auto-resolves endpoint |
| `SynapseAnchorSap.fromSynapseClient(client, wallet, opts?)` | Create from existing SynapseClient — reuses RPC endpoint |

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `sapClient` | `SapClient` | Underlying SAP SDK client |
| `endpoint` | `SynapseEndpoint` | Resolved Synapse endpoint |
| `programId` | `string` | SAP program ID |
| `walletPubkey` | `string` | Wallet public key (base58) |
| `provider` | `AnchorProvider` | Anchor provider |
| `connection` | `Connection` | Solana connection |
| `isReady` | `boolean` | Whether fully initialized |

### Module getters (proxied from SapClient)

| Getter | Domain | Key operations |
|--------|--------|----------------|
| `.agent` | Identity lifecycle | register, update, deactivate, reactivate, close, reportCalls, updateReputation, fetch |
| `.builder` | Fluent registration | .agent().description().addCapability().addPricingTier().register() |
| `.session` | Memory management | start, write, readLatest, seal, close |
| `.escrow` | Payment settlement | create, deposit, settle, withdraw, close |
| `.tools` | Tool schema registry | publish, inscribe, update, close |
| `.discovery` | Agent search | findByCapability, findByProtocol, findByWallet |
| `.feedback` | Reputation | give, update, revoke |
| `.attestation` | Web of trust | create, revoke |
| `.program` | Low-level | Direct Anchor program access |

### Factory functions

| Function | Description |
|----------|-------------|
| `createSapProvider(wallet, config?, opts?)` | HMR-safe singleton for Next.js server |
| `createSapContextBlueprint(config?)` | React context blueprint (no React dep) |

### Types

| Type | Description |
|------|-------------|
| `SapWallet` | Minimal wallet interface (publicKey, signTransaction, signAllTransactions) |
| `SapBridgeConfig` | Bridge configuration (wallet, network, region, programId, commitment) |
| `SapProviderConfig` | Server provider config (extends SapBridgeConfig without wallet) |
| `SapContextValue<T>` | React context value shape (client, loading, error, connect, disconnect) |
| `SapContextBlueprint` | Blueprint result (defaultValue, createManager) |
| `SapStateManager` | State machine (connect, disconnect, getValue, subscribe) |
| `SapCommitment` | `'processed' \| 'confirmed' \| 'finalized'` |

### Constants & errors

| Export | Description |
|--------|-------------|
| `SAP_PROGRAM_ID` | Canonical program ID: `SAPTU7aUXk2AaAdktexae1iuxXpokxzNDBAYYhaVyQL` |
| `SapDependencyError` | Thrown when a required peer dep is missing |

---

## SAP Protocol Reference

For the full on-chain protocol, refer to the dedicated repositories:

### Protocol Documentation

| Doc | Content |
|-----|---------|
| [01-architecture](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/01-architecture.md) | PDA hierarchy, authority chain, data flows |
| [02-instructions](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/02-instructions.md) | All 72 instructions |
| [03-accounts](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/03-accounts.md) | 22 account types, rent costs |
| [04-events-errors](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/04-events-errors.md) | 45 events, 91 errors |
| [05-memory](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/05-memory.md) | Memory systems |
| [06-commerce](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/06-commerce.md) | x402 escrow |
| [07-testing](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/07-testing.md) | 187 tests |
| [08-costs](https://github.com/OOBE-PROTOCOL/synapse-sap/blob/main/docs/08-costs.md) | Deployment costs |

### SAP SDK Documentation

| Doc | Content |
|-----|---------|
| [00-overview](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/00-overview.md) | Quick start |
| [03-agent-lifecycle](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/03-agent-lifecycle.md) | Register, update, close |
| [04-memory-systems](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/04-memory-systems.md) | Vault + Ledger |
| [05-x402-payments](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/05-x402-payments.md) | Escrow payments |
| [06-discovery-indexing](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/06-discovery-indexing.md) | Indexes |
| [07-tools-schemas](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/blob/main/docs/07-tools-schemas.md) | Tool registry |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `SapDependencyError` | Install missing peer dep: `pnpm add @oobe-protocol-labs/synapse-sap-sdk @coral-xyz/anchor @solana/web3.js` |
| `Could not extract RPC endpoint from SynapseClient` | Use `SynapseAnchorSap.create()` with explicit `rpcEndpoint` instead of `fromSynapseClient()` |
| `No Synapse endpoint registered for ...` | Invalid network/region combo — check `SynapseNetwork` and `SynapseRegion` enums |
| Agent operations fail | Ensure wallet has SOL for tx fees. Check commitment level. |
| Need raw SapClient | Access `sap.sapClient` directly |

---

## Next Steps

- **[04_AI_GATEWAY.md](./04_AI_GATEWAY.md)** — Agent commerce and x402 payments
- **[06_INTENTS.md](./06_INTENTS.md)** — Cross-protocol intent resolver
- **[09_PIPELINES.md](./09_PIPELINES.md)** — Multi-module composition patterns
- **[SAP Protocol Docs](https://github.com/OOBE-PROTOCOL/synapse-sap/tree/main/docs)** — Full on-chain protocol reference
- **[SAP SDK Docs](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk/tree/main/docs)** — Full TypeScript SDK documentation
