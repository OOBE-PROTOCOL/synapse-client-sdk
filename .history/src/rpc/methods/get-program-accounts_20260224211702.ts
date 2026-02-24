/**
 * @module rpc/methods/get-program-accounts
 * @description Returns all accounts owned by the provided program public key.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, DataSlice, AccountFilter, AccountInfo } from '../../core/types';

/**
 * Options for {@link getProgramAccounts}.
 *
 * @since 1.0.0
 */
export interface GetProgramAccountsOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
  filters?: AccountFilter[];
  commitment?: Commitment;
  withContext?: boolean;
  minContextSlot?: number;
}

/**
 * A program-owned account with its public key.
 *
 * @since 1.0.0
 */
export interface ProgramAccount<D = string> {
  pubkey: Pubkey;
  account: AccountInfo<D>;
}

/**
 * Fetch all accounts owned by the provided program public key.
 *
 * @remarks
 * This can be a heavy call — use filters and data slices to reduce response size.
 *
 * @param t - HTTP transport instance
 * @param programId - Base-58 encoded program public key
 * @param opts - Encoding, filters, commitment, and call options
 * @returns Array of program-owned accounts
 *
 * @example
 * ```ts
 * const accounts = await getProgramAccounts(transport, programId, {
 *   filters: [{ dataSize: 165 }],
 * });
 * ```
 *
 * @since 1.0.0
 */
export async function getProgramAccounts<D = string>(
  t: HttpTransport,
  programId: Pubkey,
  opts: GetProgramAccountsOpts = {}
): Promise<ProgramAccount<D>[]> {
  const { encoding, dataSlice, filters, commitment, withContext, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (dataSlice) cfg.dataSlice = dataSlice;
  if (filters) cfg.filters = filters;
  if (commitment) cfg.commitment = commitment;
  if (withContext) cfg.withContext = withContext;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getProgramAccounts', [programId, cfg], rest);
}
