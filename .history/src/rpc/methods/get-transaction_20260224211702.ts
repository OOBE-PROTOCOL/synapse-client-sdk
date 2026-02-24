/**
 * @module rpc/methods/get-transaction
 * @description Returns a confirmed transaction by its signature.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Signature, Encoding, Commitment, ConfirmedTransaction } from '../../core/types';

/**
 * Options for {@link getTransaction}.
 *
 * @since 1.0.0
 */
export interface GetTransactionOpts extends CallOptions {
  encoding?: Encoding;
  commitment?: Commitment;
  maxSupportedTransactionVersion?: number;
}

/**
 * Fetch a confirmed transaction by its signature.
 *
 * @param t - HTTP transport instance
 * @param signature - Transaction signature to look up
 * @param opts - Encoding, commitment, and call options
 * @returns The confirmed transaction, or `null` if not found
 *
 * @example
 * ```ts
 * const tx = await getTransaction(transport, signature, {
 *   maxSupportedTransactionVersion: 0,
 * });
 * ```
 *
 * @since 1.0.0
 */
export async function getTransaction(
  t: HttpTransport,
  signature: Signature,
  opts: GetTransactionOpts = {}
): Promise<ConfirmedTransaction | null> {
  const { encoding, commitment, maxSupportedTransactionVersion, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (encoding) cfg.encoding = encoding;
  if (commitment) cfg.commitment = commitment;
  if (maxSupportedTransactionVersion != null) cfg.maxSupportedTransactionVersion = maxSupportedTransactionVersion;
  return t.request('getTransaction', [signature, cfg], rest);
}
