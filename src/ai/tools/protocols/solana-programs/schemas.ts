/**
 * @module ai/tools/protocols/solana-programs/schemas
 * @description Solana Native Programs — Zod schemas for AI agent instruction building.
 *
 * Covers:
 *  - System Program      (4 methods — transfer, createAccount, allocate, assign)
 *  - SPL Token            (7 methods — transfer, transferChecked, approve, revoke, mintTo, burn, closeAccount)
 *  - Associated Token     (2 methods — create, createIdempotent)
 *  - Compute Budget       (2 methods — setComputeUnitLimit, setComputeUnitPrice)
 *  - Memo                 (1 method  — addMemo)
 *
 * Total: 16 instruction-building tools for AI agents.
 *
 * @since 1.1.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../shared';

const { register, methods } = createMethodRegistry('solana-programs');

/* ═══════════════════════════════════════════════════════════════
 *  Shared Zod primitives
 * ═══════════════════════════════════════════════════════════════ */

const zPubkey   = z.string().describe('Solana public key (base58)');
const zLamports = z.string().describe('Amount in lamports (as string, e.g. "1000000000" = 1 SOL)');
const zAmount   = z.string().describe('Raw token amount (as string, no decimals applied)');

/** Common output shape: a serialised TransactionInstruction */
const zInstructionOutput = z.object({
  programId: z.string().describe('Program ID that processes this instruction'),
  keys: z.array(z.object({
    pubkey: z.string(),
    isSigner: z.boolean(),
    isWritable: z.boolean(),
  })).describe('Ordered account inputs'),
  data: z.string().describe('Base64-encoded instruction data'),
});

/* ═══════════════════════════════════════════════════════════════
 *  1. System Program — native SOL operations
 * ═══════════════════════════════════════════════════════════════ */

register(
  'systemTransfer',
  z.object({
    from: zPubkey.describe('Sender wallet (signer)'),
    to: zPubkey.describe('Recipient wallet'),
    lamports: zLamports,
  }),
  zInstructionOutput,
  'Transfer SOL between two wallets. Returns a serialised System Program transfer instruction.',
);

register(
  'systemCreateAccount',
  z.object({
    from: zPubkey.describe('Funding wallet (signer)'),
    newAccount: zPubkey.describe('New account public key (signer)'),
    lamports: zLamports.describe('Lamports to fund the new account'),
    space: z.number().int().min(0).describe('Bytes to allocate for account data'),
    programId: zPubkey.describe('Owner program of the new account'),
  }),
  zInstructionOutput,
  'Create a new Solana account with allocated space and program owner.',
);

register(
  'systemAllocate',
  z.object({
    account: zPubkey.describe('Account to allocate (signer)'),
    space: z.number().int().min(0).describe('Bytes to allocate'),
  }),
  zInstructionOutput,
  'Allocate data space for an existing account without funding or assigning owner.',
);

register(
  'systemAssign',
  z.object({
    account: zPubkey.describe('Account to assign (signer)'),
    programId: zPubkey.describe('New owner program'),
  }),
  zInstructionOutput,
  'Assign an account to a different program owner.',
);

/* ═══════════════════════════════════════════════════════════════
 *  2. SPL Token — token operations
 * ═══════════════════════════════════════════════════════════════ */

register(
  'tokenTransfer',
  z.object({
    source: zPubkey.describe('Source token account'),
    destination: zPubkey.describe('Destination token account'),
    owner: zPubkey.describe('Owner of source account (signer)'),
    amount: zAmount,
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Transfer tokens (unchecked). Prefer tokenTransferChecked for safety.',
);

register(
  'tokenTransferChecked',
  z.object({
    source: zPubkey.describe('Source token account'),
    mint: zPubkey.describe('Token mint (for decimal verification)'),
    destination: zPubkey.describe('Destination token account'),
    owner: zPubkey.describe('Owner of source account (signer)'),
    amount: zAmount,
    decimals: z.number().int().min(0).max(18).describe('Expected mint decimals'),
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Transfer tokens with decimal verification (recommended). The mint decimals must match.',
);

register(
  'tokenApprove',
  z.object({
    account: zPubkey.describe('Token account'),
    delegate: zPubkey.describe('Delegate to approve'),
    owner: zPubkey.describe('Owner of token account (signer)'),
    amount: zAmount.describe('Max amount delegate can spend'),
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Approve a delegate to spend tokens from the account.',
);

register(
  'tokenRevoke',
  z.object({
    account: zPubkey.describe('Token account'),
    owner: zPubkey.describe('Owner (signer)'),
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Revoke a previously approved delegate.',
);

register(
  'tokenMintTo',
  z.object({
    mint: zPubkey.describe('Token mint'),
    destination: zPubkey.describe('Destination token account'),
    authority: zPubkey.describe('Mint authority (signer)'),
    amount: zAmount,
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Mint new tokens to a destination account. Requires mint authority.',
);

register(
  'tokenBurn',
  z.object({
    account: zPubkey.describe('Token account to burn from'),
    mint: zPubkey.describe('Token mint'),
    owner: zPubkey.describe('Owner of token account (signer)'),
    amount: zAmount,
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Burn tokens from a token account, reducing total supply.',
);

register(
  'tokenCloseAccount',
  z.object({
    account: zPubkey.describe('Token account to close'),
    destination: zPubkey.describe('Wallet to receive remaining SOL rent'),
    owner: zPubkey.describe('Owner (signer)'),
    programId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Close a token account and reclaim the SOL rent.',
);

/* ═══════════════════════════════════════════════════════════════
 *  3. Associated Token Account — ATA creation
 * ═══════════════════════════════════════════════════════════════ */

register(
  'ataCreate',
  z.object({
    payer: zPubkey.describe('Payer for account creation (signer)'),
    associatedToken: zPubkey.describe('The ATA address (derived deterministically)'),
    owner: zPubkey.describe('Wallet owner of the new ATA'),
    mint: zPubkey.describe('Token mint'),
    tokenProgramId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Create a new Associated Token Account. Fails if the ATA already exists.',
);

register(
  'ataCreateIdempotent',
  z.object({
    payer: zPubkey.describe('Payer for account creation (signer)'),
    associatedToken: zPubkey.describe('The ATA address (derived deterministically)'),
    owner: zPubkey.describe('Wallet owner of the ATA'),
    mint: zPubkey.describe('Token mint'),
    tokenProgramId: zPubkey.optional().describe('Token program ID (default: SPL Token v1)'),
  }),
  zInstructionOutput,
  'Create an ATA idempotently — succeeds even if the account already exists (recommended).',
);

/* ═══════════════════════════════════════════════════════════════
 *  4. Compute Budget — priority fees & resource allocation
 * ═══════════════════════════════════════════════════════════════ */

register(
  'setComputeUnitLimit',
  z.object({
    units: z.number().int().min(1).max(1_400_000)
      .describe('Max compute units (default: 200000, max: 1400000)'),
  }),
  zInstructionOutput,
  'Set the compute unit limit for the transaction. Lower values reduce priority fees.',
);

register(
  'setComputeUnitPrice',
  z.object({
    microLamports: z.string()
      .describe('Priority fee in micro-lamports per CU (as string, e.g. "50000")'),
  }),
  zInstructionOutput,
  'Set the priority fee (price per compute unit) to improve transaction scheduling.',
);

/* ═══════════════════════════════════════════════════════════════
 *  5. Memo — attach text to transactions
 * ═══════════════════════════════════════════════════════════════ */

register(
  'addMemo',
  z.object({
    message: z.string().max(566).describe('UTF-8 memo text'),
    signer: zPubkey.optional().describe('Signer public key (makes memo validated on-chain)'),
  }),
  zInstructionOutput,
  'Attach a UTF-8 memo string to a transaction.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

/**
 * All 16 registered Solana native program methods.
 * @since 1.1.0
 */
export const solanaProgramsMethods = methods;

/**
 * Method name list for introspection.
 * @since 1.1.0
 */
export const solanaProgramsMethodNames = methods.map((m) => m.name);
