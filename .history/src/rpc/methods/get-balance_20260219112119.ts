/**
 * getBalance — returns lamport balance for a pubkey.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Lamports, RpcContext } from '../../core/types';

export async function getBalance(
  t: HttpTransport,
  pubkey: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<Lamports>> {
  return t.request('getBalance', [pubkey, { commitment }], opts);
}
