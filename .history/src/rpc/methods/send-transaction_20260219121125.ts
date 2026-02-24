/**
 * sendTransaction — submits a signed transaction to the cluster.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, Signature } from '../../core/types';

export interface SendTransactionOpts extends CallOptions {
  encoding?: 'base58' | 'base64';
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
  minContextSlot?: number;
}

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
