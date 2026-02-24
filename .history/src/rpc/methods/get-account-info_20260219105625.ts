/**
 * getAccountInfo — returns parsed account data for a pubkey.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, RpcContext, AccountInfo, DataSlice } from '../../core/types';

export interface GetAccountInfoOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
}

export async function getAccountInfo<D = string>(
  t: HttpTransport,
  pubkey: Pubkey,
  opts: GetAccountInfoOpts = {}
): Promise<RpcContext<AccountInfo<D> | null>> {
  const { encoding, dataSlice, commitment, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (dataSlice) cfg.dataSlice = dataSlice;
  if (commitment) cfg.commitment = commitment;
  return t.request('getAccountInfo', [pubkey, cfg], rest);
}
