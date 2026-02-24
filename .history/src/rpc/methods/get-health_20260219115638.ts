/**
 * getHealth — returns the current health of the node.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

export async function getHealth(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<string> {
  return t.request('getHealth', [], opts);
}
