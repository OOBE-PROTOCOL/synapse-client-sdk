/**
 * @module rpc/methods/get-epoch-info
 * @description Returns information about the current epoch.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, EpochInfo } from '../../core/types';

/**
 * Fetch information about the current epoch.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Current epoch information including slot index, slots in epoch, and absolute slot
 *
 * @example
 * ```ts
 * const info = await getEpochInfo(transport);
 * console.log(`Epoch ${info.epoch}, slot index ${info.slotIndex}`);
 * ```
 *
 * @since 1.0.0
 */
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
