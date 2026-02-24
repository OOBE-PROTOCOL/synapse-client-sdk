/**
 * @module rpc/methods/get-recent-performance-samples
 * @description Returns a list of recent performance samples, taken once per minute.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { PerfSample } from '../../core/types';

/**
 * Fetch a list of recent performance samples.
 *
 * @param t - HTTP transport instance
 * @param limit - Number of samples to return (default 720, max 720)
 * @param opts - Additional call options
 * @returns Array of performance samples
 *
 * @example
 * ```ts
 * const samples = await getRecentPerformanceSamples(transport, 10);
 * ```
 *
 * @since 1.0.0
 */
export async function getRecentPerformanceSamples(
  t: HttpTransport,
  limit = 720,
  opts: CallOptions = {}
): Promise<PerfSample[]> {
  return t.request('getRecentPerformanceSamples', [limit], opts);
}
