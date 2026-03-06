/**
 * @module ai/intents
 * @description Cross-Protocol Intent Resolver — multi-protocol DeFi intent execution.
 *
 * Sub-modules:
 *  - `types`    — Intent, step, plan, and result type definitions
 *  - `parser`   — Validates and normalizes intent definitions
 *  - `planner`  — DAG-based execution planning with cycle detection
 *  - `executor` — Step-by-step execution with reference resolution
 *
 * @example
 * ```ts
 * import {
 *   IntentParser,
 *   IntentPlanner,
 *   IntentExecutor,
 * } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * // 1. Parse
 * const parser = new IntentParser();
 * const { intent } = parser.parse({
 *   steps: [
 *     { id: 'quote', protocol: 'jupiter', method: 'getQuote', params: { inputMint: 'SOL', outputMint: 'USDC', amount: '1000000000' } },
 *     { id: 'swap',  protocol: 'jupiter', method: 'smartSwap', params: { inputMint: 'SOL', outputMint: 'USDC', amount: '$quote.outAmount' } },
 *     { id: 'pool',  protocol: 'raydium', method: 'getPoolInfo', params: { poolId: '$swap.poolId' } },
 *   ],
 * });
 *
 * // 2. Plan
 * const planner = new IntentPlanner();
 * const plan = planner.plan(intent);
 *
 * // 3. Execute
 * const executor = new IntentExecutor({
 *   protocolTools: {
 *     jupiter: jupiterToolkit.toolMap,
 *     raydium: raydiumToolkit.toolMap,
 *   },
 * });
 * const result = await executor.execute(plan);
 * ```
 *
 * @since 1.3.0
 */

/* ── Types ── */
export type {
  IntentProtocol,
  StepReference,
  IntentStep,
  Intent,
  IntentOptions,
  PlannedStep,
  IntentPlan,
  StepStatus,
  StepResult,
  IntentResultStatus,
  IntentResult,
  IntentConfig,
} from './types';

export {
  IntentError,
  CyclicDependencyError,
  UnresolvedReferenceError,
  BudgetExceededError,
} from './types';

/* ── Parser ── */
export type { ValidationResult, ParserConfig } from './parser';
export { IntentParser } from './parser';

/* ── Planner ── */
export type { PlannerConfig } from './planner';
export { IntentPlanner } from './planner';

/* ── Executor ── */
export { IntentExecutor } from './executor';
