/**
 * @module ai/sap/program
 * @description SAP — Instruction builder for the Solana Agent Protocol program.
 *
 * Creates `TransactionInstruction`-compatible objects for every SAP method:
 * - `register`         — create a new agent PDA
 * - `update`           — update agent capabilities, pricing, endpoint
 * - `deactivate`       — mark agent as inactive
 * - `updateReputation` — post new reputation metrics
 *
 * The user signs and sends the transaction via their wallet/signer.
 *
 * @example
 * ```ts
 * import { SAPInstructionBuilder } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * const builder = new SAPInstructionBuilder({ programId: 'SAPAgnt1...' });
 * const ix = builder.register({
 *   walletPubkey: wallet.publicKey.toBase58(),
 *   name: 'DeFi Oracle Agent',
 *   description: 'Jupiter + Raydium tools',
 *   capabilities: [{ id: 'jupiter:swap' }, { id: 'raydium:pool_info' }],
 *   pricing: [{ tierId: 'standard', pricePerCall: 1000n, rateLimit: 10, maxCallsPerSession: 100, tokenType: 'USDC' }],
 * });
 * // ix is a TransactionInstruction — add to a transaction and sign
 * ```
 *
 * @since 1.3.0
 */

import type {
  SAPConfig,
  SAPInstruction,
  SAPAccountMeta,
  RegisterAgentParams,
  UpdateAgentParams,
  UpdateReputationParams,
} from './types';
import { SAP_DEFAULT_PROGRAM_ID, SAP_INSTRUCTION_DISCRIMINATORS } from './types';
import { deriveAgentPDA, base58Decode, BorshWriter, serializeRegisterData, serializeUpdateData } from './pda';
import { SAPValidator, type SAPValidatorConfig, type ValidationReport } from './validator';

/**
 * @description Solana system program ID.
 * @since 1.3.0
 */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/**
 * @description Error class for SAP instruction building failures.
 * @since 1.3.0
 */
export class SAPProgramError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SAPProgramError';
  }
}

/**
 * @description Builds Solana transaction instructions for the SAP program.
 *
 * Each method returns an {@link SAPInstruction} object that can be added to a
 * `Transaction` and signed with the agent's wallet.
 *
 * @since 1.3.0
 */
export class SAPInstructionBuilder {
  private readonly programId: string;
  private readonly validator: SAPValidator;
  private lastValidationReport: ValidationReport | null = null;

  /**
   * @param {Partial<SAPConfig> & { validation?: SAPValidatorConfig }} [config] - Configuration with optional program ID and validation settings
   */
  constructor(config?: Partial<SAPConfig> & { validation?: SAPValidatorConfig }) {
    this.programId = config?.programId ?? SAP_DEFAULT_PROGRAM_ID;
    this.validator = new SAPValidator(config?.validation);
  }

  /**
   * @description Get the validation report from the last `register()` or `update()` call.
   * Returns `null` if no call has been made yet.
   * @returns {ValidationReport | null}
   * @since 1.4.0
   */
  getLastValidationReport(): ValidationReport | null {
    return this.lastValidationReport;
  }

  /**
   * @description Get the configured program ID.
   * @returns {string} Program ID (base58)
   */
  getProgramId(): string {
    return this.programId;
  }

  /**
   * @description Build a `register` instruction to create a new agent PDA.
   *
   * Account layout:
   * 0. `[signer, writable]` Wallet (payer + authority)
   * 1. `[writable]`         Agent PDA
   * 2. `[]`                 System Program
   *
   * @param {RegisterAgentParams} params - Agent registration data
   * @returns {SAPInstruction} Transaction instruction ready to sign
   * @throws {SAPProgramError} If name or description exceeds size limits
   *
   * @example
   * ```ts
   * const ix = builder.register({
   *   walletPubkey: 'ABcD...1234',
   *   name: 'My Agent',
   *   description: 'Provides DeFi tools',
   *   capabilities: [{ id: 'jupiter:swap' }],
   * });
   * ```
   *
   * @since 1.3.0
   */
  register(params: RegisterAgentParams): SAPInstruction {
    // Deep validation (replaces basic name/desc checks)
    this.lastValidationReport = this.validator.validateRegistration(params);

    const pda = deriveAgentPDA(params.walletPubkey, this.programId);
    const instructionData = serializeRegisterData(params);

    // Prepend discriminator + bump
    const data = new Uint8Array(SAP_INSTRUCTION_DISCRIMINATORS.register.length + 1 + instructionData.length);
    data.set(SAP_INSTRUCTION_DISCRIMINATORS.register, 0);
    data[8] = pda.bump;
    data.set(instructionData, 9);

    const keys: SAPAccountMeta[] = [
      { pubkey: params.walletPubkey, isSigner: true, isWritable: true },
      { pubkey: pda.address, isSigner: false, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    return { programId: this.programId, keys, data };
  }

  /**
   * @description Build an `update` instruction to modify an existing agent PDA.
   *
   * Only provided fields are updated; omitted fields remain unchanged on-chain.
   *
   * Account layout:
   * 0. `[signer]`   Wallet (authority)
   * 1. `[writable]` Agent PDA
   *
   * @param {UpdateAgentParams} params - Fields to update
   * @returns {SAPInstruction} Transaction instruction
   *
   * @example
   * ```ts
   * const ix = builder.update({
   *   walletPubkey: 'ABcD...1234',
   *   capabilities: [
   *     { id: 'jupiter:swap' },
   *     { id: 'raydium:pool_info' },
   *     { id: 'metaplex:mint' },
   *   ],
   *   x402Endpoint: 'https://myagent.xyz/.well-known/x402',
   * });
   * ```
   *
   * @since 1.3.0
   */
  update(params: UpdateAgentParams): SAPInstruction {
    // Deep validation
    this.lastValidationReport = this.validator.validateUpdate(params);

    const pda = deriveAgentPDA(params.walletPubkey, this.programId);
    const instructionData = serializeUpdateData(params);

    const data = new Uint8Array(SAP_INSTRUCTION_DISCRIMINATORS.update.length + instructionData.length);
    data.set(SAP_INSTRUCTION_DISCRIMINATORS.update, 0);
    data.set(instructionData, 8);

    const keys: SAPAccountMeta[] = [
      { pubkey: params.walletPubkey, isSigner: true, isWritable: false },
      { pubkey: pda.address, isSigner: false, isWritable: true },
    ];

    return { programId: this.programId, keys, data };
  }

  /**
   * @description Build a `deactivate` instruction to mark an agent as inactive.
   *
   * Account layout:
   * 0. `[signer]`   Wallet (authority)
   * 1. `[writable]` Agent PDA
   *
   * @param {string} walletPubkey - Agent's wallet public key (base58)
   * @returns {SAPInstruction} Transaction instruction
   *
   * @since 1.3.0
   */
  deactivate(walletPubkey: string): SAPInstruction {
    const pda = deriveAgentPDA(walletPubkey, this.programId);

    const data = new Uint8Array(SAP_INSTRUCTION_DISCRIMINATORS.deactivate.length);
    data.set(SAP_INSTRUCTION_DISCRIMINATORS.deactivate, 0);

    const keys: SAPAccountMeta[] = [
      { pubkey: walletPubkey, isSigner: true, isWritable: false },
      { pubkey: pda.address, isSigner: false, isWritable: true },
    ];

    return { programId: this.programId, keys, data };
  }

  /**
   * @description Build an `updateReputation` instruction.
   *
   * Typically called by the agent itself to self-report metrics, or by a
   * trusted facilitator/oracle with delegated authority.
   *
   * Account layout:
   * 0. `[signer]`   Wallet or authorized updater
   * 1. `[writable]` Agent PDA
   *
   * @param {UpdateReputationParams} params - Reputation data to update
   * @returns {SAPInstruction} Transaction instruction
   *
   * @since 1.3.0
   */
  updateReputation(params: UpdateReputationParams): SAPInstruction {
    const pda = deriveAgentPDA(params.walletPubkey, this.programId);

    const w = new BorshWriter();
    w.writeOption(params.totalCallsServed, (v) => w.writeU64(v));
    w.writeOption(params.avgLatencyMs, (v) => w.writeU32(v));
    w.writeOption(params.uptimePercent, (v) => w.writeU8(v));
    w.writeOption(params.score, (v) => w.writeU32(v));
    const instructionData = w.toBytes();

    const data = new Uint8Array(SAP_INSTRUCTION_DISCRIMINATORS.updateReputation.length + instructionData.length);
    data.set(SAP_INSTRUCTION_DISCRIMINATORS.updateReputation, 0);
    data.set(instructionData, 8);

    const keys: SAPAccountMeta[] = [
      { pubkey: params.walletPubkey, isSigner: true, isWritable: false },
      { pubkey: pda.address, isSigner: false, isWritable: true },
    ];

    return { programId: this.programId, keys, data };
  }

}
