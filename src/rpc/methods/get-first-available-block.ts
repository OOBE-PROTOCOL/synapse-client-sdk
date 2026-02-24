/**
 * @module rpc/methods/get-first-available-block
 * @description Returns the slot of the lowest confirmed block that has not been purged from the ledger.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the slot of the lowest confirmed block that has not been purged from the ledger.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns The first available block slot
 *
 * @example
 * ```ts
 * const slot = await getFirstAvailableBlock(transport);
 * console.log(`First available block: ${slot}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getFirstAvailableBlock(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getFirstAvailableBlock', [], opts);
}
