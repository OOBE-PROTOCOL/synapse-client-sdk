# 🧠 Synapse AI Skills — Agent Developer Guide

Questa cartella contiene le **skill** per agenti AI che utilizzano il modulo `@oobe-protocol-labs/synapse-client-sdk/ai`.

Ogni file descrive una capability specifica, con esempi di codice pronti all'uso, best practices e pattern di integrazione.

---

## 📚 Indice delle Skill

| # | Skill | File | Descrizione |
|---|-------|------|-------------|
| 1 | [LangChain Tools](./01-langchain-tools.md) | `01-langchain-tools.md` | Creare strumenti LangChain per tutti i 53 metodi Solana RPC |
| 2 | [Agent Gateway & Sessions](./02-gateway-sessions.md) | `02-gateway-sessions.md` | Aprire sessioni metered, gestire budget e rate limiting |
| 3 | [Pricing & Metering](./03-pricing-metering.md) | `03-pricing-metering.md` | Tier pricing, dynamic pricing, bundle e costi |
| 4 | [Response Attestation](./04-response-attestation.md) | `04-response-attestation.md` | Proof-of-Computation: hash, firma, verifica risposte |
| 5 | [Tool Marketplace](./05-tool-marketplace.md) | `05-tool-marketplace.md` | Pubblicare, cercare e scoprire tool venduti da altri agenti |
| 6 | [x402 Seller — Paywall](./06-x402-seller-paywall.md) | `06-x402-seller-paywall.md` | Vendere accesso RPC via HTTP 402 con settlement on-chain |
| 7 | [x402 Buyer — Client](./07-x402-buyer-client.md) | `07-x402-buyer-client.md` | Comprare accesso RPC da server x402, pagamento automatico |
| 8 | [Full Gateway Orchestration](./08-full-gateway-orchestration.md) | `08-full-gateway-orchestration.md` | Combinare tutte le skill: sessioni + x402 + marketplace + attestation |
| 9 | [Events & Observability](./09-events-observability.md) | `09-events-observability.md` | Sistema eventi, monitoraggio, metrics e debugging |

---

## 🏗️ Architettura del modulo AI

```
src/ai/
├── index.ts                    ← barrel export principale
├── tools/
│   ├── index.ts                ← createExecutableSolanaTools()
│   └── zod/
│       ├── types.ts            ← 53 Zod schema per ogni metodo RPC
│       └── index.ts            ← agentRpcMethods[]
└── gateway/
    ├── index.ts                ← AgentGateway (orchestratore principale)
    ├── types.ts                ← Tipi: AgentIdentity, PricingTier, SessionState, ...
    ├── session.ts              ← AgentSession (metering, budget, rate limit)
    ├── pricing.ts              ← PricingEngine (tier, dynamic pricing, bundle)
    ├── validator.ts            ← ResponseValidator (Proof-of-Computation)
    ├── marketplace.ts          ← ToolMarketplace (discovery, reputazione)
    └── x402/
        ├── types.ts            ← Tipi x402 v2 (Coinbase spec)
        ├── facilitator.ts      ← FacilitatorClient (HTTP client per facilitator)
        ├── paywall.ts          ← X402Paywall (seller: genera 402, settle)
        ├── client.ts           ← X402Client (buyer: paga automaticamente)
        └── index.ts            ← barrel x402
```

---

## ⚡ Quick Start

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import {
  createExecutableSolanaTools,
  createAgentGateway,
  createAgentId,
  DEFAULT_TIERS,
  SOLANA_MAINNET,
  USDC_MAINNET,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

// 1. Client RPC
const client = new SynapseClient({ endpoint: 'https://your-rpc.example.com' });

// 2. LangChain tools (53 metodi)
const { tools, toolMap } = createExecutableSolanaTools(client);

// 3. Gateway per commercio agent-to-agent
const gateway = createAgentGateway(client, {
  identity: {
    id: createAgentId('did:synapse:agent:MyAgent'),
    name: 'My RPC Agent',
    walletPubkey: 'YourSolanaWalletPubkey',
    createdAt: Date.now(),
  },
  defaultTiers: DEFAULT_TIERS,
});
```

---

## 🔗 Prerequisiti

- **Node.js** ≥ 18
- **TypeScript** ≥ 5.0
- `@oobe-protocol-labs/synapse-client-sdk` installato
- Per i tools LangChain: `@langchain/core` ≥ 0.3
- Per x402 on-chain: `@solana/web3.js`
