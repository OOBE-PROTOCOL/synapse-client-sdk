/**
 * Geyser gRPC Subscription Parser — barrel exports.
 *
 * @module grpc/parser
 */

// ── Types ───────────────────────────────────────────────────────
export type {
  RawBuffer,
  RawTimestamp,
  RawTransactionInfo,
  RawTokenBalance,
  RawInnerInstruction,
  RawCompiledInstruction,
  RawAccountInfo,
  RawSlotInfo,
  RawBlockMeta,
  RawEntry,
  RawGeyserUpdate,
  BalanceChange,
  TokenBalanceChange,
  ParsedInstruction,
  ParsedTransaction,
  ParsedAccountUpdate,
  ParsedSlotUpdate,
  ParsedBlockMeta,
  ParsedEntry,
  ParsedGeyserUpdate,
  GeyserParserConfig,
} from './types';

// ── Known programs ──────────────────────────────────────────────
export {
  KNOWN_PROGRAMS,
  KNOWN_PROGRAMS_COUNT,
  SYSTEM_PROGRAMS,
  SPL_PROGRAMS,
  JUPITER_PROGRAMS,
  RAYDIUM_PROGRAMS,
  METEORA_PROGRAMS,
  ORCA_PROGRAMS,
  METAPLEX_PROGRAMS,
  MARINADE_PROGRAMS,
  OTHER_PROGRAMS,
  resolveProgram,
  resolveProgramBatch,
  isProgramInCategory,
  getProgramCategory,
} from './programs';

// ── Decoder functions ───────────────────────────────────────────
export {
  base58Encode,
  rawBufferToBytes,
  rawBufferToBase58,
  rawBufferToHex,
  rawBufferToBase64,
  parseTimestamp,
  computeBalanceChanges,
  computeTokenBalanceChanges,
  parseTransaction,
  parseAccountUpdate,
  parseSlotUpdate,
  parseBlockMeta,
  parseEntry,
  parseGeyserUpdate,
} from './decoder';

// ── GeyserParser class ─────────────────────────────────────────
export { GeyserParser } from './geyser-parser';
export type { GeyserParserEvents, GeyserParserStats } from './geyser-parser';
