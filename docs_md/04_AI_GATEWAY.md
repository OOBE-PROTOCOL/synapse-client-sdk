# 04 — AI Gateway: Agent Commerce, Sessions, x402 Payments

> **Imports**: `@…/synapse-client-sdk/ai/gateway`, `/ai/gateway/x402`, `/ai/gateway/monetize`  
> **Source**: `src/ai/gateway/`  
> **Prerequisites**: [03_AI_TOOLS.md](./03_AI_TOOLS.md) — you need tools to monetize.

---

## Overview

The AI Gateway enables **agent-to-agent commerce** — one agent sells access to its tools, another agent buys and uses them. Every call is metered, priced, rate-limited, and cryptographically attested.

```
Buyer Agent                        Seller Agent (you)
    │                                    │
    │── openSession(tier: 'pro') ────────→│  ← PricingEngine picks tier
    │←── sessionId + budget ─────────────│
    │                                    │
    │── execute('getQuote', params) ─────→│  ← AgentSession.preCall()
    │←── result + attestation ───────────│  ← ResponseValidator.attest()
    │                                    │
    │── settleSession(sessionId) ────────→│  ← PaymentReceipt
    │←── receipt { amount, txSig } ──────│
```

---

## Quick Start

### Set up a seller agent

```ts
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import {
  createExecutableSolanaTools,
  createAgentGateway,
  createAgentId,
  DEFAULT_TIERS,
} from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = new SynapseClient({ endpoint, apiKey });
const tools = createExecutableSolanaTools(client.getTransport());

const gateway = createAgentGateway(client, {
  identity: {
    id:           createAgentId('my-defi-agent'),
    name:         'My DeFi Agent',
    walletPubkey: 'ABcd...',
    createdAt:    Date.now(),
  },
  defaultTiers: DEFAULT_TIERS,
  maxConcurrentSessions: 100,
  sessionTtl: 3600,  // 1 hour
});

// 1. Buyer opens a session
const { session, sessionId } = await gateway.openSession({
  buyer:    createAgentId('buyer-agent'),
  tierId:   'standard',
  maxBudget: 100_000n,   // in smallest token unit
});

// 2. Buyer executes a metered call
const result = await gateway.execute(sessionId, 'getBalance', {
  pubkey: 'So111...',
});
// result.result     → RPC response
// result.attestation → { hash, timestamp, method, nonce, agentId }

// 3. Settle the session
const receipt = await gateway.settleSession(sessionId);
// receipt.amountCharged → bigint
// receipt.callCount     → number
// receipt.txSignature   → string | null
```

---

## AgentGateway

The main orchestrator that ties together pricing, sessions, attestation, and marketplace.

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `openSession` | `(intent: PaymentIntent) → { session, sessionId }` | Start a metered session |
| `execute` | `(sessionId, method, params) → AttestedResult` | Execute a tool call (checks budget + rate) |
| `settleSession` | `(sessionId) → PaymentReceipt` | Finalize and compute charges |
| `publish` | `(listing: ToolListing) → void` | List a tool on the marketplace |
| `publishBundle` | `(bundle: ToolBundle) → void` | List a bundle of tools |
| `snapshot` | `(depth?: SnapshotDepth) → GatewaySnapshot` | Get current state snapshot |
| `createGatewayTools` | `(sessionId) → ProtocolTool[]` | Wrap tools for a specific session |
| `on` | `(event, handler) → () => void` | Subscribe to gateway events |

### Events

```ts
gateway.on('session:opened',   (e) => console.log('New session:', e.sessionId));
gateway.on('call:executed',    (e) => console.log(`${e.method} took ${e.latencyMs}ms`));
gateway.on('session:exhausted',(e) => console.log('Budget exhausted:', e.sessionId));
gateway.on('payment:settled',  (e) => console.log('Settled:', e.receipt.amountCharged));
```

| Event | Payload includes |
|-------|-----------------|
| `session:opened` | `sessionId`, `buyerAgent`, `tierId` |
| `session:closed` | `sessionId`, `reason` |
| `session:exhausted` | `sessionId`, `spent`, `budget` |
| `call:executed` | `sessionId`, `method`, `latencyMs`, `cost` |
| `call:failed` | `sessionId`, `method`, `error` |
| `payment:settled` | `sessionId`, `receipt` |

---

## AgentSession

Each session tracks budget, call count, rate limits, and expiration:

```ts
class AgentSession {
  readonly id: string;
  readonly buyerAgent: AgentId;
  readonly tier: PricingTier;

  preCall(method: string): void;          // throws if over budget/rate/expired
  postCall(cost?: bigint): void;          // decrement budget
  settle(): PaymentReceipt;               // finalize

  get state(): SessionState;              // full state snapshot
  get isActive(): boolean;
  get remainingBudget(): bigint;
  get callCount(): number;
}
```

### Session errors

| Error | When it's thrown |
|-------|-----------------|
| `BudgetExhaustedError` | `remainingBudget < pricePerCall` |
| `RateLimitExceededError` | Calls per second exceeds tier limit |
| `SessionExpiredError` | Current time > `expiresAt` |
| `CallLimitExceededError` | `callCount >= maxCallsPerSession` |

```ts
try {
  await gateway.execute(sessionId, 'getBalance', { pubkey: '...' });
} catch (err) {
  if (err instanceof BudgetExhaustedError) {
    // Open a new session with more budget
  } else if (err instanceof RateLimitExceededError) {
    // Wait and retry
    await new Promise((r) => setTimeout(r, err.retryAfterMs));
  }
}
```

### SessionState

```ts
interface SessionState {
  id:        string;
  status:    'active' | 'settled' | 'expired' | 'exhausted';
  buyerAgent: AgentId;
  tier:       PricingTier;
  budget:     { total: bigint; spent: bigint; remaining: bigint };
  calls:      { total: number; limit: number };
  rateLimit:  { current: number; max: number; windowMs: number };
  createdAt:  number;
  expiresAt:  number;
}
```

---

## PricingEngine

Define pricing tiers for your agent's tools:

```ts
import { PricingEngine, DEFAULT_TIERS } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// Use defaults
const engine = new PricingEngine({ tiers: DEFAULT_TIERS });

// Or define custom tiers
const engine = new PricingEngine({
  tiers: [
    { id: 'free',    label: 'Free',    pricePerCall: 0n,    maxCallsPerSession: 10,    rateLimit: 1   },
    { id: 'standard',label: 'Standard',pricePerCall: 1000n, maxCallsPerSession: 1000,  rateLimit: 10  },
    { id: 'premium', label: 'Premium', pricePerCall: 500n,  maxCallsPerSession: 10_000,rateLimit: 100 },
  ],
  dynamicPricing: {
    enabled: true,
    baseMultiplier: 1.0,
    loadFactor: 0.5,          // price increases with load
    minMultiplier: 0.8,
    maxMultiplier: 3.0,
  },
});

const tier = engine.getTier('standard');
const price = engine.calculatePrice('standard', { load: 0.7 });  // dynamic
```

### PricingTier

```ts
interface PricingTier {
  id:                   string;
  label:                string;
  pricePerCall:         bigint;       // in smallest token unit
  maxCallsPerSession:   number;
  rateLimit:            number;       // calls per second
  token:                PaymentToken;
  includesAttestation:  boolean;
}

type PaymentToken =
  | { type: 'SOL' }
  | { type: 'SPL'; mint: string; decimals: number }
  | { type: 'USDC' };
```

---

## ResponseValidator (Proof-of-Computation)

Every tool call result is hashed and signed, creating a tamper-proof attestation:

```ts
const validator = new ResponseValidator({ secretKey: process.env.SIGNING_KEY! });

const attestation = validator.createAttestation(result, 'getBalance');
// → { hash: 'sha256...', timestamp, method, nonce, agentId }

const attested = validator.wrapResult(result, 'getBalance');
// → { result, attestation }

const isValid = validator.verify(attested);
// → true if hash matches
```

This lets buyer agents **verify** that results haven't been tampered with.

---

## ToolMarketplace

Publish and discover agent tools:

```ts
const marketplace = new ToolMarketplace();

// Publish
marketplace.publish({
  toolId: 'getQuote',
  agentId: createAgentId('my-agent'),
  description: 'Jupiter swap quote',
  pricing: [standardTier],
  tags: ['defi', 'swap', 'jupiter'],
});

// Search
const results = marketplace.search({
  tags: ['defi'],
  maxPrice: 2000n,
  minReputation: 500,
});

// Reputation
marketplace.updateReputation('getQuote', 950);
```

---

## AgentRegistry

Identity persistence across restarts:

```ts
import { AgentRegistry, MemoryAdapter } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const registry = new AgentRegistry({
  adapter: new MemoryAdapter(),  // swap with Redis/PG/OnChain for production
});

await registry.register(agentIdentity);
const agent = await registry.resolve(createAgentId('my-agent'));
```

| Adapter | Backend | Best for |
|---------|---------|----------|
| `MemoryAdapter` | In-process `Map` | Dev / test |
| `RedisPersistence` | Redis / Valkey | Production sessions |
| `PostgresPersistence` | PostgreSQL | Audit / analytics |
| `SynapseAnchorSap` | Solana (SAP SDK) | On-chain agent identity via `@oobe-protocol-labs/synapse-sap-sdk` |

---

## x402 Payment Protocol

The x402 protocol brings **HTTP 402 Payment Required** to life. Agents pay for API access with on-chain USDC.

### How it works

```
Buyer                              Seller                           Facilitator
  │                                  │                                  │
  │── GET /api/data ─────────────────→│                                  │
  │←── 402 + PaymentRequirements ────│                                  │
  │                                  │                                  │
  │── Sign payment payload ──────────────────────────────────────────────→│
  │←── { valid: true } ──────────────────────────────────────────────────│
  │                                  │                                  │
  │── GET /api/data + X-Payment ─────→│                                  │
  │←── 200 OK + data ───────────────│                                  │
  │                                  │── POST /settle ──────────────────→│
  │                                  │←── { txSignature } ──────────────│
```

### Seller setup (X402Paywall)

```ts
import { X402Paywall, SOLANA_MAINNET, USDC_MAINNET } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import express from 'express';

const paywall = new X402Paywall({
  enabled: true,
  payTo: 'YourWalletAddress...',
  facilitator: { url: 'https://facilitator.payai.network' },
  defaultNetwork: SOLANA_MAINNET,
  defaultAsset:   USDC_MAINNET,
  defaultPrice:   '1000',  // 0.001 USDC per call (6 decimals)
});

const app = express();
app.use('/api', paywall.toExpressMiddleware());

app.get('/api/data', (req, res) => {
  res.json({ premium: true, data: '...' });
});
```

### Buyer setup (X402Client)

```ts
import { X402Client } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const x402 = new X402Client({
  enabled: true,
  signer: async (requirements, resource) => {
    // Sign the payment with your wallet keypair
    return signedPayload;
  },
  maxRetries: 3,
  budgetCheck: async (amount) => amount <= 10_000_000n,  // 10 USDC max
});

// Automatic: 402 → sign → pay → retry → 200
const response = await x402.fetch('https://seller.example.com/api/data');
const data = await response.json();
```

### Facilitator client

```ts
import { createFacilitator } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const facilitator = createFacilitator({ url: 'https://facilitator.payai.network' });
const supported = await facilitator.supported();       // networks + assets
const verified  = await facilitator.verify(payload);   // verify payment
const settled   = await facilitator.settle(payload);   // settle on-chain
```

### x402 Constants

```ts
SOLANA_MAINNET                // { chainId: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' }
SOLANA_DEVNET                 // { chainId: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1' }
USDC_MAINNET                  // USDC mint on mainnet
USDC_DEVNET                   // USDC mint on devnet
X402_HEADER_PAYMENT_REQUIRED  // header name
X402_STATUS_CODE              // 402
X402_VERSION                  // protocol version
```

---

## Monetization Bridge

The monetization bridge wraps protocol tools with the commerce layer — adding metering, billing, and attestation to every call.

### Monetize a single toolkit

```ts
import { createMonetizedTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const monetized = createMonetizedTools(gateway, sessionId, jupiterToolkit);

// monetized.tools   → ProtocolTool[] (same interface, now metered)
// monetized.metrics → { totalCalls, totalCost, avgLatencyMs }
```

**What happens on each tool call:**
1. `session.preCall()` — check budget + rate limit
2. Execute original tool
3. `session.postCall()` — decrement budget
4. `validator.wrapResult()` — create attestation
5. Auto-publish to marketplace (optional)

### Monetize all protocols at once

```ts
import { createMultiProtocolMonetizedTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const monetized = createMultiProtocolMonetizedTools(gateway, sessionId, {
  jupiter: jupiterToolkit,
  raydium: raydiumToolkit,
});

monetized.allTools        // → all monetized tools combined
monetized.byProtocol      // → Record<string, MonetizedToolkit>
monetized.totalToolCount  // → number
```

### MonetizableGateway interface

For testing and dependency injection, the monetize bridge accepts any object implementing this interface:

```ts
interface MonetizableGateway {
  getSession(sessionId: string): AgentSession;
  getValidator(): ResponseValidator;
  getMarketplace(): ToolMarketplace;
  readonly agentId: AgentId;
}
```

---

## Key Types

### Identity

```ts
type AgentId = string & { __brand: 'AgentId' };

interface AgentIdentity {
  id:           AgentId;
  name:         string;
  walletPubkey: string;
  description?: string;
  tags?:        string[];
  createdAt:    number;
}
```

### Payment

```ts
interface PaymentIntent {
  nonce:     string;
  buyer:     AgentId;
  seller:    AgentId;
  tierId:    string;
  maxBudget: bigint;
  token:     PaymentToken;
  signature: string;
  createdAt: number;
  ttl:       number;
}

interface PaymentReceipt {
  intentNonce:   string;
  amountCharged: bigint;
  callCount:     number;
  txSignature:   string | null;
  settlement:    'onchain' | 'offchain-escrow' | 'streaming';
  settledAt:     number;
}
```

---

## Best Practices

1. **Start with `DEFAULT_TIERS`** — customize later based on usage data
2. **Short sessions for one-off queries** — `sessionTtl: 60` (1 minute)
3. **Long sessions for batch work** — `sessionTtl: 3600` (1 hour)
4. **Always enable `ResponseValidator`** — attestations are free and build trust
5. **Use x402 on devnet first** — switch to mainnet when ready for real payments
6. **Monitor with events** — subscribe to `call:executed` and `payment:settled` for observability

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `BudgetExhaustedError` on first call | Budget too low | Increase `maxBudget` |
| `RateLimitExceededError` | Too many calls per second | Upgrade tier or add delay |
| `SessionExpiredError` | Session TTL exceeded | Open a new session |
| x402 returns 402 but client doesn't retry | `enabled: false` or missing signer | Check `X402Client` config |
| Facilitator returns 503 | Facilitator down | Use `FacilitatorDiscovery` to find alternatives |

---

## Next Steps

- **[05_SAP.md](./05_SAP.md)** — Register your agent's identity on-chain
- **[06_INTENTS.md](./06_INTENTS.md)** — Chain monetized tools across protocols
- **[08_PERSISTENCE.md](./08_PERSISTENCE.md)** — Store sessions and receipts
