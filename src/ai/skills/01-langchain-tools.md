# Skill 01 — LangChain Tools per Solana RPC

## Obiettivo

Creare un set completo di **53 strumenti LangChain** che permettono a un agente AI di interagire con qualsiasi metodo Solana RPC in modo type-safe, con validazione Zod automatica.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `agentRpcMethods` | Array di 53 metodi con schema Zod di input e descrizione |
| `createExecutableSolanaTools()` | Factory che produce tools LangChain collegati a un `SynapseClient` |
| `SolanaToolkit` | Oggetto con `tools[]` (array) e `toolMap` (record per nome) |
| `SolanaTool` | Singolo tool LangChain (`ReturnType<typeof tool>`) |

---

## Setup base

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createExecutableSolanaTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = new SynapseClient({ endpoint: 'https://your-rpc.example.com' });

const { tools, toolMap } = createExecutableSolanaTools(client);
// tools.length === 53
```

---

## Opzioni di configurazione

```typescript
import type { CreateSolanaToolsOpts } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const { tools } = createExecutableSolanaTools(client, {
  // Prefisso per ogni tool name (default: "solana_")
  prefix: 'sol_',

  // Includi solo questi metodi
  include: ['getBalance', 'getSlot', 'getTransaction', 'getBlock'],

  // Escludi metodi specifici (applicato dopo include)
  exclude: ['requestAirdrop'],

  // Pretty print JSON nei risultati (default: true)
  prettyJson: false,
});
```

---

## Usare tools con un agente

### Con LangChain / DeepAgents

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';

const model = new ChatOpenAI({ model: 'gpt-4o' });

const { tools } = createExecutableSolanaTools(client);

// Passa direttamente all'agente
const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools,
  prompt: yourPrompt,
});
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: 'Qual è il balance del wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU?',
});
```

### Cherry-pick un tool specifico

```typescript
const { toolMap } = createExecutableSolanaTools(client);

// Usa solo getBalance
const balanceResult = await toolMap.getBalance.invoke({
  pubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
});

console.log(balanceResult); // JSON con il balance in lamports
```

---

## Elenco completo dei tools

I 53 metodi coprono tutte le categorie dell'API Solana RPC:

| Categoria | Metodi |
|-----------|--------|
| **Account** | `getAccountInfo`, `getBalance`, `getMultipleAccounts`, `getProgramAccounts`, `getLargestAccounts` |
| **Block** | `getBlock`, `getBlockHeight`, `getBlockTime`, `getBlockProduction`, `getBlocks`, `getBlocksWithLimit`, `getBlockCommitment`, `getFirstAvailableBlock` |
| **Transaction** | `getTransaction`, `getSignaturesForAddress`, `getSignatureStatuses`, `getTransactionCount`, `getFeeForMessage`, `getRecentPrioritizationFees` |
| **Blockhash** | `getLatestBlockhash`, `isBlockhashValid` |
| **Submission** | `sendTransaction`, `simulateTransaction`, `requestAirdrop` |
| **Slot/Epoch** | `getSlot`, `getSlotLeader`, `getSlotLeaders`, `getEpochInfo`, `getEpochSchedule` |
| **Inflation** | `getInflationRate`, `getInflationGovernor`, `getInflationReward` |
| **Cluster** | `getVoteAccounts`, `getClusterNodes`, `getSupply`, `getRecentPerformanceSamples`, `getHealth`, `getVersion`, `getGenesisHash`, `getIdentity`, `getLeaderSchedule`, `getHighestSnapshotSlot` |
| **Rent/Ledger** | `getMinimumBalanceForRentExemption`, `minimumLedgerSlot`, `getMaxRetransmitSlot`, `getMaxShredInsertSlot` |
| **Staking** | `getStakeMinimumDelegation`, `getStakeActivation` |
| **Token (SPL)** | `getTokenAccountBalance`, `getTokenAccountsByOwner`, `getTokenAccountsByDelegate`, `getTokenLargestAccounts`, `getTokenSupply` |

---

## Naming convention dei tools

Ogni tool segue il pattern: `{prefix}{methodName}`

| Config | Tool name esempio |
|--------|------------------|
| `prefix: 'solana_'` (default) | `solana_getBalance` |
| `prefix: 'sol_'` | `sol_getBalance` |
| `prefix: ''` | `getBalance` |

L'array `solanaToolNames` esporta tutti i nomi con il prefisso di default:

```typescript
import { solanaToolNames } from '@oobe-protocol-labs/synapse-client-sdk/ai';
// ['solana_getBalance', 'solana_getSlot', ...]
```

---

## Gestione errori nei tools

Ogni tool cattura automaticamente gli errori e restituisce un JSON strutturato:

```json
{
  "error": true,
  "method": "getBalance",
  "message": "Network request failed: timeout after 30000ms"
}
```

L'agente può interpretare questo formato e decidere se riprovare o cambiare strategia.

---

## Best practices

1. **Usa `include` per ridurre la superficie** — Non tutti gli agenti hanno bisogno di 53 tools. Filtra per use case.
2. **Disabilita `prettyJson` in produzione** — Risparmia token LLM con JSON compatto.
3. **Combina con metered tools** — Usa `gateway.createGatewayTools(sessionId)` per tool con billing integrato (vedi Skill 03).
4. **Monitora invocazioni** — I tool names nel formato `solana_*` sono facili da filtrare nei log.
