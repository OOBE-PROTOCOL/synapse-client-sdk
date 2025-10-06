/**
 * @file nft/engine.ts
 * @module SolanaNFT
 * @author Keepeeto
 * @license MIT
 * @description Production‑ready NFT utilities for Solana using @solana/web3.js and Metaplex Token Metadata.
 *              Supports standard NFTs on Token Metadata and optional compressed NFTs via DAS/Bubblegum endpoints.
 *              Strongly‑typed API with event emissions for observability. No emojis, no fluff.
 */

import { EventEmitter } from 'eventemitter3';
import {
  PublicKey,
  Connection,
  type Commitment,
} from '@solana/web3.js';
import {
  mplTokenMetadata,
  fetchDigitalAsset,
  findMetadataPda as findMetadataPdaUmi,
} from '@metaplex-foundation/mpl-token-metadata';
import { createBaseUmi, type Umi, publicKey as umiPk } from '@metaplex-foundation/umi';
import type {
  SynapseLikeClient,
  NFTConfig,
  NFTAttribute,
  NFTMetadata,
  NFTInfo,
  CompressedNFTInfo,
  AIRarityAnalysis,
} from './types.nft';

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/** Derive the Metadata PDA for a given mint. */
// replaced by Umi-backed findMetadataPda above

/** Fetch and JSON-parse a URI with a pluggable fetch implementation. */
async function getJson<T = any>(fetcher: typeof fetch, uri: string): Promise<T> {
  const res = await fetcher(uri, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function pickFetch(cfg: NFTConfig): typeof fetch {
  return cfg.fetch ?? cfg.client.fetch ?? fetch;
}

// Umi integration helpers ------------------------------------------------------
let __umiCache: WeakMap<Connection, Umi> | undefined;
function getUmi(connection: Connection): Umi {
  if (!__umiCache) __umiCache = new WeakMap();
  const cached = __umiCache.get(connection);
  if (cached) return cached;
  const umi = createBaseUmi();
  umi.use(mplTokenMetadata());
  __umiCache.set(connection, umi);
  return umi;
}

/** Derive the Metadata PDA (Umi helper). Accepts a Connection and a mint. */
export function findMetadataPda(connection: Connection, mint: PublicKey): PublicKey {
  const umi = getUmi(connection);
  const pda = findMetadataPdaUmi(umi, { mint: umiPk(mint.toBase58()) }) as any;
  const candidate = pda?.[0];
  // pda[0] can be a string, PublicKey-like object or Uint8Array. Normalize to string for PublicKey.
  const address = typeof candidate === 'string' ? candidate : (candidate?.toBase58 ? candidate.toBase58() : candidate);
  return new PublicKey(address as any);
}

// -------------------------
// Option helpers
// -------------------------
/**
 * Metaplex/umi often wraps values in Option<T>-like objects. This helper
 * returns the inner value if present, or undefined otherwise.
 */
function optionToValue<T>(opt: any): T | undefined {
  if (opt === null || opt === undefined) return undefined;
  // UMI/Metaplex Option type may provide `.unwrap()` or expose `.value` or be a plain value
  if (typeof opt.unwrap === 'function') {
    try {
      return opt.unwrap() as T;
    } catch {
      return undefined;
    }
  }
  if ('value' in opt) return opt.value as T;
  return opt as T;
}

function safeToString(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v.toBase58 === 'function') return v.toBase58();
  if (typeof v.toString === 'function') return v.toString();
  return undefined;
}

/**
 * Try common locations for the JSON metadata on a Metaplex DigitalAsset.
 * Different library versions expose the parsed JSON in different fields.
 */
function getAssetJson(asset: any): any | undefined {
  if (!asset) return undefined;
  if (asset.json) return optionToValue<any>(asset.json);
  if (asset.metadata && asset.metadata.json) return optionToValue<any>(asset.metadata.json);
  // Some versions expose parsed JSON as `data` or `content`
  if (asset.data) return optionToValue<any>(asset.data);
  if (asset.content) return optionToValue<any>(asset.content);
  // fallback: try to read `json` property via index to avoid TS warnings
  try {
    return (asset as any)['json'] ?? (asset as any)['metadata']?.['json'];
  } catch {
    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------

export class NFTEngine extends EventEmitter {
  private readonly connection: Connection;
  private readonly cfg: Required<NFTConfig>;
  private readonly rarityCache = new Map<string, AIRarityAnalysis>();

  constructor(config: NFTConfig) {
    super();

    const defaults: Required<NFTConfig> = {
      client: config.client,
      defaultCommitment: 'confirmed',
      fetch: config.fetch ?? config.client.fetch ?? fetch,
      das: {
        baseUrl: '',
        getAssetPath: '/v0/assets',
        getAssetByIdPath: '/v0/assets/byId',
        getAssetProofPath: '/v0/assets/proof',
        headers: {},
      },
    } as Required<NFTConfig>;

    this.cfg = {
      ...defaults,
      ...config,
      das: { ...defaults.das, ...(config.das ?? {}) },
    } as Required<NFTConfig>;

    this.connection = config.client.connection;
  }

  // ---------------------------------------------------------------------------
  // Standard NFT (Token Metadata) helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve owner of a 1/1 NFT mint by locating the largest token account with amount == 1.
   */
  async resolveOwnerOfMint(mint: PublicKey): Promise<string | undefined> {
    const largest = await this.connection.getTokenLargestAccounts(mint, this.cfg.defaultCommitment);
    const acct = largest.value.find((x) => x.uiAmount === 1);
    if (!acct) return undefined;
    const info = await this.connection.getParsedAccountInfo(new PublicKey(acct.address), this.cfg.defaultCommitment);
    const owner = (info.value as any)?.data?.parsed?.info?.owner as string | undefined;
    return owner;
  }

  /**
   * Load an NFT (standard Token Metadata) using Metaplex Umi `fetchDigitalAsset`.
   */
  async getNftInfo(mintStr: string, opts?: { withOwner?: boolean }): Promise<NFTInfo> {
    const mint = new PublicKey(mintStr);
    const umi = getUmi(this.connection);

    const asset = await fetchDigitalAsset(umi, umiPk(mint.toBase58()));
  const json = (getAssetJson(asset) ?? {}) as NFTMetadata;

    const owner = opts?.withOwner ? await this.resolveOwnerOfMint(mint) : undefined;

    const rawCreators = optionToValue<any[]>(asset?.metadata?.creators) ?? [];
    const creators = rawCreators.map((c: any) => ({
      address: safeToString(c.address) ? new PublicKey(safeToString(c.address)!).toBase58() : String(c.address),
      verified: Boolean(c.verified),
      share: Number(c.share ?? 0),
    }));

    const rawCollection = optionToValue<any>(asset?.metadata?.collection);
    const collection = rawCollection && rawCollection.address
      ? {
        address: new PublicKey(safeToString(rawCollection.address)!).toBase58(),
        verified: Boolean(rawCollection.verified),
        name: json?.collection?.name,
      }
      : null;

    const tokenStandard = optionToValue<number>(asset?.metadata?.tokenStandard) as number | undefined;
    const model: NFTInfo['model'] = tokenStandard === 4 ? 'programmableNFT' : 'token';

    const updateAuthorityStr = safeToString(optionToValue<any>(asset?.metadata?.updateAuthority));

    const editionRaw = optionToValue<any>(asset?.edition);
    const edition = editionRaw ? { isMaster: !!editionRaw.isOriginal, number: editionRaw.edition ?? undefined } : null;

    const info: NFTInfo = {
      mint: mint.toBase58(),
      owner,
      metadata: json,
      compressed: false,
      collection,
      creators,
      updateAuthority: updateAuthorityStr ?? null,
      model,
      edition,
    };

    this.emit('nft:loaded', info);
    return info;
  }

  // ---------------------------------------------------------------------------
  // Compressed NFTs (DAS / Bubblegum)
  // ---------------------------------------------------------------------------

  async getCompressedNftInfo(args: { assetId?: string; tree?: string; leaf?: number | string }): Promise<CompressedNFTInfo> {
    const das = this.cfg.das;
    if (!das.baseUrl) throw new Error('DAS baseUrl not configured');

    const base = das.baseUrl.replace(/\/$/, '');
    const fetcher = pickFetch(this.cfg);

    let asset: any;
    if (args.assetId) {
      const url = `${base}${das.getAssetByIdPath ?? '/v0/assets/byId'}?id=${encodeURIComponent(args.assetId)}`;
      const r = await fetcher(url, { headers: das.headers });
      if (!r.ok) throw new Error(`DAS getAssetById failed: ${r.status} ${r.statusText}`);
      asset = await r.json();
    } else if (args.tree && (args.leaf !== undefined)) {
      const search = new URLSearchParams({ tree: args.tree, leaf_index: String(args.leaf) });
      const url = `${base}${das.getAssetPath ?? '/v0/assets'}?${search.toString()}`;
      const r = await fetcher(url, { headers: das.headers });
      if (!r.ok) throw new Error(`DAS getAsset failed: ${r.status} ${r.statusText}`);
      const data = await r.json();
      asset = Array.isArray(data?.items) ? data.items[0] : data;
    } else {
      throw new Error('Provide assetId or (tree and leaf)');
    }

    if (!asset) throw new Error('Compressed asset not found');

    const md: NFTMetadata = asset.content?.metadata ?? {};
    const out: CompressedNFTInfo = {
      mint: asset.id,
      owner: asset.ownership?.owner ?? undefined,
      metadata: md,
      compressed: true,
      collection: asset.grouping?.length ? { address: asset.grouping[0].group_value, verified: true, name: md?.collection as any } : null,
      creators: (asset.creators ?? []).map((c: any) => ({ address: c.address, verified: Boolean(c.verified), share: Number(c.share ?? 0) })),
      updateAuthority: asset.authority ?? null,
      model: 'compressed',
      edition: null,
      tree: asset.compression?.tree ?? (args.tree ?? undefined),
      leaf: asset.compression?.leaf_id ?? (args.leaf as any),
      proof: Array.isArray(asset.proof) ? asset.proof : undefined,
    };

    this.emit('nft:loaded', out);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Optional rarity (lightweight, deterministic if you pass traits with rarity)
  // ---------------------------------------------------------------------------

  calculateRarity(mint: string, metadata: NFTMetadata): AIRarityAnalysis {
    const cached = this.rarityCache.get(mint);
    if (cached) return cached;

    const traits = metadata.attributes ?? [];
    let total = 0;
    const map: Record<string, number> = {};
    for (const t of traits) {
      const r = typeof t.rarity === 'number' && t.rarity > 0 ? t.rarity : 0.5;
      map[t.trait_type] = r;
      total += 1 / r; // simple reciprocal aggregation
    }

    // Normalize to 0..100
    const overall = Math.max(0, Math.min(100, (total / Math.max(1, traits.length)) * 10));
    const out = { overallRarity: overall, traitRarities: map };
    this.rarityCache.set(mint, out);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Health and diagnostics
  // ---------------------------------------------------------------------------

  async healthCheck() {
    const slot = await this.connection.getSlot(this.cfg.defaultCommitment);
    const ping = await this.connection.getEpochInfo(this.cfg.defaultCommitment);
    const dasReady = Boolean(this.cfg.das.baseUrl);
    const details = { slot, epoch: ping.epoch, dasReady };
    this.emit('nft:health', details);
    return { ok: true, details };
  }
}

// -----------------------------------------------------------------------------
// Event Names (for convenience)
// -----------------------------------------------------------------------------

export type NFTEvents = 'nft:loaded' | 'nft:health';
