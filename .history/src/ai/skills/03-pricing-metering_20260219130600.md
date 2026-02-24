# Skill 03 — Pricing & Metering

## Obiettivo

Configurare **tier di pricing**, **pricing dinamico** basato sulla congestione, **bundle** di metodi e calcolo costi per sessioni agent-to-agent.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `PricingTier` | Un livello di servizio (free, standard, premium) con prezzo, limiti e token |
| `PricingEngine` | Motore di pricing con tier, dynamic pricing e bundle discount |
| `DEFAULT_TIERS` | 4 tier preconfigurati pronti all'uso |
| `DynamicPricingConfig` | Config per surge pricing basato su latenza |
| `ToolBundle` | Pacchetto di metodi venduti insieme con sconto |

---

## 1. Tier preconfigurati (DEFAULT_TIERS)

```typescript
import { DEFAULT_TIERS } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// DEFAULT_TIERS contiene 4 tier:

// 🆓 free
//   pricePerCall: 0n, maxCallsPerSession: 100, rateLimit: 5/s
//   token: SOL, attestation: false

// 📊 standard
//   pricePerCall: 1_000n (0.000001 SOL), maxCalls: 10_000, rateLimit: 50/s
//   token: SOL, attestation: false

// ⭐ premium
//   pricePerCall: 5_000n (0.000005 SOL), maxCalls: unlimited, rateLimit: 200/s
//   token: SOL, attestation: true

// 💵 usdc-standard
//   pricePerCall: 1n (0.000001 USDC), maxCalls: 50_000, rateLimit: 100/s
//   token: USDC, attestation: false
```

---

## 2. Creare tier personalizzati

```typescript
import type { PricingTier } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const myTiers: PricingTier[] = [
  {
    id: 'basic',
    label: 'Basic Tier',
    pricePerCall: 500n,           // 0.0000005 SOL
    maxCallsPerSession: 5_000,
    rateLimit: 20,                // 20 call/s
    token: { type: 'SOL' },
    includesAttestation: false,
  },
  {
    id: 'pro',
    label: 'Pro Tier (Attested)',
    pricePerCall: 2_000n,
    maxCallsPerSession: 0,        // unlimited
    rateLimit: 500,
    token: { type: 'SOL' },
    includesAttestation: true,    // ← Proof-of-Computation incluso
  },
  {
    id: 'usdc-pro',
    label: 'Pro USDC',
    pricePerCall: 5n,             // 0.000005 USDC
    maxCallsPerSession: 100_000,
    rateLimit: 200,
    token: { type: 'USDC' },
    includesAttestation: true,
  },
  {
    id: 'spl-custom',
    label: 'Custom SPL Token',
    pricePerCall: 100n,
    maxCallsPerSession: 10_000,
    rateLimit: 50,
    token: {
      type: 'SPL',
      mint: 'YourCustomTokenMintAddress',
      decimals: 9,
    },
    includesAttestation: false,
  },
];
```

---

## 3. Pricing per-metodo

Alcuni metodi costano più di altri (es. `getTransaction` è più pesante di `getSlot`):

```typescript
const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: myTiers,

  // Override pricing per metodi specifici
  methodTiers: {
    getTransaction: [
      { ...myTiers[1], id: 'pro', pricePerCall: 8_000n },     // 4x il prezzo base
    ],
    getProgramAccounts: [
      { ...myTiers[1], id: 'pro', pricePerCall: 15_000n },    // Molto costoso
    ],
    getSlot: [
      { ...myTiers[0], id: 'basic', pricePerCall: 100n },     // Economico
    ],
  },
});
```

---

## 4. Dynamic Pricing (congestione)

Il `PricingEngine` aumenta automaticamente i prezzi quando la latenza sale:

```typescript
import { PricingEngine, type DynamicPricingConfig } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const dynamicConfig: DynamicPricingConfig = {
  baseMultiplier: 1.0,             // 1x = nessun markup base
  congestionThresholdMs: 500,      // Soglia: se latenza > 500ms → surge
  congestionMaxMultiplier: 3.0,    // Max 3x il prezzo durante congestione
  bundleDiscount: 0.15,            // 15% sconto per acquisti in bundle
};

// Il PricingEngine è creato automaticamente nel gateway,
// ma puoi usarlo standalone:
const engine = new PricingEngine(myTiers, {}, dynamicConfig);

// Calcola prezzo effettivo (tiene conto della congestione)
const tier = engine.getTier('pro')!;
const effectivePrice = engine.computeCallPrice(tier);
// Se latenza media = 200ms → effectivePrice = 2_000n (prezzo base)
// Se latenza media = 1000ms → effectivePrice = 4_000n (2x surge)

// Stima costo sessione
const estimatedCost = engine.estimateSessionCost('pro', 1_000);
// → BigInt del costo totale per 1000 chiamate
```

### Come funziona il surge pricing

```
Latenza ≤ 500ms  → prezzo × 1.0 (nessun surge)
Latenza = 750ms  → prezzo × 1.5
Latenza = 1000ms → prezzo × 2.0
Latenza = 1500ms → prezzo × 3.0 (cap massimo)
Latenza > 1500ms → prezzo × 3.0 (capped)
```

La latenza viene aggiornata automaticamente dopo ogni `gateway.execute()`.

---

## 5. Bundle di metodi

Vendi pacchetti di metodi con sconto:

```typescript
// Pubblica un bundle
const defiBundle = gateway.publishBundle(
  'DeFi Essentials',
  ['getBalance', 'getTokenAccountBalance', 'getTransaction', 'getSlot', 'getLatestBlockhash'],
  myTiers,
  'Essential methods for DeFi agents',
);

// Calcola costo bundle (con sconto applicato)
const bundleCost = gateway.pricing.computeBundleSessionCost(
  defiBundle.id,
  'pro',
  5_000, // stima 5000 chiamate
);
// → Costo con 15% di sconto rispetto al singolo acquisto
```

---

## 6. Metered LangChain Tools

Crea tools LangChain che deducono automaticamente dal budget della sessione:

```typescript
// Apri sessione per il buyer
const session = gateway.openSession(buyerIntent);

// Crea tools metered (ogni invocazione passa per execute())
const meteredTools = await gateway.createGatewayTools(session.id);

// Passa all'agente LangChain
const agent = createMyAgent({ tools: meteredTools });

// Ogni chiamata:
// 1. preCall() → verifica budget + rate limit
// 2. transport.request() → RPC call
// 3. wrapResult() → attestation (se tier lo include)
// 4. postCall() → deduce dal budget
```

I tool names sono prefissati con `metered_`:
- `metered_getBalance`
- `metered_getTransaction`
- ecc.

---

## 7. Query prezzi (lato buyer)

```typescript
// Lista tutti i tier disponibili
const tierIds = gateway.pricing.listTierIds();
// ['basic', 'pro', 'usdc-pro', 'spl-custom']

// Ottieni dettagli di un tier
const proTier = gateway.pricing.getTier('pro');
console.log(proTier?.pricePerCall);  // 2_000n
console.log(proTier?.rateLimit);     // 500

// Tier specifico per metodo
const txTier = gateway.pricing.getTier('pro', 'getTransaction');
console.log(txTier?.pricePerCall);   // 8_000n (override)

// Stima budget necessario
const budget = gateway.pricing.estimateSessionCost('pro', 10_000);
// → BigInt del budget minimo consigliato
```

---

## Best practices

1. **Free tier per onboarding** — Offri 100 call gratuite per attrarre nuovi agenti.
2. **Attestation solo su tier premium** — La firma crittografica ha un costo computazionale.
3. **Monitora la latenza** — Se il surge pricing sale troppo, i buyer andranno da altri seller.
4. **Bundle per use case** — "DeFi Pack", "NFT Reader", "Validator Tools" → acquisto più semplice.
5. **Token USDC per stabilità** — SOL è volatile, USDC mantiene il prezzo fisso.
