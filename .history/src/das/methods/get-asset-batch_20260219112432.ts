import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAsset, DasOpts } from '../types';

export async function getAssetBatch(
  t: HttpTransport,
  ids: Pubkey[],
  opts: DasOpts & CallOptions = {}
): Promise<DasAsset[]> {
  const { commitment, ...rest } = opts;
  return t.request('getAssetBatch', [{ ids, ...(commitment ? { commitment } : {}) }], rest);
}
