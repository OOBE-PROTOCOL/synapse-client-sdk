/**
 * @module ai/plugins/earnfi/schemas
 * @description Zod schemas for EarnFi Agent API tools (human execution + x402).
 * @see https://app.earnfi.fun/skill.md
 * @since 2.0.6
 */
import { z } from 'zod';
import { createMethodRegistry } from '../../tools/protocols/shared';

const zJobId = z.string().describe('EarnFi job id (e.g. EF1A2B)');
const zSecret = z.string().optional().describe('Per-job secret from paid create response');
const zAgentToken = z.string().optional().describe('EarnFi agent_token from POST /register');

const jobCreated = z.object({
  success: z.boolean().optional(),
  job_id: z.string().optional(),
  secret: z.string().optional(),
  status: z.string().optional(),
  status_url: z.string().optional(),
}).passthrough();

const genericJson = z.record(z.string(), z.unknown());

const { register: reg, methods: earnfiMethods } = createMethodRegistry('earnfi-agent');

reg(
  'getCatalog',
  z.object({}),
  genericJson,
  'List EarnFi job types, minimum rewards, and execution policy (free).',
  { httpMethod: 'GET', path: '/catalog' },
);

reg(
  'getX402Descriptor',
  z.object({}),
  genericJson,
  'Preview EarnFi x402 payment framing (returns HTTP 402).',
  { httpMethod: 'GET', path: '/x402' },
);

reg(
  'fetchRegisterChallenge',
  z.object({
    walletAddress: z.string().describe('Solana wallet public key (base58)'),
    agentName: z.string().describe('Display name for the agent'),
  }),
  genericJson,
  'Get canonical registration message + nonce (recommended before POST /register).',
  { httpMethod: 'GET', path: '/register/challenge' },
);

reg(
  'registerAgent',
  z.object({
    wallet_address: z.string(),
    agent_name: z.string(),
    message: z.string(),
    signature: z.union([z.array(z.number()), z.string()]),
    nonce: z.string().optional(),
  }),
  genericJson,
  'Register an EarnFi agent (Ed25519 message signature). Returns agent_token once.',
  { httpMethod: 'POST', path: '/register' },
);

reg(
  'createSocialJob',
  z.object({
    taskType: z.string().describe('From GET /catalog (e.g. like, follow, video)'),
    slots: z.number().int().positive(),
    rewardPerUser: z.string().describe('USD decimal string per participant'),
    executionMode: z.literal('human').optional().default('human'),
    contentUrl: z.string().url().optional(),
    title: z.string().optional(),
    agentToken: zAgentToken,
  }),
  jobCreated,
  'Create a paid social campaign (x402 USDC). Quote on first call; pays when wallet configured.',
  { httpMethod: 'GET', path: '/jobs/social' },
);

reg(
  'createManualJob',
  z.object({
    title: z.string(),
    instructions: z.string(),
    slots: z.number().int().positive(),
    rewardPerUser: z.string(),
    verificationMethod: z.enum(['manual', 'auto']).optional().default('manual'),
    executionMode: z.literal('human').optional().default('human'),
    agentToken: zAgentToken,
  }),
  jobCreated,
  'Create a paid custom human task job (x402 USDC).',
  { httpMethod: 'GET', path: '/jobs/manual' },
);

reg(
  'createContestJob',
  z.object({
    title: z.string(),
    instructions: z.string(),
    totalPrizePool: z.string().describe('Total prize pool USD'),
    agentToken: zAgentToken,
  }),
  jobCreated,
  'Create a paid contest / bounty job (x402 USDC).',
  { httpMethod: 'GET', path: '/jobs/contest' },
);

reg(
  'createInterrupt',
  z.object({
    question: z.string(),
    slots: z.number().int().positive(),
    rewardPerUser: z.string(),
    agentToken: zAgentToken,
  }),
  jobCreated,
  'Ask humans one question (human interrupt, x402 USDC).',
  { httpMethod: 'GET', path: '/interrupt' },
);

reg(
  'getJob',
  z.object({ jobId: zJobId, secret: zSecret, agentToken: zAgentToken }),
  genericJson,
  'Poll job status (free with secret or agent_token).',
  { httpMethod: 'GET', path: '/jobs/{id}' },
);

reg(
  'listSubmissions',
  z.object({ jobId: zJobId, secret: zSecret, agentToken: zAgentToken }),
  genericJson,
  'List job submissions (free poll).',
  { httpMethod: 'GET', path: '/jobs/{id}/submissions' },
);

reg(
  'listCompletions',
  z.object({ jobId: zJobId, secret: zSecret, agentToken: zAgentToken }),
  genericJson,
  'List job completions (free poll).',
  { httpMethod: 'GET', path: '/jobs/{id}/completions' },
);

reg(
  'pauseJob',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'Pause or resume a job (creator, agent_token).',
  { httpMethod: 'POST', path: '/jobs/{id}/pause' },
);

reg(
  'getInterruptStatus',
  z.object({ interruptId: z.string(), secret: zSecret, agentToken: zAgentToken }),
  genericJson,
  'Read human interrupt record by id.',
  { httpMethod: 'GET', path: '/interrupt/{id}' },
);

reg(
  'listPendingVerifications',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'List pending manual verifications for a job (creator).',
  { httpMethod: 'GET', path: '/jobs/{id}/verifications' },
);

reg(
  'approveVerification',
  z.object({ verificationId: z.string(), agentToken: zAgentToken }),
  genericJson,
  'Approve a pending manual verification.',
  { httpMethod: 'POST', path: '/verifications/{id}/approve' },
);

reg(
  'rejectVerification',
  z.object({
    verificationId: z.string(),
    reason: z.string().optional(),
    agentToken: zAgentToken,
  }),
  genericJson,
  'Reject a pending manual verification.',
  { httpMethod: 'POST', path: '/verifications/{id}/reject' },
);

reg(
  'listContestSubmissions',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'List contest submissions (creator).',
  { httpMethod: 'GET', path: '/jobs/{id}/contest/submissions' },
);

reg(
  'markContestWinner',
  z.object({
    jobId: zJobId,
    submissionId: z.string(),
    rankPosition: z.number().int().positive().optional(),
    agentToken: zAgentToken,
  }),
  genericJson,
  'Mark a contest submission as winner.',
  { httpMethod: 'POST', path: '/jobs/{id}/contest/mark-winner' },
);

reg(
  'getCreatorJobDetail',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'Extended creator job detail view.',
  { httpMethod: 'GET', path: '/jobs/{id}/detail' },
);

reg(
  'listJobParticipants',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'List users who joined or completed a job.',
  { httpMethod: 'GET', path: '/jobs/{id}/users' },
);

reg(
  'listJobPayments',
  z.object({ jobId: zJobId, agentToken: zAgentToken }),
  genericJson,
  'List payment rows linked to a job.',
  { httpMethod: 'GET', path: '/jobs/{id}/payments' },
);

export { earnfiMethods, reg as registerEarnFiMethod };

export const earnfiMethodNames = earnfiMethods.map((m) => m.name);

export const EARNFI_SAP_CAPABILITIES = {
  'human.social.engagement': 'createSocialJob',
  'human.task.manual': 'createManualJob',
  'human.contest.bounty': 'createContestJob',
  'human.interrupt.qa': 'createInterrupt',
} as const;
