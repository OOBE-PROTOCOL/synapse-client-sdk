# Skill 02 — Agent Gateway & Sessioni Metered

## Obiettivo

Configurare un **AgentGateway** che permette ad agenti di comprare e vendere accesso RPC tramite sessioni metered con budget, rate limiting e lifecycle management.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `AgentGateway` | Orchestratore principale: sessioni, pricing, attestation, marketplace |
| `AgentSession` | Sessione metered con budget, rate limit, TTL |
| `PaymentIntent` | Richiesta del buyer per aprire una sessione |
| `PaymentReceipt` | Ricevuta di settlement post-sessione |
| `AgentIdentity` | Identità DID-style dell'agente (id + wallet + name) |

---

## 1. Creare l'identità dell'agente

```typescript
import { createAgentId, type AgentIdentity } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const identity: AgentIdentity = {
  id: createAgentId('did:synapse:agent:MyRpcProvider'),
  name: 'Synapse RPC Provider #1',
  walletPubkey: 'YourSolanaWalletPubkey',
  description: 'High-performance Solana RPC with attestation',
  tags: ['solana', 'rpc', 'mainnet', 'attested'],
  createdAt: Date.now(),
};
```

---

## 2. Inizializzare il Gateway

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createAgentGateway, DEFAULT_TIERS } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = new SynapseClient({ endpoint: 'https://your-rpc.example.com' });

const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: DEFAULT_TIERS,

  // Opzionale: pricing per-metodo
  methodTiers: {
    getTransaction: [
      { ...DEFAULT_TIERS[2], pricePerCall: 10_000n }, // Premium più costoso
    ],
  },

  // TTL sessione (default: 3600 = 1 ora)
  sessionTtl: 7200, // 2 ore

  // Max sessioni concorrenti (default: 100)
  maxConcurrentSessions: 50,

  // Attestation di default per ogni chiamata
  attestByDefault: false,

  // Signer per attestation (opzionale)
  signer: async (message) => {
    // Firma con la tua keypair Solana
    return yourKeypair.sign(message);
  },
});
```

---

## 3. Aprire una sessione (lato seller)

Il buyer invia un `PaymentIntent`, il seller lo valida e apre la sessione:

```typescript
import type { PaymentIntent } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const intent: PaymentIntent = {
  nonce: crypto.randomUUID(),
  buyer: createAgentId('did:synapse:agent:BuyerBot'),
  seller: gateway.agentId, // Deve corrispondere al gateway
  tierId: 'standard',
  maxBudget: 1_000_000n, // 0.001 SOL
  token: { type: 'SOL' },
  signature: '...', // Ed25519 signature del buyer
  createdAt: Date.now(),
  ttl: 3600, // 1 ora
};

const session = gateway.openSession(intent);
// session.id → UUID della sessione
// session.status → 'active'
```

### Con verifier custom

```typescript
const session = gateway.openSession(intent, {
  // Override del tier
  tier: myCustomTier,

  // TTL custom
  ttl: 600, // 10 minuti

  // Verifier personalizzato (es. verifica firma on-chain)
  verifyIntent: (intent) => {
    return verifyEd25519Signature(intent);
  },
});
```

---

## 4. Eseguire chiamate metered

```typescript
// Singola chiamata
const result = await gateway.execute(session.id, 'getBalance', [
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
]);

console.log(result.data);         // Il balance effettivo
console.log(result.latencyMs);    // Latenza in ms
console.log(result.callIndex);    // Numero progressivo della chiamata
console.log(result.attestation);  // Attestation (se tier lo include)

// Batch di chiamate
const batchResults = await gateway.executeBatch(session.id, [
  { method: 'getSlot' },
  { method: 'getBlockHeight' },
  { method: 'getBalance', params: ['...pubkey...'] },
]);
```

---

## 5. Lifecycle della sessione

```
  PaymentIntent
       │
       ▼
   ┌─────────┐     activate()
   │ pending  │────────────────┐
   └─────────┘                 │
                               ▼
                          ┌─────────┐
                    ┌─────│  active  │─────┐
                    │     └─────────┘     │
              pause()│                    │ budget/calls exhausted
                    ▼                     ▼
              ┌─────────┐         ┌───────────┐
              │ paused  │         │ exhausted  │
              └─────────┘         └───────────┘
                    │
              resume()│
                    ▼
              ┌─────────┐
              │  active  │
              └─────────┘
                    │
              settle()│          TTL scaduto
                    ▼                  ▼
              ┌─────────┐      ┌─────────┐
              │ settled  │      │ expired  │
              └─────────┘      └─────────┘
```

```typescript
// Pausa
session.pause();  // → 'paused'
session.resume(); // → 'active'

// Settle (chiudi e genera ricevuta)
const receipt = gateway.settleSession(session.id, 'optionalTxSignature');

console.log(receipt.amountCharged); // bigint: totale addebitato
console.log(receipt.callCount);     // numero di chiamate
console.log(receipt.settlement);    // 'onchain' | 'offchain-escrow'
```

---

## 6. Gestione sessioni

```typescript
// Lista sessioni attive
const activeSessions = gateway.listSessions('active');
// [{ id: '...', status: 'active', buyer: 'did:...' }]

// Ottieni sessione specifica
const session = gateway.getSession(sessionId);
const snap = session?.snapshot();
// snap.budgetRemaining, snap.callsMade, snap.methodCounts, ...

// Garbage collection delle sessioni terminate
const pruned = gateway.pruneSessions();
console.log(`Rimosse ${pruned} sessioni scadute/settled`);
```

---

## 7. Errori tipati

Ogni errore ha un `code` per gestione programmatica:

| Errore | Code | Quando |
|--------|------|--------|
| `SessionNotFoundError` | `SESSION_NOT_FOUND` | Session ID non esiste |
| `MaxSessionsError` | `MAX_SESSIONS` | Limite sessioni concorrenti raggiunto |
| `IntentVerificationError` | `INTENT_INVALID` | PaymentIntent non valido |
| `BudgetExhaustedError` | `BUDGET_EXHAUSTED` | Budget esaurito |
| `RateLimitExceededError` | `RATE_LIMIT_EXCEEDED` | Troppi call nel window |
| `SessionExpiredError` | `SESSION_EXPIRED` | TTL scaduto |
| `CallLimitExceededError` | `CALL_LIMIT_EXCEEDED` | Max calls per session raggiunto |

```typescript
import {
  BudgetExhaustedError,
  RateLimitExceededError,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

try {
  await gateway.execute(session.id, 'getBalance', ['...']);
} catch (err) {
  if (err instanceof RateLimitExceededError) {
    console.log(`Retry dopo ${err.retryAfterMs}ms`);
    await sleep(err.retryAfterMs);
    // Riprova
  }
  if (err instanceof BudgetExhaustedError) {
    // Settle la sessione e aprine una nuova
    gateway.settleSession(session.id);
  }
}
```

---

## Best practices

1. **Sempre settare un TTL** — Evita sessioni zombie che consumano memoria.
2. **Usa `pruneSessions()` periodicamente** — Garbage collection manuale ogni N minuti.
3. **Monitora `budgetRemaining`** — Ascolta l'evento `budget:warning` per avvisare il buyer.
4. **Rate limit realistico** — Imposta `rateLimit` nel tier in base alla capacità del tuo RPC.
5. **Verifica firma in produzione** — Non fidarti del `PaymentIntent.signature` senza verifica Ed25519.
