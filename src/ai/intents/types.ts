/**
 * @module ai/intents/types
 * @description Cross-Protocol Intent Resolver — Core type definitions.
 *
 * An "intent" is a high-level description of a multi-step DeFi operation
 * that spans multiple protocols (Jupiter, Raydium, Metaplex, native SOL).
 *
 * The resolver parses intents into execution plans, resolves cross-step
 * data dependencies (e.g. "use the output of step 1 as input to step 2"),
 * and executes them with simulation, attestation, and optional Jito bundling.
 *
 * @since 1.3.0
 */

import type { ResponseAttestation } from '../gateway/types';

/* ═══════════════════════════════════════════════════════════════
 *  Protocols & References
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Supported protocol identifiers for intent steps.
 * @since 1.3.0
 */
export type IntentProtocol =
  | 'jupiter'
  | 'raydium'
  | 'metaplex'
  | 'native'
  | 'marinade'
  | 'jito'
  | string;

/**
 * @description A reference to a previous step's output field.
 *
 * Format: `"$<stepId>.<field>.<subfield>..."` where:
 * - `$step1.amount` → the `amount` field from step1's output
 * - `$step1.data.outputAmount` → nested field access
 *
 * @since 1.3.0
 */
export type StepReference = `$${string}`;

/* ═══════════════════════════════════════════════════════════════
 *  Intent Definition
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A single step in a multi-protocol intent.
 * @since 1.3.0
 */
export interface IntentStep {
  /** Unique step identifier (referenced by other steps via `$stepId`). */
  id: string;
  /** Target protocol. */
  protocol: IntentProtocol;
  /** Method name within the protocol (e.g. `"smartSwap"`, `"getPoolInfo"`). */
  method: string;
  /**
   * Input parameters. Values can be literal or {@link StepReference}s
   * that resolve at runtime from previous step outputs.
   */
  params: Record<string, unknown | StepReference>;
  /**
   * Explicit dependencies (step IDs that must complete before this step).
   * Auto-inferred from `$ref` params if omitted.
   */
  dependsOn?: string[];
  /** Human-readable description of what this step does. */
  description?: string;
  /**
   * If `true`, failure of this step is non-fatal — the plan continues.
   * @default false
   */
  optional?: boolean;
  /**
   * Max acceptable latency in ms. If exceeded, the step is marked as slow.
   * @default 30000
   */
  timeoutMs?: number;
}

/**
 * @description A complete multi-protocol intent.
 * @since 1.3.0
 */
export interface Intent {
  /** Unique intent identifier (auto-generated if omitted). */
  id?: string;
  /** Human-readable description. */
  description?: string;
  /** Ordered list of steps. */
  steps: IntentStep[];
  /** Global intent options. */
  options?: IntentOptions;
}

/**
 * @description Options controlling intent execution behavior.
 * @since 1.3.0
 */
export interface IntentOptions {
  /**
   * If `true`, all steps are simulated before execution (dry-run).
   * @default false
   */
  simulate?: boolean;
  /**
   * If `true`, failure of any step rolls back completed steps where possible.
   * @default false
   */
  atomic?: boolean;
  /**
   * If `true`, generate Proof-of-Computation attestation for each step.
   * @default true
   */
  attest?: boolean;
  /**
   * Maximum total budget (smallest token unit). Execution halts if exceeded.
   * @default Infinity
   */
  maxBudget?: bigint;
  /**
   * Session ID to charge against (if using gateway metering).
   */
  sessionId?: string;
  /**
   * If `true`, bundle all on-chain transactions via Jito for MEV protection.
   * @default false
   */
  jitoBundling?: boolean;
  /**
   * Custom metadata attached to the intent result.
   */
  metadata?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution Plan
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description A step enriched with execution plan metadata.
 * @since 1.3.0
 */
export interface PlannedStep extends IntentStep {
  /** Execution order (0-based). Steps with the same order can run in parallel. */
  executionOrder: number;
  /** Resolved dependencies (step IDs). */
  resolvedDeps: string[];
  /** Whether this step can run in parallel with others at the same order. */
  parallelizable: boolean;
  /** Estimated cost in smallest token unit. */
  estimatedCost?: bigint;
  /** Estimated latency in ms. */
  estimatedLatencyMs?: number;
}

/**
 * @description A fully resolved execution plan.
 * @since 1.3.0
 */
export interface IntentPlan {
  /** Original intent ID. */
  intentId: string;
  /** Planned steps in topological order. */
  steps: PlannedStep[];
  /** Total number of execution levels (sequential phases). */
  totalLevels: number;
  /** Estimated total cost. */
  estimatedTotalCost: bigint;
  /** Estimated total latency (sequential sum). */
  estimatedTotalLatencyMs: number;
  /** Whether the plan is valid (all deps resolved, no cycles). */
  isValid: boolean;
  /** Validation errors (if any). */
  errors: string[];
  /** Plan creation timestamp. */
  createdAt: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution Results
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Possible status values for a step execution.
 * @since 1.3.0
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'simulated';

/**
 * @description Result of executing a single step.
 * @since 1.3.0
 */
export interface StepResult {
  /** Step ID. */
  stepId: string;
  /** Execution status. */
  status: StepStatus;
  /** Output data (parsed from tool response). */
  output: unknown;
  /** Raw string output from the tool. */
  rawOutput?: string;
  /** Attestation (if generated). */
  attestation?: ResponseAttestation;
  /** Execution latency (ms). */
  latencyMs: number;
  /** Cost charged for this step. */
  cost: bigint;
  /** Error message (if failed). */
  error?: string;
  /** Timestamp of execution. */
  executedAt: number;
}

/**
 * @description Possible status values for the overall intent execution.
 * @since 1.3.0
 */
export type IntentResultStatus = 'completed' | 'partial' | 'failed' | 'simulated';

/**
 * @description Final result of an intent execution.
 * @since 1.3.0
 */
export interface IntentResult {
  /** Intent ID. */
  intentId: string;
  /** Overall status. */
  status: IntentResultStatus;
  /** Per-step results. */
  steps: StepResult[];
  /** Total cost across all steps. */
  totalCost: bigint;
  /** Total execution time (ms). */
  totalLatencyMs: number;
  /** Number of successful steps. */
  successCount: number;
  /** Number of failed steps. */
  failureCount: number;
  /** Execution start timestamp. */
  startedAt: number;
  /** Execution end timestamp. */
  completedAt: number;
  /** Custom metadata from intent options. */
  metadata?: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for the Intent Resolver system.
 * @since 1.3.0
 */
export interface IntentConfig {
  /**
   * Map of protocol name → toolkit tools (the `toolMap` from a `ProtocolToolkit`).
   * The executor uses these to invoke the actual protocol methods.
   */
  protocolTools: Record<string, Record<string, { invoke: (input: Record<string, unknown>) => Promise<string> }>>;
  /**
   * Default timeout per step (ms).
   * @default 30000
   */
  defaultTimeoutMs?: number;
  /**
   * Maximum steps allowed in a single intent.
   * @default 20
   */
  maxSteps?: number;
  /**
   * Event listener called on each step completion.
   */
  onStepComplete?: (result: StepResult) => void | Promise<void>;
  /**
   * Event listener called on step failure.
   */
  onStepError?: (stepId: string, error: Error) => void | Promise<void>;
}

/* ═══════════════════════════════════════════════════════════════
 *  Errors
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Error class for intent-related failures.
 * @since 1.3.0
 */
export class IntentError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='INTENT_ERROR'] - Machine-readable error code
   * @param {string} [stepId] - Step ID where the error occurred
   */
  constructor(
    message: string,
    public readonly code: string = 'INTENT_ERROR',
    public readonly stepId?: string,
  ) {
    super(message);
    this.name = 'IntentError';
  }
}

/**
 * @description Error thrown when a circular dependency is detected in the intent DAG.
 * @since 1.3.0
 */
export class CyclicDependencyError extends IntentError {
  constructor(cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(' → ')}`, 'CYCLIC_DEPENDENCY');
  }
}

/**
 * @description Error thrown when a step reference cannot be resolved.
 * @since 1.3.0
 */
export class UnresolvedReferenceError extends IntentError {
  constructor(ref: string, stepId: string) {
    super(`Cannot resolve reference '${ref}' in step '${stepId}'`, 'UNRESOLVED_REFERENCE', stepId);
  }
}

/**
 * @description Error thrown when the intent budget is exceeded.
 * @since 1.3.0
 */
export class BudgetExceededError extends IntentError {
  constructor(spent: bigint, max: bigint) {
    super(`Budget exceeded: spent ${spent}, max ${max}`, 'BUDGET_EXCEEDED');
  }
}
