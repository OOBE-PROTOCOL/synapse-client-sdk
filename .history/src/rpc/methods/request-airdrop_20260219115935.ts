/**
 * requestAirdrop — requests an airdrop of lamports to a Pubkey (devnet/testnet).
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, Signature } from '../../core/types';

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
