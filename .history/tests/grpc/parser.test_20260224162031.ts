/**
 * Tests for Geyser gRPC Subscription Parser.
 *
 * Verifies:
 * - Low-level converters (base58, hex, base64, timestamp)
 * - Balance change computation (SOL + SPL tokens)
 * - Known programs registry (count, resolution, categories)
 * - Transaction parsing (full pipeline)
 * - Account update parsing
 * - Slot / block_meta / entry parsing
 * - Top-level parseGeyserUpdate dispatcher
 * - GeyserParser class (config, stats, events, batch)
 * - Vote filtering, zero-balance skipping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  // Low-level
  base58Encode,
  rawBufferToBytes,
  rawBufferToBase58,
  rawBufferToHex,
  rawBufferToBase64,
  parseTimestamp,
  computeBalanceChanges,
  computeTokenBalanceChanges,
  // Top-level dispatcher
  parseGeyserUpdate,
  // Per-type parsers
  parseTransaction,
  parseAccountUpdate,
  parseSlotUpdate,
  parseBlockMeta,
  parseEntry,
  // Programs
  KNOWN_PROGRAMS,
  KNOWN_PROGRAMS_COUNT,
  resolveProgram,
  resolveProgramBatch,
  isProgramInCategory,
  getProgramCategory,
  SYSTEM_PROGRAMS,
  JUPITER_PROGRAMS,
  RAYDIUM_PROGRAMS,
  METEORA_PROGRAMS,
  // Class
  GeyserParser,
} from '../../src/grpc/parser/index';

import type {
  RawBuffer,
  RawGeyserUpdate,
  RawTransactionInfo,
  RawAccountInfo,
  RawSlotInfo,
  RawBlockMeta,
  RawEntry,
} from '../../src/grpc/parser/types';

/* ═══════════════════════════════════════════════════════════════
 *  Helpers — create raw fixtures
 * ═══════════════════════════════════════════════════════════════ */

/** Create a RawBuffer from a Uint8Array. */
function mkBuf(bytes: number[]): RawBuffer {
  return { type: 'Buffer', data: bytes };
}

/** 32-byte pubkey buffer (all zeros except last byte). */
function fakePubkeyBuf(lastByte = 1): RawBuffer {
  const data = new Array(32).fill(0);
  data[31] = lastByte;
  return mkBuf(data);
}

/** 64-byte signature buffer. */
function fakeSignatureBuf(seed = 42): RawBuffer {
  const data = new Array(64).fill(0);
  data[0] = seed;
  data[63] = seed;
  return mkBuf(data);
}

/** Build a minimal raw transaction update. */
function buildRawTransactionUpdate(overrides: Partial<{
  isVote: boolean;
  slot: string;
  fee: string;
  preBalances: string[];
  postBalances: string[];
}> = {}): RawGeyserUpdate {
  const {
    isVote = false,
    slot = '123456789',
    fee = '5000',
    preBalances = ['1000000000', '500000000'],
    postBalances = ['999995000', '500005000'],
  } = overrides;

  return {
    filters: ['tx_filter'],
    update_oneof: 'transaction',
    created_at: { seconds: '1700000000', nanos: 500000000 },
    transaction: {
      transaction: {
        signature: fakeSignatureBuf(42),
        is_vote: isVote,
        transaction: {
          signature: fakeSignatureBuf(42),
          message: mkBuf([0, 0, 0]), // minimal empty legacy message
        },
        meta: {
          fee,
          pre_balances: preBalances,
          post_balances: postBalances,
          log_messages: ['Program 11111111111111111111111111111111 invoke [1]', 'Program log: Hello'],
          compute_units_consumed: '1400',
        },
        index: '7',
      },
      slot,
    },
  };
}

/** Build a minimal raw account update. */
function buildRawAccountUpdate(overrides: Partial<{
  lamports: string;
  slot: string;
  isStartup: boolean;
}> = {}): RawGeyserUpdate {
  const { lamports = '5000000000', slot = '100', isStartup = false } = overrides;

  return {
    filters: ['acct_filter'],
    update_oneof: 'account',
    created_at: { seconds: '1700000000', nanos: 0 },
    account: {
      account: {
        pubkey: fakePubkeyBuf(1),
        lamports,
        owner: fakePubkeyBuf(2),
        executable: false,
        rent_epoch: '365',
        data: mkBuf([0xde, 0xad, 0xbe, 0xef]),
        write_version: '9999',
      },
      slot,
      is_startup: isStartup,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  1. Low-level converters
 * ═══════════════════════════════════════════════════════════════ */

describe('Low-level converters', () => {
  describe('base58Encode', () => {
    it('encodes an empty array to empty string', () => {
      expect(base58Encode(new Uint8Array(0))).toBe('');
    });

    it('encodes a single zero byte to "1"', () => {
      expect(base58Encode(new Uint8Array([0]))).toBe('1');
    });

    it('encodes multiple leading zeros correctly', () => {
      const result = base58Encode(new Uint8Array([0, 0, 1]));
      expect(result).toMatch(/^11/); // two leading "1"s
    });

    it('encodes known byte sequences', () => {
      // "Hello" in base58 = 9Ajdvzr
      const hello = new TextEncoder().encode('Hello');
      const encoded = base58Encode(hello);
      expect(encoded).toBe('9Ajdvzr');
    });

    it('encodes 32-byte all-ones pubkey', () => {
      const bytes = new Uint8Array(32).fill(255);
      const result = base58Encode(bytes);
      expect(result.length).toBeGreaterThan(0);
      // Should be a valid base58 string
      expect(result).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    });
  });

  describe('rawBufferToBytes', () => {
    it('handles RawBuffer object', () => {
      const buf = mkBuf([1, 2, 3]);
      const bytes = rawBufferToBytes(buf);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect([...bytes]).toEqual([1, 2, 3]);
    });

    it('handles plain number array', () => {
      const bytes = rawBufferToBytes([10, 20, 30]);
      expect([...bytes]).toEqual([10, 20, 30]);
    });
  });

  describe('rawBufferToBase58', () => {
    it('converts a raw buffer to base58', () => {
      const buf = mkBuf([1, 2, 3]);
      const result = rawBufferToBase58(buf);
      expect(result).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    });
  });

  describe('rawBufferToHex', () => {
    it('converts to zero-padded hex', () => {
      expect(rawBufferToHex(mkBuf([0, 15, 255]))).toBe('000fff');
    });

    it('handles empty buffer', () => {
      expect(rawBufferToHex(mkBuf([]))).toBe('');
    });
  });

  describe('rawBufferToBase64', () => {
    it('converts to base64', () => {
      const result = rawBufferToBase64(mkBuf([72, 101, 108, 108, 111])); // "Hello"
      expect(result).toBe('SGVsbG8=');
    });
  });

  describe('parseTimestamp', () => {
    it('returns undefined for undefined input', () => {
      expect(parseTimestamp(undefined)).toBeUndefined();
    });

    it('parses seconds + nanos to Date', () => {
      const date = parseTimestamp({ seconds: '1700000000', nanos: 500000000 });
      expect(date).toBeInstanceOf(Date);
      expect(date!.getFullYear()).toBe(2023);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  2. Balance change computation
 * ═══════════════════════════════════════════════════════════════ */

describe('Balance change computation', () => {
  describe('computeBalanceChanges', () => {
    it('computes deltas and skips zero by default', () => {
      const changes = computeBalanceChanges(
        ['1000000000', '500000000', '200000000'],
        ['999995000', '500005000', '200000000'], // third is unchanged
      );
      // Third account has delta=0, should be skipped
      expect(changes.length).toBe(2);
      expect(changes[0].index).toBe(0);
      expect(changes[0].deltaLamports).toBe(-5000n);
      expect(changes[0].deltaSol).toBeCloseTo(-0.000005);
      expect(changes[1].index).toBe(1);
      expect(changes[1].deltaLamports).toBe(5000n);
    });

    it('includes zero-delta when skipZero is false', () => {
      const changes = computeBalanceChanges(
        ['1000', '2000'],
        ['1000', '2000'],
        false,
      );
      expect(changes.length).toBe(2);
      expect(changes.every(c => c.deltaLamports === 0n)).toBe(true);
    });

    it('handles large balances (> Number.MAX_SAFE_INTEGER)', () => {
      const big = '99999999999999999';
      const changes = computeBalanceChanges([big], ['100000000000000000']);
      expect(changes.length).toBe(1);
      expect(changes[0].deltaLamports).toBe(1n);
    });
  });

  describe('computeTokenBalanceChanges', () => {
    it('returns empty for undefined inputs', () => {
      expect(computeTokenBalanceChanges(undefined, undefined)).toEqual([]);
    });

    it('computes token deltas', () => {
      const pre = [{
        account_index: 0,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ui_token_amount: { ui_amount: 100, decimals: 6, amount: '100000000', ui_amount_string: '100' },
        owner: 'owner1',
        program_id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      }];
      const post = [{
        account_index: 0,
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        ui_token_amount: { ui_amount: 150, decimals: 6, amount: '150000000', ui_amount_string: '150' },
        owner: 'owner1',
        program_id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      }];

      const changes = computeTokenBalanceChanges(pre, post);
      expect(changes.length).toBe(1);
      expect(changes[0].deltaAmount).toBe(50000000n);
      expect(changes[0].decimals).toBe(6);
    });

    it('skips zero-delta token changes', () => {
      const tb = [{
        account_index: 0,
        mint: 'mint1',
        ui_token_amount: { ui_amount: 50, decimals: 9, amount: '50000000000', ui_amount_string: '50' },
        owner: 'owner1',
        program_id: 'program1',
      }];
      const changes = computeTokenBalanceChanges(tb, tb);
      expect(changes.length).toBe(0);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  3. Known programs registry
 * ═══════════════════════════════════════════════════════════════ */

describe('Known programs registry', () => {
  it('has a large number of known programs', () => {
    expect(KNOWN_PROGRAMS_COUNT).toBeGreaterThan(60);
    expect(Object.keys(KNOWN_PROGRAMS).length).toBe(KNOWN_PROGRAMS_COUNT);
  });

  it('resolves System Program', () => {
    expect(resolveProgram('11111111111111111111111111111111')).toBe('System Program');
  });

  it('resolves Token Program', () => {
    expect(resolveProgram('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe('SPL Token');
  });

  it('resolves Jupiter v6', () => {
    expect(resolveProgram('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'))
      .toBe('Jupiter Aggregator v6');
  });

  it('returns undefined for unknown programs', () => {
    expect(resolveProgram('UnknownProgramId1234567890abcdef')).toBeUndefined();
  });

  it('supports custom programs override', () => {
    const custom = { 'MyCustomProgram111': 'My DApp' };
    expect(resolveProgram('MyCustomProgram111', custom)).toBe('My DApp');
  });

  it('custom programs take priority over built-in', () => {
    const custom = { '11111111111111111111111111111111': 'Overridden System' };
    expect(resolveProgram('11111111111111111111111111111111', custom)).toBe('Overridden System');
  });

  it('resolveProgramBatch returns a Map', () => {
    const ids = ['11111111111111111111111111111111', 'UnknownXYZ'];
    const map = resolveProgramBatch(ids);
    expect(map.get('11111111111111111111111111111111')).toBe('System Program');
    expect(map.has('UnknownXYZ')).toBe(false);
  });

  it('isProgramInCategory identifies system programs', () => {
    expect(isProgramInCategory('11111111111111111111111111111111', 'system')).toBe(true);
    expect(isProgramInCategory('11111111111111111111111111111111', 'jupiter')).toBe(false);
  });

  it('getProgramCategory returns correct category', () => {
    expect(getProgramCategory('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')).toBe('jupiter');
    expect(getProgramCategory('unknown_id')).toBe('unknown');
  });

  it('includes Raydium programs', () => {
    expect(Object.keys(RAYDIUM_PROGRAMS).length).toBeGreaterThanOrEqual(5);
    const raydiumIds = Object.keys(RAYDIUM_PROGRAMS);
    for (const id of raydiumIds) {
      expect(resolveProgram(id)).toBeTruthy();
    }
  });

  it('includes Meteora programs', () => {
    expect(Object.keys(METEORA_PROGRAMS).length).toBeGreaterThanOrEqual(5);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  4. Transaction parsing
 * ═══════════════════════════════════════════════════════════════ */

describe('Transaction parsing', () => {
  it('decodes signature from raw buffer', () => {
    const raw = buildRawTransactionUpdate();
    const result = parseGeyserUpdate(raw)!;
    expect(result).not.toBeNull();
    expect(result.type).toBe('transaction');

    if (result.type === 'transaction') {
      // Signature should be a base58 string
      const sig = result.data.signature as unknown as string;
      expect(sig).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
      expect(sig.length).toBeGreaterThan(10);
    }
  });

  it('computes SOL balance changes', () => {
    const raw = buildRawTransactionUpdate({
      preBalances: ['2000000000', '1000000000'],
      postBalances: ['1999990000', '1000010000'],
    });
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'transaction') {
      expect(result.data.balanceChanges.length).toBe(2);
      expect(result.data.balanceChanges[0].deltaLamports).toBe(-10000n);
      expect(result.data.balanceChanges[1].deltaLamports).toBe(10000n);
    }
  });

  it('sets fee from meta', () => {
    const raw = buildRawTransactionUpdate({ fee: '25000' });
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'transaction') {
      expect(result.data.feeLamports).toBe(25000n);
      expect(result.data.feeSol).toBeCloseTo(0.000025);
    }
  });

  it('includes log messages', () => {
    const raw = buildRawTransactionUpdate();
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'transaction') {
      expect(result.data.logs).toContain('Program log: Hello');
    }
  });

  it('sets slot and blockIndex', () => {
    const raw = buildRawTransactionUpdate({ slot: '999' });
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'transaction') {
      expect(Number(result.data.slot)).toBe(999);
      expect(result.data.blockIndex).toBe(7);
    }
  });

  it('sets isVote flag', () => {
    const raw = buildRawTransactionUpdate({ isVote: true });
    const result = parseGeyserUpdate(raw)!;
    if (result.type === 'transaction') {
      expect(result.data.isVote).toBe(true);
    }
  });

  it('includes timestamp from created_at', () => {
    const raw = buildRawTransactionUpdate();
    const result = parseGeyserUpdate(raw)!;
    if (result.type === 'transaction') {
      expect(result.data.timestamp).toBeInstanceOf(Date);
    }
  });

  it('sets compute units consumed', () => {
    const raw = buildRawTransactionUpdate();
    const result = parseGeyserUpdate(raw)!;
    if (result.type === 'transaction') {
      expect(result.data.computeUnitsConsumed).toBe(1400);
    }
  });

  it('includes filters from raw update', () => {
    const raw = buildRawTransactionUpdate();
    const result = parseGeyserUpdate(raw)!;
    expect(result.filters).toEqual(['tx_filter']);
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  5. Account update parsing
 * ═══════════════════════════════════════════════════════════════ */

describe('Account update parsing', () => {
  it('decodes pubkey and owner from raw buffers', () => {
    const raw = buildRawAccountUpdate();
    const result = parseGeyserUpdate(raw)!;
    expect(result.type).toBe('account');

    if (result.type === 'account') {
      expect(result.data.pubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
      expect(result.data.owner).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    }
  });

  it('parses lamports and computes SOL', () => {
    const raw = buildRawAccountUpdate({ lamports: '5000000000' });
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'account') {
      expect(result.data.lamports).toBe(5000000000n);
      expect(result.data.sol).toBeCloseTo(5.0);
    }
  });

  it('encodes data as hex and base64', () => {
    const raw = buildRawAccountUpdate();
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'account') {
      expect(result.data.dataHex).toBe('deadbeef');
      expect(result.data.dataSize).toBe(4);
      // Base64 of [0xde, 0xad, 0xbe, 0xef]
      expect(result.data.dataBase64).toBe('3q2+7w==');
    }
  });

  it('sets writeVersion, isStartup, slot', () => {
    const raw = buildRawAccountUpdate({ slot: '777', isStartup: true });
    const result = parseGeyserUpdate(raw)!;

    if (result.type === 'account') {
      expect(Number(result.data.slot)).toBe(777);
      expect(result.data.isStartup).toBe(true);
      expect(result.data.writeVersion).toBe(9999n);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  6. Slot / BlockMeta / Entry parsing
 * ═══════════════════════════════════════════════════════════════ */

describe('Slot update parsing', () => {
  it('parses slot update with numeric status', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'slot',
      slot: { slot: '12345', parent: '12344', status: 2 },
    };
    const result = parseGeyserUpdate(raw)!;
    expect(result.type).toBe('slot');
    if (result.type === 'slot') {
      expect(Number(result.data.slot)).toBe(12345);
      expect(Number(result.data.parent!)).toBe(12344);
      expect(result.data.status).toBe('finalized');
    }
  });

  it('parses slot update with string status', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'slot',
      slot: { slot: '100', status: 'confirmed' },
    };
    const result = parseGeyserUpdate(raw)!;
    if (result.type === 'slot') {
      expect(result.data.status).toBe('confirmed');
    }
  });
});

describe('Block meta parsing', () => {
  it('parses block meta with all fields', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'block_meta',
      block_meta: {
        slot: '500',
        blockhash: 'abc123',
        rewards: [],
        parent_slot: '499',
        parent_blockhash: 'def456',
        block_time: { seconds: '1700000000', nanos: 0 },
        block_height: '1000',
        executed_transaction_count: '250',
      },
    };
    const result = parseGeyserUpdate(raw)!;
    expect(result.type).toBe('block_meta');
    if (result.type === 'block_meta') {
      expect(Number(result.data.slot)).toBe(500);
      expect(result.data.blockhash).toBe('abc123');
      expect(Number(result.data.parentSlot!)).toBe(499);
      expect(result.data.blockHeight).toBe(1000);
      expect(result.data.executedTransactionCount).toBe(250);
      expect(result.data.blockTime).toBeInstanceOf(Date);
    }
  });
});

describe('Entry parsing', () => {
  it('parses entry update', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'entry',
      entry: {
        slot: '600',
        index: '5',
        num_hashes: '128',
        hash: mkBuf([0xaa, 0xbb, 0xcc]),
        executed_transaction_count: '10',
        starting_transaction_index: '50',
      },
    };
    const result = parseGeyserUpdate(raw)!;
    expect(result.type).toBe('entry');
    if (result.type === 'entry') {
      expect(Number(result.data.slot)).toBe(600);
      expect(result.data.index).toBe(5);
      expect(result.data.numHashes).toBe(128);
      expect(result.data.hashHex).toBe('aabbcc');
      expect(result.data.executedTransactionCount).toBe(10);
      expect(result.data.startingTransactionIndex).toBe(50);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  7. Ping & unknown update types
 * ═══════════════════════════════════════════════════════════════ */

describe('Ping and unknown types', () => {
  it('handles ping update', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'ping',
      ping: {},
    };
    const result = parseGeyserUpdate(raw)!;
    expect(result.type).toBe('ping');
  });

  it('returns null for unknown update_oneof', () => {
    const raw = {
      filters: [],
      update_oneof: 'unknown_type',
    } as unknown as RawGeyserUpdate;
    const result = parseGeyserUpdate(raw);
    expect(result).toBeNull();
  });

  it('returns null when transaction data is missing', () => {
    const raw: RawGeyserUpdate = {
      filters: [],
      update_oneof: 'transaction',
      // transaction field missing
    };
    const result = parseGeyserUpdate(raw);
    expect(result).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  8. Filtering — skipVotes, skipZeroBalanceChanges
 * ═══════════════════════════════════════════════════════════════ */

describe('Filtering', () => {
  it('filters out vote transactions when skipVotes is true', () => {
    const raw = buildRawTransactionUpdate({ isVote: true });
    const result = parseGeyserUpdate(raw, { skipVotes: true });
    expect(result).toBeNull();
  });

  it('keeps vote transactions when skipVotes is false', () => {
    const raw = buildRawTransactionUpdate({ isVote: true });
    const result = parseGeyserUpdate(raw, { skipVotes: false });
    expect(result).not.toBeNull();
    if (result?.type === 'transaction') {
      expect(result.data.isVote).toBe(true);
    }
  });

  it('skips zero balance changes by default', () => {
    const raw = buildRawTransactionUpdate({
      preBalances: ['1000', '2000'],
      postBalances: ['1000', '2000'], // no change
    });
    const result = parseGeyserUpdate(raw)!;
    if (result.type === 'transaction') {
      expect(result.data.balanceChanges.length).toBe(0);
    }
  });

  it('includes zero balance changes when configured', () => {
    const raw = buildRawTransactionUpdate({
      preBalances: ['1000', '2000'],
      postBalances: ['1000', '2000'],
    });
    const result = parseGeyserUpdate(raw, { skipZeroBalanceChanges: false })!;
    if (result.type === 'transaction') {
      expect(result.data.balanceChanges.length).toBe(2);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
 *  9. GeyserParser class
 * ═══════════════════════════════════════════════════════════════ */

describe('GeyserParser class', () => {
  let parser: GeyserParser;

  beforeEach(() => {
    parser = new GeyserParser({ skipVotes: false });
  });

  describe('configuration', () => {
    it('has default configuration', () => {
      const p = new GeyserParser();
      expect(p.config.skipVotes).toBe(false);
      expect(p.config.skipZeroBalanceChanges).toBe(true);
      expect(p.config.includeInnerInstructions).toBe(true);
      expect(p.config.includeTokenBalances).toBe(true);
    });

    it('updateConfig merges partial changes', () => {
      parser.updateConfig({ skipVotes: true });
      expect(parser.config.skipVotes).toBe(true);
      expect(parser.config.skipZeroBalanceChanges).toBe(true); // unchanged
    });

    it('addPrograms merges custom programs', () => {
      parser.addPrograms({ 'prog1': 'My Program' });
      parser.addPrograms({ 'prog2': 'Another' });
      expect(parser.config.customPrograms).toHaveProperty('prog1');
      expect(parser.config.customPrograms).toHaveProperty('prog2');
    });
  });

  describe('parse method', () => {
    it('parses a transaction update', () => {
      const raw = buildRawTransactionUpdate();
      const result = parser.parse(raw);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('transaction');
    });

    it('parses an account update', () => {
      const raw = buildRawAccountUpdate();
      const result = parser.parse(raw);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('account');
    });

    it('returns null for filtered-out updates', () => {
      parser.updateConfig({ skipVotes: true });
      const raw = buildRawTransactionUpdate({ isVote: true });
      const result = parser.parse(raw);
      expect(result).toBeNull();
    });
  });

  describe('passthrough', () => {
    it('returns the raw update untouched', () => {
      const raw = buildRawTransactionUpdate();
      const result = parser.passthrough(raw);
      expect(result).toBe(raw); // same reference
    });

    it('increments totalReceived counter', () => {
      const raw = buildRawTransactionUpdate();
      parser.passthrough(raw);
      expect(parser.stats.totalReceived).toBe(1);
    });
  });

  describe('statistics', () => {
    it('tracks parsed counts by type', () => {
      parser.parse(buildRawTransactionUpdate());
      parser.parse(buildRawTransactionUpdate());
      parser.parse(buildRawAccountUpdate());

      expect(parser.stats.totalReceived).toBe(3);
      expect(parser.stats.totalParsed).toBe(3);
      expect(parser.stats.byType.transaction).toBe(2);
      expect(parser.stats.byType.account).toBe(1);
    });

    it('tracks filtered count', () => {
      parser.updateConfig({ skipVotes: true });
      parser.parse(buildRawTransactionUpdate({ isVote: true }));
      parser.parse(buildRawTransactionUpdate({ isVote: false }));

      expect(parser.stats.totalReceived).toBe(2);
      expect(parser.stats.totalParsed).toBe(1);
      expect(parser.stats.totalFiltered).toBe(1);
    });

    it('resetStats clears all counters', () => {
      parser.parse(buildRawTransactionUpdate());
      parser.parse(buildRawAccountUpdate());
      parser.resetStats();

      expect(parser.stats.totalReceived).toBe(0);
      expect(parser.stats.totalParsed).toBe(0);
      expect(parser.stats.byType.transaction).toBe(0);
    });
  });

  describe('events', () => {
    it('emits "update" for every parsed update', () => {
      const handler = vi.fn();
      parser.on('update', handler);

      parser.parse(buildRawTransactionUpdate());
      parser.parse(buildRawAccountUpdate());

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('emits "transaction" for transaction updates', () => {
      const txHandler = vi.fn();
      parser.on('transaction', txHandler);

      parser.parse(buildRawTransactionUpdate());
      parser.parse(buildRawAccountUpdate());

      expect(txHandler).toHaveBeenCalledTimes(1);
      expect(txHandler.mock.calls[0][0]).toHaveProperty('signature');
      expect(txHandler.mock.calls[0][1]).toEqual(['tx_filter']);
    });

    it('emits "account" for account updates', () => {
      const acctHandler = vi.fn();
      parser.on('account', acctHandler);

      parser.parse(buildRawAccountUpdate());

      expect(acctHandler).toHaveBeenCalledTimes(1);
      expect(acctHandler.mock.calls[0][0]).toHaveProperty('pubkey');
    });

    it('emits "filtered" when an update is filtered out', () => {
      const filteredHandler = vi.fn();
      parser.on('filtered', filteredHandler);
      parser.updateConfig({ skipVotes: true });

      parser.parse(buildRawTransactionUpdate({ isVote: true }));

      expect(filteredHandler).toHaveBeenCalledTimes(1);
      expect(filteredHandler.mock.calls[0][1]).toBe('vote_skipped');
    });

    it('emits "error" when parsing fails', () => {
      const errorHandler = vi.fn();
      parser.on('error', errorHandler);

      // Create a malformed raw update that will cause an error
      const malformed: RawGeyserUpdate = {
        filters: [],
        update_oneof: 'account',
        account: {
          account: {
            pubkey: null as any, // will cause rawBufferToBytes to throw
            lamports: '100',
            owner: mkBuf([1]),
            executable: false,
            rent_epoch: '1',
            data: mkBuf([]),
            write_version: '1',
          },
          slot: '1',
          is_startup: false,
        },
      };

      const result = parser.parse(malformed);
      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(parser.stats.totalErrors).toBe(1);
    });
  });

  describe('parseBatch', () => {
    it('parses a batch of updates', () => {
      const updates = [
        buildRawTransactionUpdate(),
        buildRawAccountUpdate(),
        buildRawTransactionUpdate({ isVote: true }),
      ];

      const results = parser.parseBatch(updates);
      expect(results.length).toBe(3); // skipVotes is false
    });

    it('filters out nulls', () => {
      parser.updateConfig({ skipVotes: true });
      const updates = [
        buildRawTransactionUpdate({ isVote: true }),
        buildRawTransactionUpdate({ isVote: false }),
        buildRawTransactionUpdate({ isVote: true }),
      ];

      const results = parser.parseBatch(updates);
      expect(results.length).toBe(1);
    });
  });

  describe('stream handlers', () => {
    it('createHandler returns a function', () => {
      const handler = parser.createHandler();
      expect(typeof handler).toBe('function');

      const result = handler(buildRawTransactionUpdate());
      expect(result).not.toBeNull();
    });

    it('createFilteredHandler only calls callback for non-null results', () => {
      parser.updateConfig({ skipVotes: true });
      const cb = vi.fn();
      const handler = parser.createFilteredHandler(cb);

      handler(buildRawTransactionUpdate({ isVote: true }));  // filtered
      handler(buildRawTransactionUpdate({ isVote: false })); // passes

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('per-type helpers', () => {
    it('parseTransaction works directly', () => {
      const rawUpdate = buildRawTransactionUpdate();
      const tx = parser.parseTransaction(rawUpdate.transaction!);
      expect(tx.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
      expect(tx.feeLamports).toBe(5000n);
    });

    it('parseAccountUpdate works directly', () => {
      const rawUpdate = buildRawAccountUpdate();
      const acct = parser.parseAccountUpdate(rawUpdate.account!);
      expect(acct.lamports).toBe(5000000000n);
      expect(acct.sol).toBeCloseTo(5.0);
    });

    it('parseSlotUpdate works directly', () => {
      const slot = parser.parseSlotUpdate({ slot: '100', status: 1 });
      expect(Number(slot.slot)).toBe(100);
      expect(slot.status).toBe('confirmed');
    });

    it('parseBlockMeta works directly', () => {
      const meta = parser.parseBlockMeta({
        slot: '200',
        blockhash: 'hash',
        rewards: [],
        block_height: '50',
      });
      expect(Number(meta.slot)).toBe(200);
      expect(meta.blockHeight).toBe(50);
    });

    it('parseEntry works directly', () => {
      const entry = parser.parseEntry({
        slot: '300',
        index: '1',
        num_hashes: '64',
        hash: mkBuf([0xff]),
        executed_transaction_count: '5',
      });
      expect(Number(entry.slot)).toBe(300);
      expect(entry.numHashes).toBe(64);
      expect(entry.hashHex).toBe('ff');
    });
  });
});
