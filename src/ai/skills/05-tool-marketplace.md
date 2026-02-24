# Skill 05 — Tool Marketplace

## Obiettivo

Pubblicare, cercare e scoprire **tool RPC** venduti da agenti, con filtri per prezzo, reputazione, latenza e region.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `ToolMarketplace` | Registry in-memory di tool listing |
| `ToolListing` | Un singolo metodo pubblicato da un seller con stats |
| `ToolBundle` | Pacchetto di metodi venduti insieme |
| `MarketplaceQuery` | Filtri di ricerca (prezzo, reputazione, region, ecc.) |
| `reputationScore` | Punteggio 0-1000 basato su attestation, volume, latenza |

---

## 1. Pubblicare i propri tool

```typescript
// Pubblica tutti i metodi standard
gateway.publish(
  ['getBalance', 'getSlot', 'getTransaction', 'getBlock', 'getTokenAccountBalance'],
  {
    region: 'eu-west',
    commitments: ['confirmed', 'finalized'],
    description: (method) => `High-performance ${method} — 99.9% uptime`,
  },
);
```

### Pubblicare un bundle

```typescript
const nftBundle = gateway.publishBundle(
  'NFT Reader Pack',
  ['getAccountInfo', 'getTokenAccountsByOwner', 'getProgramAccounts', 'getTransaction'],
  myTiers,
  'Everything you need to read NFT data on Solana',
);
// nftBundle.id → UUID del bundle
```

---

## 2. Cercare tool nel marketplace

### Ricerca base

```typescript
// Tutti i listing
const allTools = gateway.marketplace.search();

// Per metodo
const balanceProviders = gateway.marketplace.search({ method: 'getBalance' });

// Substring match
const tokenTools = gateway.marketplace.search({ method: 'token' });
// → getTokenAccountBalance, getTokenAccountsByOwner, getTokenSupply, ...
```

### Con filtri avanzati

```typescript
import type { MarketplaceQuery } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const query: MarketplaceQuery = {
  method: 'getBalance',

  // Max prezzo per call (lamports)
  maxPrice: 2_000n,

  // Min reputazione (0-1000)
  minReputation: 700,

  // Min uptime (0-100%)
  minUptime: 99,

  // Solo seller con attestation
  requireAttestation: true,

  // Region specifica
  region: 'us-east',

  // Tag del seller
  tags: ['solana', 'mainnet'],

  // Ordinamento
  sortBy: 'price',         // 'price' | 'reputation' | 'latency' | 'uptime' | 'totalServed'
  sortDirection: 'asc',    // Prezzo crescente

  // Paginazione
  limit: 10,
  offset: 0,
};

const results = gateway.marketplace.search(query);

for (const listing of results) {
  console.log(`${listing.seller.name}: ${listing.method}`);
  console.log(`  Prezzo min: ${Math.min(...listing.tiers.map(t => Number(t.pricePerCall)))}`);
  console.log(`  Reputazione: ${listing.reputationScore}/1000`);
  console.log(`  Latenza: ${listing.avgLatencyMs}ms`);
  console.log(`  Uptime: ${listing.uptimePercent}%`);
}
```

---

## 3. Struttura di un ToolListing

```typescript
interface ToolListing {
  method: string;                    // 'getBalance'
  description: string;               // 'High-performance getBalance...'
  seller: AgentIdentity;             // Identità completa del seller
  tiers: PricingTier[];              // Tier disponibili
  avgLatencyMs: number;              // Latenza media (self-reported)
  uptimePercent: number;             // 0-100
  totalServed: number;               // Chiamate servite totali
  reputationScore: number;           // 0-1000
  attestationAvailable: boolean;     // Ha un signer?
  region?: string;                   // 'eu-west', 'us-east', ...
  commitments: string[];             // ['processed', 'confirmed', 'finalized']
  listedAt: number;                  // Unix ms
  updatedAt: number;                 // Unix ms
}
```

---

## 4. Reputazione

La reputazione è un punteggio composito (0-1000):

```
reputation = 0.4 × verificationRate
           + 0.3 × volumeScore
           + 0.3 × latencyScore
```

| Componente | Peso | Come si calcola |
|------------|------|-----------------|
| `verificationRate` | 40% | % di attestation verificate con successo |
| `volumeScore` | 30% | Normalizzato sul volume di chiamate servite |
| `latencyScore` | 30% | Inversamente proporzionale alla latenza media |

### Aggiornare la reputazione

```typescript
// Il marketplace calcola automaticamente la reputazione
// quando vengono riportate attestation verificate:
gateway.marketplace.reportAttestation(sellerId, {
  verified: true,
  latencyMs: 45,
});
```

---

## 5. Gestione listing

```typescript
// Rimuovi un listing specifico
gateway.marketplace.delistTool('getBalance', sellerId);

// Rimuovi TUTTI i listing di un seller
const removedCount = gateway.marketplace.delistAll(sellerId);

// Cerca bundles
const bundles = gateway.marketplace.listBundles();
const myBundles = gateway.marketplace.listBundles(myAgentId);
```

---

## 6. Statistiche del marketplace

```typescript
import type { MarketplaceStats } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const stats: MarketplaceStats = gateway.marketplace.getStats();

console.log(`Listing totali: ${stats.totalListings}`);
console.log(`Seller unici: ${stats.totalSellers}`);
console.log(`Bundle: ${stats.totalBundles}`);
console.log(`Prezzo medio/call: ${stats.avgPricePerCall}`);
console.log(`Reputazione media: ${stats.avgReputation}`);
console.log(`Uptime medio: ${stats.avgUptime}%`);
```

---

## 7. Pattern: Agent che sceglie il miglior provider

```typescript
async function findBestProvider(method: string) {
  // Cerca il più economico con buona reputazione
  const [cheapest] = gateway.marketplace.search({
    method,
    minReputation: 600,
    requireAttestation: true,
    sortBy: 'price',
    sortDirection: 'asc',
    limit: 1,
  });

  // Cerca il più veloce
  const [fastest] = gateway.marketplace.search({
    method,
    minReputation: 600,
    sortBy: 'latency',
    sortDirection: 'asc',
    limit: 1,
  });

  // Cerca il più affidabile
  const [mostReliable] = gateway.marketplace.search({
    method,
    sortBy: 'reputation',
    sortDirection: 'desc',
    limit: 1,
  });

  return { cheapest, fastest, mostReliable };
}
```

---

## Best practices

1. **Aggiorna i listing** — Usa `publish()` periodicamente per aggiornare latenza e uptime.
2. **Reputazione ≥ 700** — Sotto questo livello, i buyer non si fidano.
3. **Region matching** — Seleziona seller nella stessa region per latenza minima.
4. **Bundle per fidelizzare** — I buyer preferiscono un unico provider per più metodi.
5. **Attestation come differenziatore** — Offrire attestation ti distingue dai competitor.
