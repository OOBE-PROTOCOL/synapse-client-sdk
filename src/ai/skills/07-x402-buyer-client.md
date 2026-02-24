# Skill 07 — x402 Buyer: Client

## Obiettivo

Configurare un agente come **buyer** nel protocollo x402: quando un server risponde con HTTP 402, il client firma automaticamente un pagamento SPL e riprova la richiesta.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `X402Client` | Client buyer-side: rileva 402, paga, riprova |
| `X402PayloadSigner` | Funzione che firma la transazione Solana |
| `X402RequirementsSelector` | Logica di selezione tra più opzioni di pagamento |
| `X402BudgetCheck` | Callback per verificare budget disponibile |
| `X402PaymentOutcome` | Esito del pagamento: amount, settlement, requirements |

---

## 1. Flow buyer-side

```
Agent (buyer)                   Remote x402 Server
     │                                │
     │── POST /rpc ──────────────────▶│
     │                                │
     │◀── 402 + PAYMENT-REQUIRED ─────│
     │                                │
     │  [decode requirements]         │
     │  [seleziona network/asset]     │
     │  [budget check]                │
     │  [firma tx SPL]                │
     │                                │
     │── POST /rpc + PAYMENT-SIG ────▶│
     │                                │
     │◀── 200 + PAYMENT-RESPONSE ─────│
     │  [decode settlement]           │
     │  [track pagamento]             │
```

---

## 2. Configurare l'X402Client

```typescript
import {
  X402Client,
  createX402Client,
  SOLANA_MAINNET,
  USDC_MAINNET,
  type X402ClientConfig,
  type X402PayloadSigner,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Il signer è la funzione più importante: firma la transazione
const signer: X402PayloadSigner = async (requirements, resource) => {
  // requirements contiene: scheme, network, asset, amount, payTo, extra.feePayer
  // Tu devi costruire e firmare una transazione SPL TransferChecked

  const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
  const { createTransferCheckedInstruction, getAssociatedTokenAddress } = await import('@solana/spl-token');

  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const mint = new PublicKey(requirements.asset);
  const payTo = new PublicKey(requirements.payTo);
  const feePayer = requirements.extra?.feePayer
    ? new PublicKey(requirements.extra.feePayer as string)
    : myKeypair.publicKey;

  // Token accounts
  const sourceAta = await getAssociatedTokenAddress(mint, myKeypair.publicKey);
  const destAta = await getAssociatedTokenAddress(mint, payTo);

  // Crea transazione
  const tx = new Transaction();
  tx.add(createTransferCheckedInstruction(
    sourceAta,
    mint,
    destAta,
    myKeypair.publicKey,
    BigInt(requirements.amount),
    6, // USDC decimals
  ));

  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Firma parziale (il facilitator aggiungerà la firma di feePayer)
  tx.partialSign(myKeypair);

  // Serializza in base64
  const serialized = tx.serialize({ requireAllSignatures: false }).toString('base64');

  return {
    x402Version: 2,
    resource,
    accepted: requirements,
    payload: { transaction: serialized },
  };
};

// Configura il client
const x402Client = createX402Client({
  enabled: true,
  signer,

  // Network e asset preferiti
  preferredNetwork: SOLANA_MAINNET,
  preferredAsset: USDC_MAINNET,

  // Max per singola chiamata (protezione)
  maxAmountPerCall: '100000', // 0.1 USDC max

  // Max retry su 402 (default: 1)
  maxRetries: 1,

  // Auto-detect 402 (default: true)
  autoDetect: true,
});
```

---

## 3. Usare il client come fetch wrapper

```typescript
// Il client wrappa fetch() e gestisce automaticamente i 402
const { response, payment } = await x402Client.fetch(
  'https://premium-rpc.example.com/rpc',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getBalance',
      params: ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
      id: 1,
    }),
  },
);

// Se il server ha richiesto pagamento:
if (payment) {
  console.log(`Pagato: ${payment.amountPaid} atomic units`);
  console.log(`Requirements: ${payment.requirements.scheme} su ${payment.requirements.network}`);
  console.log(`Settlement tx: ${payment.settlement?.transaction}`);
}

// La response è sempre il risultato finale (dopo il retry con pagamento)
const data = await response.json();
console.log(data.result); // Il balance
```

---

## 4. Usare tramite AgentGateway

```typescript
const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: DEFAULT_TIERS,

  // Abilita il buyer x402
  x402Client: {
    enabled: true,
    signer,
    preferredNetwork: SOLANA_MAINNET,
    preferredAsset: USDC_MAINNET,
    maxAmountPerCall: '50000',
  },
});

// Chiama un server remoto x402-enabled
const { result, payment } = await gateway.executeRemoteX402(
  'https://premium-rpc.example.com/rpc',
  'getBalance',
  ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
);

console.log(result); // Il balance
if (payment) {
  console.log(`Pagamento: ${payment.amountPaid} → tx: ${payment.settlement?.transaction}`);
}
```

---

## 5. Budget check

Previeni spese eccessive con un callback di budget:

```typescript
let remainingBudget = 1_000_000n; // 1 USDC

const x402Client = createX402Client({
  enabled: true,
  signer,

  // Verifica budget prima di ogni pagamento
  budgetCheck: async (amount, asset, network) => {
    const cost = BigInt(amount);
    if (cost > remainingBudget) {
      console.log('Budget insufficiente!');
      return false; // Non pagare
    }
    remainingBudget -= cost;
    return true; // Procedi col pagamento
  },
});
```

---

## 6. Requirements selector custom

Di default il client sceglie l'opzione più economica che matcha network + asset. Puoi personalizzare:

```typescript
import { type X402RequirementsSelector } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const mySelector: X402RequirementsSelector = (accepts, config) => {
  // Preferisci USDC su mainnet
  const usdcMainnet = accepts.find(
    r => r.network === SOLANA_MAINNET && r.asset === USDC_MAINNET,
  );
  if (usdcMainnet) return usdcMainnet;

  // Fallback: qualsiasi opzione Solana
  const anySolana = accepts.find(r => r.network.startsWith('solana:'));
  return anySolana;
};

const x402Client = createX402Client({
  enabled: true,
  signer,
  requirementsSelector: mySelector,
});
```

---

## 7. Interceptor per trasporti custom

Se non usi `fetch()` direttamente (es. con `HttpTransport` di Synapse):

```typescript
// Dopo una risposta 402 dal transport:
const intercept = await x402Client.interceptResponse(
  statusCode,           // 402
  responseHeaders,      // { 'PAYMENT-REQUIRED': 'base64...' }
  responseBody,         // opzionale
);

if (intercept.shouldRetry) {
  // Riprova con l'header di pagamento
  const retryResponse = await transport.request(method, params, {
    headers: {
      'PAYMENT-SIGNATURE': intercept.paymentSignatureHeader!,
    },
  });

  // Parse settlement dalla risposta
  const settlement = x402Client.parseSettlementResponse(retryResponse.headers);
}
```

---

## 8. Tracking pagamenti

```typescript
// Numero totale di pagamenti
console.log(x402Client.payments); // 42

// Totale pagato per asset
const totalPaid = x402Client.totalAmountPaid;
for (const [key, amount] of totalPaid) {
  console.log(`${key}: ${amount} atomic units`);
  // 'solana:5eykt4...:EPjFWdd5...': 500000n
}

// Totale per asset specifico
const usdcPaid = x402Client.getTotalPaid(SOLANA_MAINNET, USDC_MAINNET);
console.log(`USDC pagati: ${usdcPaid}`); // 500000n = 0.5 USDC

// Via gateway
const stats = gateway.getX402ClientStats();
// { payments: 42, totalPaid: Map(...) }
```

---

## 9. Errori buyer-side

| Errore | Quando |
|--------|--------|
| `X402ClientError` | Errore generico del client |
| `NoAcceptablePaymentError` | Nessuna opzione di pagamento compatibile |
| `PaymentSigningError` | Il signer ha fallito |
| `PaymentRetryError` | Il retry dopo pagamento ha fallito (status ≠ 200, ≠ 402) |

```typescript
import {
  PaymentSigningError,
  NoAcceptablePaymentError,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

try {
  const { response } = await x402Client.fetch(url, init);
} catch (err) {
  if (err instanceof NoAcceptablePaymentError) {
    console.log('Nessun metodo di pagamento compatibile');
    console.log('Accepts:', err.paymentRequired.accepts);
  }
  if (err instanceof PaymentSigningError) {
    console.log('Errore firma:', err.cause);
    console.log('Requirements:', err.requirements);
  }
}
```

---

## Best practices

1. **`maxAmountPerCall` sempre** — Protezione contro server malicious che chiedono troppo.
2. **Budget check in produzione** — Monitora la spesa in tempo reale.
3. **Signer con keypair dedicata** — Non usare la keypair principale dell'agente.
4. **Testa su devnet** — `SOLANA_DEVNET` + `USDC_DEVNET` per development.
5. **Log ogni pagamento** — Ascolta l'evento `x402:payment-sent` per audit.
6. **Auto-detect disabilitabile** — Imposta `autoDetect: false` se vuoi gestire i 402 manualmente.
