/**
 * @module rpc/methods/get-inflation-governor
 * @description Returns the current inflation governor parameters.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, InflationGovernor } from '../../core/types';

/**
 * Fetch the current inflation governor parameters.
 *
 * @param t - HTTP transport instance
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Inflation governor with initial rate, terminal rate, taper, and other parameters
 *
 * @example
 * ```ts
 * const governor = await getInflationGovernor(transport);
 * console.log(`Initial rate: ${governor.initial}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getInflationGovernor(
  t: HttpTransport,
  commitment?: Commitment,
  opts: CallOptions = {}
): Promise<InflationGovernor> {
  const params = commitment ? [{ commitment }] : [];
  return t.request('getInflationGovernor', params, opts);
}
