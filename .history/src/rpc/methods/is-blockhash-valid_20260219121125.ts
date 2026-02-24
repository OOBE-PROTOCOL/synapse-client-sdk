/**
 * isBlockhashValid — returns whether a blockhash is still valid or not.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

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
