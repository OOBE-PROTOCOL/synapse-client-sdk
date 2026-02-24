/**
 * @module rpc/methods/get-account-info
 * @description Returns parsed account data for a given public key.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, RpcContext, AccountInfo, DataSlice } from '../../core/types';

/**
 * Options for {@link getAccountInfo}.
 *
 * @since 1.0.0
 */
export interface GetAccountInfoOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
  minContextSlot?: number;
  commitment?: Commitment;
}

/**
 * Fetch parsed account data for a given public key.
 *
 * @typeParam D - The expected shape of the parsed account data
 * @param t - HTTP transport instance
 * @param pubkey - Base-58 encoded public key to query
 * @param opts - Encoding, data-slice, commitment, and other call options
 * @returns Context-wrapped account info, or `null` if the account does not exist
 *
 * @example
 * ```ts
 * const { context, value } = await getAccountInfo(transport, pubkey);
 * if (value) console.log(`Owner: ${value.owner}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getAccountInfo<D = string>(
  t: HttpTransport,
  pubkey: Pubkey,
  opts: GetAccountInfoOpts = {}
): Promise<RpcContext<AccountInfo<D> | null>> {
  const { encoding, dataSlice, commitment, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (dataSlice) cfg.dataSlice = dataSlice;
  if (commitment) cfg.commitment = commitment;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getAccountInfo', [pubkey, cfg], rest);
}
