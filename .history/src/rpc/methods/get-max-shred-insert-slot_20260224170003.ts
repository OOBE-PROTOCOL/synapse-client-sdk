/**
 * @module rpc/methods/get-max-shred-insert-slot
 * @description Returns the max slot seen from after shred insert.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the max slot seen from after shred insert.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns The max slot number from the shred insert stage
 *
 * @example
 * ```ts
 * const slot = await getMaxShredInsertSlot(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getMaxShredInsertSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getMaxShredInsertSlot', [], opts);
}
