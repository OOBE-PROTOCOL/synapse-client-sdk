import { z } from 'zod';

export const agentRpcMethods: AgentRpcMethod[] = [];

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