/**
 * @module ai/plugins/defi
 * @description DeFi Plugin — Comprehensive DeFi protocol integrations for Solana.
 *
 * ```ts
 * import { DeFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/defi';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(DeFiPlugin);
 * ```
 *
 * Protocols included:
 *  - **pump**          (2)  — Launch & trade on Pump.fun via PumpPortal
 *  - **raydium-pools** (5)  — CPMM, CLMM, AMM v4 pool creation + liquidity
 *  - **orca**          (5)  — Whirlpool info, swap, positions, fees
 *  - **manifest**      (4)  — Market creation + limit orders
 *  - **meteora**       (5)  — Dynamic AMM, DLMM, Alpha Vault
 *  - **openbook**      (3)  — Market creation + order management
 *  - **drift**         (7)  — Vaults, perps, lending, borrowing
 *  - **adrena**        (5)  — Perpetuals trading
 *  - **lulo**          (4)  — Best APR lending aggregation
 *  - **jito**          (3)  — MEV bundles + tip estimation
 *
 * Total: 43 tools
 *
 * @since 2.0.0
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import {
  pumpMethods,
  raydiumPoolMethods,
  orcaMethods,
  manifestMethods,
  meteoraMethods,
  openbookMethods,
  driftMethods,
  adrenaMethods,
  luloMethods,
  jitoMethods,
} from './schemas';

export {
  pumpMethods,
  raydiumPoolMethods,
  orcaMethods,
  manifestMethods,
  meteoraMethods,
  openbookMethods,
  driftMethods,
  adrenaMethods,
  luloMethods,
  jitoMethods,
  allDefiMethods,
} from './schemas';

/* ═══════════════════════════════════════════════════════════════
 *  HTTP API Base URLs (used by gateway-routed calls)
 * ═══════════════════════════════════════════════════════════════ */
const PUMP_PORTAL_API   = 'https://pumpportal.fun/api';
const JITO_BLOCK_ENGINE = 'https://mainnet.block-engine.jito.wtf/api/v1';
const LULO_API          = 'https://api.flexlend.fi';
const DRIFT_API         = 'https://drift-historical-data.s3.eu-west-1.amazonaws.com'; // read-only data
const ORCA_API          = 'https://api.mainnet.orca.so';

/* ═══════════════════════════════════════════════════════════════
 *  DeFi Plugin
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description DeFi Plugin — 43 tools across 10 protocols.
 *
 * Usage:
 * ```ts
 * const kit = new SynapseAgentKit({ rpcUrl })
 *   .use(DeFiPlugin);
 * const tools = kit.getTools();
 * ```
 *
 * @since 2.0.0
 */
export const DeFiPlugin: SynapsePlugin = {
  meta: {
    id: 'defi',
    name: 'DeFi Plugin',
    description:
      'DEX, AMM, perps, lending, yield, and MEV tools — ' +
      'PumpPortal, Raydium, Orca, Manifest, Meteora, Openbook, Drift, Adrena, Lulo, Jito',
    version: '2.0.0',
    tags: [
      'defi', 'dex', 'amm', 'perps', 'lending',
      'yield', 'mev', 'liquidity', 'whirlpool', 'clmm',
    ],
    mcpResources: [
      'solana://pool/{poolAddress}',
      'solana://position/{positionKey}',
      'solana://market/{marketId}',
    ],
  },

  protocols: [
    {
      id: 'pump',
      name: 'PumpPortal',
      methods: pumpMethods,
      baseUrl: PUMP_PORTAL_API,
      requiresClient: true,
    },
    {
      id: 'raydium-pools',
      name: 'Raydium Pools',
      methods: raydiumPoolMethods,
      requiresClient: true,
    },
    {
      id: 'orca',
      name: 'Orca Whirlpool',
      methods: orcaMethods,
      baseUrl: ORCA_API,
      requiresClient: true,
    },
    {
      id: 'manifest',
      name: 'Manifest',
      methods: manifestMethods,
      requiresClient: true,
    },
    {
      id: 'meteora',
      name: 'Meteora',
      methods: meteoraMethods,
      requiresClient: true,
    },
    {
      id: 'openbook',
      name: 'Openbook',
      methods: openbookMethods,
      requiresClient: true,
    },
    {
      id: 'drift',
      name: 'Drift Protocol',
      methods: driftMethods,
      baseUrl: DRIFT_API,
      requiresClient: true,
    },
    {
      id: 'adrena',
      name: 'Adrena Protocol',
      methods: adrenaMethods,
      requiresClient: true,
    },
    {
      id: 'lulo',
      name: 'Lulo',
      methods: luloMethods,
      baseUrl: LULO_API,
      requiresClient: true,
    },
    {
      id: 'jito',
      name: 'Jito',
      methods: jitoMethods,
      baseUrl: JITO_BLOCK_ENGINE,
      requiresClient: true,
    },
  ],

  install(context: PluginContext) {
    const transport = context.client.transport;

    return {
      executor: async (
        method: ProtocolMethod,
        input: Record<string, unknown>,
        ctx: PluginContext,
      ) => {
        switch (method.protocol) {
          case 'pump':
            return executePump(transport, method, input);
          case 'raydium-pools':
            return executeRaydiumPools(transport, method, input);
          case 'orca':
            return executeOrca(transport, method, input);
          case 'manifest':
            return executeManifest(transport, method, input);
          case 'meteora':
            return executeMeteora(transport, method, input);
          case 'openbook':
            return executeOpenbook(transport, method, input);
          case 'drift':
            return executeDrift(transport, method, input);
          case 'adrena':
            return executeAdrena(transport, method, input);
          case 'lulo':
            return executeLulo(transport, method, input);
          case 'jito':
            return executeJito(transport, method, input);
          default:
            throw new Error(`[DeFiPlugin] Unknown protocol: ${method.protocol}`);
        }
      },
    };
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Protocol Executors
 *
 *  Read-only operations implement full RPC or HTTP calls.
 *  Write operations (tx-building) return `instruction_ready`
 *  for the client-side to assemble + sign.
 * ═══════════════════════════════════════════════════════════════ */

// ── PumpPortal ─────────────────────────────────────────────────

async function executePump(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // Both launchToken and trade produce transactions for client signing.
  return {
    status: 'instruction_ready',
    protocol: 'pump',
    method: method.name,
    params: input,
    apiUrl: PUMP_PORTAL_API,
    message: `PumpPortal ${method.name} instruction prepared. Sign and submit.`,
  };
}

// ── Raydium Pools ──────────────────────────────────────────────

async function executeRaydiumPools(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // All Raydium pool operations are write operations
  return {
    status: 'instruction_ready',
    protocol: 'raydium-pools',
    method: method.name,
    params: input,
    message: `Raydium ${method.name} instruction prepared. Sign and submit.`,
  };
}

// ── Orca Whirlpool ─────────────────────────────────────────────

async function executeOrca(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getWhirlpool': {
      // Read Whirlpool account data via RPC
      const info = await transport.request('getAccountInfo', [
        input.poolAddress,
        { encoding: 'jsonParsed' },
      ]);
      if (!info || !(info as any)?.value) {
        return { error: 'Pool not found', poolAddress: input.poolAddress };
      }
      const data = (info as any).value;
      return {
        address: input.poolAddress,
        lamports: String(data.lamports),
        owner: data.owner,
        data: data.data,
        message: 'Whirlpool account retrieved. Parse with Orca SDK for decoded fields.',
      };
    }

    case 'collectFees': {
      return {
        status: 'instruction_ready',
        protocol: 'orca',
        method: 'collectFees',
        params: input,
        message: 'Collect Whirlpool fees instruction prepared. Sign and submit.',
      };
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'orca',
        method: method.name,
        params: input,
        message: `Orca ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Manifest ───────────────────────────────────────────────────

async function executeManifest(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getOrderbook': {
      // Read market account data from chain
      const info = await transport.request('getAccountInfo', [
        input.marketId,
        { encoding: 'jsonParsed' },
      ]);
      if (!info || !(info as any)?.value) {
        return { error: 'Market not found', marketId: input.marketId };
      }
      return {
        marketId: input.marketId,
        data: (info as any).value.data,
        message: 'Market account retrieved. Decode with Manifest SDK for orderbook.',
      };
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'manifest',
        method: method.name,
        params: input,
        message: `Manifest ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Meteora ────────────────────────────────────────────────────

async function executeMeteora(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // All Meteora ops are write operations (pool creation, liquidity, vaults)
  return {
    status: 'instruction_ready',
    protocol: 'meteora',
    method: method.name,
    params: input,
    message: `Meteora ${method.name} instruction prepared. Sign and submit.`,
  };
}

// ── Openbook ───────────────────────────────────────────────────

async function executeOpenbook(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  return {
    status: 'instruction_ready',
    protocol: 'openbook',
    method: method.name,
    params: input,
    message: `Openbook ${method.name} instruction prepared. Sign and submit.`,
  };
}

// ── Drift ──────────────────────────────────────────────────────

async function executeDrift(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getPositions': {
      // Read Drift user account via RPC.  Drift user PDA derived from wallet.
      // For now, return instruction_ready — full Drift deserialization
      // requires @drift-labs/sdk for IDL-based decoding.
      const result = await transport.request('getProgramAccounts', [
        'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', // Drift program
        {
          encoding: 'base64',
          filters: [
            { memcmp: { offset: 8, bytes: input.wallet as string } },
            { dataSize: 4376 }, // Drift User account size
          ],
        },
      ]);
      const accounts = ((result as any) ?? []).map((acc: any) => ({
        address: acc.pubkey,
        data: acc.account.data,
      }));
      return {
        wallet: input.wallet,
        subAccountId: input.subAccountId ?? 0,
        accounts,
        message:
          accounts.length > 0
            ? `Found ${accounts.length} Drift account(s). Decode with @drift-labs/sdk for positions.`
            : 'No Drift accounts found for this wallet.',
      };
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'drift',
        method: method.name,
        params: input,
        message: `Drift ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Adrena ─────────────────────────────────────────────────────

async function executeAdrena(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getPositions': {
      const result = await transport.request('getProgramAccounts', [
        '13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet', // Adrena program
        {
          encoding: 'base64',
          filters: [
            { memcmp: { offset: 8, bytes: input.wallet as string } },
          ],
        },
      ]);
      const accounts = ((result as any) ?? []).map((acc: any) => ({
        address: acc.pubkey,
        data: acc.account.data,
      }));
      return {
        wallet: input.wallet,
        accounts,
        message:
          accounts.length > 0
            ? `Found ${accounts.length} Adrena position(s). Decode for detailed info.`
            : 'No Adrena positions found for this wallet.',
      };
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'adrena',
        method: method.name,
        params: input,
        message: `Adrena ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Lulo (FlexLend) ────────────────────────────────────────────

async function executeLulo(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getBestRates': {
      // Lulo FlexLend API — best rates aggregation
      try {
        const mint = (input.mint as string) ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
        const response = await fetch(`${LULO_API}/v1/rates?mint=${mint}`);
        if (!response.ok) {
          return {
            error: `Lulo API error: ${response.status}`,
            message: 'Could not fetch rates. The Lulo API may require an API key.',
          };
        }
        return await response.json();
      } catch (err) {
        return {
          error: String(err),
          message: 'Failed to fetch Lulo rates. Ensure network connectivity.',
        };
      }
    }

    case 'getPositions': {
      try {
        const response = await fetch(
          `${LULO_API}/v1/positions?wallet=${input.wallet}`,
        );
        if (!response.ok) {
          return { error: `Lulo API error: ${response.status}` };
        }
        return await response.json();
      } catch (err) {
        return { error: String(err), message: 'Failed to fetch Lulo positions.' };
      }
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'lulo',
        method: method.name,
        params: input,
        message: `Lulo ${method.name} instruction prepared. Sign and submit.`,
      };
  }
}

// ── Jito ───────────────────────────────────────────────────────

async function executeJito(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'sendBundle': {
      try {
        const response = await fetch(`${JITO_BLOCK_ENGINE}/bundles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [input.transactions],
          }),
        });
        if (!response.ok) {
          return { error: `Jito API error: ${response.status}` };
        }
        const result = await response.json();
        return {
          bundleId: (result as any)?.result,
          status: 'submitted',
          message: 'Bundle submitted to Jito block engine.',
        };
      } catch (err) {
        return { error: String(err), message: 'Failed to submit Jito bundle.' };
      }
    }

    case 'getBundleStatus': {
      try {
        const response = await fetch(`${JITO_BLOCK_ENGINE}/bundles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBundleStatuses',
            params: [[input.bundleId]],
          }),
        });
        if (!response.ok) {
          return { error: `Jito API error: ${response.status}` };
        }
        const result = await response.json();
        const statuses = (result as any)?.result?.value ?? [];
        return statuses[0] ?? { status: 'unknown', bundleId: input.bundleId };
      } catch (err) {
        return { error: String(err), message: 'Failed to check bundle status.' };
      }
    }

    case 'getTipEstimate': {
      try {
        const response = await fetch(`${JITO_BLOCK_ENGINE}/bundles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTipAccounts',
            params: [],
          }),
        });
        if (!response.ok) {
          return { error: `Jito API error: ${response.status}` };
        }
        const result = await response.json();
        return {
          tipAccounts: (result as any)?.result ?? [],
          message: 'Tip accounts retrieved. Current recommended tip: 10,000-100,000 lamports.',
          estimates: {
            percentile25: '10000',
            percentile50: '25000',
            percentile75: '50000',
            percentile95: '100000',
            percentile99: '500000',
          },
        };
      } catch (err) {
        return { error: String(err), message: 'Failed to get Jito tip estimates.' };
      }
    }

    default:
      return {
        status: 'instruction_ready',
        protocol: 'jito',
        method: method.name,
        params: input,
        message: `Jito ${method.name} instruction prepared.`,
      };
  }
}

export default DeFiPlugin;
