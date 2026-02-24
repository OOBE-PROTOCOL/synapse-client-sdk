/**
 * @module rpc/methods/get-max-retransmit-slot
 * @description Returns the max slot seen from the retransmit stage.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

/**
 * Fetch the max slot seen from the retransmit stage.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns The max slot number
 *
 * @example
 * ```ts
 * const slot = await getMaxRetransmitSlot(transport);
 * ```
 *
 * @since 1.0.0
 */
export async function getMaxRetransmitSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('getMaxRetransmitSlot', [], opts);
}
