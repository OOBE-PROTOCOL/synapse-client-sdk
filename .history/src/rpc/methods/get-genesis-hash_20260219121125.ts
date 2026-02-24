/**
 * getGenesisHash — returns the genesis hash.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

export async function getGenesisHash(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<string> {
  return t.request('getGenesisHash', [], opts);
}
