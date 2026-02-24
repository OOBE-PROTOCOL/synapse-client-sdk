import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasOpts } from '../types';
import type { Pubkey } from '../../core/types';

export interface SignaturesForAssetParams {
  id: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  before?: string;
  after?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface AssetSignatureInfo {
  signature: string;
  type?: string;
  slot?: number;
}

export interface AssetSignaturesPage {
  total: number;
  limit: number;
  page: number;
  items: AssetSignatureInfo[];
}

export async function getSignaturesForAsset(
  t: HttpTransport,
  params: SignaturesForAssetParams,
  opts: DasOpts & CallOptions = {}
): Promise<AssetSignaturesPage> {
  const { commitment, ...rest } = opts;
  return t.request('getSignaturesForAsset', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
