/**
 * getBlockHeight — returns current block height.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

export async function getBlockHeight(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<number> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getBlockHeight', [cfg], rest);
}
