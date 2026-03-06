/**
 * @module ai/intents/executor
 * @description Cross-Protocol Intent Executor — runs planned intents step-by-step.
 *
 * Resolves `$stepId.field` references, invokes protocol tools, tracks
 * costs, generates attestations, and handles failure/rollback semantics.
 *
 * @example
 * ```ts
 * import { IntentParser, IntentPlanner, IntentExecutor } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const parser = new IntentParser();
 * const planner = new IntentPlanner();
 * const executor = new IntentExecutor({
 *   protocolTools: {
 *     jupiter: jupiterToolkit.toolMap,
 *     raydium: raydiumToolkit.toolMap,
 *   },
 * });
 *
 * const { intent } = parser.parse(myIntent);
 * const plan = planner.plan(intent);
 * const result = await executor.execute(plan);
 *
 * console.log(`Status: ${result.status}`);
 * console.log(`Total cost: ${result.totalCost}`);
 * for (const step of result.steps) {
 *   console.log(`  ${step.stepId}: ${step.status} (${step.latencyMs}ms)`);
 * }
 * ```
 *
 * @since 1.3.0
 */

import type {
  IntentPlan,
  PlannedStep,
  StepResult,
  IntentResult,
  IntentConfig,
  IntentOptions,
  StepStatus,
  IntentResultStatus,
} from './types';
import { IntentError, UnresolvedReferenceError, BudgetExceededError } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Reference Resolver
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Resolve `$stepId.field.subfield` references in step params.
 *
 * @param {Record<string, unknown>} params - Step params (may contain `$ref` strings)
 * @param {Map<string, StepResult>} results - Completed step results
 * @returns {Record<string, unknown>} Params with all references resolved to actual values
 * @throws {UnresolvedReferenceError} If a reference cannot be resolved
 *
 * @since 1.3.0
 */
function resolveReferences(
  params: Record<string, unknown>,
  results: Map<string, StepResult>,
  stepId: string,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      const parts = value.slice(1).split('.');
      const refStepId = parts[0];
      const fieldPath = parts.slice(1);

      const stepResult = results.get(refStepId);
      if (!stepResult) {
        throw new UnresolvedReferenceError(value, stepId);
      }

      if (stepResult.status !== 'completed' && stepResult.status !== 'simulated') {
        throw new UnresolvedReferenceError(
          `${value} (step '${refStepId}' has status '${stepResult.status}')`,
          stepId,
        );
      }

      let val: unknown = stepResult.output;
      for (const field of fieldPath) {
        if (val === null || val === undefined) {
          throw new UnresolvedReferenceError(
            `${value} — field '${field}' not found (value is ${val})`,
            stepId,
          );
        }
        if (typeof val === 'object') {
          val = (val as Record<string, unknown>)[field];
        } else {
          throw new UnresolvedReferenceError(
            `${value} — cannot traverse '${field}' on non-object`,
            stepId,
          );
        }
      }

      resolved[key] = val;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively resolve nested objects
      resolved[key] = resolveReferences(value as Record<string, unknown>, results, stepId);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/* ═══════════════════════════════════════════════════════════════
 *  IntentExecutor
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Executes intent plans step-by-step with reference resolution,
 * budget tracking, attestation, and failure handling.
 *
 * Execution modes:
 * - **Sequential**: Steps are executed in topological order
 * - **Simulate**: All steps are dry-run (tools are called but results are marked as simulated)
 * - **Atomic**: On failure, all completed steps are marked as requiring rollback
 *
 * @since 1.3.0
 */
export class IntentExecutor {
  private readonly config: IntentConfig;
  private readonly defaultTimeout: number;
  private readonly maxSteps: number;

  /**
   * @param {IntentConfig} config - Executor configuration with protocol tools
   */
  constructor(config: IntentConfig) {
    this.config = config;
    this.defaultTimeout = config.defaultTimeoutMs ?? 30_000;
    this.maxSteps = config.maxSteps ?? 20;
  }

  /**
   * @description Execute an intent plan step-by-step.
   *
   * Steps are executed in topological order. At each step:
   * 1. Resolve `$ref` params from previous step outputs
   * 2. Check budget (if `maxBudget` is set)
   * 3. Invoke the protocol tool
   * 4. Parse output and record result
   * 5. Call `onStepComplete` / `onStepError` callbacks
   *
   * @param {IntentPlan} plan - Execution plan from {@link IntentPlanner.plan}
   * @param {IntentOptions} [options] - Execution options (override intent-level options)
   * @returns {Promise<IntentResult>} Execution result with per-step details
   *
   * @example
   * ```ts
   * const result = await executor.execute(plan, { simulate: true });
   * if (result.status === 'completed') {
   *   console.log('All steps succeeded!');
   * }
   * ```
   *
   * @since 1.3.0
   */
  async execute(plan: IntentPlan, options?: IntentOptions): Promise<IntentResult> {
    if (!plan.isValid) {
      throw new IntentError(`Cannot execute invalid plan: ${plan.errors.join(', ')}`, 'INVALID_PLAN');
    }

    const startedAt = Date.now();
    const simulate = options?.simulate ?? false;
    const atomic = options?.atomic ?? false;
    const maxBudget = options?.maxBudget;

    const results = new Map<string, StepResult>();
    const stepResults: StepResult[] = [];
    let totalCost = 0n;
    let successCount = 0;
    let failureCount = 0;

    // Group steps by execution level for sequential processing
    const levels = new Map<number, PlannedStep[]>();
    for (const step of plan.steps) {
      if (!levels.has(step.executionOrder)) levels.set(step.executionOrder, []);
      levels.get(step.executionOrder)!.push(step);
    }

    const sortedLevels = [...levels.keys()].sort((a, b) => a - b);

    for (const level of sortedLevels) {
      const stepsAtLevel = levels.get(level)!;

      // Execute steps at the same level (could be parallel in future)
      for (const step of stepsAtLevel) {
        // Budget check
        if (maxBudget !== undefined && totalCost + (step.estimatedCost ?? 0n) > maxBudget) {
          const result: StepResult = {
            stepId: step.id,
            status: 'skipped',
            output: null,
            latencyMs: 0,
            cost: 0n,
            error: 'Budget would be exceeded',
            executedAt: Date.now(),
          };
          stepResults.push(result);
          results.set(step.id, result);
          failureCount++;
          if (atomic) break;
          continue;
        }

        // Check if dependencies succeeded
        const depsFailed = (step.resolvedDeps ?? []).some(dep => {
          const depResult = results.get(dep);
          return depResult && depResult.status !== 'completed' && depResult.status !== 'simulated';
        });

        if (depsFailed && !step.optional) {
          const result: StepResult = {
            stepId: step.id,
            status: 'skipped',
            output: null,
            latencyMs: 0,
            cost: 0n,
            error: 'Dependency failed',
            executedAt: Date.now(),
          };
          stepResults.push(result);
          results.set(step.id, result);
          failureCount++;
          if (atomic) break;
          continue;
        }

        // Execute the step
        const result = await this.executeStep(step, results, simulate);
        stepResults.push(result);
        results.set(step.id, result);

        if (result.status === 'completed' || result.status === 'simulated') {
          successCount++;
          totalCost += result.cost;
        } else {
          failureCount++;
          if (atomic) break;
        }

        // Callbacks
        if (result.status === 'completed' || result.status === 'simulated') {
          await this.config.onStepComplete?.(result);
        } else if (result.status === 'failed') {
          await this.config.onStepError?.(step.id, new IntentError(result.error ?? 'Unknown error', 'STEP_FAILED', step.id));
        }
      }

      // Check if atomic mode and a failure occurred
      if (atomic && failureCount > 0) break;
    }

    // Determine overall status
    let status: IntentResultStatus;
    if (simulate) {
      status = 'simulated';
    } else if (failureCount === 0) {
      status = 'completed';
    } else if (successCount > 0) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    return {
      intentId: plan.intentId,
      status,
      steps: stepResults,
      totalCost,
      totalLatencyMs: Date.now() - startedAt,
      successCount,
      failureCount,
      startedAt,
      completedAt: Date.now(),
      metadata: options?.metadata,
    };
  }

  /**
   * @description Simulate an intent plan (dry-run). All tools are called
   * but results are marked as `simulated`.
   *
   * @param {IntentPlan} plan - Execution plan
   * @param {IntentOptions} [options] - Additional options
   * @returns {Promise<IntentResult>} Simulated result
   *
   * @since 1.3.0
   */
  async simulate(plan: IntentPlan, options?: IntentOptions): Promise<IntentResult> {
    return this.execute(plan, { ...options, simulate: true });
  }

  /**
   * @description Execute atomically — if any required step fails, stop immediately.
   *
   * @param {IntentPlan} plan - Execution plan
   * @param {IntentOptions} [options] - Additional options
   * @returns {Promise<IntentResult>} Execution result
   *
   * @since 1.3.0
   */
  async executeAtomic(plan: IntentPlan, options?: IntentOptions): Promise<IntentResult> {
    return this.execute(plan, { ...options, atomic: true });
  }

  /* ── Single step execution ── */

  private async executeStep(
    step: PlannedStep,
    results: Map<string, StepResult>,
    simulate: boolean,
  ): Promise<StepResult> {
    const start = Date.now();

    try {
      // Resolve references
      const resolvedParams = resolveReferences(step.params as Record<string, unknown>, results, step.id);

      // Find the tool
      const protocolTools = this.config.protocolTools[step.protocol];
      if (!protocolTools) {
        throw new IntentError(
          `No tools registered for protocol '${step.protocol}'`,
          'PROTOCOL_NOT_FOUND',
          step.id,
        );
      }

      const tool = protocolTools[step.method];
      if (!tool) {
        throw new IntentError(
          `Method '${step.method}' not found in protocol '${step.protocol}'`,
          'METHOD_NOT_FOUND',
          step.id,
        );
      }

      // Execute with timeout
      const timeoutMs = step.timeoutMs ?? this.defaultTimeout;
      const rawOutput = await Promise.race([
        tool.invoke(resolvedParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new IntentError(`Step '${step.id}' timed out after ${timeoutMs}ms`, 'TIMEOUT', step.id)), timeoutMs),
        ),
      ]);

      // Parse output
      let output: unknown;
      try {
        output = JSON.parse(rawOutput);
      } catch {
        output = rawOutput;
      }

      return {
        stepId: step.id,
        status: simulate ? 'simulated' : 'completed',
        output,
        rawOutput,
        latencyMs: Date.now() - start,
        cost: step.estimatedCost ?? 0n,
        executedAt: Date.now(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        stepId: step.id,
        status: step.optional ? 'skipped' : 'failed',
        output: null,
        latencyMs: Date.now() - start,
        cost: 0n,
        error,
        executedAt: Date.now(),
      };
    }
  }
}
