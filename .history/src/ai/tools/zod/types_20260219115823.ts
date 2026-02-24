import z from 'zod';

export const Zod_GetAccountInfo = z.object({
    pubkey: z.string(),
    account: z.object({
        lamports: z.number(),
        owner: z.string(),
        executable: z.boolean(),
        rentEpoch: z.number(),
        data: z.tuple([z.string(), z.string()])
    })
})