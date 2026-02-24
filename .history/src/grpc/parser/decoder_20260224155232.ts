/**
 * Geyser gRPC Subscription Parser — Core decoder.
 *
 * Converts raw Yellowstone/Geyser protobuf-style messages into
 * typed, developer-friendly objects. Handles:
 *
 * - Buffer → base58 conversion (signatures, pubkeys)
 * - Balance diff calculation (SOL + SPL tokens)
 * - Known program resolution
 * - Inner instruction extraction
 * - Transaction message decoding (v0 + legacy)
 *
 * Developers get both the **raw** update (pass-through) and the
 * **parsed** version — they pick what they need.
 *
 * @module grpc/parser/decoder
 */

import { Pubkey, Sig, Slot, Lamports, UnixTs } from '../../core/types';
import type { Signature, UnixTimestamp } from '../../core/types';
import { lamportsToSol } from '../../utils/helpers';
import { resolveProgram } from './programs';

import type {
  RawBuffer,
  RawTimestamp,
  RawTransactionInfo,
  RawAccountInfo,
  RawSlotInfo,
  RawBlockMeta,
  RawEntry,
  RawGeyserUpdate,
  RawTokenBalance,
  RawInnerInstruction,
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

/* ═══════════════════════════════════════════════════════════════
 *  Low-level converters
 * ═══════════════════════════════════════════════════════════════ */

// base58 alphabet
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Pure-JS base58 encode (no dependency on bs58).
 * Used for converting raw signature/pubkey buffers to base58 strings.
 */
export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  // Count leading zeros
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  // Allocate enough space in big-endian base58 representation
  const size = ((bytes.length - zeros) * 138 / 100 + 1) >>> 0;
  const b58 = new Uint8Array(size);

  let length = 0;
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 256 * b58[k];
      b58[k] = carry % 58;
      carry = (carry / 58) >>> 0;
    }
    length = j;
  }

  // Skip leading zeros in base58 result
  let idx = size - length;
  while (idx < size && b58[idx] === 0) idx++;

  // Map to base58 characters
  let str = '1'.repeat(zeros);
  for (; idx < size; idx++) str += ALPHABET[b58[idx]];
  return str;
}

/**
 * Convert a raw protobuf Buffer descriptor to a Uint8Array.
 * Handles both `{ type: 'Buffer', data: number[] }` and direct `number[]`.
 */
export function rawBufferToBytes(buf: RawBuffer | number[]): Uint8Array {
  const arr = Array.isArray(buf) ? buf : buf.data;
  return new Uint8Array(arr);
}

/** Convert a raw buffer to a base58 string. */
export function rawBufferToBase58(buf: RawBuffer | number[]): string {
  return base58Encode(rawBufferToBytes(buf));
}

/** Convert a raw buffer to hex string. */
export function rawBufferToHex(buf: RawBuffer | number[]): string {
  const bytes = rawBufferToBytes(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Convert a raw buffer to base64 string. */
export function rawBufferToBase64(buf: RawBuffer | number[]): string {
  const bytes = rawBufferToBytes(buf);
  // Node.js Buffer path (fast)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Fallback for edge runtimes
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Parse raw protobuf timestamp → Date. */
export function parseTimestamp(ts?: RawTimestamp): Date | undefined {
  if (!ts) return undefined;
  const sec = typeof ts.seconds === 'string' ? Number(ts.seconds) : ts.seconds;
  return new Date(sec * 1000 + Math.floor((ts.nanos ?? 0) / 1e6));
}

/* ═══════════════════════════════════════════════════════════════
 *  Balance change calculation
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Compute SOL balance changes from pre/post arrays.
 */
export function computeBalanceChanges(
  preBalances: string[],
  postBalances: string[],
  skipZero = true,
): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const len = Math.min(preBalances.length, postBalances.length);

  for (let i = 0; i < len; i++) {
    const pre = BigInt(preBalances[i]);
    const post = BigInt(postBalances[i]);
    const delta = post - pre;

    if (skipZero && delta === 0n) continue;

    changes.push({
      index: i,
      preLamports: Lamports(pre),
      postLamports: Lamports(post),
      deltaLamports: delta,
      deltaSol: Number(delta) / 1e9,
    });
  }

  return changes;
}

/**
 * Compute SPL token balance changes from pre/post arrays.
 */
export function computeTokenBalanceChanges(
  preTokenBalances?: RawTokenBalance[],
  postTokenBalances?: RawTokenBalance[],
): TokenBalanceChange[] {
  if (!preTokenBalances && !postTokenBalances) return [];

  // Index by `accountIndex:mint` for matching
  const preMap = new Map<string, RawTokenBalance>();
  const postMap = new Map<string, RawTokenBalance>();

  for (const tb of (preTokenBalances ?? [])) {
    preMap.set(`${tb.account_index}:${tb.mint}`, tb);
  }
  for (const tb of (postTokenBalances ?? [])) {
    postMap.set(`${tb.account_index}:${tb.mint}`, tb);
  }

  const allKeys = new Set([...preMap.keys(), ...postMap.keys()]);
  const changes: TokenBalanceChange[] = [];

  for (const key of allKeys) {
    const pre = preMap.get(key);
    const post = postMap.get(key);

    const preAmt = pre?.ui_token_amount?.amount ?? '0';
    const postAmt = post?.ui_token_amount?.amount ?? '0';
    const delta = BigInt(postAmt) - BigInt(preAmt);

    if (delta === 0n) continue;

    const decimals = post?.ui_token_amount?.decimals ?? pre?.ui_token_amount?.decimals ?? 0;

    changes.push({
      accountIndex: post?.account_index ?? pre!.account_index,
      mint: Pubkey(post?.mint ?? pre!.mint),
      owner: Pubkey(post?.owner ?? pre!.owner ?? ''),
      preAmount: preAmt,
      postAmount: postAmt,
      deltaAmount: delta,
      decimals,
      preUiAmount: pre?.ui_token_amount?.ui_amount ?? null,
      postUiAmount: post?.ui_token_amount?.ui_amount ?? null,
    });
  }

  return changes;
}

/* ═══════════════════════════════════════════════════════════════
 *  Transaction message decoding (v0 + legacy)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Minimal parsing of the serialized transaction message to extract
 * account keys and instructions. Works for both legacy and v0 formats.
 *
 * NOTE: For full CPI-level decoding, use the rich `innerInstructions`
 * from meta. This function only extracts top-level instructions from
 * the raw message bytes.
 */
function decodeMessageAccountKeys(messageBytes: Uint8Array): {
  accountKeys: string[];
  instructions: Array<{ programIdIndex: number; accountIndexes: number[]; data: Uint8Array }>;
  recentBlockhash: string;
} {
  const accountKeys: string[] = [];
  const instructions: Array<{ programIdIndex: number; accountIndexes: number[]; data: Uint8Array }> = [];
  let recentBlockhash = '';

  try {
    let offset = 0;

    // Check if this is a protobuf-encoded message (starts with field tag)
    // Yellowstone encodes v0 messages as protobuf, not raw Solana wire format
    if (messageBytes.length > 2 && messageBytes[0] === 0x0a) {
      // Protobuf message format from Yellowstone:
      // field 1 (header): varint
      // field 2 (account_keys): repeated bytes (tag 0x12)
      // field 3 (recent_blockhash): bytes (tag 0x1a)
      // field 4 (instructions): repeated message (tag 0x22)
      // field 5 (address_table_lookups): repeated message (tag 0x2a) [v0 only]

      offset = 0;
      while (offset < messageBytes.length) {
        // Read field tag (varint)
        const tag = messageBytes[offset++];
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x07;

        if (wireType === 2) {
          // Length-delimited
          let length = 0;
          let shift = 0;
          while (offset < messageBytes.length) {
            const byte = messageBytes[offset++];
            length |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
          }

          if (fieldNumber === 2) {
            // account_keys: 32-byte pubkey
            if (length === 32) {
              const keyBytes = messageBytes.slice(offset, offset + length);
              accountKeys.push(base58Encode(keyBytes));
            }
          } else if (fieldNumber === 3) {
            // recent_blockhash
            if (length === 32) {
              const bhBytes = messageBytes.slice(offset, offset + length);
              recentBlockhash = base58Encode(bhBytes);
            }
          }
          // Skip over the data for fields we don't fully parse
          offset += length;
        } else if (wireType === 0) {
          // Varint — skip
          while (offset < messageBytes.length && (messageBytes[offset++] & 0x80) !== 0) {}
        } else {
          // Unknown wire type — bail safely
          break;
        }
      }
    } else {
      // Legacy wire format: compact-u16 header, then account keys, blockhash, instructions
      // num_required_signatures (1 byte)
      // num_readonly_signed_accounts (1 byte)
      // num_readonly_unsigned_accounts (1 byte)
      offset = 0;
      offset += 3; // skip header bytes

      // Read compact-u16 for number of account keys
      let numKeys = messageBytes[offset++];
      if (numKeys > 127) {
        numKeys = (numKeys & 0x7f) | (messageBytes[offset++] << 7);
      }

      // Read account keys (32 bytes each)
      for (let i = 0; i < numKeys && offset + 32 <= messageBytes.length; i++) {
        accountKeys.push(base58Encode(messageBytes.slice(offset, offset + 32)));
        offset += 32;
      }

      // Read recent blockhash (32 bytes)
      if (offset + 32 <= messageBytes.length) {
        recentBlockhash = base58Encode(messageBytes.slice(offset, offset + 32));
        offset += 32;
      }

      // Read compact-u16 for number of instructions
      let numIx = messageBytes[offset++];
      if (numIx > 127) {
        numIx = (numIx & 0x7f) | (messageBytes[offset++] << 7);
      }

      for (let i = 0; i < numIx && offset < messageBytes.length; i++) {
        const programIdIndex = messageBytes[offset++];

        // Read compact-u16 for number of accounts
        let numAccounts = messageBytes[offset++];
        if (numAccounts > 127) {
          numAccounts = (numAccounts & 0x7f) | (messageBytes[offset++] << 7);
        }
        const accountIndexes: number[] = [];
        for (let j = 0; j < numAccounts && offset < messageBytes.length; j++) {
          accountIndexes.push(messageBytes[offset++]);
        }

        // Read compact-u16 for data length
        let dataLen = messageBytes[offset++];
        if (dataLen > 127) {
          dataLen = (dataLen & 0x7f) | (messageBytes[offset++] << 7);
        }
        const data = messageBytes.slice(offset, offset + dataLen);
        offset += dataLen;

        instructions.push({ programIdIndex, accountIndexes, data });
      }
    }
  } catch {
    // Graceful degradation — return what we have so far
  }

  return { accountKeys, instructions, recentBlockhash };
}

/* ═══════════════════════════════════════════════════════════════
 *  Main parse functions
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Parse a raw gRPC transaction update into a developer-friendly object.
 */
export function parseTransaction(
  raw: { transaction: RawTransactionInfo; slot: string },
  config: GeyserParserConfig = {},
  timestamp?: Date,
): ParsedTransaction {
  const {
    skipZeroBalanceChanges = true,
    customPrograms,
    includeInnerInstructions = true,
    includeTokenBalances = true,
  } = config;

  const txInfo = raw.transaction;
  const meta = txInfo.meta;

  // 1. Decode signature
  const sigBytes = rawBufferToBytes(txInfo.signature);
  const signature = Sig(base58Encode(sigBytes));

  // 2. Decode transaction message → account keys + top-level instructions
  const messageBytes = rawBufferToBytes(txInfo.transaction.message);
  const { accountKeys: decodedKeys, instructions: decodedIx, recentBlockhash } =
    decodeMessageAccountKeys(messageBytes);

  const accountKeys = decodedKeys.map(k => Pubkey(k));

  // 3. Balance changes
  const balanceChanges = computeBalanceChanges(
    meta.pre_balances,
    meta.post_balances,
    skipZeroBalanceChanges,
  );

  // 4. Token balance changes
  const tokenBalanceChanges = includeTokenBalances
    ? computeTokenBalanceChanges(meta.pre_token_balances, meta.post_token_balances)
    : [];

  // 5. Build instruction list
  const instructions: ParsedInstruction[] = [];

  // Top-level instructions from decoded message
  for (let i = 0; i < decodedIx.length; i++) {
    const ix = decodedIx[i];
    const programId = accountKeys[ix.programIdIndex] ?? Pubkey('unknown');

    instructions.push({
      programId,
      programName: resolveProgram(programId, customPrograms),
      accounts: ix.accountIndexes.map(idx => accountKeys[idx] ?? Pubkey('unknown')),
      dataHex: rawBufferToHex(Array.from(ix.data)),
      dataBase64: rawBufferToBase64(Array.from(ix.data)),
      index: i,
      isInner: false,
    });
  }

  // Inner (CPI) instructions from meta
  if (includeInnerInstructions && meta.inner_instructions) {
    for (const inner of meta.inner_instructions) {
      for (let j = 0; j < inner.instructions.length; j++) {
        const cpi = inner.instructions[j];
        const programId = accountKeys[cpi.program_id_index] ?? Pubkey('unknown');

        let dataBytes: Uint8Array;
        if (typeof cpi.data === 'string') {
          // base58 or base64 encoded
          dataBytes = new Uint8Array(0);
        } else {
          dataBytes = rawBufferToBytes(cpi.data);
        }

        instructions.push({
          programId,
          programName: resolveProgram(programId, customPrograms),
          accounts: cpi.accounts.map(idx => accountKeys[idx] ?? Pubkey('unknown')),
          dataHex: dataBytes.length > 0 ? rawBufferToHex(Array.from(dataBytes)) : '',
          dataBase64: dataBytes.length > 0 ? rawBufferToBase64(Array.from(dataBytes)) : '',
          index: j,
          isInner: true,
          parentIndex: inner.index,
        });
      }
    }
  }

  // 6. Resolve invoked programs
  const programSet = new Set<string>();
  for (const ix of instructions) {
    programSet.add(ix.programId);
  }
  const programsInvoked = [...programSet].map(p => Pubkey(p));
  const programNamesInvoked = programsInvoked
    .map(p => resolveProgram(p, customPrograms) ?? p)
    .filter((v, i, a) => a.indexOf(v) === i);

  // 7. Loaded addresses (v0 transactions)
  let loadedAddresses: ParsedTransaction['loadedAddresses'];
  if (meta.loaded_addresses) {
    loadedAddresses = {
      writable: meta.loaded_addresses.writable.map(b => Pubkey(rawBufferToBase58(b))),
      readonly: meta.loaded_addresses.readonly.map(b => Pubkey(rawBufferToBase58(b))),
    };
  }

  // 8. Fee
  const feeLamports = Lamports(BigInt(meta.fee));

  return {
    signature,
    slot: Slot(Number(raw.slot)),
    blockIndex: Number(txInfo.index),
    isVote: txInfo.is_vote,
    feeLamports,
    feeSol: lamportsToSol(feeLamports),
    computeUnitsConsumed: meta.compute_units_consumed
      ? Number(meta.compute_units_consumed)
      : undefined,
    accountKeys,
    recentBlockhash: recentBlockhash || undefined,
    balanceChanges,
    tokenBalanceChanges,
    instructions,
    logs: meta.log_messages ?? [],
    error: meta.err ?? null,
    timestamp,
    programsInvoked,
    programNamesInvoked,
    loadedAddresses,
  };
}

/**
 * Parse a raw gRPC account update into a developer-friendly object.
 */
export function parseAccountUpdate(
  raw: { account: RawAccountInfo; slot: string; is_startup: boolean },
  config: GeyserParserConfig = {},
  timestamp?: Date,
): ParsedAccountUpdate {
  const acct = raw.account;
  const pubkey = Pubkey(rawBufferToBase58(acct.pubkey));
  const owner = Pubkey(rawBufferToBase58(acct.owner));
  const lamports = Lamports(BigInt(acct.lamports));
  const dataBytes = rawBufferToBytes(acct.data);

  return {
    pubkey,
    slot: Slot(Number(raw.slot)),
    lamports,
    sol: lamportsToSol(lamports),
    owner,
    ownerName: resolveProgram(owner, config.customPrograms),
    executable: acct.executable,
    rentEpoch: Number(acct.rent_epoch),
    dataHex: rawBufferToHex(acct.data),
    dataBase64: rawBufferToBase64(acct.data),
    dataSize: dataBytes.length,
    writeVersion: BigInt(acct.write_version),
    txnSignature: acct.txn_signature
      ? Sig(rawBufferToBase58(acct.txn_signature))
      : undefined,
    isStartup: raw.is_startup,
    timestamp,
  };
}

/**
 * Parse a raw slot update.
 */
export function parseSlotUpdate(
  raw: RawSlotInfo,
  timestamp?: Date,
): ParsedSlotUpdate {
  const statusMap: Record<string | number, string> = {
    0: 'processed',
    1: 'confirmed',
    2: 'finalized',
    3: 'rooted',
    processed: 'processed',
    confirmed: 'confirmed',
    finalized: 'finalized',
    rooted: 'rooted',
  };

  return {
    slot: Slot(Number(raw.slot)),
    parent: raw.parent ? Slot(Number(raw.parent)) : undefined,
    status: (statusMap[raw.status] ?? String(raw.status)) as ParsedSlotUpdate['status'],
    timestamp,
  };
}

/**
 * Parse a raw block meta update.
 */
export function parseBlockMeta(
  raw: RawBlockMeta,
  timestamp?: Date,
): ParsedBlockMeta {
  return {
    slot: Slot(Number(raw.slot)),
    blockhash: raw.blockhash,
    parentSlot: raw.parent_slot ? Slot(Number(raw.parent_slot)) : undefined,
    parentBlockhash: raw.parent_blockhash,
    blockTime: raw.block_time ? parseTimestamp(raw.block_time) : undefined,
    blockHeight: raw.block_height ? Number(raw.block_height) : undefined,
    executedTransactionCount: raw.executed_transaction_count
      ? Number(raw.executed_transaction_count)
      : undefined,
    timestamp,
  };
}

/**
 * Parse a raw entry notification.
 */
export function parseEntry(
  raw: RawEntry,
  timestamp?: Date,
): ParsedEntry {
  return {
    slot: Slot(Number(raw.slot)),
    index: Number(raw.index),
    numHashes: Number(raw.num_hashes),
    hashHex: rawBufferToHex(raw.hash),
    executedTransactionCount: Number(raw.executed_transaction_count),
    startingTransactionIndex: raw.starting_transaction_index
      ? Number(raw.starting_transaction_index)
      : undefined,
    timestamp,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Top-level dispatcher — single entry point for any update
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Parse any raw Geyser subscription update into a typed discriminated union.
 *
 * This is the main entry point — pass any raw update message from the
 * gRPC stream and get back a fully parsed, typed object.
 *
 * @param raw - The raw update object from the gRPC subscribe() stream.
 * @param config - Optional parser configuration.
 * @returns Parsed update with `type` discriminant, or `null` if the update
 *          was filtered out (e.g. vote transaction with `skipVotes: true`).
 *
 * @example
 * ```ts
 * import { parseGeyserUpdate } from '@oobe-protocol-labs/synapse-client-sdk/grpc';
 *
 * stream.on('data', (raw) => {
 *   const parsed = parseGeyserUpdate(raw);
 *   if (!parsed) return; // filtered out
 *
 *   switch (parsed.type) {
 *     case 'transaction':
 *       console.log(parsed.data.signature, parsed.data.programsInvoked);
 *       break;
 *     case 'account':
 *       console.log(parsed.data.pubkey, parsed.data.sol);
 *       break;
 *     case 'slot':
 *       console.log(parsed.data.slot, parsed.data.status);
 *       break;
 *   }
 * });
 * ```
 */
export function parseGeyserUpdate(
  raw: RawGeyserUpdate,
  config: GeyserParserConfig = {},
): ParsedGeyserUpdate | null {
  const ts = parseTimestamp(raw.created_at);
  const filters = raw.filters ?? [];

  switch (raw.update_oneof) {
    case 'transaction': {
      if (!raw.transaction) return null;

      // Optionally skip vote transactions
      if (config.skipVotes && raw.transaction.transaction.is_vote) {
        return null;
      }

      return {
        type: 'transaction',
        filters,
        data: parseTransaction(raw.transaction, config, ts),
      };
    }

    case 'account': {
      if (!raw.account) return null;
      return {
        type: 'account',
        filters,
        data: parseAccountUpdate(raw.account, config, ts),
      };
    }

    case 'slot': {
      if (!raw.slot) return null;
      return {
        type: 'slot',
        filters,
        data: parseSlotUpdate(raw.slot, ts),
      };
    }

    case 'block_meta': {
      if (!raw.block_meta) return null;
      return {
        type: 'block_meta',
        filters,
        data: parseBlockMeta(raw.block_meta, ts),
      };
    }

    case 'entry': {
      if (!raw.entry) return null;
      return {
        type: 'entry',
        filters,
        data: parseEntry(raw.entry, ts),
      };
    }

    case 'ping': {
      return { type: 'ping', filters, data: {} };
    }

    default:
      return null;
  }
}
