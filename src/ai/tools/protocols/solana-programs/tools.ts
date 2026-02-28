/**
 * @module ai/tools/protocols/solana-programs/tools
 * @description Solana Native Programs — LangChain tool factory.
 *
 * Creates 16 instruction-building tools that encode Solana native
 * program instructions (System, SPL Token, ATA, Compute Budget, Memo).
 * These tools run locally — no RPC or REST calls needed.
 *
 * ```ts
 * const programs = createSolanaProgramsTools();
 * agent.tools.push(...programs.tools);
 *
 * // Agent can now build instructions:
 * // "Transfer 1 SOL from <wallet> to <recipient>"
 * // → calls solana_programs_systemTransfer tool
 * ```
 *
 * @since 1.1.0
 */
import {
  buildProtocolTools,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { solanaProgramsMethods } from './schemas';
import { Pubkey, type Lamports } from '../../../../core/types';
import { SystemProgram } from '../../../../programs/system';
import { SplToken, TOKEN_PROGRAM } from '../../../../programs/spl-token';
import { AssociatedToken } from '../../../../programs/associated-token';
import { ComputeBudget } from '../../../../programs/compute-budget';
import { Memo } from '../../../../programs/memo';
import type { TransactionInstruction } from '../../../../programs/types';

/* ═══════════════════════════════════════════════════════════════
 *  Config
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Configuration for Solana native programs tool creation.
 * @since 1.1.0
 */
export interface SolanaProgramsToolsConfig {
  // No external dependencies needed — all encoding is local.
}

/* ═══════════════════════════════════════════════════════════════
 *  Serialiser — TransactionInstruction → JSON-friendly output
 * ═══════════════════════════════════════════════════════════════ */

/** @internal Convert Uint8Array to base64 for JSON transport */
function uint8ToBase64(data: Uint8Array): string {
  // Node.js path (fastest)
  if (typeof Buffer !== 'undefined') return Buffer.from(data).toString('base64');
  // Browser path
  let binary = '';
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
  return btoa(binary);
}

/** @internal Serialise a TransactionInstruction for LLM consumption */
function serialiseInstruction(ix: TransactionInstruction) {
  return {
    programId: ix.programId as unknown as string,
    keys: ix.keys.map((k) => ({
      pubkey: k.pubkey as unknown as string,
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: uint8ToBase64(ix.data),
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher — local instruction encoding
 * ═══════════════════════════════════════════════════════════════ */

function createProgramsExecutor() {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    switch (method.name) {
      // ── System Program ───────────────────────────────────────
      case 'systemTransfer':
        return serialiseInstruction(SystemProgram.transfer({
          from: Pubkey(input.from as string),
          to: Pubkey(input.to as string),
          lamports: BigInt(input.lamports as string) as Lamports,
        }));

      case 'systemCreateAccount':
        return serialiseInstruction(SystemProgram.createAccount({
          from: Pubkey(input.from as string),
          newAccount: Pubkey(input.newAccount as string),
          lamports: BigInt(input.lamports as string) as Lamports,
          space: input.space as number,
          programId: Pubkey(input.programId as string),
        }));

      case 'systemAllocate':
        return serialiseInstruction(SystemProgram.allocate({
          account: Pubkey(input.account as string),
          space: input.space as number,
        }));

      case 'systemAssign':
        return serialiseInstruction(SystemProgram.assign({
          account: Pubkey(input.account as string),
          programId: Pubkey(input.programId as string),
        }));

      // ── SPL Token ────────────────────────────────────────────
      case 'tokenTransfer':
        return serialiseInstruction(SplToken.transfer({
          source: Pubkey(input.source as string),
          destination: Pubkey(input.destination as string),
          owner: Pubkey(input.owner as string),
          amount: BigInt(input.amount as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenTransferChecked':
        return serialiseInstruction(SplToken.transferChecked({
          source: Pubkey(input.source as string),
          mint: Pubkey(input.mint as string),
          destination: Pubkey(input.destination as string),
          owner: Pubkey(input.owner as string),
          amount: BigInt(input.amount as string),
          decimals: input.decimals as number,
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenApprove':
        return serialiseInstruction(SplToken.approve({
          account: Pubkey(input.account as string),
          delegate: Pubkey(input.delegate as string),
          owner: Pubkey(input.owner as string),
          amount: BigInt(input.amount as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenRevoke':
        return serialiseInstruction(SplToken.revoke({
          account: Pubkey(input.account as string),
          owner: Pubkey(input.owner as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenMintTo':
        return serialiseInstruction(SplToken.mintTo({
          mint: Pubkey(input.mint as string),
          destination: Pubkey(input.destination as string),
          authority: Pubkey(input.authority as string),
          amount: BigInt(input.amount as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenBurn':
        return serialiseInstruction(SplToken.burn({
          account: Pubkey(input.account as string),
          mint: Pubkey(input.mint as string),
          owner: Pubkey(input.owner as string),
          amount: BigInt(input.amount as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      case 'tokenCloseAccount':
        return serialiseInstruction(SplToken.closeAccount({
          account: Pubkey(input.account as string),
          destination: Pubkey(input.destination as string),
          owner: Pubkey(input.owner as string),
          programId: input.programId ? Pubkey(input.programId as string) : undefined,
        }));

      // ── Associated Token Account ─────────────────────────────
      case 'ataCreate':
        return serialiseInstruction(AssociatedToken.create({
          payer: Pubkey(input.payer as string),
          associatedToken: Pubkey(input.associatedToken as string),
          owner: Pubkey(input.owner as string),
          mint: Pubkey(input.mint as string),
          tokenProgramId: input.tokenProgramId ? Pubkey(input.tokenProgramId as string) : undefined,
        }));

      case 'ataCreateIdempotent':
        return serialiseInstruction(AssociatedToken.createIdempotent({
          payer: Pubkey(input.payer as string),
          associatedToken: Pubkey(input.associatedToken as string),
          owner: Pubkey(input.owner as string),
          mint: Pubkey(input.mint as string),
          tokenProgramId: input.tokenProgramId ? Pubkey(input.tokenProgramId as string) : undefined,
        }));

      // ── Compute Budget ───────────────────────────────────────
      case 'setComputeUnitLimit':
        return serialiseInstruction(ComputeBudget.setComputeUnitLimit({
          units: input.units as number,
        }));

      case 'setComputeUnitPrice':
        return serialiseInstruction(ComputeBudget.setComputeUnitPrice({
          microLamports: BigInt(input.microLamports as string),
        }));

      // ── Memo ─────────────────────────────────────────────────
      case 'addMemo':
        return serialiseInstruction(Memo.addMemo({
          message: input.message as string,
          signer: input.signer ? Pubkey(input.signer as string) : undefined,
        }));

      default:
        throw new Error(`Unknown Solana program method: ${method.name}`);
    }
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  createSolanaProgramsTools()
 *
 *  Public factory — the single entry-point for consumers.
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Create LangChain-compatible tools for Solana native programs.
 *
 * All 16 tools run locally — they encode instructions using the SDK's
 * native binary encoders. No RPC or REST API calls are made.
 *
 * @param {SolanaProgramsToolsConfig & CreateProtocolToolsOpts} [config={}] - Tool options
 * @returns {ProtocolToolkit} Toolkit with 16 instruction-building tools
 *
 * @example
 * ```ts
 * const programs = createSolanaProgramsTools();
 * const agent = createAgent({ tools: programs.tools });
 *
 * // Agent builds a SOL transfer instruction:
 * const result = await programs.toolMap.systemTransfer.invoke({
 *   from: 'SenderWallet...',
 *   to: 'ReceiverWallet...',
 *   lamports: '1000000000',
 * });
 *
 * // Cherry-pick:
 * const transferTool = programs.toolMap.tokenTransferChecked;
 * ```
 *
 * @since 1.1.0
 */
export function createSolanaProgramsTools(
  config: SolanaProgramsToolsConfig & CreateProtocolToolsOpts = {},
): ProtocolToolkit {
  const { ...toolOpts } = config;
  const execute = createProgramsExecutor();

  return buildProtocolTools(solanaProgramsMethods, execute, {
    defaultPrefix: 'solana_programs_',
    ...toolOpts,
  });
}

/** Re-export schemas for direct access. */
export { solanaProgramsMethods, solanaProgramsMethodNames } from './schemas';
