/**
 * getStakeMinimumDelegation — returns the stake minimum delegation in lamports.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

export async function getStakeMinimumDelegation(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<number>> {
  return t.request('getStakeMinimumDelegation', [{ commitment }], opts);
}
