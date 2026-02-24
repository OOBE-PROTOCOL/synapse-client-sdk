/**
 * @module rpc/methods/get-fee-for-message
 * @description Returns the fee the network will charge for a given message.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

/**
 * Fetch the fee the network will charge for a given serialized message.
 *
 * @param t - HTTP transport instance
 * @param message - Base-64 encoded message to estimate fees for
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Context-wrapped fee in lamports, or `null` if the blockhash has expired
 *
 * @example
 * ```ts
 * const { value: fee } = await getFeeForMessage(transport, base64Msg);
 * if (fee !== null) console.log(`Fee: ${fee} lamports`);
 * ```
 *
 * @since 1.0.0
 */
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
