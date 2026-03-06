/**
 * @module ai/sap
 * @description Solana Agent Protocol (SAP) — On-chain agent identity, discovery & reputation.
 *
 * Sub-modules:
 *  - `types`     — PDA account schema, instruction params, filter types
 *  - `pda`       — PDA derivation, Borsh serialization/deserialization
 *  - `program`   — Transaction instruction builders (register, update, deactivate)
 *  - `discovery` — On-chain agent search via `getProgramAccounts`
 *  - `adapter`   — {@link OnChainPersistenceAdapter} for {@link AgentRegistry}
 *
 * @example
 * ```ts
 * import {
 *   SAPInstructionBuilder,
 *   SAPDiscovery,
 *   OnChainPersistenceAdapter,
 *   deriveAgentPDA,
 * } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * // 1. Derive PDA address
 * const pda = deriveAgentPDA(walletPubkey, programId);
 *
 * // 2. Build registration instruction
 * const builder = new SAPInstructionBuilder({ programId });
 * const ix = builder.register({
 *   walletPubkey,
 *   name: 'My DeFi Agent',
 *   description: 'Jupiter + Raydium tools',
 *   capabilities: [{ id: 'jupiter:swap' }, { id: 'raydium:pool_info' }],
 *   pricing: [{ tierId: 'standard', pricePerCall: 1000n, rateLimit: 10, maxCallsPerSession: 100, tokenType: 'USDC' }],
 *   x402Endpoint: 'https://myagent.xyz/.well-known/x402',
 * });
 *
 * // 3. Discover agents on-chain
 * const discovery = new SAPDiscovery(client, { programId });
 * const agents = await discovery.find({ capability: 'jupiter:swap', minReputation: 700 });
 *
 * // 4. Use as persistence adapter for AgentRegistry
 * const adapter = new OnChainPersistenceAdapter(client, { programId });
 * const registry = new AgentRegistry({ adapter });
 * ```
 *
 * @since 1.3.0
 */

/* ── Types ── */
export type {
  SAPConfig,
  AgentCapability,
  AgentPricingOnChain,
  AgentReputationOnChain,
  AgentPDAAccount,
  RegisterAgentParams,
  UpdateAgentParams,
  UpdateReputationParams,
  AgentDiscoveryFilter,
  DiscoveryResult,
  SAPAggregateMetrics,
  SAPInstruction,
  SAPAccountMeta,
  VolumeCurveBreakpoint,
} from './types';

export {
  SAP_DEFAULT_PROGRAM_ID,
  SAP_SEED_PREFIX,
  SAP_ACCOUNT_DISCRIMINATOR,
  SAP_INSTRUCTION_DISCRIMINATORS,
  pdaToIdentity,
  pricingToTier,
  computeCallCost,
  estimateTotalCost,
} from './types';

/* ── PDA ── */
export type { DerivedPDA } from './pda';

export {
  deriveAgentPDA,
  deserializeAgentAccount,
  serializeRegisterData,
  serializeUpdateData,
  base58Decode,
  base58Encode,
  isOnCurve,
  BorshReader,
  BorshWriter,
} from './pda';

/* ── Program ── */
export {
  SAPInstructionBuilder,
  SAPProgramError,
} from './program';

/* ── Discovery ── */
export {
  SAPDiscovery,
  SAPDiscoveryError,
} from './discovery';

/* ── Adapter ── */
export {
  OnChainPersistenceAdapter,
} from './adapter';

/* ── Registry ── */
export type {
  CapabilityCategory,
  CapabilityIOSchema,
  CapabilityDefinition,
} from './registry';

export {
  SAPCapabilityRegistry,
} from './registry';

/* ── Validator ── */
export type {
  ValidationSeverity,
  ValidationIssue,
  ValidationReport,
  SAPValidatorConfig,
} from './validator';

export {
  SAPValidator,
  SAPValidationError,
} from './validator';

/* ── Subnetwork ── */
export type {
  SelectionStrategy,
  SubnetworkConfig,
  CapabilityAssignment,
  SubnetworkResult,
  SubnetworkHealth,
} from './subnetwork';

export {
  SubnetworkBuilder,
} from './subnetwork';

/* ── Scoring ── */
export type {
  HealthScoreBreakdown,
  AgentHealthScore,
  NetworkAnalytics,
} from './scoring';

export {
  computeAgentHealthScore,
  computeNetworkAnalytics,
} from './scoring';
