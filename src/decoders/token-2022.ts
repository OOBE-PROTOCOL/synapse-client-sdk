/**
 * SPL Token-2022 (Token Extensions) decoder.
 *
 * Parses TLV (Type-Length-Value) extensions appended after the standard
 * 165-byte token account or 82-byte mint layout.
 *
 * @module decoders/token-2022
 * @since 1.1.0
 */

import { AccountReader } from './layout';
import {
  decodeTokenAccount, decodeMint,
  TOKEN_ACCOUNT_SIZE, MINT_SIZE,
} from './token';
import type { DecodedTokenAccount, DecodedMint } from './token';
import type { Pubkey } from '../core/types';

// ── Extension type enum ────────────────────────────────────────

/** Known Token-2022 extension types. @since 1.1.0 */
export enum TokenExtensionType {
  Uninitialized               = 0,
  TransferFeeConfig           = 1,
  TransferFeeAmount           = 2,
  MintCloseAuthority          = 3,
  ConfidentialTransferMint    = 4,
  ConfidentialTransferAccount = 5,
  DefaultAccountState         = 6,
  ImmutableOwner              = 7,
  MemoTransfer                = 8,
  NonTransferable             = 9,
  InterestBearingConfig       = 10,
  CpiGuard                    = 11,
  PermanentDelegate           = 12,
  NonTransferableAccount      = 13,
  TransferHook                = 14,
  TransferHookAccount         = 15,
  MetadataPointer             = 18,
  TokenMetadata               = 19,
  GroupPointer                = 20,
  GroupMemberPointer          = 22,
}

// ── Decoded extension types ────────────────────────────────────

/** Transfer fee configuration extension. @since 1.1.0 */
export interface TransferFeeConfig {
  type: 'TransferFeeConfig';
  transferFeeConfigAuthority: Pubkey;
  withdrawWithheldAuthority: Pubkey;
  withheldAmount: bigint;
  olderTransferFee: { epoch: bigint; maximumFee: bigint; transferFeeBasisPoints: number };
  newerTransferFee: { epoch: bigint; maximumFee: bigint; transferFeeBasisPoints: number };
}

/** Transfer fee amount (on token accounts). @since 1.1.0 */
export interface TransferFeeAmount {
  type: 'TransferFeeAmount';
  withheldAmount: bigint;
}

/** Mint close authority extension. @since 1.1.0 */
export interface MintCloseAuthorityExt {
  type: 'MintCloseAuthority';
  closeAuthority: Pubkey;
}

/** Default account state extension. @since 1.1.0 */
export interface DefaultAccountStateExt {
  type: 'DefaultAccountState';
  state: number;
}

/** Immutable owner extension (marker, no data). @since 1.1.0 */
export interface ImmutableOwnerExt {
  type: 'ImmutableOwner';
}

/** Memo transfer extension. @since 1.1.0 */
export interface MemoTransferExt {
  type: 'MemoTransfer';
  requireIncomingTransferMemos: boolean;
}

/** Non-transferable extension (marker). @since 1.1.0 */
export interface NonTransferableExt {
  type: 'NonTransferable';
}

/** Interest-bearing config extension. @since 1.1.0 */
export interface InterestBearingConfigExt {
  type: 'InterestBearingConfig';
  rateAuthority: Pubkey;
  initializationTimestamp: bigint;
  preUpdateAverageRate: number;
  lastUpdateTimestamp: bigint;
  currentRate: number;
}

/** Permanent delegate extension. @since 1.1.0 */
export interface PermanentDelegateExt {
  type: 'PermanentDelegate';
  delegate: Pubkey;
}

/** Metadata pointer extension. @since 1.1.0 */
export interface MetadataPointerExt {
  type: 'MetadataPointer';
  authority: Pubkey;
  metadataAddress: Pubkey;
}

/** Unknown / unrecognized extension. @since 1.1.0 */
export interface UnknownExtension {
  type: 'Unknown';
  extensionType: number;
  data: Uint8Array;
}

/** Union of all decoded extensions. @since 1.1.0 */
export type DecodedExtension =
  | TransferFeeConfig
  | TransferFeeAmount
  | MintCloseAuthorityExt
  | DefaultAccountStateExt
  | ImmutableOwnerExt
  | MemoTransferExt
  | NonTransferableExt
  | InterestBearingConfigExt
  | PermanentDelegateExt
  | MetadataPointerExt
  | UnknownExtension;

// ── Token-2022 decoded containers ──────────────────────────────

/** Decoded Token-2022 account with extensions. @since 1.1.0 */
export interface DecodedToken2022Account extends DecodedTokenAccount {
  extensions: DecodedExtension[];
}

/** Decoded Token-2022 mint with extensions. @since 1.1.0 */
export interface DecodedToken2022Mint extends DecodedMint {
  extensions: DecodedExtension[];
}

/** SPL Token-2022 Program ID. @since 1.1.0 */
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// ── TLV parser ─────────────────────────────────────────────────

/**
 * Parse TLV extensions from raw account data.
 *
 * Layout after base account:
 * - 1 byte: AccountType discriminator (1 = Mint, 2 = Account)
 * - TLV entries: [u16 type, u16 length, ...data] repeated
 *
 * @internal
 */
function parseTlvExtensions(data: Uint8Array, baseSize: number): DecodedExtension[] {
  const extensions: DecodedExtension[] = [];

  // Skip base layout + 1-byte AccountType discriminator
  let offset = baseSize + 1;

  while (offset + 4 <= data.length) {
    const extType = data[offset] | (data[offset + 1] << 8);   // u16 LE
    const extLen  = data[offset + 2] | (data[offset + 3] << 8); // u16 LE
    offset += 4;

    // End marker: type=0 && length=0
    if (extType === 0 && extLen === 0) break;
    if (offset + extLen > data.length) break;

    const extData = data.slice(offset, offset + extLen);
    extensions.push(decodeExtension(extType, extData));
    offset += extLen;
  }

  return extensions;
}

/** @internal */
function decodeExtension(extType: number, data: Uint8Array): DecodedExtension {
  const r = new AccountReader(data);

  switch (extType) {
    case TokenExtensionType.TransferFeeConfig: {
      const transferFeeConfigAuthority = r.pubkey();
      const withdrawWithheldAuthority = r.pubkey();
      const withheldAmount = r.u64();
      const olderEpoch = r.u64();
      const olderMax = r.u64();
      const olderBps = r.u16();
      const newerEpoch = r.u64();
      const newerMax = r.u64();
      const newerBps = r.u16();
      return {
        type: 'TransferFeeConfig',
        transferFeeConfigAuthority,
        withdrawWithheldAuthority,
        withheldAmount,
        olderTransferFee: { epoch: olderEpoch, maximumFee: olderMax, transferFeeBasisPoints: olderBps },
        newerTransferFee: { epoch: newerEpoch, maximumFee: newerMax, transferFeeBasisPoints: newerBps },
      };
    }

    case TokenExtensionType.TransferFeeAmount:
      return { type: 'TransferFeeAmount', withheldAmount: r.u64() };

    case TokenExtensionType.MintCloseAuthority:
      return { type: 'MintCloseAuthority', closeAuthority: r.pubkey() };

    case TokenExtensionType.DefaultAccountState:
      return { type: 'DefaultAccountState', state: r.u8() };

    case TokenExtensionType.ImmutableOwner:
      return { type: 'ImmutableOwner' };

    case TokenExtensionType.MemoTransfer:
      return { type: 'MemoTransfer', requireIncomingTransferMemos: r.bool() };

    case TokenExtensionType.NonTransferable:
      return { type: 'NonTransferable' };

    case TokenExtensionType.InterestBearingConfig: {
      const rateAuthority = r.pubkey();
      const initializationTimestamp = r.i64();
      const preUpdateAverageRate = r.u16();
      const lastUpdateTimestamp = r.i64();
      const currentRate = r.u16();
      return {
        type: 'InterestBearingConfig',
        rateAuthority,
        initializationTimestamp,
        preUpdateAverageRate,
        lastUpdateTimestamp,
        currentRate,
      };
    }

    case TokenExtensionType.PermanentDelegate:
      return { type: 'PermanentDelegate', delegate: r.pubkey() };

    case TokenExtensionType.MetadataPointer:
      return { type: 'MetadataPointer', authority: r.pubkey(), metadataAddress: r.pubkey() };

    default:
      return { type: 'Unknown', extensionType: extType, data };
  }
}

// ── Public decoders ────────────────────────────────────────────

/**
 * Decode a Token-2022 token account (base layout + TLV extensions).
 *
 * @param data - Raw account data (>= 165 bytes).
 * @returns Decoded account with parsed extensions.
 * @since 1.1.0
 */
export function decodeToken2022Account(data: Uint8Array): DecodedToken2022Account {
  const base = decodeTokenAccount(data);
  const extensions = data.length > TOKEN_ACCOUNT_SIZE + 1
    ? parseTlvExtensions(data, TOKEN_ACCOUNT_SIZE)
    : [];
  return { ...base, extensions };
}

/**
 * Decode a Token-2022 mint (base layout + TLV extensions).
 *
 * @param data - Raw account data (>= 82 bytes).
 * @returns Decoded mint with parsed extensions.
 * @since 1.1.0
 */
export function decodeToken2022Mint(data: Uint8Array): DecodedToken2022Mint {
  const base = decodeMint(data);
  const extensions = data.length > MINT_SIZE + 1
    ? parseTlvExtensions(data, MINT_SIZE)
    : [];
  return { ...base, extensions };
}
