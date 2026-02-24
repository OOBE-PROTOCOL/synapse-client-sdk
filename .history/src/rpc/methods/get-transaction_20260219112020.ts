/**
 * getTransaction — fetch parsed transaction by signature.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Signature, Encoding, Commitment, ConfirmedTransaction } from '../../core/types';

export interface GetTransactionOpts extends CallOptions {
  encoding?: Encoding;
  commitment?: Commitment;
  maxSupportedTransactionVersion?: number;
}

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
