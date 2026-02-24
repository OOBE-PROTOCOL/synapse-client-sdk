/**
 * DasClient — typed facade for all DAS (Digital Asset Standard) methods.
 * Wraps the Metaplex Read API / Helius DAS endpoints.
 */
import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey } from '../core/types';
import type {
  DasAsset, DasAssetProof, DasPage, DasSearchParams, DasOpts
} from './types';
import * as m from './methods/index';

export class DasClient {
  constructor(private readonly t: HttpTransport) {}

  getAsset(id: Pubkey, opts?: DasOpts & CallOptions) {
    return m.getAsset(this.t, id, opts);
  }

  getAssetProof(id: Pubkey, opts?: DasOpts & CallOptions) {
    return m.getAssetProof(this.t, id, opts);
  }

  getAssetBatch(ids: Pubkey[], opts?: DasOpts & CallOptions) {
    return m.getAssetBatch(this.t, ids, opts);
  }

  getAssetProofBatch(ids: Pubkey[], opts?: DasOpts & CallOptions) {
    return m.getAssetProofBatch(this.t, ids, opts);
  }

  getAssetsByOwner(params: m.GetAssetsByOwnerParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByOwner(this.t, params, opts);
  }

  getAssetsByGroup(params: m.GetAssetsByGroupParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByGroup(this.t, params, opts);
  }

  getAssetsByCreator(params: m.GetAssetsByCreatorParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByCreator(this.t, params, opts);
  }

  getAssetsByAuthority(params: m.GetAssetsByAuthorityParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByAuthority(this.t, params, opts);
  }

  searchAssets(params: DasSearchParams, opts?: DasOpts & CallOptions) {
    return m.searchAssets(this.t, params, opts);
  }

  getSignaturesForAsset(params: m.SignaturesForAssetParams, opts?: DasOpts & CallOptions) {
    return m.getSignaturesForAsset(this.t, params, opts);
  }

  getTokenAccounts(params: m.GetTokenAccountsParams, opts?: DasOpts & CallOptions) {
    return m.getTokenAccounts(this.t, params, opts);
  }
}
