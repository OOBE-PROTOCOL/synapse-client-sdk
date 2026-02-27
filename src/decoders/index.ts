/**
 * Native Solana account data decoders.
 *
 * Zero-dependency, DataView-based decoders for the most common Solana
 * account types. Each decoder is a pure function that takes raw bytes
 * and returns a fully typed object.
 *
 * @module decoders
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import {
 *   decodeTokenAccount, decodeMint, decodeStakeAccount,
 *   decodeNonceAccount, decodeLookupTable, decodeMultisig,
 * } from '@oobe-protocol-labs/synapse-client-sdk/decoders';
 *
 * const tokenAcct = decodeTokenAccount(rawBytes);
 * const mint      = decodeMint(mintBytes);
 * const stake     = decodeStakeAccount(stakeBytes);
 * ```
 */

// ── Core reader ────────────────────────────────────────────────
export { AccountReader, encodeBase58 } from './layout';

// ── SPL Token (v1) ─────────────────────────────────────────────
export {
  decodeTokenAccount,
  decodeMint,
  TOKEN_ACCOUNT_SIZE,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from './token';
export type {
  DecodedTokenAccount,
  DecodedMint,
  TokenAccountState,
} from './token';

// ── SPL Token-2022 ─────────────────────────────────────────────
export {
  decodeToken2022Account,
  decodeToken2022Mint,
  TokenExtensionType,
  TOKEN_2022_PROGRAM_ID,
} from './token-2022';
export type {
  DecodedToken2022Account,
  DecodedToken2022Mint,
  DecodedExtension,
  TransferFeeConfig,
  TransferFeeAmount,
  MintCloseAuthorityExt,
  DefaultAccountStateExt,
  ImmutableOwnerExt,
  MemoTransferExt,
  NonTransferableExt,
  InterestBearingConfigExt,
  PermanentDelegateExt,
  MetadataPointerExt,
  UnknownExtension,
} from './token-2022';

// ── Stake ──────────────────────────────────────────────────────
export {
  decodeStakeAccount,
  STAKE_PROGRAM_ID,
} from './stake';
export type {
  DecodedStakeAccount,
  StakeAccountType,
  StakeMeta,
  StakeAuthorized,
  StakeLockup,
  StakeDelegation,
} from './stake';

// ── Nonce ──────────────────────────────────────────────────────
export {
  decodeNonceAccount,
  NONCE_ACCOUNT_SIZE,
  SYSTEM_PROGRAM_ID,
} from './nonce';
export type {
  DecodedNonceAccount,
  NonceState,
} from './nonce';

// ── Address Lookup Table ───────────────────────────────────────
export {
  decodeLookupTable,
  LOOKUP_TABLE_PROGRAM_ID,
  LOOKUP_TABLE_HEADER_SIZE,
} from './lookup-table';
export type {
  DecodedLookupTable,
} from './lookup-table';

// ── Multisig ───────────────────────────────────────────────────
export {
  decodeMultisig,
  MAX_MULTISIG_SIGNERS,
  MULTISIG_SIZE,
} from './multisig';
export type {
  DecodedMultisig,
} from './multisig';
