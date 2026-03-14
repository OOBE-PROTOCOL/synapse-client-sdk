/**
 * @module ai/tools/protocols/kamiyo/schemas
 * @description KAMIYO Protocol — Zod schemas for the phase-1 OOBE partner surface.
 *
 * Covers:
 *  - x402 pricing checks
 *  - x402 paid fetches
 *  - escrow creation
 *  - escrow status checks
 *
 * @since 2.0.6
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('kamiyo');

const zUrl = z.string().url().describe('Absolute HTTP(S) URL');
const zPubkey = z.string().describe('Solana wallet public key (base58)');
const zErrorCode = z.string().describe('Machine-readable error code').optional();

const zPricingOption = z.object({
  network: z.string().optional(),
  priceUsd: z.union([z.number(), z.string()]).optional(),
  asset: z.string().optional(),
  description: z.string().optional(),
});

const zPricingResult = z.object({
  success: z.boolean(),
  free: z.boolean().optional(),
  options: z.array(zPricingOption).optional(),
  error: z.string().optional(),
  code: zErrorCode,
});

const zPaymentSummary = z.object({
  network: z.string(),
  amountUsd: z.number(),
  asset: z.string(),
  signature: z.string().optional(),
});

const zEscrowStatusResult = z.object({
  success: z.boolean(),
  status: z.string().optional(),
  agent: z.string().optional(),
  api: z.string().optional(),
  amount: z.number().optional(),
  createdAt: z.number().optional(),
  expiresAt: z.number().optional(),
  transactionId: z.string().optional(),
  error: z.string().optional(),
  code: zErrorCode,
});

register(
  'x402CheckPricing',
  z.object({
    url: zUrl.describe('KAMIYO-paid resource URL to inspect'),
  }),
  zPricingResult,
  'Check whether a KAMIYO x402 resource is free or requires payment, and return available payment options.',
  { httpMethod: 'GET', path: '/x402/pricing' },
);

register(
  'x402Fetch',
  z.object({
    url: zUrl.describe('KAMIYO-paid resource URL to fetch'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('HTTP method (default GET)'),
    body: z.string().optional().describe('Optional raw request body. JSON must be stringified before sending'),
    headers: z.record(z.string(), z.string()).optional().describe('Optional request headers forwarded to KAMIYO'),
  }),
  z.object({
    success: z.boolean(),
    paid: z.boolean().optional(),
    data: z.unknown().optional(),
    summary: z.string().optional(),
    payment: zPaymentSummary.optional(),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Fetch a KAMIYO x402 resource with automatic payment handling through the KAMIYO partner API.',
  { httpMethod: 'POST', path: '/x402/fetch' },
);

register(
  'createEscrow',
  z.object({
    api: zPubkey.describe('API provider wallet to receive funds if escrow settles successfully'),
    amount: z.number().positive().describe('Escrow amount in SOL'),
    timeLock: z.number().int().min(3600).max(2_592_000).optional().describe('Expiry in seconds (default 3600)'),
  }),
  z.object({
    success: z.boolean(),
    escrowAddress: z.string().optional(),
    transactionId: z.string().optional(),
    signature: z.string().optional(),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Create a KAMIYO escrow for a provider interaction with optional timelock.',
  { httpMethod: 'POST', path: '/escrows' },
);

register(
  'checkEscrowStatus',
  z.object({
    escrowAddress: z.string().optional().describe('Escrow PDA address'),
    transactionId: z.string().optional().describe('Escrow transaction ID'),
  }).refine(
    (value) => Boolean(value.escrowAddress || value.transactionId),
    { message: 'escrowAddress or transactionId is required' },
  ),
  zEscrowStatusResult,
  'Fetch the current state of a KAMIYO escrow by transaction ID or escrow address.',
  { httpMethod: 'GET', path: '/escrows/status' },
);

export const kamiyoMethods = methods;

export const kamiyoMethodNames = methods.map((method) => method.name) as readonly string[];
