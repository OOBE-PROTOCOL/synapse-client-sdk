import { z } from 'zod';
import type { AgentRpcMethod } from './types';

export type { AgentRpcMethod } from './types';

/**
 * Central registry — populated by side-effect import of `./types`.
 *
 * Uses `var` intentionally so the binding is hoisted above the
 * side-effect `import './types'` at the bottom of this file.
 * With `const`/`let`, ESM hoists static imports above variable
 * initialisers, causing a Temporal Dead Zone error when `types.ts`
 * calls `registerRpcMethod()` during module evaluation.
 */
// eslint-disable-next-line no-var
export var agentRpcMethods: AgentRpcMethod[] = [];

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
  const method: AgentRpcMethod = { name, input, output, description };
  agentRpcMethods.push(method);
  return method;
}

/* Side-effect import: executes all registerRpcMethod() calls. */
import './types';