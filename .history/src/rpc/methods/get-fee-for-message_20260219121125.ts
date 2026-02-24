/**
 * getFeeForMessage — get the fee the network will charge for a particular Message.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

export async function getFeeForMessage(
  t: HttpTransport,
  message: string,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<number | null>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getFeeForMessage', [message, cfg], rest);
}
