/**
 * getInflationRate — returns the specific inflation values for the current epoch.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { InflationRate } from '../../core/types';

export async function getInflationRate(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<InflationRate> {
  return t.request('getInflationRate', [], opts);
}
