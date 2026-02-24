/**
 * getEpochSchedule — returns the epoch schedule information from this cluster.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { EpochSchedule } from '../../core/types';

export async function getEpochSchedule(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<EpochSchedule> {
  return t.request('getEpochSchedule', [], opts);
}
