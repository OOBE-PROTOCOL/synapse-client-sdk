/**
 * getRecentPerformanceSamples — returns a list of recent performance samples.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { PerfSample } from '../../core/types';

export async function getRecentPerformanceSamples(
  t: HttpTransport,
  limit = 720,
  opts: CallOptions = {}
): Promise<PerfSample[]> {
  return t.request('getRecentPerformanceSamples', [limit], opts);
}
