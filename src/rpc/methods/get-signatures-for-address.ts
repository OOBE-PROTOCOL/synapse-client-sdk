/**
 * @module rpc/methods/get-signatures-for-address
 * @description Returns confirmed signatures for transactions involving an address.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, SignatureInfo } from '../../core/types';

/**
 * Options for {@link getSignaturesForAddress}.
 *
 * @since 1.0.0
 */
export interface GetSignaturesOpts extends CallOptions {
  limit?: number;
  before?: string;
  until?: string;
  commitment?: Commitment;
  minContextSlot?: number;
}

/**
 * Fetch confirmed signatures for transactions involving the given address.
 *
 * @remarks
 * Auto-paginates with safety guards. Set `limit` to control total results
 * (default 100, max ~50 000).
 *
 * @param t - HTTP transport instance
 * @param address - Base-58 encoded account address
 * @param opts - Pagination, commitment, and call options
 * @returns Array of signature information objects
 *
 * @example
 * ```ts
 * const sigs = await getSignaturesForAddress(transport, address, { limit: 10 });
 * ```
 *
 * @since 1.0.0
 */
export async function getSignaturesForAddress(
  t: HttpTransport,
  address: Pubkey,
  opts: GetSignaturesOpts = {}
): Promise<SignatureInfo[]> {
  const { limit = 100, before: initialBefore, until, commitment, minContextSlot, ...rest } = opts;
  const results: SignatureInfo[] = [];
  let remaining = limit;
  let before = initialBefore;
  const rpcCap = 1000;
  const maxPages = 50;

  for (let page = 0; page < maxPages && remaining > 0; page++) {
    const pageLimit = Math.min(remaining, rpcCap);
    const cfg: Record<string, unknown> = { limit: pageLimit };
    if (before) cfg.before = before;
    if (until) cfg.until = until;
    if (commitment) cfg.commitment = commitment;
    if (minContextSlot != null) cfg.minContextSlot = minContextSlot;

    const batch = await t.request<SignatureInfo[]>('getSignaturesForAddress', [address, cfg], rest);
    if (!Array.isArray(batch) || batch.length === 0) break;

    results.push(...batch);
    remaining -= batch.length;
    before = batch[batch.length - 1]?.signature as string;
    if (batch.length < pageLimit) break;
  }

  return results;
}
