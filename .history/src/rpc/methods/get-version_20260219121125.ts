/**
 * getVersion — returns the current Solana version running on the node.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

export async function getVersion(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ 'solana-core': string; 'feature-set': number }> {
  return t.request('getVersion', [], opts);
}
