import z from 'zod';
import { registerRpcMethod } from '.';
import { PublicKey } from '@solana/web3.js';

export interface AgentRpcMethod {
    name: string;
    description?: string;
    input: z.ZodTypeAny;
    output: z.ZodTypeAny;
}

/**
 * Zod schemas for getAccountInfo RPC method.
 * These define the expected input parameters and output structure for the method,
 * enabling runtime validation and type inference. Nice for Agents that want to call this method with confidence about the data shapes.
 * This fills the gap between the raw untyped JSON-RPC layer and the strongly-typed client methods, providing a clear contract for inputs and outputs.
 */
const Z_Inp_GetAccountInfo = z.object({
    pubkey: z.instanceof(PublicKey),
    encoding: z.enum(['base64', 'jsonParsed', 'base58', 'base64+zstd']).optional(),
    dataSlice: z.object({
        offset: z.number(),
        length: z.number(),
    }).optional(),
    commitment: z.enum(['processed', 'confirmed', 'finalized']).optional(),
    minContextSlot: z.number().optional(),
})
const Z_Out_GetAccountInfo = z.object({
    context: z.object({
        slot: z.number(),
        apiVersion: z.string().optional(),
    }),
    value: z.object({
        data: z.union([
            z.string(),
            z.tuple([z.string(), z.enum(['base64', 'jsonParsed', 'base58', 'base64+zstd'])]),
            z.object({
                parsed: z.unknown(),
                program: z.instanceof(PublicKey),
                space: z.number(),
            }),
        ]),
        executable: z.boolean(),
        lamports: z.bigint(),
        owner: z.instanceof(PublicKey),
        rentEpoch: z.number(),
        space: z.number(),
    }).nullable(),
});

export const z_GetAccountInfo = registerRpcMethod(
    'getAccountInfo',
    Z_Inp_GetAccountInfo,
    Z_Out_GetAccountInfo,
    'Retrieves account information for a given account address.'
);

const Z_Inp_GetBalance = z.object({
    commitment: z.enum(['processed', 'confirmed', 'finalized']).optional(),
    minContextSlot: z.number().optional(),
    pubkey: z.instanceof(PublicKey),
});