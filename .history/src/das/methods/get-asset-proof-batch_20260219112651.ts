import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAssetProof, DasOpts } from '../types';

export async function getAssetProofBatch(
  t: HttpTransport,
  ids: Pubkey[],
  opts: DasOpts & CallOptions = {}
): Promise<Record<string, DasAssetProof>> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetProofBatch', [{ ids, ...(commitment ? { commitment } : {}) }], rest);
}
