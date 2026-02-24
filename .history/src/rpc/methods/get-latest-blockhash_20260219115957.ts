/**
 * getLatestBlockhash — returns the latest blockhash.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

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
