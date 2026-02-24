# Skill 06 — x402 Seller: Paywall

## Obiettivo

Vendere accesso RPC via protocollo **x402** (Coinbase): generare risposte HTTP 402, verificare pagamenti e settle on-chain tramite un facilitator configurabile.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `X402Paywall` | Middleware che genera 402 e coordina verify/settle |
| `FacilitatorClient` | Client HTTP per il facilitator (verify, settle, supported) |
| `X402Config` | Config completa: payTo, facilitator, network, routes, prezzi |
| `PaywallResult` | Esito del processamento: `payment-required`, `payment-valid`, `no-payment-needed` |
| `SettleResult` | Esito del settlement con header `PAYMENT-RESPONSE` |

---

## 1. Flow del protocollo x402

```
  Buyer Agent                    Seller Gateway                   Facilitator
       │                              │                              │
       │──── GET /rpc (no payment) ──▶│                              │
       │                              │                              │
       │◀── 402 + PAYMENT-REQUIRED ───│                              │
       │    (base64 JSON con accepts)  │                              │
       │                              │                              │
       │  [firma tx SPL transfer]     │                              │
       │                              │                              │
       │── GET /rpc + PAYMENT-SIG ───▶│                              │
       │                              │── POST /verify ─────────────▶│
       │                              │◀── { isValid: true } ────────│
       │                              │                              │
       │                              │  [esegue RPC call]           │
       │                              │                              │
       │                              │── POST /settle ─────────────▶│
       │                              │◀── { success, txSig } ──────│
       │                              │                              │
       │◀── 200 + PAYMENT-RESPONSE ───│                              │
       │    (base64 JSON settlement)   │                              │
```

---

## 2. Configurare il Paywall

```typescript
import {
  createAgentGateway,
  SOLANA_MAINNET,
  USDC_MAINNET,
  type X402Config,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

const x402Config: X402Config = {
  // Abilita il paywall
  enabled: true,

  // Wallet che riceve i pagamenti
  payTo: 'YourSolanaWalletPubkey',

  // Facilitator (verifica + settle on-chain)
  facilitator: {
    url: 'https://x402.org/facilitator', // Coinbase public facilitator
    // Oppure il tuo facilitator custom:
    // url: 'https://my-facilitator.example.com',

    // Auth opzionale per endpoint
    createAuthHeaders: async () => ({
      verify: { 'X-API-Key': 'your-key' },
      settle: { 'X-API-Key': 'your-key' },
      supported: {},
    }),

    // Timeout (default: 30s)
    timeoutMs: 15_000,
  },

  // Network Solana (CAIP-2 format)
  defaultNetwork: SOLANA_MAINNET,

  // Token per i pagamenti
  defaultAsset: USDC_MAINNET,

  // Prezzo default per ogni chiamata (in micro-USDC)
  defaultPrice: '1000', // 0.001 USDC

  // Timeout pagamento (default: 60s)
  defaultMaxTimeoutSeconds: 60,

  // Pricing per-metodo
  routes: {
    getBalance: {
      price: '500',          // 0.0005 USDC (economico)
      network: SOLANA_MAINNET,
      asset: USDC_MAINNET,
      description: 'Get SOL balance for a wallet',
    },
    getTransaction: {
      price: '5000',         // 0.005 USDC (costoso)
      network: SOLANA_MAINNET,
      asset: USDC_MAINNET,
      description: 'Get full transaction details',
      maxTimeoutSeconds: 30,
    },
    getProgramAccounts: {
      price: '10000',        // 0.01 USDC (molto costoso)
      network: SOLANA_MAINNET,
      asset: USDC_MAINNET,
      description: 'Scan all accounts for a program',
    },
  },
};

// Passa al gateway
const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: DEFAULT_TIERS,
  x402: x402Config, // ← Abilita paywall
});
```

---

## 3. Processare richieste

### Uso diretto del Paywall

```typescript
import { X402Paywall } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const paywall = new X402Paywall(x402Config);

// Simula una request in arrivo
const result = await paywall.processRequest('getBalance', {
  // Headers HTTP della request
  // Se PAYMENT-SIGNATURE è presente → verifica il pagamento
  // Se assente → ritorna 402
});

switch (result.type) {
  case 'payment-required':
    // Rispondi con 402
    return new Response(JSON.stringify(result.body), {
      status: 402,
      headers: result.headers,
    });

  case 'payment-valid':
    // Pagamento verificato! Esegui la chiamata RPC
    const rpcResult = await executeRpcCall('getBalance', params);

    // Settle il pagamento on-chain
    const settle = await paywall.settleAfterResponse(
      result.paymentPayload,
      result.requirements,
    );

    // Rispondi con il risultato + header di settlement
    return new Response(JSON.stringify(rpcResult), {
      status: 200,
      headers: settle.responseHeader
        ? { 'PAYMENT-RESPONSE': settle.responseHeader }
        : {},
    });

  case 'no-payment-needed':
    // x402 disabilitato, procedi normalmente
    break;
}
```

### Uso tramite AgentGateway (consigliato)

```typescript
// Pipeline completa in una sola chiamata
const { result, x402, settlement, responseHeaders } = await gateway.executeWithX402(
  session.id,       // Sessione metered (o null per x402-only)
  'getBalance',
  ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
  incomingHttpHeaders,  // Headers dalla request HTTP
);

if (x402.type === 'payment-required') {
  // 402: il buyer deve pagare
  return new Response(JSON.stringify(x402.body), {
    status: 402,
    headers: x402.headers,
  });
}

// 200: risposta con dati + settlement
return new Response(JSON.stringify(result?.data), {
  status: 200,
  headers: responseHeaders, // Include PAYMENT-RESPONSE
});
```

---

## 4. Formato della risposta 402

Quando il buyer non include `PAYMENT-SIGNATURE`, riceve:

**Status:** `402 Payment Required`

**Headers:**
```
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOm51bGws...  (base64)
Content-Type: application/json
```

**Body (decodificato):**
```json
{
  "x402Version": 2,
  "resource": {
    "url": "getBalance",
    "description": "Get SOL balance for a wallet",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amount": "500",
      "payTo": "YourSolanaWalletPubkey",
      "maxTimeoutSeconds": 60,
      "extra": {
        "feePayer": "FacilitatorFeePayer..."
      }
    }
  ]
}
```

---

## 5. Local Verifier (bypass facilitator)

Per scenari trusted (es. agenti nella stessa infrastruttura):

```typescript
const x402Config: X402Config = {
  // ...
  localVerifier: async (payload, requirements) => {
    // Verifica locale senza chiamare il facilitator
    const isValid = await myLocalVerification(payload, requirements);
    return {
      isValid,
      invalidReason: isValid ? undefined : 'Local verification failed',
      payer: payload.accepted.payTo,
    };
  },
};
```

---

## 6. Network e asset supportati

```typescript
import {
  SOLANA_MAINNET,   // 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  SOLANA_DEVNET,    // 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
  USDC_MAINNET,     // 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  USDC_DEVNET,      // '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Network custom (CAIP-2 format):
const MY_NETWORK: X402Network = 'solana:MyCustomGenesisHash';
```

---

## 7. Query al facilitator

```typescript
import { FacilitatorClient, createFacilitator } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const facilitator = createFacilitator({
  url: 'https://x402.org/facilitator',
});

// Quali scheme/network sono supportati?
const supported = await facilitator.supported();
for (const kind of supported.kinds) {
  console.log(`${kind.scheme} su ${kind.network}`);
  if (kind.extra?.feePayer) {
    console.log(`  feePayer: ${kind.extra.feePayer}`);
  }
}
```

---

## Errori x402

| Errore | Quando |
|--------|--------|
| `FacilitatorError` | Errore generico dal facilitator |
| `VerifyError` | `/verify` ha restituito `isValid: false` |
| `SettleError` | `/settle` ha fallito |

```typescript
import { VerifyError, SettleError } from '@oobe-protocol-labs/synapse-client-sdk/ai';

try {
  await facilitator.verify(payload, requirements);
} catch (err) {
  if (err instanceof VerifyError) {
    console.log(err.statusCode);    // HTTP status
    console.log(err.responseBody);  // Risposta originale
  }
}
```

---

## Best practices

1. **Usa il facilitator Coinbase per iniziare** — `https://x402.org/facilitator` è gratuito e trustless.
2. **Pricing per-route** — Metodi pesanti (getProgramAccounts) devono costare di più.
3. **Timeout brevi per metodi semplici** — 30s per getBalance, 60s per getTransaction.
4. **Cache `/supported`** — Il paywall già lo fa (TTL 1 min), non chiamarlo ad ogni request.
5. **Monitora i settlement** — Se il facilitator fallisce, il buyer ha già il dato ma tu non hai il pagamento.
6. **Testa su devnet** — Usa `SOLANA_DEVNET` + `USDC_DEVNET` prima di andare in mainnet.
