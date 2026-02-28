/**
 * Compute Budget Program instruction encoders.
 *
 * Encodes priority fee and compute unit instructions that control
 * transaction scheduling and resource allocation.
 *
 * Program ID: `ComputeBudget111111111111111111111111111111`
 *
 * @module programs/compute-budget
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { ComputeBudget } from '@oobe-protocol-labs/synapse-client-sdk/programs';
 *
 * // Set priority fee (micro-lamports per CU)
 * const priorityIx = ComputeBudget.setComputeUnitPrice({ microLamports: 50_000n });
 *
 * // Set compute unit limit
 * const limitIx = ComputeBudget.setComputeUnitLimit({ units: 400_000 });
 * ```
 */

import { Pubkey } from '../core/types';
import type { TransactionInstruction } from './types';
import { InstructionWriter } from './types';

// ── Program ID ─────────────────────────────────────────────────

/**
 * Compute Budget Program address.
 * @since 1.1.0
 */
export const COMPUTE_BUDGET_PROGRAM = Pubkey('ComputeBudget111111111111111111111111111111');

// ── Instruction discriminators ─────────────────────────────────

/** @internal Compute Budget instruction indices */
const enum CbIx {
  RequestHeapFrame = 1,
  SetComputeUnitLimit = 2,
  SetComputeUnitPrice = 3,
  SetLoadedAccountsDataSizeLimit = 4,
}

// ── Param types ────────────────────────────────────────────────

/**
 * Params for {@link ComputeBudget.setComputeUnitLimit}.
 * @since 1.1.0
 */
export interface SetComputeUnitLimitParams {
  /** Maximum compute units for the transaction (max 1_400_000). */
  units: number;
}

/**
 * Params for {@link ComputeBudget.setComputeUnitPrice}.
 * @since 1.1.0
 */
export interface SetComputeUnitPriceParams {
  /** Priority fee in micro-lamports per compute unit. */
  microLamports: bigint;
}

/**
 * Params for {@link ComputeBudget.requestHeapFrame}.
 * @since 1.1.0
 */
export interface RequestHeapFrameParams {
  /** Heap size in bytes (must be multiple of 1024, max 256 KiB). */
  bytes: number;
}

/**
 * Params for {@link ComputeBudget.setLoadedAccountsDataSizeLimit}.
 * @since 1.1.0
 */
export interface SetLoadedAccountsDataSizeLimitParams {
  /** Maximum total loaded accounts data size in bytes. */
  bytes: number;
}

// ── ComputeBudget namespace ────────────────────────────────────

/**
 * Compute Budget Program instruction encoders.
 *
 * These instructions must be included at the **beginning** of a
 * transaction to take effect.
 *
 * @since 1.1.0
 */
export const ComputeBudget = {
  /** Compute Budget Program address. */
  programId: COMPUTE_BUDGET_PROGRAM,

  /**
   * Set the compute unit limit for the transaction.
   *
   * Default is 200_000 CU. Max is 1_400_000 CU.
   * Setting a lower limit can reduce priority fees.
   *
   * @since 1.1.0
   */
  setComputeUnitLimit(p: SetComputeUnitLimitParams): TransactionInstruction {
    const w = new InstructionWriter(5);
    w.u8(CbIx.SetComputeUnitLimit);
    w.u32(p.units);
    return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: w.toBytes() };
  },

  /**
   * Set the priority fee (price per compute unit).
   *
   * Priority fee = `microLamports × computeUnitsUsed`.
   * A value of 50_000 micro-lamports ≈ 0.05 lamports/CU.
   *
   * @since 1.1.0
   */
  setComputeUnitPrice(p: SetComputeUnitPriceParams): TransactionInstruction {
    const w = new InstructionWriter(9);
    w.u8(CbIx.SetComputeUnitPrice);
    w.u64(p.microLamports);
    return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: w.toBytes() };
  },

  /**
   * Request a larger heap frame for the transaction.
   *
   * Default heap is 32 KiB. Max is 256 KiB. Must be a multiple of 1024.
   *
   * @since 1.1.0
   */
  requestHeapFrame(p: RequestHeapFrameParams): TransactionInstruction {
    const w = new InstructionWriter(5);
    w.u8(CbIx.RequestHeapFrame);
    w.u32(p.bytes);
    return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: w.toBytes() };
  },

  /**
   * Set the maximum total size of loaded accounts data.
   *
   * @since 1.1.0
   */
  setLoadedAccountsDataSizeLimit(p: SetLoadedAccountsDataSizeLimitParams): TransactionInstruction {
    const w = new InstructionWriter(5);
    w.u8(CbIx.SetLoadedAccountsDataSizeLimit);
    w.u32(p.bytes);
    return { programId: COMPUTE_BUDGET_PROGRAM, keys: [], data: w.toBytes() };
  },
} as const;
