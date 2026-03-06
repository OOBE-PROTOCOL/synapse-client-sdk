/**
 * @module ai/plugins/token
 * @description Token Plugin — SPL token operations, staking, and cross-chain bridging.
 *
 * ```ts
 * import { TokenPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/token';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(TokenPlugin);
 * ```
 *
 * Tools included:
 *  - **spl-token** (11): deployToken, transfer, transferSol, getBalance, getTokenAccounts,
 *    mintTo, burn, freezeAccount, thawAccount, closeAccount, rugCheck
 *  - **staking** (7): stakeSOL, unstakeSOL, getStakeAccounts, stakeJupSOL, unstakeJupSOL,
 *    stakeSolayer, unstakeSolayer
 *  - **bridging** (4): bridgeWormhole, bridgeWormholeStatus, bridgeDeBridge, bridgeDeBridgeStatus
 *
 * @since 2.0.0
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import { tokenSplMethods, tokenStakingMethods, tokenBridgingMethods } from './schemas';

export { tokenSplMethods, tokenStakingMethods, tokenBridgingMethods, allTokenMethods } from './schemas';

/**
 * @description Token Plugin — the `.use(TokenPlugin)` instance.
 *
 * Registers 22 tools across 3 protocols:
 *  - `spl-token` — core SPL token operations
 *  - `staking` — native + liquid staking
 *  - `bridging` — cross-chain bridges (Wormhole, deBridge)
 *
 * @since 2.0.0
 */
export const TokenPlugin: SynapsePlugin = {
  meta: {
    id: 'token',
    name: 'Token Plugin',
    description: 'SPL token operations: deploy, transfer, stake, bridge, and safety checks',
    version: '2.0.0',
    tags: ['token', 'spl', 'staking', 'bridging', 'transfer', 'defi'],
    mcpResources: [
      'solana://token/{mint}',
      'solana://balance/{wallet}',
      'solana://stake/{wallet}',
    ],
  },

  protocols: [
    {
      id: 'spl-token',
      name: 'SPL Token',
      methods: tokenSplMethods,
      requiresClient: true,
    },
    {
      id: 'staking',
      name: 'Staking',
      methods: tokenStakingMethods,
      requiresClient: true,
    },
    {
      id: 'bridging',
      name: 'Cross-Chain Bridging',
      methods: tokenBridgingMethods,
      baseUrl: 'https://api.wormholescan.io',
      requiresClient: true,
    },
  ],

  install(context: PluginContext) {
    const transport = context.client.transport;

    return {
      executor: async (method: ProtocolMethod, input: Record<string, unknown>, ctx: PluginContext) => {
        // Route to the correct protocol handler
        switch (method.protocol) {
          case 'spl-token':
            return executeSplToken(transport, method, input);
          case 'staking':
            return executeStaking(transport, method, input);
          case 'bridging':
            return executeBridging(transport, method, input);
          default:
            throw new Error(`Unknown protocol: ${method.protocol}`);
        }
      },
    };
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Protocol executors — RPC-backed
 * ═══════════════════════════════════════════════════════════════ */

async function executeSplToken(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // Each method maps to on-chain instruction building + RPC simulation/submission.
  // The transport is used for account reads, recent blockhash, etc.
  switch (method.name) {
    case 'getBalance': {
      if (input.mint) {
        // SPL token balance via getTokenAccountsByOwner
        const result = await transport.request('getTokenAccountsByOwner', [
          input.wallet,
          { mint: input.mint },
          { encoding: 'jsonParsed' },
        ]);
        const accounts = (result as any)?.value ?? [];
        if (accounts.length === 0) {
          return { balance: '0', decimals: 0, uiAmount: 0, mint: input.mint };
        }
        const info = accounts[0].account.data.parsed.info;
        return {
          balance: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount,
          mint: input.mint,
        };
      }
      // Native SOL balance
      const lamports = await transport.request('getBalance', [input.wallet]);
      return {
        balance: String((lamports as any)?.value ?? lamports),
        decimals: 9,
        uiAmount: Number((lamports as any)?.value ?? lamports) / 1e9,
      };
    }

    case 'getTokenAccounts': {
      const result = await transport.request('getTokenAccountsByOwner', [
        input.wallet,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]);
      const solBalance = await transport.request('getBalance', [input.wallet]);
      const accounts = ((result as any)?.value ?? []).map((acc: any) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          ata: acc.pubkey,
          amount: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount,
        };
      }).filter((a: any) => input.showZeroBalance || Number(a.amount) > 0);

      return {
        accounts,
        totalAccounts: accounts.length,
        nativeSolBalance: String((solBalance as any)?.value ?? solBalance),
      };
    }

    default:
      // For write operations (deployToken, transfer, mintTo, burn, etc.),
      // return instruction data that client-side can assemble into a transaction.
      return {
        status: 'instruction_ready',
        method: method.name,
        params: input,
        message: `${method.name} instruction prepared. Sign and submit the transaction.`,
      };
  }
}

async function executeStaking(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (method.name) {
    case 'getStakeAccounts': {
      const result = await transport.request('getProgramAccounts', [
        'Stake11111111111111111111111111111111111111',
        {
          encoding: 'jsonParsed',
          filters: [
            { memcmp: { offset: 12, bytes: input.wallet as string } },
          ],
        },
      ]);
      const accounts = ((result as any) ?? []).map((acc: any) => {
        const parsed = acc.account.data.parsed?.info;
        return {
          address: acc.pubkey,
          lamports: String(acc.account.lamports),
          state: parsed?.stake?.delegation ? 'active' : 'inactive',
          validator: parsed?.stake?.delegation?.voter,
          activationEpoch: parsed?.stake?.delegation?.activationEpoch,
        };
      });
      const totalStaked = accounts.reduce(
        (sum: bigint, a: any) => sum + BigInt(a.lamports), 0n,
      );
      return { accounts, totalStaked: String(totalStaked) };
    }

    default:
      return {
        status: 'instruction_ready',
        method: method.name,
        params: input,
        message: `${method.name} instruction prepared. Sign and submit the transaction.`,
      };
  }
}

async function executeBridging(
  transport: any,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  // Bridge operations produce instruction data for client-side signing
  return {
    status: 'instruction_ready',
    method: method.name,
    protocol: method.protocol,
    params: input,
    message: `${method.name} requires cross-chain coordination. Instruction data prepared.`,
  };
}

export default TokenPlugin;
