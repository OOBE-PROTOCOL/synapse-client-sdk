/**
 * getLatestBlockhash / isBlockhashValid — blockhash lifecycle methods.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext, Slot } from '../../core/types';

export interface BlockhashResult {
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function getLatestBlockhash(
  t: HttpTransport,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<BlockhashResult>> {
  return t.request('getLatestBlockhash', [{ commitment }], opts);
}

export async function isBlockhashValid(
  t: HttpTransport,
  blockhash: string,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<boolean>> {
  return t.request('isBlockhashValid', [blockhash, { commitment }], opts);
}
