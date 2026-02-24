/**
 * GeyserParser — high-level entry point for dev consumption.
 *
 * Developers instantiate this once with their preferred config
 * and feed every raw update from a Yellowstone gRPC `subscribe()` stream.
 * They choose between **raw** (zero-cost pass-through) or **parsed**
 * (fully decoded, typed, human-readable) output — or both.
 *
 * @module grpc/parser/geyser-parser
 *
 * @example
 * ```ts
 * import { GeyserParser } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const parser = new GeyserParser({ skipVotes: true });
 *
 * grpcStream.on('data', (raw) => {
 *   // Option A — get the fully parsed update
 *   const parsed = parser.parse(raw);
 *   if (!parsed) return; // filtered out
 *
 *   switch (parsed.type) {
 *     case 'transaction':
 *       console.log(parsed.data.signature, parsed.data.programNamesInvoked);
 *       break;
 *     case 'account':
 *       console.log(parsed.data.pubkey, parsed.data.sol, 'SOL');
 *       break;
 *   }
 *
 *   // Option B — keep the raw wire format untouched
 *   const rawMsg = parser.passthrough(raw);
 *
 *   // Option C — parse selectively
 *   if (raw.update_oneof === 'transaction') {
 *     const tx = parser.parseTransaction(raw.transaction!);
 *     console.log(tx.signature, tx.feeSol);
 *   }
 * });
 * ```
 */

import { EventEmitter } from 'eventemitter3';

import type {
  RawGeyserUpdate,
  RawTransactionInfo,
  RawAccountInfo,
  RawSlotInfo,
  RawBlockMeta,
  RawEntry,
  GeyserParserConfig,
  ParsedGeyserUpdate,
  ParsedTransaction,
  ParsedAccountUpdate,
  ParsedSlotUpdate,
  ParsedBlockMeta,
  ParsedEntry,
} from './types';

import {
  parseGeyserUpdate,
  parseTransaction,
  parseAccountUpdate,
  parseSlotUpdate,
  parseBlockMeta,
  parseEntry,
  parseTimestamp,
} from './decoder';

/* ═══════════════════════════════════════════════════════════════
 *  Event types emitted by GeyserParser
 * ═══════════════════════════════════════════════════════════════ */

export interface GeyserParserEvents {
  /** Emitted for every successfully parsed update. */
  update: (update: ParsedGeyserUpdate) => void;

  /** Emitted specifically for parsed transactions. */
  transaction: (tx: ParsedTransaction, filters: string[]) => void;

  /** Emitted specifically for parsed account updates. */
  account: (acct: ParsedAccountUpdate, filters: string[]) => void;

  /** Emitted specifically for slot updates. */
  slot: (slot: ParsedSlotUpdate, filters: string[]) => void;

  /** Emitted for block meta updates. */
  blockMeta: (meta: ParsedBlockMeta, filters: string[]) => void;

  /** Emitted for entry updates. */
  entry: (entry: ParsedEntry, filters: string[]) => void;

  /** Emitted when an update is filtered out. */
  filtered: (raw: RawGeyserUpdate, reason: string) => void;

  /** Emitted when parsing fails for a single message. */
  error: (error: Error, raw: RawGeyserUpdate) => void;
}

/* ═══════════════════════════════════════════════════════════════
 *  Parser statistics
 * ═══════════════════════════════════════════════════════════════ */

export interface GeyserParserStats {
  totalReceived: number;
  totalParsed: number;
  totalFiltered: number;
  totalErrors: number;
  byType: {
    transaction: number;
    account: number;
    slot: number;
    block_meta: number;
    entry: number;
    ping: number;
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  GeyserParser class
 * ═══════════════════════════════════════════════════════════════ */

/**
 * High-level Geyser gRPC subscription parser.
 *
 * Features:
 * - **Raw mode** (`passthrough`) — zero-cost, returns the raw wire message
 * - **Parsed mode** (`parse`) — fully decoded, typed output
 * - **Event-based** — optionally emit per-type events for reactive pipelines
 * - **Stats tracking** — counts by type, filtered, errors
 * - **Config hot-reload** — change `skipVotes`, custom programs, etc. at runtime
 */
export class GeyserParser extends EventEmitter<GeyserParserEvents> {
  private _config: Required<GeyserParserConfig>;
  private _stats: GeyserParserStats;

  constructor(config: GeyserParserConfig = {}) {
    super();

    this._config = {
      skipZeroBalanceChanges: config.skipZeroBalanceChanges ?? true,
      skipVotes: config.skipVotes ?? false,
      customPrograms: config.customPrograms ?? {},
      includeInnerInstructions: config.includeInnerInstructions ?? true,
      includeTokenBalances: config.includeTokenBalances ?? true,
    };

    this._stats = {
      totalReceived: 0,
      totalParsed: 0,
      totalFiltered: 0,
      totalErrors: 0,
      byType: {
        transaction: 0,
        account: 0,
        slot: 0,
        block_meta: 0,
        entry: 0,
        ping: 0,
      },
    };
  }

  /* ─── Configuration ──────────────────────────────────────── */

  /** Get the current parser configuration. */
  get config(): Readonly<Required<GeyserParserConfig>> {
    return this._config;
  }

  /** Update configuration at runtime (partial merge). */
  updateConfig(patch: Partial<GeyserParserConfig>): void {
    if (patch.skipZeroBalanceChanges !== undefined)
      this._config.skipZeroBalanceChanges = patch.skipZeroBalanceChanges;
    if (patch.skipVotes !== undefined)
      this._config.skipVotes = patch.skipVotes;
    if (patch.customPrograms !== undefined)
      this._config.customPrograms = { ...this._config.customPrograms, ...patch.customPrograms };
    if (patch.includeInnerInstructions !== undefined)
      this._config.includeInnerInstructions = patch.includeInnerInstructions;
    if (patch.includeTokenBalances !== undefined)
      this._config.includeTokenBalances = patch.includeTokenBalances;
  }

  /** Register additional custom program IDs → names. */
  addPrograms(programs: Record<string, string>): void {
    this._config.customPrograms = { ...this._config.customPrograms, ...programs };
  }

  /* ─── Statistics ─────────────────────────────────────────── */

  /** Get current parser statistics. */
  get stats(): Readonly<GeyserParserStats> {
    return this._stats;
  }

  /** Reset all statistics counters to zero. */
  resetStats(): void {
    this._stats = {
      totalReceived: 0,
      totalParsed: 0,
      totalFiltered: 0,
      totalErrors: 0,
      byType: { transaction: 0, account: 0, slot: 0, block_meta: 0, entry: 0, ping: 0 },
    };
  }

  /* ─── Raw mode (pass-through) ────────────────────────────── */

  /**
   * Return the raw update as-is — zero decoding cost.
   *
   * Useful when devs want the protobuf wire format for
   * custom decoding, storage, or forwarding.
   */
  passthrough<T extends RawGeyserUpdate>(raw: T): T {
    this._stats.totalReceived++;
    return raw;
  }

  /* ─── Parsed mode ────────────────────────────────────────── */

  /**
   * Parse any raw Geyser update into a fully typed object.
   *
   * Returns `null` when the update is filtered out by config
   * (e.g. vote transactions when `skipVotes: true`).
   *
   * Emits typed events for reactive consumption.
   */
  parse(raw: RawGeyserUpdate): ParsedGeyserUpdate | null {
    this._stats.totalReceived++;

    try {
      const result = parseGeyserUpdate(raw, this._config);

      if (!result) {
        this._stats.totalFiltered++;
        this.emit('filtered', raw, this._filterReason(raw));
        return null;
      }

      this._stats.totalParsed++;
      this._stats.byType[result.type]++;

      // Emit typed events
      this.emit('update', result);

      switch (result.type) {
        case 'transaction':
          this.emit('transaction', result.data, result.filters);
          break;
        case 'account':
          this.emit('account', result.data, result.filters);
          break;
        case 'slot':
          this.emit('slot', result.data, result.filters);
          break;
        case 'block_meta':
          this.emit('blockMeta', result.data, result.filters);
          break;
        case 'entry':
          this.emit('entry', result.data, result.filters);
          break;
      }

      return result;
    } catch (err) {
      this._stats.totalErrors++;
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error, raw);
      return null;
    }
  }

  /**
   * Convenience: parse a batch of raw updates, returning only non-null results.
   */
  parseBatch(updates: RawGeyserUpdate[]): ParsedGeyserUpdate[] {
    const results: ParsedGeyserUpdate[] = [];
    for (const raw of updates) {
      const parsed = this.parse(raw);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  /* ─── Per-type parsing helpers ──────────────────────────── */

  /**
   * Parse a raw transaction update directly.
   * Use when you already know the `update_oneof` type.
   */
  parseTransaction(
    raw: { transaction: RawTransactionInfo; slot: string },
    timestamp?: Date,
  ): ParsedTransaction {
    return parseTransaction(raw, this._config, timestamp);
  }

  /**
   * Parse a raw account update directly.
   */
  parseAccountUpdate(
    raw: { account: RawAccountInfo; slot: string; is_startup: boolean },
    timestamp?: Date,
  ): ParsedAccountUpdate {
    return parseAccountUpdate(raw, this._config, timestamp);
  }

  /**
   * Parse a raw slot update directly.
   */
  parseSlotUpdate(raw: RawSlotInfo, timestamp?: Date): ParsedSlotUpdate {
    return parseSlotUpdate(raw, timestamp);
  }

  /**
   * Parse a raw block meta update directly.
   */
  parseBlockMeta(raw: RawBlockMeta, timestamp?: Date): ParsedBlockMeta {
    return parseBlockMeta(raw, timestamp);
  }

  /**
   * Parse a raw entry update directly.
   */
  parseEntry(raw: RawEntry, timestamp?: Date): ParsedEntry {
    return parseEntry(raw, timestamp);
  }

  /* ─── Stream adapter ─────────────────────────────────────── */

  /**
   * Create a transform callback suitable for piping a stream.
   *
   * @example
   * ```ts
   * grpcStream.on('data', parser.createHandler());
   * ```
   */
  createHandler(): (raw: RawGeyserUpdate) => ParsedGeyserUpdate | null {
    return (raw) => this.parse(raw);
  }

  /**
   * Create a handler that only forwards non-null results to a callback.
   *
   * @example
   * ```ts
   * grpcStream.on('data', parser.createFilteredHandler((update) => {
   *   console.log(update.type, update.data);
   * }));
   * ```
   */
  createFilteredHandler(
    cb: (update: ParsedGeyserUpdate) => void,
  ): (raw: RawGeyserUpdate) => void {
    return (raw) => {
      const parsed = this.parse(raw);
      if (parsed) cb(parsed);
    };
  }

  /* ─── Internal helpers ──────────────────────────────────── */

  private _filterReason(raw: RawGeyserUpdate): string {
    if (raw.update_oneof === 'transaction') {
      if (this._config.skipVotes && raw.transaction?.transaction.is_vote) {
        return 'vote_skipped';
      }
    }
    return 'unknown';
  }
}
