/**
 * @module rpc/methods/minimum-ledger-slot
 * @description Returns the lowest slot the node has information about in its ledger.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the lowest slot the node has information about in its ledger.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns The minimum ledger slot number
 *
 * @example
 * ```ts
 * const slot = await minimumLedgerSlot(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function minimumLedgerSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('minimumLedgerSlot', [], opts);
}
