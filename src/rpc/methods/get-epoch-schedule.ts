/**
 * @module rpc/methods/get-epoch-schedule
 * @description Returns the epoch schedule parameters for the cluster.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { EpochSchedule } from '../../core/types';

/**
 * Fetch the epoch schedule parameters for the cluster.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Epoch schedule containing slots per epoch, leader schedule slot offset, and warmup flag
 *
 * @example
 * ```ts
 * const schedule = await getEpochSchedule(transport);
 * console.log(`Slots per epoch: ${schedule.slotsPerEpoch}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getEpochSchedule(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<EpochSchedule> {
  return t.request('getEpochSchedule', [], opts);
}
