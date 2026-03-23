/**
 * @module ai/tools/protocols/invoica
 * @description Invoica — Zod schemas for x402 invoice middleware integration.
 * Covers: invoice creation, invoice lookup, settlement verification, SAP escrow detection.
 * Invoica is the Financial OS for the Agent Economy — Stripe for AI Agents.
 * @see https://invoica.ai
 * @since 2.1.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('invoica');

const zErrorCode = z.string().describe('Machine-readable error code').optional();

// ── Shared result shapes ────────────────────────────────────────────────────

const zInvoiceStatus = z.enum([
  'pending',
  'paid',
  'overdue',
  'cancelled',
]).describe('Invoice lifecycle status');

const zInvoiceRecord = z.object({
  id: z.string().describe('Invoica invoice UUID'),
  status: zInvoiceStatus,
  amount: z.number().describe('Invoice amount in USDC'),
  currency: z.string().describe('Currency code (default USDC)'),
  recipientAddress: z.string().describe('Recipient wallet address'),
  payerAddress: z.string().optional().describe('Payer wallet address when known'),
  txId: z.string().optional().describe('On-chain transaction ID/signature confirming payment'),
  chainId: z.string().optional().describe('Chain where payment was detected'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  paidAt: z.string().optional().describe('ISO 8601 payment confirmation timestamp'),
  description: z.string().optional(),
});

// ── createInvoice ────────────────────────────────────────────────────────────

register(
  'createInvoice',
  z.object({
    recipientAddress: z
      .string()
      .describe('Wallet address that should receive the payment (your address)'),
    amount: z
      .number()
      .positive()
      .describe('Amount in USDC to invoice for'),
    description: z
      .string()
      .max(500)
      .optional()
      .describe('Human-readable description of the service or product invoiced'),
    payerAgentId: z
      .string()
      .optional()
      .describe('Wallet address or agent ID of the payer — enables trust-gate scoring'),
    dueDate: z
      .string()
      .optional()
      .describe('ISO 8601 due date (e.g. 2026-04-01T00:00:00Z)'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Arbitrary key-value metadata attached to the invoice'),
  }),
  z.object({
    success: z.boolean(),
    invoiceId: z.string().optional().describe('Invoica invoice UUID'),
    status: zInvoiceStatus.optional(),
    invoiceUrl: z.string().url().optional().describe('Shareable URL to view/pay the invoice'),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Create a new x402 invoice. Returns an invoice ID and shareable payment URL. '
  + 'The payerAgentId enables Helixa trust-gate scoring — agents below the Junk tier (0-25) are rejected.',
  { httpMethod: 'POST', path: '/invoices' },
);

// ── getInvoice ───────────────────────────────────────────────────────────────

register(
  'getInvoice',
  z.object({
    invoiceId: z.string().describe('Invoica invoice UUID returned by createInvoice'),
  }),
  z.object({
    success: z.boolean(),
    invoice: zInvoiceRecord.optional(),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Retrieve the current status and details of an invoice by its ID. '
  + 'Poll this to check whether a pending invoice has been paid.',
  { httpMethod: 'GET', path: '/invoices/:invoiceId' },
);

// ── checkSettlement ──────────────────────────────────────────────────────────

register(
  'checkSettlement',
  z.object({
    txId: z
      .string()
      .describe('On-chain transaction hash (EVM) or signature (Solana) to verify'),
    chainId: z
      .string()
      .describe('Chain identifier: "base", "polygon", or "solana"'),
    recipientAddress: z
      .string()
      .optional()
      .describe('Expected recipient address — used to confirm the payment destination'),
    expectedAmountUsdc: z
      .number()
      .optional()
      .describe('Minimum USDC amount required for settlement to be valid'),
  }),
  z.object({
    success: z.boolean(),
    settled: z.boolean().optional().describe('true if payment confirmed on-chain'),
    amount: z.number().optional().describe('USDC amount transferred'),
    from: z.string().optional().describe('Sender wallet address'),
    to: z.string().optional().describe('Recipient wallet address'),
    blockNumber: z.number().optional(),
    timestamp: z.number().optional().describe('Block timestamp (Unix seconds)'),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Verify that a specific on-chain transaction is a valid USDC payment to the expected recipient. '
  + 'Supports Base (EVM), Polygon (EVM), and Solana.',
  { httpMethod: 'GET', path: '/settlements/:txId' },
);

// ── detectSapSettlement ──────────────────────────────────────────────────────

register(
  'detectSapSettlement',
  z.object({
    txSignature: z
      .string()
      .describe('Solana transaction signature to inspect for SAP escrow settlement'),
    rpcUrl: z
      .string()
      .url()
      .optional()
      .describe('Solana RPC URL (defaults to mainnet-beta)'),
  }),
  z.object({
    success: z.boolean(),
    match: z
      .object({
        txSignature: z.string(),
        sapProgramId: z.string().describe('SAP escrow program address'),
        amount: z.number().describe('Settled USDC amount'),
        from: z.string().describe('Payer wallet'),
        to: z.string().describe('Invoica recipient wallet'),
        slot: z.number().optional(),
        blockTime: z.number().optional(),
      })
      .nullable()
      .describe('SAP escrow match details, or null if not a SAP settlement'),
    error: z.string().optional(),
    code: zErrorCode,
  }),
  'Detect whether a Solana transaction is a Synapse Agent Protocol (SAP) x402 escrow settlement. '
  + 'Uses discriminator-based detection against SAP program SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ. '
  + 'Returns SapEscrowMatch or null — never throws.',
  { httpMethod: 'POST', path: '/sap/detect' },
);

export const invoicaMethods = methods;
export const invoicaMethodNames = methods.map((m) => m.name) as readonly string[];
