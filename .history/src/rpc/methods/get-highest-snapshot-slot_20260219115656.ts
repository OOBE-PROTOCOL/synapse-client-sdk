/**
 * getHighestSnapshotSlot — returns the highest slot information that the node has snapshots for.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function getHighestSnapshotSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ full: Slot; incremental?: Slot }> {
  return t.request('getHighestSnapshotSlot', [], opts);
}
