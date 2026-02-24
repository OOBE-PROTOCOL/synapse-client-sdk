/**
 * simulateTransaction — simulate sending a transaction.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Encoding } from '../../core/types';

export interface SimulateTransactionOpts extends CallOptions {
  encoding?: 'base58' | 'base64';
  commitment?: Commitment;
  sigVerify?: boolean;
  replaceRecentBlockhash?: boolean;
  accounts?: { addresses: Pubkey[]; encoding?: Encoding };
  minContextSlot?: number;
  innerInstructions?: boolean;
}

export interface SimulateResult {
  err: unknown;
  logs: string[] | null;
  accounts?: unknown[] | null;
  unitsConsumed?: number;
  returnData?: { programId: Pubkey; data: [string, string] } | null;
  innerInstructions?: unknown[] | null;
  replacementBlockhash?: { blockhash: string; lastValidBlockHeight: number } | null;
  loadedAccountsDataSize?: number;
}

export async function simulateTransaction(
  t: HttpTransport,
  tx: string,
  opts: SimulateTransactionOpts = {}
): Promise<SimulateResult> {
  const { encoding = 'base64', commitment, sigVerify, replaceRecentBlockhash, accounts, minContextSlot, innerInstructions, ...rest } = opts;
  const cfg: Record<string, unknown> = { encoding };
  if (commitment) cfg.commitment = commitment;
  if (sigVerify != null) cfg.sigVerify = sigVerify;
  if (replaceRecentBlockhash != null) cfg.replaceRecentBlockhash = replaceRecentBlockhash;
  if (accounts) cfg.accounts = accounts;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  if (innerInstructions != null) cfg.innerInstructions = innerInstructions;
  return t.request('simulateTransaction', [tx, cfg], rest);
}
