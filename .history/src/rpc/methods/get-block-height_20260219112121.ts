/**
 * getBlockHeight — returns current block height.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment } from '../../core/types';

export async function getBlockHeight(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<number> {
  return t.request('getBlockHeight', [{ commitment }], opts);
}
