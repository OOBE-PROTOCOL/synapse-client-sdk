/**
 * @module rpc/methods/get-inflation-rate
 * @description Returns the specific inflation values for the current epoch.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { InflationRate } from '../../core/types';

/**
 * Fetch the specific inflation values for the current epoch.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Inflation rate containing total, validator, foundation, and epoch values
 *
 * @example
 * ```ts
 * const rate = await getInflationRate(transport);
 * console.log(`Total inflation: ${rate.total}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getInflationRate(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<InflationRate> {
  return t.request('getInflationRate', [], opts);
}
