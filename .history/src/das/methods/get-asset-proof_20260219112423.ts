import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAssetProof, DasOpts } from '../types';

export async function getAssetProof(
  t: HttpTransport,
  id: Pubkey,
  opts: DasOpts & CallOptions = {}
): Promise<DasAssetProof> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetProof', [{ id, ...(commitment ? { commitment } : {}) }], rest);
}
