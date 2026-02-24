/**
 * @module rpc/methods/send-transaction
 * @description Submits a signed transaction to the cluster for processing.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, Signature } from '../../core/types';

/**
 * Options for {@link sendTransaction}.
 *
 * @since 1.0.0
 */
export interface SendTransactionOpts extends CallOptions {
  encoding?: 'base58' | 'base64';
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
  minContextSlot?: number;
}

/**
 * Submit a signed transaction to the cluster for processing.
 *
 * @param t - HTTP transport instance
 * @param signedTx - Encoded signed transaction string
 * @param opts - Encoding, preflight, retry, and call options
 * @returns Transaction signature
 *
 * @example
 * ```ts
 * const sig = await sendTransaction(transport, serializedTx, {
 *   skipPreflight: true,
 * });
 * ```
 *
 * @since 1.0.0
 */
export async function sendTransaction(
  t: HttpTransport,
  signedTx: string,
  opts: SendTransactionOpts = {}
): Promise<Signature> {
  const { encoding = 'base64', skipPreflight, preflightCommitment, maxRetries: mr, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { encoding };
  if (skipPreflight != null) cfg.skipPreflight = skipPreflight;
  if (preflightCommitment) cfg.preflightCommitment = preflightCommitment;
  if (mr != null) cfg.maxRetries = mr;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('sendTransaction', [signedTx, cfg], rest);
}
