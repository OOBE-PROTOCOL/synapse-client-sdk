import z from 'zod';

/**
 * Zod schemas for getAccountInfo RPC method.
 * These define the expected input parameters and output structure for the method,
 * enabling runtime validation and type inference. Nice for Agents that want to call this method with confidence about the data shapes.
 * This fills the gap between the raw untyped JSON-RPC layer and the strongly-typed client methods, providing a clear contract for inputs and outputs.
 */
export const Z_Inp_GetAccountInfo = z.object({
    encoding: z.enum(['base64', 'jsonParsed', 'base58', 'base64+zstd']).optional(),
    dataSlice: z.object({
        offset: z.number(),
        length: z.number(),
    }).optional(),
    commitment: z.enum(['processed', 'confirmed', 'finalized']).optional(),
    minContextSlot: z.number().optional(),
})
export const Z_Out_GetAccountInfo = z.object({
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
                program: z.string(),
                space: z.number(),
            }),
        ]),
        executable: z.boolean(),
        lamports: z.bigint(),
        owner: z.string(),
        rentEpoch: z.number(),
        space: z.number(),
    }).nullable(),
});