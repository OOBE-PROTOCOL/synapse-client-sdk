/**
 * @module ai/plugins/earnfi
 * @description EarnFi Plugin — human execution infrastructure for SAP / Synapse agents.
 *
 * Exposes the EarnFi Agent API (`ai-agent/v1`): social campaigns, manual tasks,
 * contests, human interrupts, and job polling — paid via x402 USDC on Solana.
 *
 * ```ts
 * import { SynapseAgentKit } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
 * import { createEarnFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/earnfi';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
 *   .use(createEarnFiPlugin({
 *     agentToken: process.env.EARNFI_AGENT_TOKEN,
 *     wallet: myWallet,
 *     connection: myConnection,
 *   }));
 * ```
 *
 * @see https://app.earnfi.fun/skill.md
 * @since 2.0.6
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import { EarnFiHttpClient, type EarnFiHttpClientConfig, EARNFI_DEFAULT_API_BASE } from './client';
import { earnfiMethods } from './schemas';

export {
  EarnFiHttpClient,
  EARNFI_DEFAULT_API_BASE,
  type EarnFiHttpClientConfig,
  type EarnFiWalletLike,
} from './client';
export { earnfiMethods, earnfiMethodNames, EARNFI_SAP_CAPABILITIES } from './schemas';

export type EarnFiPluginConfig = EarnFiHttpClientConfig;

/**
 * @description Factory — EarnFi requires runtime config (agent_token, optional wallet for x402).
 */
export function createEarnFiPlugin(config: EarnFiPluginConfig = {}): SynapsePlugin {
  const client = new EarnFiHttpClient(config);

  return {
    meta: {
      id: 'earnfi',
      name: 'EarnFi Human Execution',
      description:
        'Fund real human work on EarnFi — social campaigns, manual tasks, contests, interrupts — via x402 USDC. ' +
        'EarnFi retains agent identity and settlement internally.',
      version: '1.0.0',
      author: 'EarnFi (https://earnfi.fun)',
      tags: ['earnfi', 'human', 'x402', 'execution', 'microjobs', 'social', 'sap-capability'],
      mcpResources: ['https://app.earnfi.fun/skill.md', 'https://app.earnfi.fun/openapi-x402.json'],
    },

    protocols: [
      {
        id: 'earnfi-agent',
        name: 'EarnFi Agent API',
        methods: earnfiMethods,
        baseUrl: config.baseUrl ?? EARNFI_DEFAULT_API_BASE,
        requiresClient: false,
      },
    ],

    install(_context: PluginContext) {
      return {
        executor: async (method: ProtocolMethod, input: Record<string, unknown>) =>
          executeEarnFi(client, method, input),
      };
    },
  };
}

async function executeEarnFi(
  client: EarnFiHttpClient,
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  const token =
    (typeof input.agentToken === 'string' && input.agentToken) || client.agentToken || undefined;

  const withToken = (params: Record<string, string | undefined>) =>
    token ? { ...params, agent_token: token } : params;

  switch (method.name) {
    case 'getCatalog':
      return client.get('/catalog');

    case 'getX402Descriptor':
      return client.get('/x402');

    case 'fetchRegisterChallenge':
      return client.get('/register/challenge', {
        wallet_address: String(input.walletAddress),
        agent_name: String(input.agentName),
      });

    case 'registerAgent':
      return client.post('/register', input);

    case 'createSocialJob':
      return client.x402Get(
        '/jobs/social',
        withToken({
          task_type: String(input.taskType),
          slots: String(input.slots),
          reward_per_user: String(input.rewardPerUser),
          execution_mode: String(input.executionMode ?? 'human'),
          content_url: input.contentUrl ? String(input.contentUrl) : undefined,
          title: input.title ? String(input.title) : undefined,
        }),
      );

    case 'createManualJob':
      return client.x402Get(
        '/jobs/manual',
        withToken({
          title: String(input.title),
          instructions: String(input.instructions),
          slots: String(input.slots),
          reward_per_user: String(input.rewardPerUser),
          verification_method: String(input.verificationMethod ?? 'manual'),
          execution_mode: String(input.executionMode ?? 'human'),
        }),
      );

    case 'createContestJob':
      return client.x402Get(
        '/jobs/contest',
        withToken({
          title: String(input.title),
          instructions: String(input.instructions),
          total_prize_pool: String(input.totalPrizePool),
        }),
      );

    case 'createInterrupt':
      return client.x402Get(
        '/interrupt',
        withToken({
          question: String(input.question),
          slots: String(input.slots),
          reward_per_user: String(input.rewardPerUser),
        }),
      );

    case 'getJob': {
      const params: Record<string, string | undefined> = {};
      if (input.secret) params.secret = String(input.secret);
      else if (token) params.agent_token = token;
      return client.get(`/jobs/${encodeURIComponent(String(input.jobId))}`, params);
    }

    case 'listSubmissions': {
      const params: Record<string, string | undefined> = {};
      if (input.secret) params.secret = String(input.secret);
      else if (token) params.agent_token = token;
      return client.get(`/jobs/${encodeURIComponent(String(input.jobId))}/submissions`, params);
    }

    case 'listCompletions': {
      const params: Record<string, string | undefined> = {};
      if (input.secret) params.secret = String(input.secret);
      else if (token) params.agent_token = token;
      return client.get(`/jobs/${encodeURIComponent(String(input.jobId))}/completions`, params);
    }

    case 'pauseJob':
      return client.get(`/jobs/${encodeURIComponent(String(input.jobId))}/pause`, withToken({}));

    case 'getInterruptStatus':
      return client.get(`/interrupt/${encodeURIComponent(String(input.interruptId))}`);

    default:
      throw new Error(`[EarnFiPlugin] Unknown method: ${method.name}`);
  }
}

export default createEarnFiPlugin;
