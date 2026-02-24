/**
 * @module ai/tools/zod
 * @description Zod schema registry for Solana RPC methods.
 *
 * Provides a registration system for RPC method schemas that agents
 * can use for input validation and discovery. Each method is registered
 * with Zod input/output schemas and a human-readable description.
 *
 * @since 1.0.0
 */

/* Side-effect import: executes all registerRpcMethod() calls.
 * MUST come before `agentRpcMethods` declaration so that in ESM
 * module evaluation (where imports are hoisted), the types module
 * runs first and populates `_registry` via `registerRpcMethod()`. */
import './types';

import { z } from 'zod';
import type { AgentRpcMethod } from './types';

export type { AgentRpcMethod } from './types';

/**
 * Internal mutable registry — populated during module evaluation by
 * `registerRpcMethod()` calls originating from `./types`.
 *
 * We keep a module-scoped array that `registerRpcMethod` pushes into.
 * Because `_registry` is initialised via `var` (hoisted, so it exists
 * as `undefined` during import evaluation), the `registerRpcMethod`
 * function creates the array on first call to avoid the TDZ issue.
 */
// eslint-disable-next-line no-var
var _registry: AgentRpcMethod[] | undefined;

/**
 * @description Public immutable view of all registered Solana RPC method schemas.
 * Populated during module evaluation by `registerRpcMethod()` calls from `./types`.
 * @since 1.0.0
 */
export const agentRpcMethods: AgentRpcMethod[] = _registry ?? [];

/**
 * @description Register an RPC method with Zod input/output schemas for agent discovery.
 * Called during module evaluation to populate the shared `agentRpcMethods` array.
 *
 * @template I - Zod schema type for input parameters
 * @template O - Zod schema type for output
 * @param {string} name - The JSON-RPC method name (e.g. 'getBalance')
 * @param {I} input - Zod schema for validated input parameters
 * @param {O} output - Zod schema documenting the expected output shape
 * @param {string} [description] - Human-readable description for LLM discovery
 * @returns {AgentRpcMethod} The registered method descriptor
 * @since 1.0.0
 */
export function registerRpcMethod<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  name: string,
  input: I,
  output: O,
  description?: string,
): AgentRpcMethod {
  if (!_registry) _registry = [];
  const method: AgentRpcMethod = { name, input, output, description };
  _registry.push(method);
  return method;
}