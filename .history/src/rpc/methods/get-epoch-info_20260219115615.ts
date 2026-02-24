/**
 * getEpochInfo — returns information about the current epoch.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, EpochInfo } from '../../core/types';

export async function getEpochInfo(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<EpochInfo> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getEpochInfo', [cfg], rest);
}
