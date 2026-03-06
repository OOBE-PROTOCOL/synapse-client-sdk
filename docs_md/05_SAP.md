# 05 — SAP: Solana Agent Protocol

> **Import**: `@oobe-protocol-labs/synapse-client-sdk/ai/sap`  
> **Source**: `src/ai/sap/`  
> **Prerequisites**: [01_CORE.md](./01_CORE.md) — you need a `SynapseClient` for discovery. Basic Solana PDA knowledge is helpful but not required.

---

## Overview

SAP (Solana Agent Protocol) is the on-chain identity and commerce layer for AI agents on Solana. Every agent registers a **PDA (Program Derived Address)** containing its identity, capabilities, micropayment pricing, and reputation — fully verifiable and discoverable without any centralized registry.

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Micropayment-native** | Every call is individually priced. No subscriptions. Volume curves reward usage. |
| **Metered billing** | ERC-8004-inspired volume curves adapted natively for Solana |
| **Decentralized** | Agent identity lives on-chain as PDAs — no central registry |
| **Composable** | SubnetworkBuilder assembles multi-agent task forces automatically |
| **Validated** | Deep validation engine catches issues before on-chain submission |
| **Observable** | Health scoring and network analytics built-in |

### Architecture

```
Your Code (SDK)                              Solana Blockchain
┌────────────────────────────┐             ┌──────────────────┐
│                            │             │                  │
│  SAPCapabilityRegistry     │             │  SAP Program     │
│  SAPValidator              │             │  ┌─ Agent PDA 1  │
│  SAPInstructionBuilder  ───┼── tx ──────→│  ├─ Agent PDA 2  │
│  SAPDiscovery           ←──┼── read ─────│  ├─ Agent PDA 3  │
│  SubnetworkBuilder         │             │  └─ ...          │
│  computeAgentHealthScore   │             │                  │
│  computeNetworkAnalytics   │             └──────────────────┘
│  computeCallCost           │
│  estimateTotalCost         │
│  OnChainPersistenceAdapter │
└────────────────────────────┘
```

### Module Map

| Module | File | Purpose |
|--------|------|---------|
| **Types** | `types.ts` | PDA layout, pricing, reputation, instructions |
| **PDA** | `pda.ts` | PDA derivation, Borsh serialization, base58 |
| **Program** | `program.ts` | Transaction instruction builder |
| **Discovery** | `discovery.ts` | On-chain agent search |
| **Adapter** | `adapter.ts` | Bridge to `AgentRegistry` |
| **Registry** | `registry.ts` | Canonical capability catalog (30+ capabilities) |
| **Validator** | `validator.ts` | Deep validation engine |
| **Subnetwork** | `subnetwork.ts` | Multi-agent composition |
| **Scoring** | `scoring.ts` | Health scoring & network analytics |

---

## Quick Start

### 1. Derive your agent's PDA

```ts
import { deriveAgentPDA, SAP_DEFAULT_PROGRAM_ID } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const pda = deriveAgentPDA('YourWalletPubkey...', SAP_DEFAULT_PROGRAM_ID);
// pda.address → 'DerivedPDABase58...'
// pda.bump    → 254
// pda.seeds   → Uint8Array[]
```

### 2. Validate & register

```ts
import {
  SAPInstructionBuilder,
  SAPCapabilityRegistry,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const builder = new SAPInstructionBuilder({
  programId: SAP_DEFAULT_PROGRAM_ID,
  validation: { strict: true },      // throws on invalid params
});

const ix = builder.register({
  walletPubkey: 'YourWalletPubkey...',
  name: 'My DeFi Agent',
  description: 'Jupiter + Raydium swap tools',
  capabilities: [
    { id: 'jupiter:swap', description: 'Token swaps via Jupiter' },
    { id: 'jupiter:getQuote' },
    { id: 'raydium:getPoolInfo' },
  ],
  pricing: [{
    tierId: 'standard',
    pricePerCall: 1000n,                // 0.001 USDC per call
    rateLimit: 10,
    maxCallsPerSession: 0,              // unlimited
    tokenType: 'USDC',
    tokenDecimals: 6,
    settlementMode: 'x402',
    volumeCurve: [
      { afterCalls: 100, pricePerCall: 800n },    // 20% off after 100 calls
      { afterCalls: 1000, pricePerCall: 500n },   // 50% off after 1000 calls
    ],
  }],
  x402Endpoint: 'https://myagent.xyz/.well-known/x402',
});

// ix → { programId, keys, data } — ready for a Solana transaction
```

### 3. Submit the transaction

```ts
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

const tx = new Transaction().add(ix);
const signature = await sendAndConfirmTransaction(connection, tx, [ownerKeypair]);
```

### 4. Discover agents

```ts
import { SAPDiscovery } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const discovery = new SAPDiscovery(client, { programId: SAP_DEFAULT_PROGRAM_ID });

const result = await discovery.findByCapability('jupiter:swap');
const cheapest = await discovery.findCheapest('standard');
const best = await discovery.findMostReputable();
```

### 5. Estimate cost before calling

```ts
import { computeCallCost, estimateTotalCost } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const agent = result.agents[0];
const pricing = agent.pricing[0];

// How much does call #150 cost?
const cost = computeCallCost(pricing, 150);  // → 800n (volume discount applied)

// How much do 1500 total calls cost?
const estimate = estimateTotalCost(pricing, 1500);
// estimate.totalCost       → 870_000n
// estimate.avgPricePerCall  → 580n
// estimate.breakdown        → [{from:1, to:100, ...}, {from:101, to:1000, ...}, ...]
```

---

## Micropayment Pricing Model

SAP implements **pay-per-call micropayments** inspired by ERC-8004 metered billing, adapted natively for Solana. There are no subscriptions — every invocation has a deterministic, verifiable cost.

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Pricing Tier                        │
│                                                             │
│  Base Price:  1000 lamports per call                        │
│  Volume Curve:                                              │
│    ├── after 100 calls  → 800 lamports  (−20%)             │
│    ├── after 1000 calls → 500 lamports  (−50%)             │
│    └── after 10000 calls → 200 lamports (−80%)             │
│                                                             │
│  Floor: 100 lamports  (price never goes below)              │
│  Ceiling: 2000 lamports (price never goes above)            │
│                                                             │
│  Settlement: x402 | escrow | batched | instant              │
│  Token: SOL | USDC | any SPL                                │
└─────────────────────────────────────────────────────────────┘
```

### `AgentPricingOnChain`

```ts
interface AgentPricingOnChain {
  // ── Identity ──
  tierId: string;                // e.g. 'base', 'priority'

  // ── Per-Call Pricing ──
  pricePerCall: bigint;          // base price in smallest token unit
  minPricePerCall?: bigint;      // price floor (for dynamic pricing)
  maxPricePerCall?: bigint;      // price ceiling

  // ── Volume Curve (ERC-8004-style metered billing) ──
  volumeCurve?: VolumeCurveBreakpoint[];

  // ── Rate Limiting ──
  rateLimit: number;             // calls per second
  maxCallsPerSession: number;    // 0 = unlimited
  burstLimit?: number;           // max burst in one second

  // ── Payment Token ──
  tokenType: 'SOL' | 'USDC' | 'SPL';
  tokenMint?: string;            // SPL token mint (when tokenType = 'SPL')
  tokenDecimals?: number;        // for display (9 = SOL, 6 = USDC)

  // ── Settlement ──
  settlementMode?: 'instant' | 'escrow' | 'batched' | 'x402';
  minEscrowDeposit?: bigint;     // minimum escrow deposit
  batchIntervalSec?: number;     // batch settlement interval
}
```

### Volume Curves

Volume curves implement **metered billing**: the more an agent is used, the cheaper each call becomes. The curve is evaluated sequentially:

```ts
interface VolumeCurveBreakpoint {
  afterCalls: number;      // threshold (cumulative calls)
  pricePerCall: bigint;    // discounted price after threshold
}
```

**Example**:

```ts
const pricing: AgentPricingOnChain = {
  tierId: 'standard',
  pricePerCall: 1000n,           // base: 0.001 USDC
  tokenType: 'USDC',
  tokenDecimals: 6,
  rateLimit: 50,
  maxCallsPerSession: 0,
  volumeCurve: [
    { afterCalls: 100,  pricePerCall: 800n },   // calls 101+  → 0.0008 USDC
    { afterCalls: 1000, pricePerCall: 500n },   // calls 1001+ → 0.0005 USDC
    { afterCalls: 5000, pricePerCall: 200n },   // calls 5001+ → 0.0002 USDC
  ],
};
```

### `computeCallCost(pricing, callNumber)`

Returns the exact cost of the Nth call:

```ts
computeCallCost(pricing, 1);      // → 1000n  (base price)
computeCallCost(pricing, 100);    // → 1000n  (still base)
computeCallCost(pricing, 101);    // → 800n   (first breakpoint)
computeCallCost(pricing, 1001);   // → 500n   (second breakpoint)
computeCallCost(pricing, 5001);   // → 200n   (third breakpoint)
```

Floor/ceiling are enforced automatically:

```ts
const pricingWithBounds = {
  ...pricing,
  minPricePerCall: 300n,    // floor
  maxPricePerCall: 900n,    // ceiling
};
computeCallCost(pricingWithBounds, 1);      // → 900n  (ceiling enforced)
computeCallCost(pricingWithBounds, 5001);   // → 300n  (floor enforced)
```

### `estimateTotalCost(pricing, totalCalls, startingFrom?)`

Computes total cost across N calls with full volume breakdown:

```ts
const estimate = estimateTotalCost(pricing, 1500);

// estimate.totalCost       → total in smallest unit
// estimate.avgPricePerCall → average unit cost
// estimate.breakdown       → segment-by-segment detail:
// [
//   { from: 1,    to: 100,  pricePerCall: 1000n, subtotal: 100_000n },
//   { from: 101,  to: 1000, pricePerCall: 800n,  subtotal: 720_000n },
//   { from: 1001, to: 1500, pricePerCall: 500n,  subtotal: 250_000n },
// ]
```

Continue from a previous session:

```ts
// Agent was already called 500 times — estimate next 2000
const next = estimateTotalCost(pricing, 2000, 501);
```

### Settlement Modes

| Mode | Description | When to use |
|------|-------------|-------------|
| `'instant'` | Each call triggers an on-chain transfer | Low-volume, high-value calls |
| `'escrow'` | Caller pre-funds an escrow PDA, agent draws per call | High-volume, trusted relationship |
| `'batched'` | Calls accumulate off-chain, settled periodically | High-volume, cost-sensitive |
| `'x402'` | Payment via HTTP x402 protocol (default) | Standard agent-to-agent commerce |

```ts
// Escrow pricing
{
  tierId: 'escrow-tier',
  pricePerCall: 500n,
  settlementMode: 'escrow',
  minEscrowDeposit: 50_000n,    // caller must deposit at least 50k lamports
  tokenType: 'SOL',
  rateLimit: 100,
  maxCallsPerSession: 0,
}

// Batched pricing
{
  tierId: 'batch-tier',
  pricePerCall: 200n,
  settlementMode: 'batched',
  batchIntervalSec: 3600,       // settle every hour
  tokenType: 'USDC',
  rateLimit: 1000,
  maxCallsPerSession: 0,
}
```

### ERC-8004 Comparison

| ERC-8004 (Ethereum) | SAP (Solana) |
|---------------------|--------------|
| Subscription-based metering | Pay-per-call with volume curves |
| ERC-20 tokens only | SOL + USDC + any SPL token |
| Smart contract settlement | PDA-based escrow + x402 |
| On-chain meter reads | On-chain reputation with off-chain metering |
| Gas-heavy per-call billing | Batched settlement for high volumes |
| Single-chain | Solana-native (400ms finality) |

---

## Capability Registry

`SAPCapabilityRegistry` provides a **canonical catalog** of capabilities that agents can advertise. It gives the network a shared vocabulary so discovery queries are reliable and unambiguous.

### Default Catalog (30+ capabilities)

| Protocol | Capabilities | Category |
|----------|-------------|----------|
| **jupiter** | `swap`, `getQuote`, `getRoutes`, `limitOrder`, `dcaCreate` | defi |
| **raydium** | `swap`, `getPoolInfo`, `addLiquidity` | defi/data |
| **marinade** | `stake`, `unstake` | defi |
| **drift** | `perp`, `getPosition` | defi/data |
| **solend** | `lend`, `borrow` | defi |
| **metaplex** | `mint`, `getNFTMetadata` | nft/data |
| **ai** | `sentimentAnalysis`, `riskScore`, `pricePredictor`, `summarize` | ai |
| **pyth** | `getPrice` | oracle |
| **switchboard** | `readFeed` | oracle |
| **payments** | `transfer`, `streamCreate` | payments |
| **realms** | `vote`, `createProposal` | governance |
| **sns** | `resolveDomain` | identity |
| **infra** | `rpcProxy`, `webhookRelay` | infrastructure |

### Usage

```ts
import { SAPCapabilityRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const reg = SAPCapabilityRegistry.default();   // pre-loaded with 30+ caps
// or: SAPCapabilityRegistry.empty()           // start from scratch

// ── Lookup ──
reg.has('jupiter:swap');                       // true
reg.get('jupiter:swap');                       // CapabilityDefinition

// ── Filtering ──
reg.byProtocol('jupiter');                     // all Jupiter capabilities
reg.byCategory('defi');                        // all DeFi capabilities
reg.protocols();                               // ['jupiter', 'raydium', ...]
reg.categories();                              // ['defi', 'nft', 'ai', ...]
reg.critical();                                // critical-only capabilities
reg.deprecated();                              // deprecated capabilities

// ── Search ──
reg.search('swap');                            // free-text search across id, desc, protocol

// ── Validation ──
const result = reg.validate(['jupiter:swap', 'fake:thing']);
// result.known    → ['jupiter:swap']
// result.unknown  → ['fake:thing']

// ── Dependency Graph ──
reg.relatedGraph('jupiter:swap');
// → ['jupiter:getQuote', 'jupiter:getRoutes']  (related through 2 levels)

// ── Extension ──
reg.register({
  id: 'myprotocol:action',
  protocol: 'myprotocol',
  description: 'Custom action',
  category: 'custom',
  input:  { fields: { param: 'string' } },
  output: { fields: { result: 'object' } },
});
```

### `CapabilityDefinition`

```ts
interface CapabilityDefinition {
  id: string;                           // 'protocol:method'
  protocol: string;                     // 'jupiter'
  description: string;                  // human-readable
  category: CapabilityCategory;         // 'defi' | 'nft' | 'ai' | ...
  minVersion?: string;                  // minimum SDK version
  input?: CapabilityIOSchema;           // expected input schema
  output?: CapabilityIOSchema;          // expected output schema
  relatedCapabilities?: string[];       // frequently co-used capabilities
  isCritical?: boolean;                 // core capability flag
  deprecated?: string;                  // deprecation notice
}

type CapabilityCategory =
  | 'defi' | 'nft' | 'data' | 'ai' | 'governance'
  | 'payments' | 'identity' | 'infrastructure'
  | 'oracle' | 'social' | 'custom';

interface CapabilityIOSchema {
  fields: Record<string, 'string' | 'number' | 'bigint' | 'boolean' | 'bytes' | 'object'>;
}
```

---

## Validator

`SAPValidator` performs **deep validation** on agent registration and update payloads before they are submitted on-chain. It catches data problems early, saving transaction fees and preventing invalid on-chain state.

### Checks Performed

| Area | What is validated |
|------|------------------|
| **Wallet pubkey** | Base58 charset, 32–44 characters |
| **Name** | Non-empty, ≤ 64 UTF-8 bytes, no control characters |
| **Description** | Non-empty, ≤ 512 UTF-8 bytes |
| **Capabilities** | `protocol:method` format, no duplicates, max count, registry check |
| **Pricing** | Non-empty tierId, positive pricePerCall, rateLimit > 0, valid tokenType, SPL requires tokenMint, no duplicate tiers |
| **x402 endpoint** | Must be HTTPS, valid URL structure |
| **Cross-field** | At least one capability per pricing tier protocol (warning) |

### Usage

```ts
import { SAPValidator } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

// ── Lenient mode (collect all issues) ──
const validator = new SAPValidator({ strict: false });

const report = validator.validateRegistration({
  walletPubkey: 'ABC...',
  name: 'My Agent',
  description: 'Tools',
  capabilities: [{ id: 'bad_format' }],     // ← will flag this
  pricing: [{ tierId: '', pricePerCall: 0n, rateLimit: -1, maxCallsPerSession: 0, tokenType: 'USDC' }],
});

if (!report.valid) {
  console.error(report.errors);     // blocking errors
  console.warn(report.warnings);    // non-fatal suggestions
  console.info(report.info);        // informational notes
}

// ── Strict mode (throws on first error) ──
const strict = new SAPValidator({ strict: true });
strict.validateRegistration(params);  // throws SAPValidationError
```

### Configuration

```ts
interface SAPValidatorConfig {
  strict?: boolean;                           // throw on first error (default: false)
  registry?: SAPCapabilityRegistry;           // custom registry (default: builtin)
  allowUnknownCapabilities?: boolean;         // warn vs error on unknown caps (default: true)
  maxCapabilities?: number;                   // max capabilities per agent (default: 50)
  maxPricingTiers?: number;                   // max pricing tiers per agent (default: 10)
}
```

### Integrated into `SAPInstructionBuilder`

The validator is automatically invoked when using `SAPInstructionBuilder.register()` or `.update()`:

```ts
const builder = new SAPInstructionBuilder({
  programId: SAP_DEFAULT_PROGRAM_ID,
  validation: { strict: true },              // enable strict validation
});

// This will throw SAPValidationError if params are invalid
const ix = builder.register(/* ... */);

// Access the last validation report
const report = builder.getLastValidationReport();
```

### `ValidationReport`

```ts
interface ValidationReport {
  valid: boolean;                            // true if zero errors
  errors: ValidationIssue[];                 // blocking issues
  warnings: ValidationIssue[];               // non-fatal suggestions
  info: ValidationIssue[];                   // informational notes
  durationMs: number;                        // validation time
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;                              // machine-readable code
  message: string;                           // human-readable message
  field?: string;                            // e.g. 'capabilities[2].id'
  value?: unknown;                           // the offending value
}
```

---

## Subnetwork Builder

`SubnetworkBuilder` is a **query planner for agent meshes**. Given a set of required capabilities, it discovers the optimal combination of agents that collectively covers them all, optimizing for cost, reputation, latency, or a weighted balance.

### How It Works

```
Input: ['jupiter:swap', 'pyth:getPrice', 'ai:riskScore']
                          │
                 ┌────────┴─────────┐
                 │  SubnetworkBuilder │
                 │                   │
                 │  1. Discover      │  ← SAPDiscovery.findByCapability()
                 │  2. Filter        │  ← minReputation, minUptime
                 │  3. Score         │  ← strategy-based scoring
                 │  4. Assign        │  ← constrained-first allocation
                 │  5. Estimate      │  ← cost, latency, reputation
                 └────────┬─────────┘
                          │
Output: SubnetworkResult {
  assignments: [
    { capability: 'jupiter:swap',  agent: Agent_A, alternatives: [...] },
    { capability: 'pyth:getPrice', agent: Agent_B, alternatives: [...] },
    { capability: 'ai:riskScore',  agent: Agent_C, alternatives: [...] },
  ],
  estimatedCostPerCall: 3500n,
  complete: true
}
```

### Usage

```ts
import { SubnetworkBuilder, SAPDiscovery } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const discovery = new SAPDiscovery(client, { programId });
const subnet = new SubnetworkBuilder(discovery);

// Build a subnetwork
const result = await subnet.build({
  requiredCapabilities: ['jupiter:swap', 'solend:lend', 'ai:riskScore'],
  strategy: 'balanced',             // 'cheapest' | 'reputable' | 'fastest' | 'balanced'
  maxCostPerCall: 5000n,
  minReputation: 500,
  minUptime: 90,
  pricingTier: 'standard',
  maxAgents: 10,
  preferMultiCapable: true,         // prefer agents covering multiple caps
});

if (result.complete) {
  for (const a of result.assignments) {
    console.log(`${a.capability} → ${a.agent.name} (${a.pricing.pricePerCall} per call)`);
    console.log(`  Alternatives: ${a.alternatives.length}`);
  }
  console.log(`Total cost/call: ${result.estimatedCostPerCall}`);
  console.log(`Avg reputation: ${result.avgReputation}`);
  console.log(`Max latency: ${result.maxLatencyMs}ms`);
} else {
  console.warn('Unassigned:', result.unassigned);
}
```

### Selection Strategies

| Strategy | Optimization | Weight Distribution |
|----------|-------------|-------------------|
| `'cheapest'` | Minimize total cost | Price 70%, Reputation 20%, Latency 10% |
| `'reputable'` | Maximize reliability | Reputation 60%, Uptime 25%, Cost 15% |
| `'fastest'` | Minimize latency | Latency 60%, Uptime 25%, Cost 15% |
| `'balanced'` | Weighted combination | All factors weighted evenly |

Multi-capable agents receive a scoring bonus — an agent that handles both `jupiter:swap` and `jupiter:getQuote` is preferred over two separate agents.

### Subnetwork Health

```ts
const health = await subnet.evaluateHealth(result);

// health.status → 'healthy' | 'degraded' | 'critical'
// health.atRisk → capabilities with only 1 available agent
// health.redundant → capabilities with 2+ agents available
// health.agents → per-agent health with reasons
```

### Rebuild on degradation

```ts
const rebuilt = await subnet.rebuild(result, {
  requiredCapabilities: result.assignments.map(a => a.capability),
  strategy: 'reputable',  // switch to reliability-first
});
```

### `SubnetworkResult`

```ts
interface SubnetworkResult {
  complete: boolean;                        // all capabilities assigned?
  assignments: CapabilityAssignment[];      // capability → agent mapping
  unassigned: string[];                     // unresolved capabilities
  agents: AgentPDAAccount[];                // unique agents (deduplicated)
  estimatedCostPerCall: bigint;             // sum across all agents
  avgReputation: number;
  maxLatencyMs: number;                     // bottleneck latency
  buildTimeMs: number;
  strategy: SelectionStrategy;
}

interface CapabilityAssignment {
  capability: string;
  agent: AgentPDAAccount;
  pricing: AgentPricingOnChain;
  reputationScore: number;
  latencyMs: number;
  alternatives: AgentPDAAccount[];          // fallback agents
}
```

---

## Health Scoring & Network Analytics

### Agent Health Score

`computeAgentHealthScore()` produces a composite 0–100 score for a single agent:

```ts
import { computeAgentHealthScore } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const health = computeAgentHealthScore(agent);

// health.composite     → 82
// health.tier          → 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
// health.summary       → 'My Agent: 82/100 (excellent)'
// health.recommendations → ['Consider reducing latency below 200ms']
// health.breakdown     → { reputation, uptime, latency, activity, pricing }
```

**Scoring components** (default weights):

| Component | Weight | Source | Scoring |
|-----------|--------|--------|---------|
| Reputation | 30% | `reputation.score` (0–1000) | Linear scale to 0–100 |
| Uptime | 25% | `reputation.uptimePercent` | Direct mapping |
| Latency | 20% | `reputation.avgLatencyMs` | Log scale (0ms=100, 1s=50, 30s+=0) |
| Activity | 15% | `reputation.totalCallsServed` | Relative to network average |
| Pricing | 10% | `pricing[0].pricePerCall` | Lower = better (relative) |

Custom weights:

```ts
const health = computeAgentHealthScore(agent, 
  { networkAvgCalls: 5000, networkAvgPrice: 2000n },
  { reputation: 0.40, uptime: 0.30, latency: 0.15, activity: 0.10, pricing: 0.05 },
);
```

### Tier Classification

| Score | Tier | Description |
|-------|------|-------------|
| 80–100 | `excellent` | Top performer |
| 60–79 | `good` | Solid agent |
| 40–59 | `fair` | Room for improvement |
| 20–39 | `poor` | Needs attention |
| 0–19 | `critical` | At risk |

### Network Analytics

`computeNetworkAnalytics()` produces ecosystem-wide insights:

```ts
import { computeNetworkAnalytics } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const analytics = computeNetworkAnalytics(allAgents);

// ── Distribution ──
analytics.totalAgents;                    // 150
analytics.activeAgents;                   // 142
analytics.avgHealthScore;                 // 67

// ── Equality ──
analytics.giniCoefficient;                // 0.34 (0 = perfectly equal, 1 = monopoly)
analytics.tierDistribution;               // { excellent: 20, good: 55, fair: 40, poor: 20, critical: 7 }

// ── Protocol Landscape ──
analytics.protocolConcentration;
// [
//   { protocol: 'jupiter', agentCount: 45, pct: 30 },
//   { protocol: 'raydium', agentCount: 30, pct: 20 },
//   ...
// ]

// ── Coverage ──
analytics.capabilityCoverage;
// [
//   { capability: 'jupiter:swap', agentCount: 45 },
//   { capability: 'ai:riskScore', agentCount: 8 },
//   ...
// ]

// ── Highlights ──
analytics.topAgents;                      // top 10 by composite score
analytics.needsAttention;                 // agents with score < 40 + reasons
```

---

## PDA Derivation

### `deriveAgentPDA(walletPubkey, programId?)`

Derives a deterministic PDA from the wallet public key:

```ts
const pda = deriveAgentPDA('ABcd1234...');
```

| Return field | Type | Description |
|-------------|------|-------------|
| `address` | `string` | Base58 PDA address |
| `bump` | `number` | Bump seed (255→0) |
| `seeds` | `Uint8Array[]` | Raw seed bytes |

**Seeds**: `["synapse_agent", <wallet_pubkey_32_bytes>]` — guarantees one PDA per wallet.

---

## On-Chain Account Schema

### `AgentPDAAccount`

```ts
interface AgentPDAAccount {
  address: string;                      // PDA address (base58)
  version: number;                      // schema version (u8)
  isActive: boolean;                    // active or deactivated
  walletPubkey: string;                 // owner's wallet (base58)
  name: string;                         // max 64 characters
  description: string;                  // max 256 characters
  agentId?: string;                     // DID-style identifier
  capabilities: AgentCapability[];      // advertised capabilities
  pricing: AgentPricingOnChain[];       // micropayment pricing tiers
  reputation: AgentReputationOnChain;   // on-chain reputation
  x402Endpoint?: string;               // x402 payment endpoint
  createdAt: number;                    // unix timestamp (ms)
  updatedAt: number;                    // unix timestamp (ms)
}
```

### `AgentCapability`

```ts
interface AgentCapability {
  id: string;              // 'protocol:method' (e.g. 'jupiter:swap')
  description?: string;    // human-readable
  protocol?: string;       // protocol namespace
}
```

### `AgentReputationOnChain`

```ts
interface AgentReputationOnChain {
  totalCallsServed: bigint;     // lifetime call count
  avgLatencyMs: number;         // average response latency
  uptimePercent: number;        // 0–100
  score: number;                // reputation score (0–1000)
  lastUpdatedAt: number;        // unix timestamp
}
```

### Borsh Layout

```
[0..8]    u8[8]   Anchor discriminator
[8]       u8      version (1)
[9]       u8      is_active (0 | 1)
[10..42]  u8[32]  wallet pubkey (raw bytes)
[42..50]  i64     created_at (unix ms)
[50..58]  i64     updated_at (unix ms)
[58..66]  u64     total_calls_served
[66..70]  u32     avg_latency_ms
[70]      u8      uptime_percent (0-100)
[71..]    Borsh   name, description, capabilities, pricing, x402_endpoint
```

---

## Instruction Builder

### `SAPInstructionBuilder`

Builds Solana transaction instructions for the SAP program:

```ts
const builder = new SAPInstructionBuilder({
  programId: SAP_DEFAULT_PROGRAM_ID,
  validation: { strict: true },
});
```

| Method | Parameters | Description |
|--------|-----------|-------------|
| `register` | `RegisterAgentParams` | Create a new agent PDA |
| `update` | `UpdateAgentParams` | Modify existing agent data |
| `deactivate` | `{ walletPubkey }` | Set `isActive = false` |
| `updateReputation` | `UpdateReputationParams` | Update reputation metrics |
| `getLastValidationReport` | — | Get the last validation report |

Each method returns a `SAPInstruction`:

```ts
interface SAPInstruction {
  programId: string;
  keys: SAPAccountMeta[];
  data: Uint8Array;
}

interface SAPAccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}
```

### `RegisterAgentParams`

```ts
interface RegisterAgentParams {
  walletPubkey: string;              // must be signer
  name: string;                      // max 64 bytes UTF-8
  description: string;               // max 256 bytes UTF-8
  agentId?: string;                  // optional DID
  capabilities?: AgentCapability[];  // initial capabilities
  pricing?: AgentPricingOnChain[];   // initial pricing tiers
  x402Endpoint?: string;            // x402 endpoint URL
}
```

### `UpdateAgentParams`

```ts
interface UpdateAgentParams {
  walletPubkey: string;                 // must be signer
  name?: string;                        // omit = don't change
  description?: string;
  capabilities?: AgentCapability[];     // replaces existing list
  pricing?: AgentPricingOnChain[];      // replaces existing list
  x402Endpoint?: string;
  isActive?: boolean;
}
```

---

## Discovery

### `SAPDiscovery`

Query registered agents on-chain via `getProgramAccounts`:

```ts
const discovery = new SAPDiscovery(client, { programId: SAP_DEFAULT_PROGRAM_ID });
```

| Method | Returns | Description |
|--------|---------|-------------|
| `findAgent(walletPubkey)` | `AgentPDAAccount \| null` | Find specific agent |
| `find(filter)` | `DiscoveryResult` | Filtered search |
| `findActive()` | `DiscoveryResult` | All active agents |
| `findByCapability(id)` | `DiscoveryResult` | By capability ID |
| `findByProtocol(id)` | `DiscoveryResult` | By protocol |
| `findCheapest(tierId?)` | `AgentPDAAccount \| null` | Lowest price per call |
| `findMostReputable()` | `AgentPDAAccount \| null` | Highest reputation |
| `getAggregateMetrics()` | `SAPAggregateMetrics` | Network-wide stats |

### `AgentDiscoveryFilter`

```ts
interface AgentDiscoveryFilter {
  activeOnly?: boolean;           // default: true
  capability?: string;            // e.g. 'jupiter:swap'
  protocol?: string;              // e.g. 'jupiter'
  minReputation?: number;         // 0–1000
  maxPricePerCall?: bigint;
  minUptime?: number;
  sortBy?: 'reputation' | 'price' | 'latency' | 'uptime' | 'calls';
  sortDirection?: 'asc' | 'desc';
  limit?: number;                 // default: 50
}
```

### Example: Discover, score, and connect

```ts
const result = await discovery.findByCapability('jupiter:swap');

// Score all discovered agents
const scored = result.agents.map(a => computeAgentHealthScore(a));
const best = scored.sort((a, b) => b.composite - a.composite)[0];

// Estimate cost for 500 calls
const pricing = result.agents.find(a => a.walletPubkey === best.walletPubkey)!.pricing[0];
const cost = estimateTotalCost(pricing, 500);
console.log(`Best agent: ${best.name} (${best.composite}/100), 500 calls = ${cost.totalCost} lamports`);

// Bridge to gateway
const identity = pdaToIdentity(result.agents[0]);
const tiers = result.agents[0].pricing.map(pricingToTier);
```

---

## Borsh Serialization

Zero-dependency Borsh serializer for on-chain data. All new pricing fields use `Option` encoding for backward compatibility.

### Deserialize account data

```ts
import { deserializeAgentAccount } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const rawAccountData = /* Uint8Array from getAccountInfo */;
const account = deserializeAgentAccount(rawAccountData);
// → AgentPDAAccount (including volumeCurve, settlementMode, etc.)
```

### Serialize instruction data

```ts
import { serializeRegisterData, serializeUpdateData } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const data = serializeRegisterData({
  walletPubkey: 'ABC...',
  name: 'My Agent',
  description: 'DeFi tools',
  capabilities: [{ id: 'jupiter:swap' }],
  pricing: [{
    tierId: 'standard',
    pricePerCall: 1000n,
    rateLimit: 10,
    maxCallsPerSession: 100,
    tokenType: 'USDC',
    tokenDecimals: 6,
    settlementMode: 'x402',
    volumeCurve: [{ afterCalls: 100, pricePerCall: 800n }],
  }],
  x402Endpoint: 'https://myagent.xyz/.well-known/x402',
});
```

### Low-level reader/writer

```ts
import { BorshReader, BorshWriter } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const reader = new BorshReader(buffer);
const version = reader.readU8();
const name    = reader.readString();
const count   = reader.readU64();        // → bigint

const writer = new BorshWriter(1024);
writer.writeU8(1);
writer.writeString('Agent Name');
writer.writeU64(1000n);
const bytes = writer.toBytes();
```

### Base58 utilities

```ts
import { base58Decode, base58Encode, isOnCurve } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';

const bytes   = base58Decode('So11111111111111111111111111111111111111112');
const str     = base58Encode(bytes);
const onCurve = isOnCurve(bytes);        // Ed25519 curve check
```

---

## On-Chain Persistence Adapter

Bridge SAP data into the `AgentRegistry`:

```ts
import { OnChainPersistenceAdapter, AgentRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const adapter = new OnChainPersistenceAdapter(client, {
  programId: SAP_DEFAULT_PROGRAM_ID,
});

const registry = new AgentRegistry({ adapter });
// Registry reads agent identity directly from on-chain PDAs

const agent = await registry.resolve(createAgentId('agent-wallet-pubkey'));
```

---

## Helper Functions

### `pdaToIdentity(account)`

Convert on-chain `AgentPDAAccount` → `AgentIdentity` (for Gateway compatibility):

```ts
const identity = pdaToIdentity(pdaAccount);
// → { id: AgentId, name, walletPubkey, description, tags, createdAt }
```

### `pricingToTier(pricing)`

Convert on-chain `AgentPricingOnChain` → `PricingTier` (for PricingEngine). Handles `tokenDecimals` for SPL tokens:

```ts
const tier = pricingToTier(onchainPricing);
// → { id, label, pricePerCall, maxCallsPerSession, rateLimit, token, includesAttestation }
```

---

## Constants

```ts
SAP_DEFAULT_PROGRAM_ID            // Base58 SAP program ID
SAP_SEED_PREFIX                   // 'synapse_agent'
SAP_ACCOUNT_DISCRIMINATOR         // Uint8Array (8 bytes)
SAP_INSTRUCTION_DISCRIMINATORS    // { register, update, deactivate, updateReputation }
```

---

## Full API Reference

### Types

| Export | Kind | Description |
|--------|------|-------------|
| `SAPConfig` | interface | Module configuration |
| `AgentCapability` | interface | Capability advertised by an agent |
| `AgentPricingOnChain` | interface | Micropayment pricing (ERC-8004-style) |
| `VolumeCurveBreakpoint` | interface | Volume discount breakpoint |
| `AgentReputationOnChain` | interface | On-chain reputation metrics |
| `AgentPDAAccount` | interface | Full deserialized PDA account |
| `RegisterAgentParams` | interface | Registration instruction parameters |
| `UpdateAgentParams` | interface | Update instruction parameters |
| `UpdateReputationParams` | interface | Reputation update parameters |
| `AgentDiscoveryFilter` | interface | Discovery query filters |
| `DiscoveryResult` | interface | Discovery query result |
| `SAPAggregateMetrics` | interface | Network-wide aggregate metrics |
| `SAPInstruction` | interface | Solana instruction (programId, keys, data) |
| `SAPAccountMeta` | interface | Account metadata for instructions |
| `DerivedPDA` | type | PDA derivation result |
| `CapabilityCategory` | type | Capability category enum |
| `CapabilityIOSchema` | interface | I/O schema hints |
| `CapabilityDefinition` | interface | Full capability metadata |
| `ValidationSeverity` | type | `'error' \| 'warning' \| 'info'` |
| `ValidationIssue` | interface | Single validation finding |
| `ValidationReport` | interface | Complete validation report |
| `SAPValidatorConfig` | interface | Validator configuration |
| `SelectionStrategy` | type | Subnetwork optimization strategy |
| `SubnetworkConfig` | interface | Subnetwork build configuration |
| `CapabilityAssignment` | interface | Capability → agent mapping |
| `SubnetworkResult` | interface | Subnetwork build result |
| `SubnetworkHealth` | interface | Subnetwork health status |
| `HealthScoreBreakdown` | interface | Health score components |
| `AgentHealthScore` | interface | Full health score result |
| `NetworkAnalytics` | interface | Network-wide analytics |

### Classes

| Export | Description |
|--------|-------------|
| `SAPInstructionBuilder` | Transaction instruction builder (register, update, deactivate) |
| `SAPDiscovery` | On-chain agent search via `getProgramAccounts` |
| `OnChainPersistenceAdapter` | Bridge SAP → AgentRegistry |
| `SAPCapabilityRegistry` | Canonical capability catalog (30+ defaults) |
| `SAPValidator` | Deep validation engine |
| `SubnetworkBuilder` | Multi-agent subnetwork composition |

### Functions

| Export | Description |
|--------|-------------|
| `deriveAgentPDA()` | Derive deterministic PDA from wallet pubkey |
| `deserializeAgentAccount()` | Borsh → `AgentPDAAccount` |
| `serializeRegisterData()` | `RegisterAgentParams` → Borsh bytes |
| `serializeUpdateData()` | `UpdateAgentParams` → Borsh bytes |
| `base58Decode()` | Base58 string → bytes |
| `base58Encode()` | Bytes → Base58 string |
| `isOnCurve()` | Ed25519 curve check |
| `pdaToIdentity()` | PDA → `AgentIdentity` (gateway bridge) |
| `pricingToTier()` | On-chain pricing → `PricingTier` (gateway bridge) |
| `computeCallCost()` | Cost of Nth call with volume curve |
| `estimateTotalCost()` | Total cost for N calls with breakdown |
| `computeAgentHealthScore()` | Composite 0–100 health score |
| `computeNetworkAnalytics()` | Network-wide analytics + Gini coefficient |

### Error Classes

| Export | Description |
|--------|-------------|
| `SAPProgramError` | Instruction builder errors |
| `SAPDiscoveryError` | Discovery query errors |
| `SAPValidationError` | Validation failures (strict mode) |

---

## Best Practices

1. **Use the registry** — register capabilities using `protocol:method` convention. Check against `SAPCapabilityRegistry.default()` before registering.
2. **Validate before submitting** — enable `validation: { strict: true }` in `SAPInstructionBuilder` to catch issues before wasting tx fees.
3. **Set volume curves** — reward heavy users with automatic discounts. Even a simple 2-breakpoint curve improves adoption.
4. **Choose the right settlement** — `x402` for standard use, `escrow` for high-trust partners, `batched` for high-volume pipelines.
5. **Set price floors** — `minPricePerCall` prevents accidental zero-cost service at the bottom of volume curves.
6. **Monitor health** — use `computeAgentHealthScore()` + `computeNetworkAnalytics()` to track agent and network performance.
7. **Build subnetworks** — use `SubnetworkBuilder` for multi-step tasks instead of manual agent selection. It handles failover automatically.
8. **One PDA per wallet** — deterministic seeds guarantee uniqueness. Use `deriveAgentPDA()` to verify.
9. **Update reputation periodically** — higher scores improve discovery ranking and subnetwork selection.
10. **Bridge to Gateway** — use `pdaToIdentity()` + `pricingToTier()` for seamless integration with the commerce gateway.

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `SAPProgramError` on register | PDA already exists | Use `update` instead |
| `SAPValidationError` | Invalid params | Check `report.errors` for details |
| `deriveAgentPDA` wrong address | Wrong program ID | Verify `SAP_DEFAULT_PROGRAM_ID` |
| Discovery returns empty | No agents registered | Register your agent first |
| Deserialization fails | Data format mismatch | Check `SAP_ACCOUNT_DISCRIMINATOR` |
| Volume curve not applied | `volumeCurve` is empty | Add at least one `VolumeCurveBreakpoint` |
| Subnetwork incomplete | Missing agents for capability | Lower `minReputation` or register more agents |
| Health score = 0 | No reputation data | Call `updateReputation` first |

---

## Next Steps

- **[04_AI_GATEWAY.md](./04_AI_GATEWAY.md)** — Use discovered agents with the commerce gateway
- **[06_INTENTS.md](./06_INTENTS.md)** — Chain agent tools across protocols
- **[08_PERSISTENCE.md](./08_PERSISTENCE.md)** — Persistence adapters (including `OnChainPersistenceAdapter`)
- **[09_PIPELINES.md](./09_PIPELINES.md)** — Multi-agent pipelines powered by subnetworks
