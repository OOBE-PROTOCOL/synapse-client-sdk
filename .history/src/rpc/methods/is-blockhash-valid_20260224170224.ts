/**
 * @module rpc/methods/is-blockhash-valid
 * @description Returns whether a blockhash is still valid.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext } from '../../core/types';

/**
 * Check whether a blockhash is still valid.
 *
 * @param t - HTTP transport instance
 * @param blockhash - The blockhash to evaluate, as a base-58 encoded string
 * @param commitment - Desired commitment level
 * @param opts - Additional call options
 * @returns Boolean indicating validity, wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value: valid } = await isBlockhashValid(transport, blockhash);
 * ```
 *
 * @since 1.0.0
 */
export async function isBlockhashValid(
  t: HttpTransport,
  blockhash: string,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<boolean>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('isBlockhashValid', [blockhash, cfg], rest);
}
