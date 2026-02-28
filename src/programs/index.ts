/**
 * Native Solana instruction encoders.
 *
 * Zero-dependency encoders for the core Solana programs: System, SPL Token,
 * Associated Token Account, Memo, and Compute Budget.
 *
 * Each encoder produces a {@link TransactionInstruction} that can be used
 * with the SDK's transaction building utilities or converted to a
 * `@solana/kit` instruction via {@link toKitInstruction}.
 *
 * @module programs
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import {
 *   SystemProgram, SplToken, AssociatedToken,
 *   ComputeBudget, Memo,
 * } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { Pubkey, Lamports } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * // SOL transfer
 * const transferIx = SystemProgram.transfer({
 *   from: Pubkey('Sender...'),
 *   to: Pubkey('Receiver...'),
 *   lamports: Lamports(1_000_000_000n),
 * });
 *
 * // SPL Token transfer
 * const tokenIx = SplToken.transferChecked({
 *   source: Pubkey('SrcTokenAcct...'),
 *   mint: Pubkey('Mint...'),
 *   destination: Pubkey('DstTokenAcct...'),
 *   owner: Pubkey('Wallet...'),
 *   amount: 1_000_000n,
 *   decimals: 6,
 * });
 *
 * // Priority fee
 * const feeIx = ComputeBudget.setComputeUnitPrice({ microLamports: 50_000n });
 * ```
 */

// ── Types & Writer ─────────────────────────────────────────────
export {
  type AccountMeta,
  type TransactionInstruction,
  InstructionWriter,
  decodeBase58,
  writableSigner,
  writable,
  readonlySigner,
  readonly,
} from './types';

// ── System Program ─────────────────────────────────────────────
export {
  SystemProgram,
  SYSTEM_PROGRAM,
  type TransferParams as SystemTransferParams,
  type CreateAccountParams,
  type AssignParams,
  type AllocateParams,
  type CreateAccountWithSeedParams,
  type AdvanceNonceParams,
  type WithdrawNonceParams,
  type InitializeNonceParams,
  type AuthorizeNonceParams,
} from './system';

// ── SPL Token ──────────────────────────────────────────────────
export {
  SplToken,
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  type InitializeMintParams,
  type InitializeAccountParams,
  type TransferParams as TokenTransferParams,
  type TransferCheckedParams,
  type ApproveParams,
  type ApproveCheckedParams,
  type RevokeParams,
  type MintToParams,
  type MintToCheckedParams,
  type BurnParams,
  type BurnCheckedParams,
  type CloseAccountParams,
  type FreezeThawParams,
  type SyncNativeParams,
} from './spl-token';

// ── Associated Token Account ───────────────────────────────────
export {
  AssociatedToken,
  ASSOCIATED_TOKEN_PROGRAM,
  type CreateATAParams,
  type RecoverNestedParams,
} from './associated-token';

// ── Memo ───────────────────────────────────────────────────────
export {
  Memo,
  MEMO_PROGRAM_V2,
  MEMO_PROGRAM_V1,
  type AddMemoParams,
} from './memo';

// ── Compute Budget ─────────────────────────────────────────────
export {
  ComputeBudget,
  COMPUTE_BUDGET_PROGRAM,
  type SetComputeUnitLimitParams,
  type SetComputeUnitPriceParams,
  type RequestHeapFrameParams,
  type SetLoadedAccountsDataSizeLimitParams,
} from './compute-budget';

// ── Kit bridge ─────────────────────────────────────────────────

import type { TransactionInstruction } from './types';
import { decodeBase58 } from './types';
import type { Address, Instruction, AccountMeta as KitAccountMeta } from '@solana/kit';
import { address as kitAddress, AccountRole } from '@solana/kit';

/**
 * Convert a Synapse {@link TransactionInstruction} to a `@solana/kit`
 * `IInstruction` for use with Kit's transaction builder.
 *
 * @param ix - Synapse instruction to convert.
 * @returns Kit-compatible instruction.
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { SystemProgram, toKitInstruction } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 * import { pipe, createTransactionMessage, appendTransactionMessageInstruction } from '@oobe-protocol-labs/synapse-client-sdk/kit';
 *
 * const ix = SystemProgram.transfer({ from, to, lamports: 1_000_000_000n });
 * const kitIx = toKitInstruction(ix);
 *
 * const msg = pipe(
 *   createTransactionMessage({ version: 0 }),
 *   m => appendTransactionMessageInstruction(kitIx, m),
 * );
 * ```
 */
export function toKitInstruction(ix: TransactionInstruction): Instruction {
  return {
    programAddress: kitAddress(ix.programId as unknown as string) as Address,
    accounts: ix.keys.map<KitAccountMeta>((k) => ({
      address: kitAddress(k.pubkey as unknown as string) as Address,
      role: k.isSigner
        ? (k.isWritable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER)
        : (k.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY),
    })),
    data: ix.data,
  };
}
