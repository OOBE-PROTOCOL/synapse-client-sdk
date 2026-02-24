/**
 * getLatestBlockhash / isBlockhashValid — blockhash lifecycle methods.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext, Slot } from '../../core/types';

export interface BlockhashResult {
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function getLatestBlockhash(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<BlockhashResult>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getLatestBlockhash', [cfg], rest);
}

export async function isBlockhashValid(
  t: HttpTransport,
  blockhash: string,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<boolean>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('isBlockhashValid', [blockhash, cfg], rest);
}
