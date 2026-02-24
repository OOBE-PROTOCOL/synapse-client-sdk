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

/** Public immutable view of registered methods. */
export const agentRpcMethods: AgentRpcMethod[] = _registry ?? [];

/**
 * Registers an RPC method with the given name, input and output schemas, and an optional description.
 * This allows Agents to discover and call these methods with confidence about the expected data shapes.
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