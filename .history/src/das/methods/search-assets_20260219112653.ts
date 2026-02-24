import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasPage, DasAsset, DasOpts, DasSearchParams } from '../types';

export async function searchAssets(
  t: HttpTransport,
  params: DasSearchParams,
  opts: DasOpts & CallOptions = {}
): Promise<DasPage<DasAsset>> {
  const { commitment, ...rest } = opts;
  return t.request('searchAssets', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
