# Skill 04 — Response Attestation (Proof-of-Computation)

## Obiettivo

Generare **prove crittografiche** delle risposte RPC: ogni risposta viene hashata, firmata ed è verificabile da terze parti senza rieseguire la chiamata.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `ResponseValidator` | Classe che genera e gestisce attestation |
| `ResponseAttestation` | Oggetto con hash di request/response, slot, firma Ed25519 |
| `AttestedResult<T>` | Wrapper: `{ data: T, attestation?, latencyMs, callIndex }` |
| `verifyIntegrity()` | Verifica statica che i dati corrispondono agli hash |
| `verifySignature()` | Verifica della firma Ed25519 dell'attestatore |

---

## 1. Come funziona

```
┌─────────────┐         ┌──────────────────┐
│  Agent call  │────────▶│  gateway.execute  │
└─────────────┘         └──────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              SHA-256(params)  │   SHA-256(response)
                    │          │          │
                    └──────────┼──────────┘
                               │
                        Ed25519 Sign
                    (method|reqHash|resHash|slot)
                               │
                               ▼
                    ┌─────────────────────┐
                    │ ResponseAttestation  │
                    │ • requestHash       │
                    │ • responseHash      │
                    │ • slot              │
                    │ • signature         │
                    │ • attesterId        │
                    │ • timestamp         │
                    └─────────────────────┘
```

---

## 2. Abilitare attestation

### Via tier pricing

```typescript
const premiumTier: PricingTier = {
  id: 'premium',
  label: 'Premium (Attested)',
  pricePerCall: 5_000n,
  maxCallsPerSession: 0,
  rateLimit: 200,
  token: { type: 'SOL' },
  includesAttestation: true, // ← Attestation inclusa automaticamente
};
```

### Via config globale

```typescript
const gateway = createAgentGateway(client, {
  identity,
  defaultTiers: [premiumTier],

  // Attesta TUTTE le risposte, indipendentemente dal tier
  attestByDefault: true,

  // Signer Ed25519 (obbligatorio per attestation firmate)
  signer: async (message: Uint8Array) => {
    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.fromSecretKey(yourSecretKey);
    return keypair.sign(message).signature;
  },
});
```

---

## 3. Eseguire una chiamata attestata

```typescript
const result = await gateway.execute(session.id, 'getBalance', [
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
]);

// result.data → { value: 1000000000, ... }
// result.latencyMs → 45
// result.callIndex → 1

if (result.attestation) {
  const att = result.attestation;
  console.log(att.method);        // 'getBalance'
  console.log(att.requestHash);   // SHA-256 hex dei params
  console.log(att.responseHash);  // SHA-256 hex della risposta
  console.log(att.slot);          // Slot Solana al momento della risposta
  console.log(att.attesterId);    // AgentId del seller
  console.log(att.signature);     // Base64 Ed25519 signature
  console.log(att.timestamp);     // Unix timestamp
}
```

---

## 4. Verificare un'attestation (lato buyer)

### Verifica integrità (senza firma)

```typescript
import { ResponseValidator } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Il buyer ha ricevuto result + attestation
const integrity = ResponseValidator.verifyIntegrity(
  result.attestation!,
  ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'], // params originali
  result.data,                                         // response ricevuta
);

console.log(integrity.valid);          // true → dati non manomessi
console.log(integrity.requestMatch);   // true → params corrispondono
console.log(integrity.responseMatch);  // true → response corrisponde
```

### Verifica firma Ed25519

```typescript
import { ResponseValidator } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const isSignatureValid = await ResponseValidator.verifySignature(
  result.attestation!,
  async (message, signature, pubkey) => {
    // Usa @solana/web3.js per verificare
    const { PublicKey } = await import('@solana/web3.js');
    const pk = new PublicKey(pubkey);
    return pk.verify(message, signature);
  },
  sellerWalletPubkey, // La pubkey dichiarata dal seller
);

console.log(isSignatureValid); // true → il seller ha firmato questa attestation
```

---

## 5. Log delle attestation

Il `ResponseValidator` mantiene un ring buffer di attestation (max 10.000):

```typescript
// Attestation per sessione
const sessionAtts = gateway.validator.getSessionAttestations(session.id);

// Attestation per metodo (ultime 100)
const balanceAtts = gateway.validator.getMethodAttestations('getBalance', 100);

// Conteggio totale
console.log(gateway.validator.totalAttestations); // 1234

// Export completo (per archivio off-chain)
const fullLog = gateway.validator.exportLog();
// → Array<ResponseAttestation>
```

---

## 6. Struttura dell'attestation

```typescript
interface ResponseAttestation {
  sessionId: string;        // Sessione di appartenenza
  method: string;           // Metodo RPC chiamato
  requestHash: string;      // SHA-256(canonicalize(params))
  responseHash: string;     // SHA-256(canonicalize(response))
  slot: number;             // Slot Solana (ancora temporale on-chain)
  attesterId: AgentId;      // Identità dell'attestatore (seller)
  signature: string;        // Ed25519(method|reqHash|resHash|slot)
  timestamp: number;        // Unix ms
}
```

Il messaggio firmato è:
```
"{method}|{requestHash}|{responseHash}|{slot}"
```

Questo permette a chiunque di ricostruire il messaggio e verificare la firma.

---

## 7. Attestation senza firma

Se non fornisci un `signer`, le attestation vengono create con `signature: ''`.
Sono comunque utili per:

- **Audit log** — Traccia di ogni chiamata con hash
- **Cache validation** — Verifica che la cache non sia corrotta
- **Debugging** — Correlazione request/response

---

## Use cases avanzati

### Dispute resolution

```typescript
// Il buyer contesta una risposta.
// Il seller può dimostrare che la risposta è autentica:

const att = result.attestation!;
const proof = {
  attestation: att,
  originalParams: ['7xKXtg...'],
  originalResponse: result.data,
};

// Qualsiasi terza parte può verificare:
const valid = ResponseValidator.verifyIntegrity(att, proof.originalParams, proof.originalResponse);
const signed = await ResponseValidator.verifySignature(att, verifier, sellerPubkey);

if (valid.valid && signed) {
  // La risposta è autentica e firmata dal seller
}
```

### On-chain attestation posting

```typescript
// Post attestation su Solana come memo
const memo = JSON.stringify({
  method: att.method,
  requestHash: att.requestHash,
  responseHash: att.responseHash,
  slot: att.slot,
  signature: att.signature,
});

// Crea una transazione memo su Solana per prova immutabile
```

---

## Best practices

1. **Firma solo su tier premium** — L'operazione di firma ha un costo computazionale.
2. **Mantieni la keypair sicura** — Usa un HSM o Vault per il signer in produzione.
3. **Esporta i log periodicamente** — Il ring buffer è limitato a 10k attestation.
4. **Slot come ancora temporale** — Lo slot Solana lega l'attestation a un punto nel tempo on-chain.
5. **Non fidarti di attestation non firmate** — Hash senza firma provano integrità, non autenticità.
