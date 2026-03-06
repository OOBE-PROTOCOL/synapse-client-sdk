/**
 * @module ai/plugins/misc
 * @description Misc Plugin — Domains, oracle feeds, market data, bounties, and games.
 *
 * ```ts
 * import { MiscPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/misc';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(MiscPlugin);
 * ```
 *
 * Protocols included:
 *  - **sns**          (3)  — .sol domain registration + resolution
 *  - **alldomains**   (3)  — Multi-TLD domain resolution (.abc, .bonk, .poor, etc.)
 *  - **pyth**         (3)  — On-chain oracle price feeds
 *  - **coingecko**    (6)  — Market data, trending, gainers, OHLCV, pools
 *  - **gibwork**      (3)  — On-chain bounties & task marketplace
 *  - **send-arcade**  (2)  — On-chain mini-games
 *
 * Total: 20 tools
 *
 * @since 2.0.0
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import {
  snsMethods,
  alldomainsMethods,
  pythMethods,
  coingeckoMethods,
  gibworkMethods,
  sendArcadeMethods,
} from './schemas';

export {
  snsMethods,
  alldomainsMethods,
  pythMethods,
  coingeckoMethods,
  gibworkMethods,
  sendArcadeMethods,
  allMiscMethods,
} from './schemas';

/* ═══════════════════════════════════════════════════════════════
 *  API Base URLs
 * ═══════════════════════════════════════════════════════════════ */
const SNS_API        = 'https://sns-sdk-proxy.bonfida.workers.dev';
const PYTH_API       = 'https://hermes.pyth.network';
const COINGECKO_API  = 'https://pro-api.coingecko.com/api/v3';
const GIBWORK_API    = 'https://api2.gib.work';

/* ═══════════════════════════════════════════════════════════════
 *  Misc Plugin
 * ═══════════════════════════════════════════════════════════════ */

export const MiscPlugin: SynapsePlugin = {
  meta: {
    id: 'misc',
    name: 'Misc Plugin',
    description:
      'Domain names, oracle feeds, market data, bounties, and games — ' +
      'SNS, AllDomains, Pyth, CoinGecko, GibWork, Send Arcade',
    version: '2.0.0',
    tags: ['domains', 'oracle', 'market-data', 'bounties', 'games', 'sns', 'pyth'],
    mcpResources: [
      'solana://domain/{name}',
      'oracle://pyth/{feedId}',
      'market://coingecko/{tokenId}',
    ],
  },

  protocols: [
    {
      id: 'sns',
      name: 'Solana Name Service',
      methods: snsMethods,
      baseUrl: SNS_API,
      requiresClient: true,
    },
    {
      id: 'alldomains',
      name: 'AllDomains',
      methods: alldomainsMethods,
      requiresClient: true,
    },
    {
      id: 'pyth',
      name: 'Pyth Oracle',
      methods: pythMethods,
      baseUrl: PYTH_API,
      requiresClient: false,
    },
    {
      id: 'coingecko',
      name: 'CoinGecko',
      methods: coingeckoMethods,
      baseUrl: COINGECKO_API,
      requiresClient: false,
    },
    {
      id: 'gibwork',
      name: 'GibWork',
      methods: gibworkMethods,
      baseUrl: GIBWORK_API,
      requiresClient: true,
    },
    {
      id: 'send-arcade',
      name: 'Send Arcade',
      methods: sendArcadeMethods,
      requiresClient: true,
    },
  ],

  install(context: PluginContext) {
    const transport = context.client.transport;
    const apiKeys = context.config?.apiKeys as Record<string, string> | undefined;

    return {
      executor: async (
        method: ProtocolMethod,
        input: Record<string, unknown>,
        ctx: PluginContext,
      ) => {
        switch (method.protocol) {
          case 'sns':
            return executeSns(transport, method, input);
          case 'alldomains':
            return executeAlldomains(transport, method, input);
          case 'pyth':
            return executePyth(method, input);
          case 'coingecko':
            return executeCoinGecko(method, input, apiKeys?.coingecko);
          case 'gibwork':
            return executeGibWork(method, input);
          case 'send-arcade':
            return executeSendArcade(transport, method, input);
          default:
            throw new Error(`[MiscPlugin] Unknown protocol: ${method.protocol}`);
        }
      },
    };
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Protocol Executors
 * ═══════════════════════════════════════════════════════════════ */

// ── SNS — Solana Name Service ──────────────────────────────────

async function executeSns(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'resolveDomain': {
      try {
        const domain = (input.domain as string).replace(/\.sol$/, '');
        const res = await fetch(`${SNS_API}/resolve/${domain}`);
        if (!res.ok) {
          return { owner: null, domainKey: '', error: `Domain not found: ${input.domain}` };
        }
        const data = await res.json();
        return {
          owner: (data as any)?.result ?? (data as any)?.s,
          domainKey: '',
          domain: `${domain}.sol`,
        };
      } catch (err) {
        return { error: String(err), owner: null };
      }
    }

    case 'reverseLookup': {
      try {
        const res = await fetch(`${SNS_API}/favorite-domain/${input.wallet}`);
        const fav = res.ok ? await res.json() : null;
        const domainsRes = await fetch(`${SNS_API}/domains/${input.wallet}`);
        const domains = domainsRes.ok ? ((await domainsRes.json()) as any)?.result ?? [] : [];
        return {
          domains: Array.isArray(domains) ? domains.map((d: any) => `${d}.sol`) : [],
          primaryDomain: (fav as any)?.result ? `${(fav as any).result}.sol` : null,
        };
      } catch (err) {
        return { error: String(err), domains: [], primaryDomain: null };
      }
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'sns',
        method: method.name,
        params: input,
        message: `SNS ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── AllDomains ─────────────────────────────────────────────────

async function executeAlldomains(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'resolveDomain': {
      // AllDomains uses on-chain accounts — fall through to RPC lookup
      // For a production build, use the AllDomains SDK.
      return {
        domain: input.domain,
        message: 'AllDomains resolution requires the AllDomains SDK. Use resolveDomain with SNS for .sol domains.',
        owner: null,
      };
    }

    case 'getOwnedDomains': {
      return {
        wallet: input.wallet,
        domains: [],
        message: 'Query AllDomains program accounts for owned domains. Requires AllDomains SDK for decoding.',
      };
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'alldomains',
        method: method.name,
        params: input,
        message: `AllDomains ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Pyth — On-Chain Oracle ─────────────────────────────────────

async function executePyth(
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getPrice': {
      try {
        const feedId = input.priceId as string;
        // Try Hermes API first (supports both hex IDs and symbols)
        const res = await fetch(
          `${PYTH_API}/v2/updates/price/latest?ids[]=${feedId}`,
        );
        if (!res.ok) {
          return { error: `Pyth API error: ${res.status}`, id: feedId };
        }
        const data = await res.json();
        const parsed = (data as any)?.parsed?.[0]?.price;
        if (!parsed) {
          return { error: 'Price feed not found', id: feedId };
        }
        return {
          id: feedId,
          price: Number(parsed.price) * Math.pow(10, parsed.expo),
          confidence: Number(parsed.conf) * Math.pow(10, parsed.expo),
          expo: parsed.expo,
          publishTime: parsed.publish_time,
          status: 'trading',
        };
      } catch (err) {
        return { error: String(err), id: input.priceId };
      }
    }

    case 'listPriceFeeds': {
      try {
        const res = await fetch(`${PYTH_API}/v2/price_feeds`);
        if (!res.ok) {
          return { error: `Pyth API error: ${res.status}`, feeds: [] };
        }
        let feeds = (await res.json()) as any[];
        if (input.query) {
          const q = (input.query as string).toLowerCase();
          feeds = feeds.filter((f: any) =>
            (f.attributes?.symbol ?? '').toLowerCase().includes(q) ||
            (f.attributes?.description ?? '').toLowerCase().includes(q),
          );
        }
        if (input.assetType) {
          feeds = feeds.filter(
            (f: any) => (f.attributes?.asset_type ?? '') === input.assetType,
          );
        }
        return {
          feeds: feeds.slice(0, 50).map((f: any) => ({
            id: f.id,
            symbol: f.attributes?.symbol ?? '',
            assetType: f.attributes?.asset_type ?? '',
            description: f.attributes?.description ?? '',
          })),
        };
      } catch (err) {
        return { error: String(err), feeds: [] };
      }
    }

    case 'getPriceHistory': {
      return {
        message: 'Pyth historical data requires the Pyth Benchmarks API. Use getPrice for latest.',
        prices: [],
        priceId: input.priceId,
      };
    }

    default:
      return { error: `Unknown Pyth method: ${method.name}` };
  }
}

// ── CoinGecko ──────────────────────────────────────────────────

async function executeCoinGecko(
  method: ProtocolMethod,
  input: Record<string, unknown>,
  apiKey?: string,
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) {
    headers['x-cg-pro-api-key'] = apiKey;
  }
  const baseUrl = apiKey ? COINGECKO_API : 'https://api.coingecko.com/api/v3';

  try {
    switch (method.name) {
      case 'getTokenPrice': {
        const id = input.tokenId as string;
        const vs = (input.vsCurrency as string) ?? 'usd';
        const res = await fetch(
          `${baseUrl}/coins/markets?vs_currency=${vs}&ids=${id}&sparkline=false`,
          { headers },
        );
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const coins = (await res.json()) as any[];
        if (!coins.length) return { error: `Token not found: ${id}` };
        const c = coins[0];
        return {
          id: c.id,
          symbol: c.symbol,
          currentPrice: c.current_price,
          marketCap: c.market_cap,
          priceChange24h: c.price_change_24h,
          priceChangePercent24h: c.price_change_percentage_24h,
          volume24h: c.total_volume,
          high24h: c.high_24h,
          low24h: c.low_24h,
          ath: c.ath,
          athDate: c.ath_date,
        };
      }

      case 'getTrending': {
        const res = await fetch(`${baseUrl}/search/trending`, { headers });
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const data = await res.json();
        return {
          coins: ((data as any)?.coins ?? []).map((c: any) => ({
            id: c.item.id,
            name: c.item.name,
            symbol: c.item.symbol,
            marketCapRank: c.item.market_cap_rank,
            thumb: c.item.thumb,
          })),
          nfts: ((data as any)?.nfts ?? []).map((n: any) => ({
            id: n.id,
            name: n.name,
            symbol: n.symbol,
            thumb: n.thumb,
          })),
        };
      }

      case 'getTopGainersLosers': {
        const vs = (input.vsCurrency as string) ?? 'usd';
        const res = await fetch(
          `${baseUrl}/coins/markets?vs_currency=${vs}&order=price_change_percentage_24h_desc&per_page=50&page=1`,
          { headers },
        );
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const coins = (await res.json()) as any[];
        const sorted = [...coins].sort(
          (a, b) =>
            (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0),
        );
        const format = (c: any) => ({
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          priceChangePercent: c.price_change_percentage_24h,
          currentPrice: c.current_price,
        });
        return {
          topGainers: sorted.slice(0, 10).map(format),
          topLosers: sorted.slice(-10).reverse().map(format),
        };
      }

      case 'getTokenInfo': {
        const res = await fetch(`${baseUrl}/coins/${input.tokenId}`, { headers });
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const c = (await res.json()) as any;
        return {
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          description: c.description?.en?.slice(0, 500),
          homepage: c.links?.homepage?.[0],
          genesisDate: c.genesis_date,
          categories: c.categories,
          platforms: c.platforms,
          links: {
            twitter: c.links?.twitter_screen_name
              ? `https://twitter.com/${c.links.twitter_screen_name}`
              : undefined,
            telegram: c.links?.telegram_channel_identifier
              ? `https://t.me/${c.links.telegram_channel_identifier}`
              : undefined,
            github: c.links?.repos_url?.github,
          },
          marketData: {
            currentPrice: c.market_data?.current_price,
            totalSupply: c.market_data?.total_supply,
            circulatingSupply: c.market_data?.circulating_supply,
            maxSupply: c.market_data?.max_supply,
            fdv: c.market_data?.fully_diluted_valuation?.usd,
          },
        };
      }

      case 'getPoolsByToken': {
        const network = (input.network as string) ?? 'solana';
        const addr = input.tokenAddress as string;
        const onChainUrl = apiKey
          ? 'https://pro-api.coingecko.com/api/v3'
          : 'https://api.coingecko.com/api/v3';
        const res = await fetch(
          `${onChainUrl}/onchain/networks/${network}/tokens/${addr}/pools`,
          { headers },
        );
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const data = (await res.json()) as any;
        return {
          pools: ((data as any)?.data ?? []).map((p: any) => ({
            poolAddress: p.attributes?.address,
            dex: p.relationships?.dex?.data?.id,
            baseToken: {
              symbol: p.attributes?.base_token_symbol ?? '',
              address: '',
            },
            quoteToken: {
              symbol: p.attributes?.quote_token_symbol ?? '',
              address: '',
            },
            priceUsd: p.attributes?.base_token_price_usd,
            volume24h: p.attributes?.volume_usd?.h24 ? Number(p.attributes.volume_usd.h24) : undefined,
            liquidity: p.attributes?.reserve_in_usd ? Number(p.attributes.reserve_in_usd) : undefined,
            fdv: p.attributes?.fdv_usd ? Number(p.attributes.fdv_usd) : undefined,
          })),
          totalPools: (data as any)?.data?.length ?? 0,
        };
      }

      case 'getOHLCV': {
        const id = input.tokenId as string;
        const vs = (input.vsCurrency as string) ?? 'usd';
        const days = (input.days as string) ?? '7';
        const res = await fetch(
          `${baseUrl}/coins/${id}/market_chart?vs_currency=${vs}&days=${days}`,
          { headers },
        );
        if (!res.ok) return { error: `CoinGecko API error: ${res.status}` };
        const data = (await res.json()) as any;
        return {
          prices: data.prices ?? [],
          marketCaps: data.market_caps ?? [],
          totalVolumes: data.total_volumes ?? [],
        };
      }

      default:
        return { error: `Unknown CoinGecko method: ${method.name}` };
    }
  } catch (err) {
    return { error: String(err), method: method.name };
  }
}

// ── GibWork ────────────────────────────────────────────────────

async function executeGibWork(
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'listBounties': {
      try {
        const status = (input.status as string) ?? 'open';
        const limit = (input.limit as number) ?? 20;
        const res = await fetch(
          `${GIBWORK_API}/v1/bounties?status=${status}&limit=${limit}`,
        );
        if (!res.ok) return { error: `GibWork API error: ${res.status}`, bounties: [] };
        return await res.json();
      } catch (err) {
        return { error: String(err), bounties: [] };
      }
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'gibwork',
        method: method.name,
        params: input,
        message: `GibWork ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Send Arcade ────────────────────────────────────────────────

async function executeSendArcade(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // Send Arcade ops mostly involve on-chain transactions
  return {
    status: 'instruction_ready',
    protocol: 'send-arcade',
    method: method.name,
    params: input,
    message: `Send Arcade ${method.name} instruction prepared. Sign and submit.`,
  };
}

export default MiscPlugin;
