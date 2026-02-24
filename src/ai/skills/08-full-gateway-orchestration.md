# Skill 08 — Full Gateway Orchestration

## Obiettivo

Combinare **tutte le capability** del modulo AI in un setup completo: sessioni metered + x402 payments + attestation + marketplace, sia come seller che come buyer.

---

## Scenario: Agent RPC Provider completo

Un agente che:
1. **Vende** accesso RPC via x402 (paywall + settlement on-chain)
2. **Compra** da altri provider quando i propri upstream sono down
3. **Attesta** le risposte per dimostrare autenticità
4. **Pubblica** i propri tool sul marketplace
5. **Emette eventi** per monitoring in tempo reale

---

## 1. Setup completo

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import {
  createAgentGateway,
  createAgentId,
  DEFAULT_TIERS,
  SOLANA_MAINNET,
  USDC_MAINNET,
  type GatewayConfig,
  type X402Config,
  type X402ClientConfig,
  type PricingTier,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

// ── RPC Client
const client = new SynapseClient({
  endpoint: 'https://your-rpc-provider.example.com',
});

// ── Identità
const identity = {
  id: createAgentId('did:synapse:agent:MyPremiumRPC'),
  name: 'Premium Solana RPC',
  walletPubkey: 'SellerWalletPubkey',
  description: 'Enterprise-grade Solana RPC with attestation and x402',
  tags: ['solana', 'mainnet', 'premium', 'attested', 'x402'],
  createdAt: Date.now(),
};

// ── Tier personalizzati
const tiers: PricingTier[] = [
  {
    id: 'free',
    label: 'Free (Trial)',
    pricePerCall: 0n,
    maxCallsPerSession: 50,
    rateLimit: 2,
    token: { type: 'SOL' },
    includesAttestation: false,
  },
  {
    id: 'standard',
    label: 'Standard',
    pricePerCall: 1_000n,
    maxCallsPerSession: 50_000,
    rateLimit: 100,
    token: { type: 'USDC' },
    includesAttestation: false,
  },
  {
    id: 'premium',
    label: 'Premium (Attested)',
    pricePerCall: 3_000n,
    maxCallsPerSession: 0,
    rateLimit: 500,
    token: { type: 'USDC' },
    includesAttestation: true,
  },
];

// ── x402 Paywall (SELLER)
const x402Seller: X402Config = {
  enabled: true,
  payTo: 'SellerWalletPubkey',
  facilitator: {
    url: 'https://x402.org/facilitator',
    timeoutMs: 15_000,
  },
  defaultNetwork: SOLANA_MAINNET,
  defaultAsset: USDC_MAINNET,
  defaultPrice: '1000',
  routes: {
    getBalance:          { price: '500',   network: SOLANA_MAINNET, asset: USDC_MAINNET },
    getSlot:             { price: '200',   network: SOLANA_MAINNET, asset: USDC_MAINNET },
    getTransaction:      { price: '5000',  network: SOLANA_MAINNET, asset: USDC_MAINNET },
    getProgramAccounts:  { price: '10000', network: SOLANA_MAINNET, asset: USDC_MAINNET },
    getBlock:            { price: '3000',  network: SOLANA_MAINNET, asset: USDC_MAINNET },
  },
};

// ── x402 Client (BUYER — per fallback)
const x402Buyer: X402ClientConfig = {
  enabled: true,
  signer: myPaymentSigner,  // Vedi Skill 07
  preferredNetwork: SOLANA_MAINNET,
  preferredAsset: USDC_MAINNET,
  maxAmountPerCall: '50000',
  budgetCheck: myBudgetChecker,
};

// ── Config completa
const config: GatewayConfig = {
  identity,
  defaultTiers: tiers,
  methodTiers: {
    getProgramAccounts: [{ ...tiers[2], pricePerCall: 15_000n }],
  },
  sessionTtl: 3600,
  maxConcurrentSessions: 200,
  attestByDefault: false,
  signer: async (msg) => myKeypair.sign(msg),
  x402: x402Seller,
  x402Client: x402Buyer,
};

// ── Crea il gateway
const gateway = createAgentGateway(client, config);
```

---

## 2. Pipeline completa — HTTP Server Handler

```typescript
// Express / Hono / raw HTTP handler
async function handleRpcRequest(req: Request): Promise<Response> {
  const body = await req.json();
  const { method, params, id } = body;

  // ── Step 1: x402 Paywall
  const headers = Object.fromEntries(req.headers.entries());
  const { result, x402, settlement, responseHeaders } = await gateway.executeWithX402(
    null,            // null = no session metering, x402-only billing
    method,
    params,
    headers,
  );

  // Se il buyer non ha pagato → 402
  if (x402.type === 'payment-required') {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32099, message: 'Payment required' },
      id,
    }), {
      status: 402,
      headers: { ...x402.headers, 'Content-Type': 'application/json' },
    });
  }

  // ── Step 2: Risposta con settlement
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    result: result?.data,
    id,
  }), {
    status: 200,
    headers: { ...responseHeaders, 'Content-Type': 'application/json' },
  });
}
```

---

## 3. Pipeline con sessioni metered + x402

Per buyer che aprono sessioni con PaymentIntent:

```typescript
async function handleMeteredRequest(
  sessionId: string,
  method: string,
  params: unknown[],
  headers: Record<string, string>,
): Promise<{ data: unknown; responseHeaders: Record<string, string> }> {

  // Usa sia sessione che x402
  const { result, x402, settlement, responseHeaders } = await gateway.executeWithX402(
    sessionId,   // ← metering attivo
    method,
    params,
    headers,
  );

  if (x402.type === 'payment-required') {
    throw new Error('Payment required');
  }

  return {
    data: result?.data,
    responseHeaders,
  };
}
```

---

## 4. Fallback buyer: comprare da altri provider

Quando il tuo upstream è down, compra da un altro agent:

```typescript
async function executeWithFallback(method: string, params: unknown[]) {
  try {
    // Prova il nostro upstream
    return await gateway.execute(sessionId, method, params);
  } catch (err) {
    console.log('Upstream down, fallback a provider x402...');

    // Compra da un altro provider
    const { result } = await gateway.executeRemoteX402(
      'https://backup-rpc.example.com/rpc',
      method,
      params,
    );

    return result;
  }
}
```

---

## 5. Pubblicare sul marketplace

```typescript
// Pubblica tutti i metodi
const allMethods = [
  'getBalance', 'getSlot', 'getTransaction', 'getBlock',
  'getAccountInfo', 'getTokenAccountBalance', 'getLatestBlockhash',
  'sendTransaction', 'simulateTransaction',
];

gateway.publish(allMethods, {
  region: 'eu-west',
  commitments: ['confirmed', 'finalized'],
});

// Pubblica bundle
gateway.publishBundle(
  'DeFi Suite',
  ['getBalance', 'getTransaction', 'getTokenAccountBalance', 'getLatestBlockhash', 'sendTransaction'],
  tiers,
);

gateway.publishBundle(
  'Read-Only',
  ['getBalance', 'getSlot', 'getBlock', 'getAccountInfo', 'getEpochInfo'],
  [tiers[0], tiers[1]], // Solo free e standard
);
```

---

## 6. LangChain tools metered

```typescript
// Crea tools per un buyer specifico
const session = gateway.openSession(buyerIntent);
const tools = await gateway.createGatewayTools(session.id);

// Passa all'agente
// Ogni tool invoca: preCall → execute → wrapResult → postCall
// Con pricing, rate limiting, budget tracking e attestation automatici
```

---

## 7. Monitoring in tempo reale

```typescript
// Ascolta tutti gli eventi
gateway.on('*', (event) => {
  console.log(`[${event.type}] session=${event.sessionId}`, event.data);
});

// Metriche
setInterval(() => {
  const m = gateway.getMetrics();
  console.log(`Calls: ${m.totalCallsServed}`);
  console.log(`Revenue: ${m.totalRevenue}`);
  console.log(`Sessions: ${m.activeSessions}/${m.totalSessions}`);
  console.log(`Attestations: ${m.totalAttestations}`);
  console.log(`x402 paywall: ${m.x402.paywallEnabled ? 'ON' : 'OFF'}`);
  console.log(`x402 client: ${m.x402.clientEnabled ? 'ON' : 'OFF'}`);
  console.log(`x402 payments sent: ${m.x402.clientPayments}`);
  console.log(`Marketplace: ${m.marketplaceStats.totalListings} listings`);
}, 30_000);
```

---

## 8. Garbage collection

```typescript
// Ogni 5 minuti: pulisci sessioni terminate
setInterval(() => {
  const pruned = gateway.pruneSessions();
  if (pruned > 0) console.log(`Pruned ${pruned} sessions`);
}, 5 * 60 * 1000);
```

---

## Architettura del flusso completo

```
                    ┌───────────────────────────────────────┐
                    │            AgentGateway                │
                    │                                       │
  Buyer ──────────▶│  processX402Request()                  │
  (HTTP)           │       │                                │
                    │       ├─ 402? → respond with headers   │
                    │       │                                │
                    │       └─ valid? → execute()             │
                    │              │                          │
                    │       session.preCall()                 │
                    │              │                          │
                    │       transport.request()  ────────────│───▶ Solana RPC
                    │              │                          │
                    │       validator.wrapResult()            │
                    │              │                          │
                    │       session.postCall()                │
                    │              │                          │
                    │       settleX402Payment() ────────────│───▶ Facilitator
                    │              │                          │
                    │       return response + headers         │
                    └───────────────────────────────────────┘
                               │          │
                          events      metrics
                               │          │
                          monitoring  dashboard
```

---

## Best practices

1. **Separa seller e buyer config** — Non mescolare wallet: `x402.payTo` (ricezione) ≠ `x402Client.signer` (spesa).
2. **Fallback chain** — `upstream RPC → altro agent x402 → devnet`.
3. **Budget buyer limitato** — Imposta `maxAmountPerCall` e `budgetCheck` per evitare spese impreviste.
4. **Pubblica su marketplace** — Più visibilità = più buyer.
5. **Attesta per differenziarti** — I buyer pagano di più per risposte firmate.
6. **Monitora tutto** — Events + metrics + attestation log.
