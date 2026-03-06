/**
 * @module ai/intents/planner
 * @description Cross-Protocol Intent Planner — DAG-based execution planning.
 *
 * Converts a validated {@link Intent} into an {@link IntentPlan} by:
 * 1. Building a directed acyclic graph (DAG) from step dependencies
 * 2. Detecting cycles
 * 3. Computing topological sort (execution order)
 * 4. Identifying parallelizable steps
 * 5. Estimating costs and latencies
 *
 * @example
 * ```ts
 * import { IntentPlanner } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const planner = new IntentPlanner();
 * const plan = planner.plan(parsedIntent);
 *
 * console.log(`${plan.totalLevels} execution levels`);
 * console.log(`Estimated cost: ${plan.estimatedTotalCost}`);
 *
 * // View execution order
 * for (const step of plan.steps) {
 *   console.log(`[Level ${step.executionOrder}] ${step.id}: ${step.protocol}.${step.method}`);
 * }
 * ```
 *
 * @since 1.3.0
 */

import type { Intent, IntentPlan, PlannedStep, IntentStep } from './types';
import { IntentError, CyclicDependencyError } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Cost estimation defaults
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Default estimated costs per protocol (in lamports/micro-units).
 * Used when no custom cost estimator is provided.
 * @since 1.3.0
 */
const DEFAULT_COST_ESTIMATES: Record<string, bigint> = {
  jupiter:  1000n,
  raydium:  1000n,
  metaplex: 2000n,
  native:   500n,
  marinade: 1500n,
  jito:     3000n,
};

/**
 * @description Default estimated latencies per protocol (ms).
 * @since 1.3.0
 */
const DEFAULT_LATENCY_ESTIMATES: Record<string, number> = {
  jupiter:  2000,
  raydium:  1500,
  metaplex: 3000,
  native:   500,
  marinade: 2000,
  jito:     1000,
};

/* ═══════════════════════════════════════════════════════════════
 *  Planner Configuration
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for the intent planner.
 * @since 1.3.0
 */
export interface PlannerConfig {
  /** Custom cost estimates per protocol. */
  costEstimates?: Record<string, bigint>;
  /** Custom latency estimates per protocol (ms). */
  latencyEstimates?: Record<string, number>;
  /** Maximum DAG depth before rejecting. @default 10 */
  maxDepth?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  IntentPlanner
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Converts validated intents into optimized execution plans.
 *
 * The planner performs:
 * 1. **DAG construction** — edges from each dependency to the dependent step
 * 2. **Cycle detection** — DFS-based, throws {@link CyclicDependencyError}
 * 3. **Topological sort** — Kahn's algorithm for deterministic ordering
 * 4. **Level assignment** — steps at the same level can run in parallel
 * 5. **Cost estimation** — per-step and total cost/latency estimates
 *
 * @since 1.3.0
 */
export class IntentPlanner {
  private readonly costEstimates: Record<string, bigint>;
  private readonly latencyEstimates: Record<string, number>;
  private readonly maxDepth: number;

  /**
   * @param {PlannerConfig} [config] - Planner configuration
   */
  constructor(config?: PlannerConfig) {
    this.costEstimates = { ...DEFAULT_COST_ESTIMATES, ...config?.costEstimates };
    this.latencyEstimates = { ...DEFAULT_LATENCY_ESTIMATES, ...config?.latencyEstimates };
    this.maxDepth = config?.maxDepth ?? 10;
  }

  /**
   * @description Create an execution plan from a validated intent.
   *
   * @param {Intent} intent - Validated intent (from {@link IntentParser.parse})
   * @returns {IntentPlan} Execution plan with topologically sorted steps
   * @throws {CyclicDependencyError} If the dependency graph contains a cycle
   * @throws {IntentError} If the DAG exceeds maximum depth
   *
   * @example
   * ```ts
   * const plan = planner.plan(intent);
   * if (plan.isValid) {
   *   for (const step of plan.steps) {
   *     console.log(`[${step.executionOrder}] ${step.id} (${step.protocol})`);
   *   }
   * }
   * ```
   *
   * @since 1.3.0
   */
  plan(intent: Intent): IntentPlan {
    const errors: string[] = [];
    const stepMap = new Map<string, IntentStep>();
    for (const step of intent.steps) {
      stepMap.set(step.id, step);
    }

    // Build adjacency list (deps → step)
    const adjList = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const step of intent.steps) {
      if (!adjList.has(step.id)) adjList.set(step.id, new Set());
      if (!inDegree.has(step.id)) inDegree.set(step.id, 0);

      for (const dep of step.dependsOn ?? []) {
        if (!adjList.has(dep)) adjList.set(dep, new Set());
        adjList.get(dep)!.add(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
      }
    }

    // Cycle detection (DFS)
    this.detectCycles(intent.steps, adjList);

    // Topological sort (Kahn's algorithm) with level assignment
    const queue: string[] = [];
    const levels = new Map<string, number>();

    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
        levels.set(id, 0);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const currentLevel = levels.get(current) ?? 0;

      for (const neighbor of adjList.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        // Level = max dependency level + 1
        const neighborLevel = Math.max(levels.get(neighbor) ?? 0, currentLevel + 1);
        levels.set(neighbor, neighborLevel);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for unprocessed nodes (cycle should have been caught already)
    if (sorted.length !== intent.steps.length) {
      errors.push('Not all steps were processed — possible unresolved dependency');
    }

    // Check depth
    const maxLevel = Math.max(...levels.values(), 0);
    if (maxLevel > this.maxDepth) {
      errors.push(`DAG depth ${maxLevel} exceeds maximum ${this.maxDepth}`);
    }

    // Build planned steps
    const plannedSteps: PlannedStep[] = [];
    let totalCost = 0n;
    let totalLatency = 0;

    // Group by level for parallel latency estimation
    const levelLatencies: Record<number, number> = {};

    for (const stepId of sorted) {
      const step = stepMap.get(stepId)!;
      const level = levels.get(stepId) ?? 0;
      const estimatedCost = this.costEstimates[step.protocol] ?? 1000n;
      const estimatedLatency = this.latencyEstimates[step.protocol] ?? 2000;

      // Count steps at same level
      const sameLevel = sorted.filter(id => levels.get(id) === level);

      plannedSteps.push({
        ...step,
        executionOrder: level,
        resolvedDeps: step.dependsOn ?? [],
        parallelizable: sameLevel.length > 1,
        estimatedCost,
        estimatedLatencyMs: estimatedLatency,
      });

      totalCost += estimatedCost;
      // For latency, take the max per level (parallel steps)
      levelLatencies[level] = Math.max(levelLatencies[level] ?? 0, estimatedLatency);
    }

    totalLatency = Object.values(levelLatencies).reduce((sum, v) => sum + v, 0);

    return {
      intentId: intent.id ?? 'unknown',
      steps: plannedSteps,
      totalLevels: maxLevel + 1,
      estimatedTotalCost: totalCost,
      estimatedTotalLatencyMs: totalLatency,
      isValid: errors.length === 0,
      errors,
      createdAt: Date.now(),
    };
  }

  /**
   * @description Optimize a plan by reordering parallelizable steps
   * to minimize total latency.
   *
   * @param {IntentPlan} plan - Plan to optimize
   * @returns {IntentPlan} Optimized plan (new object, original unchanged)
   *
   * @since 1.3.0
   */
  optimize(plan: IntentPlan): IntentPlan {
    // Group steps by execution level
    const levels = new Map<number, PlannedStep[]>();
    for (const step of plan.steps) {
      if (!levels.has(step.executionOrder)) levels.set(step.executionOrder, []);
      levels.get(step.executionOrder)!.push(step);
    }

    // Within each level, sort by estimated latency descending
    // (start slowest first for better parallelization)
    const optimizedSteps: PlannedStep[] = [];
    for (const [, stepsAtLevel] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
      stepsAtLevel.sort((a, b) => (b.estimatedLatencyMs ?? 0) - (a.estimatedLatencyMs ?? 0));
      optimizedSteps.push(...stepsAtLevel);
    }

    return {
      ...plan,
      steps: optimizedSteps,
    };
  }

  /* ── Cycle detection ── */

  private detectCycles(steps: IntentStep[], adjList: Map<string, Set<string>>): void {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const colors = new Map<string, number>();
    const parent = new Map<string, string | null>();

    for (const step of steps) {
      colors.set(step.id, WHITE);
      parent.set(step.id, null);
    }

    const dfs = (node: string): void => {
      colors.set(node, GRAY);

      for (const neighbor of adjList.get(node) ?? []) {
        if (colors.get(neighbor) === GRAY) {
          // Back edge — cycle found
          const cycle = [neighbor, node];
          let curr: string | null | undefined = node;
          while (curr && curr !== neighbor) {
            curr = parent.get(curr);
            if (curr) cycle.push(curr);
          }
          throw new CyclicDependencyError(cycle.reverse());
        }
        if (colors.get(neighbor) === WHITE) {
          parent.set(neighbor, node);
          dfs(neighbor);
        }
      }

      colors.set(node, BLACK);
    };

    for (const step of steps) {
      if (colors.get(step.id) === WHITE) {
        dfs(step.id);
      }
    }
  }
}
