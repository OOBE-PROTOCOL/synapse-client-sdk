import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';
import type { DasAsset, DasOpts } from '../types';

export async function getAsset(
  t: HttpTransport,
  id: Pubkey,
  opts: DasOpts & CallOptions = {}
): Promise<DasAsset> {
  const { commitment, ...rest } = opts;
  return t.request('getAsset', [{ id, ...(commitment ? { commitment } : {}) }], rest);
}
