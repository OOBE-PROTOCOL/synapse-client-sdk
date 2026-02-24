/**
 * @module rpc/methods/request-airdrop
 * @description Requests an airdrop of lamports to a public key (devnet / testnet only).
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Signature } from '../../core/types';

/**
 * Request an airdrop of lamports to a public key.
 *
 * @remarks
 * Only available on devnet and testnet clusters.
 *
 * @param t - HTTP transport instance
 * @param pubkey - Base-58 encoded recipient public key
 * @param lamports - Number of lamports to airdrop
 * @param commitment - Optional commitment level
 * @param opts - Additional call options
 * @returns Transaction signature of the airdrop
 *
 * @example
 * ```ts
 * const sig = await requestAirdrop(transport, pubkey, 1_000_000_000);
 * ```
 *
 * @since 1.0.0
 */
export async function requestAirdrop(
  t: HttpTransport,
  pubkey: Pubkey,
  lamports: number,
  commitment?: Commitment,
  opts: CallOptions = {}
): Promise<Signature> {
  const params: unknown[] = commitment
    ? [pubkey, lamports, { commitment }]
    : [pubkey, lamports];
  return t.request('requestAirdrop', params, opts);
}
