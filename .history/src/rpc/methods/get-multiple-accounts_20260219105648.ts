/**
 * getMultipleAccounts — batch account fetch (max 100 per call).
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, DataSlice, RpcContext, AccountInfo } from '../../core/types';

export interface GetMultipleAccountsOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
  commitment?: Commitment;
}

export async function getMultipleAccounts<D = string>(
  t: HttpTransport,
  pubkeys: Pubkey[],
  opts: GetMultipleAccountsOpts = {}
): Promise<RpcContext<(AccountInfo<D> | null)[]>> {
  const { encoding, dataSlice, commitment, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (dataSlice) cfg.dataSlice = dataSlice;
  if (commitment) cfg.commitment = commitment;
  return t.request('getMultipleAccounts', [pubkeys, cfg], rest);
}
