/**
 * sendTransaction / simulateTransaction — submission methods.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, Signature, Pubkey, Encoding } from '../../core/types';

export interface SendTransactionOpts extends CallOptions {
  encoding?: 'base58' | 'base64';
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
  minContextSlot?: number;
}

export interface SimulateTransactionOpts extends CallOptions {
  encoding?: 'base58' | 'base64';
  commitment?: Commitment;
  sigVerify?: boolean;
  replaceRecentBlockhash?: boolean;
  accounts?: { addresses: Pubkey[]; encoding?: Encoding };
  minContextSlot?: number;
}

export interface SimulateResult {
  err: unknown;
  logs: string[] | null;
  accounts?: unknown[] | null;
  unitsConsumed?: number;
  returnData?: { programId: Pubkey; data: [string, string] };
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

export async function simulateTransaction(
  t: HttpTransport,
  tx: string,
  opts: SimulateTransactionOpts = {}
): Promise<SimulateResult> {
  const { encoding = 'base64', commitment, sigVerify, replaceRecentBlockhash, accounts, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { encoding };
  if (commitment) cfg.commitment = commitment;
  if (sigVerify != null) cfg.sigVerify = sigVerify;
  if (replaceRecentBlockhash != null) cfg.replaceRecentBlockhash = replaceRecentBlockhash;
  if (accounts) cfg.accounts = accounts;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('simulateTransaction', [tx, cfg], rest);
}
