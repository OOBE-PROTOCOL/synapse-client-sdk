/**
 * @module das/client
 * @description Typed facade for all DAS (Digital Asset Standard) methods.
 * Wraps the Metaplex Read API / Helius DAS endpoints with a convenient
 * class-based interface.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../core/transport';
import type { Pubkey } from '../core/types';
import type {
  DasAsset, DasAssetProof, DasPage, DasSearchParams, DasOpts
} from './types';
import * as m from './methods/index';

/**
 * High-level client for the Digital Asset Standard (DAS) API.
 *
 * @description Provides typed methods for fetching, searching, and inspecting
 * digital assets (NFTs, cNFTs, and fungible tokens) via the Metaplex Read API.
 *
 * @example
 * ```ts
 * const das = new DasClient(transport);
 * const asset = await das.getAsset('So1111...');
 * ```
 *
 * @since 1.0.0
 */
export class DasClient {
  /**
   * Creates a new DAS client.
   * @param t - HTTP transport used for JSON-RPC communication
   */
  constructor(private readonly t: HttpTransport) {}

  /**
   * Fetch a single digital asset by its ID.
   * @param id - Base-58 encoded asset public key
   * @param opts - Commitment level and call options
   * @returns The full DAS asset object
   * @since 1.0.0
   */
  getAsset(id: Pubkey, opts?: DasOpts & CallOptions) {
    return m.getAsset(this.t, id, opts);
  }

  /**
   * Fetch the Merkle proof for a compressed asset.
   * @param id - Base-58 encoded asset public key
   * @param opts - Commitment level and call options
   * @returns The Merkle proof for the compressed asset
   * @since 1.0.0
   */
  getAssetProof(id: Pubkey, opts?: DasOpts & CallOptions) {
    return m.getAssetProof(this.t, id, opts);
  }

  /**
   * Fetch multiple digital assets in a single batch request.
   * @param ids - Array of base-58 encoded asset public keys
   * @param opts - Commitment level and call options
   * @returns Array of DAS asset objects
   * @since 1.0.0
   */
  getAssetBatch(ids: Pubkey[], opts?: DasOpts & CallOptions) {
    return m.getAssetBatch(this.t, ids, opts);
  }

  /**
   * Fetch Merkle proofs for multiple compressed assets in a single batch request.
   * @param ids - Array of base-58 encoded asset public keys
   * @param opts - Commitment level and call options
   * @returns Map of asset IDs to their Merkle proofs
   * @since 1.0.0
   */
  getAssetProofBatch(ids: Pubkey[], opts?: DasOpts & CallOptions) {
    return m.getAssetProofBatch(this.t, ids, opts);
  }

  /**
   * Fetch all digital assets owned by a given wallet address.
   * @param params - Owner address and pagination/sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of assets owned by the address
   * @since 1.0.0
   */
  getAssetsByOwner(params: m.GetAssetsByOwnerParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByOwner(this.t, params, opts);
  }

  /**
   * Fetch all digital assets belonging to a specific group (e.g. a collection).
   * @param params - Group key/value pair and pagination/sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of assets in the group
   * @since 1.0.0
   */
  getAssetsByGroup(params: m.GetAssetsByGroupParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByGroup(this.t, params, opts);
  }

  /**
   * Fetch all digital assets created by a given creator address.
   * @param params - Creator address, verification filter, and pagination/sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of assets by the creator
   * @since 1.0.0
   */
  getAssetsByCreator(params: m.GetAssetsByCreatorParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByCreator(this.t, params, opts);
  }

  /**
   * Fetch all digital assets managed by a given authority address.
   * @param params - Authority address and pagination/sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of assets under the authority
   * @since 1.0.0
   */
  getAssetsByAuthority(params: m.GetAssetsByAuthorityParams, opts?: DasOpts & CallOptions) {
    return m.getAssetsByAuthority(this.t, params, opts);
  }

  /**
   * Search for digital assets using flexible filter criteria.
   * @param params - Search filters, pagination, and sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of matching assets
   * @since 1.0.0
   */
  searchAssets(params: DasSearchParams, opts?: DasOpts & CallOptions) {
    return m.searchAssets(this.t, params, opts);
  }

  /**
   * Fetch transaction signatures associated with a digital asset.
   * @param params - Asset ID and pagination/sorting options
   * @param opts - Commitment level and call options
   * @returns Paginated list of transaction signatures for the asset
   * @since 1.0.0
   */
  getSignaturesForAsset(params: m.SignaturesForAssetParams, opts?: DasOpts & CallOptions) {
    return m.getSignaturesForAsset(this.t, params, opts);
  }

  /**
   * Fetch token accounts filtered by owner or mint address.
   * @param params - Owner/mint address and pagination options
   * @param opts - Commitment level and call options
   * @returns Paginated list of token accounts
   * @since 1.0.0
   */
  getTokenAccounts(params: m.GetTokenAccountsParams, opts?: DasOpts & CallOptions) {
    return m.getTokenAccounts(this.t, params, opts);
  }
}
