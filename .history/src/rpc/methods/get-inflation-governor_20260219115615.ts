/**
 * getInflationGovernor — returns the current inflation governor.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, InflationGovernor } from '../../core/types';

export async function getInflationGovernor(
  t: HttpTransport,
  commitment?: Commitment,
  opts: CallOptions = {}
): Promise<InflationGovernor> {
  const params = commitment ? [{ commitment }] : [];
  return t.request('getInflationGovernor', params, opts);
}
