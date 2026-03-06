# 06 — Intents: Cross-Protocol Intent Resolver

> **Import**: `@…/synapse-client-sdk/ai/intents`  
> **Source**: `src/ai/intents/`  
> **Prerequisites**: [01_CORE.md](./01_CORE.md) (SynapseClient), [03_AI_TOOLS.md](./03_AI_TOOLS.md) (protocol tools)

---

## Overview

The Intent system lets you describe **what** you want (in natural language or structured JSON) and the SDK figures out **how** to do it — selecting the right protocols, ordering operations, resolving dependencies, and executing them.

### Pipeline

```
Input                   Parse                 Plan                    Execute
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│ "Swap 1  │     │ IntentParser │     │ IntentPlanner │     │ IntentExecutor   │
│  SOL to  │────→│  - classify  │────→│  - build DAG  │────→│  - resolve $ref  │
│  USDC,   │     │  - extract   │     │  - topo sort  │     │  - parallel exec │
│  stake"  │     │  - normalize │     │  - group      │     │  - collect       │
└──────────┘     └──────────────┘     └───────────────┘     └──────────────────┘
                       │                    │                       │
                       ▼                    ▼                       ▼
                  ParsedIntent[]      ExecutionPlan          IntentResult
```

### When to use Intents

| Scenario | Use Intents? | Alternative |
|----------|-------------|-------------|
| "Swap SOL to USDC" (single step) | ❌ | Call Jupiter tool directly |
| "Swap SOL to USDC, then stake USDC in Marinade" | ✅ | — |
| "Get best price across 3 DEXes" | ❌ | Use tool directly with comparison |
| "Batch: swap + stake + register agent" | ✅ | — |
| AI agent decides multi-step plan | ✅ | — |

---

## Quick Start

```ts
import {
  IntentParser,
  IntentPlanner,
  IntentExecutor,
} from '@oobe-protocol-labs/synapse-client-sdk/ai/intents';
import { createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

const client = createSynapseClient({ rpcUrl: '...' });
const tools  = await createProtocolTools(client, 'all');

// 1. Parse user input
const parser  = new IntentParser();
const intents = parser.parse('Swap 1 SOL to USDC on Jupiter, then stake the USDC on Marinade');
// → ParsedIntent[]

// 2. Plan execution order
const planner = new IntentPlanner();
const plan    = planner.plan(intents);
// → ExecutionPlan { steps, dag, parallelGroups }

// 3. Execute
const executor = new IntentExecutor(tools);
const result   = await executor.execute(plan);
// → IntentResult { success, outputs, errors }
```

---

## 1. IntentParser

### `parser.parse(input)`

Accepts a natural-language string or structured JSON:

```ts
const parser = new IntentParser();

// Natural language
const intents = parser.parse('Swap 1 SOL to USDC');

// Structured
const intents2 = parser.parse([
  { action: 'swap', protocol: 'jupiter', params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
  { action: 'stake', protocol: 'marinade', params: { amount: '$ref:step0.output.amountOut' } },
]);
```

### `parser.extractReferences(intent)`

Finds `$ref` tokens that create data dependencies between steps:

```ts
const refs = parser.extractReferences(intent);
// → ['$ref:step0.output.amountOut']
```

### `ParsedIntent`

```ts
interface ParsedIntent {
  id:         string;               // auto-generated (step0, step1, ...)
  action:     string;               // 'swap', 'stake', 'transfer', etc.
  protocol:   string;               // 'jupiter', 'marinade', etc.
  params:     Record<string, any>;  // action-specific parameters
  references: string[];             // $ref dependencies
  raw:        string | object;      // original input
}
```

---

## 2. IntentPlanner

### `planner.plan(intents)`

Builds a DAG (Directed Acyclic Graph) from parsed intents and returns a topologically sorted execution plan:

```ts
const planner = new IntentPlanner();
const plan    = planner.plan(intents);
```

### How the DAG works

```
Step 0: Swap SOL→USDC (no dependencies)
Step 1: Stake USDC   (depends on Step 0 via $ref:step0.output.amountOut)

DAG:
  step0 ──→ step1

Topological sort: [step0, step1]
Parallel groups:  [[step0], [step1]]  (step1 waits for step0)
```

If two steps have **no** dependency, they run in parallel:

```
Step 0: Get Jupiter price  (no deps)
Step 1: Get Raydium price  (no deps)
Step 2: Swap on cheapest   (depends on step0 AND step1)

DAG:
  step0 ──┐
           ├──→ step2
  step1 ──┘

Parallel groups: [[step0, step1], [step2]]
```

### `ExecutionPlan`

```ts
interface ExecutionPlan {
  steps:          PlannedStep[];      // topologically sorted
  dag:            DAGNode[];          // raw DAG
  parallelGroups: PlannedStep[][];    // steps grouped by execution wave
  metadata: {
    totalSteps:   number;
    maxParallelism: number;
    estimatedMs:  number;
  };
}

interface PlannedStep {
  intentId:     string;           // step0, step1, ...
  action:       string;
  protocol:     string;
  params:       Record<string, any>;
  dependsOn:    string[];         // intentIds this step waits for
  references:   ResolvedReference[];
}

interface DAGNode {
  id:       string;
  edges:    string[];   // outgoing edges (dependents)
  inDegree: number;     // incoming edge count
}
```

---

## 3. IntentExecutor

### `executor.execute(plan)`

Runs the plan respecting the DAG order:

```ts
const executor = new IntentExecutor(tools);
const result   = await executor.execute(plan);
```

**Execution flow**:
1. For each parallel group (wave), execute all steps concurrently
2. Before executing a step, resolve `$ref` tokens from previous step outputs
3. Find the matching tool from the provided `tools` array
4. Call the tool with resolved params
5. Collect output for downstream `$ref` resolution
6. Continue to next wave

### `executor.simulate(plan)`

Dry-run: validates the plan without making any RPC calls:

```ts
const simulation = await executor.simulate(plan);
// → { valid: true, steps: [...], warnings: [...] }
```

### `executor.executeAtomic(plan)`

All-or-nothing: if any step fails, previous results are rolled back (where possible):

```ts
try {
  const result = await executor.executeAtomic(plan);
} catch (err) {
  // All steps reverted
  console.error('Atomic execution failed:', err);
}
```

### `$ref` Resolution

References let step outputs flow into step inputs:

```ts
// Step 0 output: { amountOut: 50_000_000 }
// Step 1 params: { amount: '$ref:step0.output.amountOut' }
// After resolution: { amount: 50_000_000 }

// Nested paths work too:
'$ref:step0.output.routes[0].outAmount'
// → resolves routes[0].outAmount from step0's output
```

### `IntentResult`

```ts
interface IntentResult {
  success:  boolean;
  outputs:  Map<string, any>;        // stepId → output
  errors:   Map<string, Error>;      // stepId → error (if any)
  timing: {
    totalMs:    number;
    perStep:    Map<string, number>;  // stepId → ms
  };
}
```

---

## Types Reference

### Intent types

```ts
type IntentAction =
  | 'swap'       // DEX swap
  | 'stake'      // staking
  | 'transfer'   // token transfer
  | 'getQuote'   // price query
  | 'getBalance' // account balance
  | 'register'   // SAP registration
  | 'custom';    // user-defined

interface IntentInput {
  action:     IntentAction;
  protocol?:  string;
  params:     Record<string, any>;
}
```

### Error types

```ts
class IntentParseError extends Error {
  input:  string | object;   // what was passed
  reason: string;            // why it failed
}

class IntentPlanError extends Error {
  intents:   ParsedIntent[];
  reason:    string;
  // Common: 'CIRCULAR_DEPENDENCY', 'UNKNOWN_PROTOCOL', 'MISSING_PARAM'
}

class IntentExecutionError extends Error {
  stepId:    string;          // which step failed
  plan:      ExecutionPlan;
  partial:   Map<string, any>;  // results from completed steps
}
```

---

## End-to-End Example

### Swap + Stake pipeline

```ts
import { createSynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { createProtocolTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';
import { IntentParser, IntentPlanner, IntentExecutor } from '@oobe-protocol-labs/synapse-client-sdk/ai/intents';

// Setup
const client = createSynapseClient({ rpcUrl: 'https://your.rpc.endpoint' });
const tools  = await createProtocolTools(client, 'all');

// Parse
const parser  = new IntentParser();
const intents = parser.parse([
  {
    action:   'swap',
    protocol: 'jupiter',
    params: {
      inputMint:  'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount:     1_000_000_000, // 1 SOL in lamports
      slippage:   50,            // 0.5%
    },
  },
  {
    action:   'stake',
    protocol: 'marinade',
    params: {
      amount: '$ref:step0.output.outAmount', // USDC from swap
    },
  },
]);

// Plan
const planner = new IntentPlanner();
const plan    = planner.plan(intents);

console.log('Execution waves:', plan.parallelGroups.length);
// → 2 (swap first, then stake)

// Simulate first
const sim = await executor.simulate(plan);
if (!sim.valid) {
  console.error('Plan invalid:', sim.warnings);
  process.exit(1);
}

// Execute
const executor = new IntentExecutor(tools);
const result   = await executor.execute(plan);

if (result.success) {
  console.log('Swap output:', result.outputs.get('step0'));
  console.log('Stake output:', result.outputs.get('step1'));
} else {
  for (const [stepId, err] of result.errors) {
    console.error(`Step ${stepId} failed:`, err.message);
  }
}
```

### Multi-DEX price comparison (parallel execution)

```ts
const intents = parser.parse([
  { action: 'getQuote', protocol: 'jupiter',  params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
  { action: 'getQuote', protocol: 'raydium',  params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
  { action: 'getQuote', protocol: 'orca',     params: { inputMint: 'SOL', outputMint: 'USDC', amount: 1e9 } },
]);

const plan   = planner.plan(intents);
// All 3 quotes run in parallel (no dependencies!)
console.log('Parallel groups:', plan.parallelGroups.length); // → 1

const result = await executor.execute(plan);
const quotes = [
  { dex: 'jupiter', quote: result.outputs.get('step0') },
  { dex: 'raydium', quote: result.outputs.get('step1') },
  { dex: 'orca',    quote: result.outputs.get('step2') },
];
const best = quotes.sort((a, b) => b.quote.outAmount - a.quote.outAmount)[0];
console.log(`Best price on ${best.dex}: ${best.quote.outAmount}`);
```

---

## Best Practices

1. **Always simulate before execute** — catch plan errors without wasting RPC calls
2. **Use `$ref` for data flow** — don't manually pass outputs between steps
3. **Keep steps atomic** — one action per step for clean error handling
4. **Use `executeAtomic` for financial operations** — all-or-nothing prevents partial state
5. **Check `parallelGroups.length`** — if it's 1, everything runs in parallel (fast!)
6. **Handle `IntentExecutionError.partial`** — tells you which steps completed before the failure

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `IntentParseError` | Unrecognized action or protocol | Check `IntentAction` type for valid actions |
| `IntentPlanError: CIRCULAR_DEPENDENCY` | Step A refs Step B, Step B refs Step A | Remove circular `$ref` |
| `IntentPlanError: UNKNOWN_PROTOCOL` | Protocol not in provided tools | Add protocol tools with `createProtocolTools` |
| `$ref` resolves to `undefined` | Typo in path or step didn't produce output | Check step output shape, use `simulate()` |
| Steps run sequentially when they should be parallel | Unnecessary `$ref` between steps | Remove `$ref` if no real dependency |
| `IntentExecutionError` | Tool call failed | Check `error.partial` for completed steps |

---

## Next Steps

- **[07_ACTIONS_BLINKS.md](./07_ACTIONS_BLINKS.md)** — Expose intent pipelines as Solana Actions
- **[09_PIPELINES.md](./09_PIPELINES.md)** — Production integration patterns
