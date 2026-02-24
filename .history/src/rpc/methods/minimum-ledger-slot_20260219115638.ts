/**
 * minimumLedgerSlot — returns the lowest slot the node has information about in its ledger.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Slot } from '../../core/types';

export async function minimumLedgerSlot(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<Slot> {
  return t.request('minimumLedgerSlot', [], opts);
}
