/**
 * @module rpc/methods/get-highest-snapshot-slot
 * @description Returns the highest slot information that the node has snapshots for.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the highest slot information that the node has snapshots for.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Object containing the highest full snapshot slot and optionally the highest incremental snapshot slot
 *
 * @example
 * ```ts
 * const { full, incremental } = await getHighestSnapshotSlot(transport);
 * console.log(`Full snapshot slot: ${full}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getHighestSnapshotSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ full: Slot; incremental?: Slot }> {
  return t.request('getHighestSnapshotSlot', [], opts);
}
