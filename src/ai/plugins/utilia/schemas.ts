/**
 * @module ai/plugins/utilia/schemas
 * @description Zod schemas for Utilia's paid Solana evidence tools.
 *
 * @since 2.1.0
 */
import { z } from "zod";
import { createMethodRegistry } from "../../tools/protocols/shared";

const zBase58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/);
const zSignature = zBase58
  .min(64)
  .max(88)
  .describe("Public Solana transaction signature");
const zPubkey = zBase58
  .min(32)
  .max(44)
  .describe("Solana account or mint address");
const zClassification = z.object({
  category: z.enum([
    "none",
    "slippage",
    "insufficient_funds",
    "compute_budget",
    "expired_blockhash",
    "account_conflict",
    "program_error",
    "unknown",
  ]),
  summary: z.string(),
  suggestedAction: z.string().nullable(),
});

const { register: registerUtilia, methods: utiliaMethods } =
  createMethodRegistry("utilia");

registerUtilia(
  "priorityFees",
  z.object({
    accounts: z.array(zPubkey).max(20).optional().default([]),
  }),
  z.object({
    observedAt: z.string(),
    accounts: z.array(z.string()),
    sampleCount: z.number().int(),
    minMicroLamports: z.number().int(),
    lowMicroLamports: z.number().int(),
    mediumMicroLamports: z.number().int(),
    highMicroLamports: z.number().int(),
    urgentMicroLamports: z.number().int(),
    maxMicroLamports: z.number().int(),
    note: z.string(),
  }),
  "Fetch live Solana priority-fee quantiles from Utilia for $0.002 USDC via x402. Requires action-time payment approval.",
);

registerUtilia(
  "transactionDiagnosis",
  z.object({
    signature: zSignature,
  }),
  z.object({
    signature: z.string().nullable(),
    slot: z.number().int(),
    blockTime: z.number().int().nullable().optional(),
    succeeded: z.boolean(),
    feeLamports: z.number().int().nullable().optional(),
    computeUnitsConsumed: z.number().int().nullable().optional(),
    classification: zClassification,
    solBalanceChanges: z.array(z.unknown()),
    tokenBalanceChanges: z.array(z.unknown()),
    logs: z.array(z.string()),
    rawError: z.unknown().optional(),
    confirmation: z.unknown().nullable(),
  }),
  "Explain a confirmed or failed Solana transaction with balance deltas, logs, compute use, and a retry-safe failure class for $0.004 USDC via x402.",
);

registerUtilia(
  "tokenRisk",
  z.object({
    mint: zPubkey,
  }),
  z.object({
    mint: z.string(),
    program: z.string().nullable(),
    ownerProgram: z.string(),
    decimals: z.number().int().nullable().optional(),
    supplyRaw: z.string().nullable(),
    initialized: z.boolean().nullable().optional(),
    mintAuthority: z.string().nullable().optional(),
    freezeAuthority: z.string().nullable().optional(),
    token2022Extensions: z.array(z.string()),
    top10HolderPercent: z.number().optional(),
    largestAccounts: z.array(z.unknown()),
    riskFlags: z.array(z.string()),
    holderDataAvailable: z.boolean().optional(),
    caution: z.string(),
  }),
  "Inspect an SPL mint for authorities, Token-2022 controls, holder concentration, and risk flags for $0.006 USDC via x402.",
);

registerUtilia(
  "simulateTransaction",
  z.object({
    transaction: z.string().min(1).describe("Unsigned serialized transaction"),
    encoding: z.enum(["base64", "base58"]).optional().default("base64"),
    accountAddresses: z.array(zPubkey).max(20).optional(),
  }),
  z.object({
    slot: z.number().int(),
    succeeded: z.boolean(),
    unitsConsumed: z.number().int().nullable(),
    classification: zClassification,
    logs: z.array(z.string()),
    rawError: z.unknown().optional(),
    replacementBlockhash: z.unknown().nullable().optional(),
    accounts: z.array(z.unknown()).nullable().optional(),
    returnData: z.unknown().optional(),
  }),
  "Simulate and classify an unsigned Solana transaction before signing for $0.008 USDC via x402.",
);

export { utiliaMethods };
export const utiliaMethodNames = utiliaMethods.map((method) => method.name);
