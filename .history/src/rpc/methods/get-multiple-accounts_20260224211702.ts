/**
 * @module rpc/methods/get-multiple-accounts
 * @description Returns account information for a list of public keys (max 100 per call).
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Encoding, Commitment, DataSlice, RpcContext, AccountInfo } from '../../core/types';

/**
 * Options for {@link getMultipleAccounts}.
 *
 * @since 1.0.0
 */
export interface GetMultipleAccountsOpts extends CallOptions {
  encoding?: Encoding;
  dataSlice?: DataSlice;
  commitment?: Commitment;
  minContextSlot?: number;
}

/**
 * Fetch account information for multiple public keys in a single batch request.
 *
 * @param t - HTTP transport instance
 * @param pubkeys - Array of base-58 encoded public keys (max 100)
 * @param opts - Encoding, commitment, data-slice, and call options
 * @returns Array of account info objects (or `null` for missing accounts) wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getMultipleAccounts(transport, [pubkey1, pubkey2]);
 * ```
 *
 * @since 1.0.0
 */
export async function getMultipleAccounts<D = string>(
  t: HttpTransport,
  pubkeys: Pubkey[],
  opts: GetMultipleAccountsOpts = {}
): Promise<RpcContext<(AccountInfo<D> | null)[]>> {
  const { encoding, dataSlice, commitment, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (dataSlice) cfg.dataSlice = dataSlice;
  if (commitment) cfg.commitment = commitment;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getMultipleAccounts', [pubkeys, cfg], rest);
}
