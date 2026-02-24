/**
 * @module rpc/methods/get-balance
 * @description Returns the lamport balance for a given public key.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Lamports, RpcContext } from '../../core/types';

/**
 * Fetch the SOL balance (in lamports) for a public key.
 *
 * @param t - HTTP transport instance
 * @param pubkey - Base-58 encoded public key to query
 * @param commitment - Desired commitment level (default: `"confirmed"`)
 * @param opts - Additional call options
 * @returns Context-wrapped lamport balance
 *
 * @example
 * ```ts
 * const { context, value } = await getBalance(transport, pubkey);
 * console.log(`Balance: ${value} lamports`);
 * ```
 *
 * @since 1.0.0
 */
export async function getBalance(
  t: HttpTransport,
  pubkey: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<Lamports>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getBalance', [pubkey, cfg], rest);
}
