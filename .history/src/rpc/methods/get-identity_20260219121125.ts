/**
 * getIdentity — returns the identity pubkey for the current node.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';

export async function getIdentity(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ identity: Pubkey }> {
  return t.request('getIdentity', [], opts);
}
