/**
 * @module rpc/methods/get-block-time
 * @description Returns the estimated production time of a block as a Unix timestamp.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot, UnixTimestamp } from '../../core/types';

/**
 * Fetch the estimated production time of a block as a Unix timestamp.
 *
 * @param t - HTTP transport instance
 * @param slot - Slot number to query
 * @param opts - Additional call options
 * @returns Unix timestamp (seconds since epoch) or `null` if unavailable
 *
 * @example
 * ```ts
 * const timestamp = await getBlockTime(transport, 100_000);
 * if (timestamp) console.log(new Date(timestamp * 1000));
 * ```
 *
 * @since 1.0.0
 */
export async function getBlockTime(
  t: HttpTransport,
  slot: Slot,
  opts: CallOptions = {}
): Promise<UnixTimestamp | null> {
  return t.request('getBlockTime', [slot], opts);
}
