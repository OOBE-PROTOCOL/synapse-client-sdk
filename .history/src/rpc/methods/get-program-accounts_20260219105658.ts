/**
 * getProgramAccounts — fetch all accounts owned by a program (heavy).
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, DataSlice, AccountFilter, AccountInfo } from '../../core/types';

export interface GetProgramAccountsOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
  filters?: AccountFilter[];
  commitment?: Commitment;
  withContext?: boolean;
  minContextSlot?: number;
}

export interface ProgramAccount<D = string> {
  pubkey: Pubkey;
  account: AccountInfo<D>;
}

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
