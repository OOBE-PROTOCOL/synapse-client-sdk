/**
 * @module ai/intents/parser
 * @description Cross-Protocol Intent Parser — validates and normalizes intents.
 *
 * Validates intent structure, auto-detects dependencies from `$stepId.field`
 * references, checks for duplicate IDs, and verifies all referenced steps exist.
 *
 * @example
 * ```ts
 * import { IntentParser } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const parser = new IntentParser({ maxSteps: 20 });
 *
 * const result = parser.parse({
 *   steps: [
 *     { id: 'quote', protocol: 'jupiter', method: 'getQuote', params: { inputMint: 'So11...', outputMint: 'EPjF...' } },
 *     { id: 'swap', protocol: 'jupiter', method: 'smartSwap', params: { amount: '$quote.outAmount' }, dependsOn: ['quote'] },
 *   ],
 * });
 *
 * if (result.valid) {
 *   console.log(result.intent); // Normalized intent with auto-generated ID
 * }
 * ```
 *
 * @since 1.3.0
 */

import { randomUUID } from 'crypto';
import type { Intent, IntentStep, StepReference } from './types';
import { IntentError } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Validation Result
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Result of intent validation.
 * @since 1.3.0
 */
export interface ValidationResult {
  /** Whether the intent is valid. */
  valid: boolean;
  /** Validation errors (empty if valid). */
  errors: string[];
  /** Warnings that don't prevent execution. */
  warnings: string[];
  /** The normalized intent (only present if valid). */
  intent?: Intent;
}

/* ═══════════════════════════════════════════════════════════════
 *  IntentParser
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Parser configuration options.
 * @since 1.3.0
 */
export interface ParserConfig {
  /** Maximum allowed steps. @default 20 */
  maxSteps?: number;
  /** Allowed protocols. When set, steps with unknown protocols are rejected. */
  allowedProtocols?: string[];
  /** Whether to auto-infer dependencies from `$ref` params. @default true */
  autoInferDeps?: boolean;
}

/**
 * @description Validates, normalizes, and enriches intent definitions.
 *
 * Performs:
 * 1. Structural validation (required fields, types)
 * 2. Dependency detection from `$stepId.field` references
 * 3. Duplicate ID detection
 * 4. Forward-reference detection (step references future step)
 * 5. Missing reference detection
 *
 * @since 1.3.0
 */
export class IntentParser {
  private readonly config: Required<ParserConfig>;

  /**
   * @param {ParserConfig} [config] - Parser configuration
   */
  constructor(config?: ParserConfig) {
    this.config = {
      maxSteps: config?.maxSteps ?? 20,
      allowedProtocols: config?.allowedProtocols ?? [],
      autoInferDeps: config?.autoInferDeps ?? true,
    };
  }

  /**
   * @description Parse and validate an intent definition.
   *
   * @param {Intent} intent - Raw intent to parse
   * @returns {ValidationResult} Validation result with normalized intent
   *
   * @example
   * ```ts
   * const result = parser.parse(myIntent);
   * if (!result.valid) {
   *   console.error('Errors:', result.errors);
   * }
   * ```
   *
   * @since 1.3.0
   */
  parse(intent: Intent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Basic structure ──
    if (!intent.steps || !Array.isArray(intent.steps)) {
      return { valid: false, errors: ['Intent must have a "steps" array'], warnings };
    }

    if (intent.steps.length === 0) {
      return { valid: false, errors: ['Intent must have at least one step'], warnings };
    }

    if (intent.steps.length > this.config.maxSteps) {
      errors.push(`Too many steps: ${intent.steps.length} (max: ${this.config.maxSteps})`);
    }

    // ── Step validation ──
    const stepIds = new Set<string>();
    const stepOrder = new Map<string, number>(); // stepId → index

    for (let i = 0; i < intent.steps.length; i++) {
      const step = intent.steps[i];

      // Required fields
      if (!step.id) {
        errors.push(`Step at index ${i} is missing "id"`);
        continue;
      }
      if (!step.protocol) {
        errors.push(`Step '${step.id}' is missing "protocol"`);
      }
      if (!step.method) {
        errors.push(`Step '${step.id}' is missing "method"`);
      }

      // Duplicate ID
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: '${step.id}'`);
      }
      stepIds.add(step.id);
      stepOrder.set(step.id, i);

      // Allowed protocols
      if (
        this.config.allowedProtocols.length > 0 &&
        step.protocol &&
        !this.config.allowedProtocols.includes(step.protocol)
      ) {
        errors.push(`Step '${step.id}' uses unknown protocol '${step.protocol}'. Allowed: ${this.config.allowedProtocols.join(', ')}`);
      }
    }

    // ── Reference validation & dependency inference ──
    const normalizedSteps: IntentStep[] = [];

    for (const step of intent.steps) {
      if (!step.id) continue;

      const inferredDeps = new Set<string>(step.dependsOn ?? []);

      // Scan params for $references
      if (step.params && this.config.autoInferDeps) {
        for (const [key, value] of Object.entries(step.params)) {
          if (typeof value === 'string' && value.startsWith('$')) {
            const refStepId = value.slice(1).split('.')[0];

            // Check reference exists
            if (!stepIds.has(refStepId)) {
              errors.push(`Step '${step.id}' references unknown step '${refStepId}' in param '${key}'`);
            }

            // Check for forward references
            const refIndex = stepOrder.get(refStepId);
            const stepIndex = stepOrder.get(step.id);
            if (refIndex !== undefined && stepIndex !== undefined && refIndex >= stepIndex) {
              warnings.push(`Step '${step.id}' references step '${refStepId}' which appears later — ensure dependency order is correct`);
            }

            inferredDeps.add(refStepId);
          }
        }
      }

      // Check explicit deps exist
      for (const dep of step.dependsOn ?? []) {
        if (!stepIds.has(dep)) {
          errors.push(`Step '${step.id}' depends on unknown step '${dep}'`);
        }
      }

      normalizedSteps.push({
        ...step,
        dependsOn: [...inferredDeps],
        params: step.params ?? {},
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // ── Return normalized intent ──
    const normalized: Intent = {
      id: intent.id ?? randomUUID(),
      description: intent.description,
      steps: normalizedSteps,
      options: intent.options ?? {},
    };

    return { valid: true, errors: [], warnings, intent: normalized };
  }

  /**
   * @description Extract all step references from an intent step's params.
   *
   * @param {IntentStep} step - Step to analyze
   * @returns {Array<{ param: string; ref: string; stepId: string; fieldPath: string[] }>}
   *   Array of reference details
   *
   * @since 1.3.0
   */
  extractReferences(step: IntentStep): Array<{
    param: string;
    ref: string;
    stepId: string;
    fieldPath: string[];
  }> {
    const refs: Array<{ param: string; ref: string; stepId: string; fieldPath: string[] }> = [];

    for (const [key, value] of Object.entries(step.params ?? {})) {
      if (typeof value === 'string' && value.startsWith('$')) {
        const parts = value.slice(1).split('.');
        refs.push({
          param: key,
          ref: value,
          stepId: parts[0],
          fieldPath: parts.slice(1),
        });
      }
    }

    return refs;
  }
}
