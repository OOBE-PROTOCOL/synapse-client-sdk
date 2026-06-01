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
      return client.getCatalog();

    case 'getX402Descriptor':
      return client.getX402Preview();

    case 'fetchRegisterChallenge':
      return client.get('/register/challenge', {
        wallet_address: String(input.walletAddress),
        agent_name: String(input.agentName),
      });

    case 'registerAgent':
      return client.post('/register', input);

    case 'createSocialJob':
      return client.createSocialJob({
        taskType: String(input.taskType),
        slots: Number(input.slots),
        rewardPerUser: String(input.rewardPerUser),
        executionMode: (input.executionMode as 'human' | undefined) ?? 'human',
        contentUrl: input.contentUrl ? String(input.contentUrl) : undefined,
        title: input.title ? String(input.title) : undefined,
        agentToken: token,
      });

    case 'createManualJob':
      return client.createManualJob({
        title: String(input.title),
        instructions: String(input.instructions),
        slots: Number(input.slots),
        rewardPerUser: String(input.rewardPerUser),
        verificationMethod: (input.verificationMethod as 'manual' | 'auto' | undefined) ?? 'manual',
        executionMode: (input.executionMode as 'human' | undefined) ?? 'human',
        agentToken: token,
      });

    case 'createContestJob':
      return client.createContestJob({
        title: String(input.title),
        instructions: String(input.instructions),
        totalPrizePool: String(input.totalPrizePool),
        agentToken: token,
      });

    case 'createInterrupt':
      return client.createInterrupt({
        question: String(input.question),
        slots: Number(input.slots),
        rewardPerUser: String(input.rewardPerUser),
        agentToken: token,
      });

    case 'getJob':
      return client.getJob(String(input.jobId), {
        secret: input.secret ? String(input.secret) : undefined,
        agentToken: token,
      });

    case 'listSubmissions':
      return client.listSubmissions(String(input.jobId), {
        secret: input.secret ? String(input.secret) : undefined,
        agentToken: token,
      });

    case 'listCompletions':
      return client.listCompletions(String(input.jobId), {
        secret: input.secret ? String(input.secret) : undefined,
        agentToken: token,
      });

    case 'pauseJob':
      return client.pauseJob(String(input.jobId), token);

    case 'getInterruptStatus':
      return client.getInterruptStatus(String(input.interruptId), {
        secret: input.secret ? String(input.secret) : undefined,
        agentToken: token,
      });

    case 'listPendingVerifications':
      return client.listPendingVerifications(String(input.jobId), token);

    case 'approveVerification':
      return client.approveVerification(String(input.verificationId), token);

    case 'rejectVerification':
      return client.rejectVerification(String(input.verificationId), {
        reason: input.reason ? String(input.reason) : undefined,
        agentToken: token,
      });

    case 'listContestSubmissions':
      return client.listContestSubmissions(String(input.jobId), token);

    case 'markContestWinner':
      return client.markContestWinner(String(input.jobId), {
        submissionId: String(input.submissionId),
        rankPosition: input.rankPosition !== undefined ? Number(input.rankPosition) : undefined,
        agentToken: token,
      });

    case 'getCreatorJobDetail':
      return client.getCreatorJobDetail(String(input.jobId), token);

    case 'listJobParticipants':
      return client.listJobParticipants(String(input.jobId), token);

    case 'listJobPayments':
      return client.listJobPayments(String(input.jobId), token);

    default:
      throw new Error(`[EarnFiPlugin] Unknown method: ${method.name}`);
  }
}

export default createEarnFiPlugin;
