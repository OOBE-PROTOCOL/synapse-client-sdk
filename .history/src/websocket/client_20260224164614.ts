/**
 * WsClient — typed Solana WebSocket subscription client.
 *
 * Provides a clean API for all 6 Solana PubSub subscription methods
 * with automatic reconnect, ping/pong keep-alive, and subscription
 * restore after reconnection.
 *
 * @module websocket/client
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { WsClient } from '@oobe-protocol-labs/synapse-client-sdk';
 *
 * const ws = new WsClient({ endpoint: 'wss://rpc.synapse.com' });
 * ws.onSlotChange((n) => console.log('Slot:', n.slot));
 * ws.onAccountChange(pubkey, (n) => console.log('Balance:', n.result.value.lamports));
 * ```
 */
import WebSocket from 'ws';
import type { Pubkey, Signature } from '../core/types';
import type {
  WsConfig, SubscriptionId,
  AccountSubParams, ProgramSubParams, LogsSubParams,
  LogsFilter, SignatureSubParams,
  AccountNotification, ProgramNotification,
  LogsNotification, SignatureNotification,
  SlotNotification, RootNotification
} from './types';

/** @internal Tracked subscription entry. */
type SubEntry = {
  method: string;
  params: unknown[];
  handler: (data: any) => void;
  id?: SubscriptionId;
};

/**
 * Typed Solana WebSocket subscription client.
 *
 * Supports `accountSubscribe`, `programSubscribe`, `logsSubscribe`,
 * `signatureSubscribe`, `slotSubscribe`, and `rootSubscribe`.
 *
 * @since 1.0.0
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private subs = new Map<number, SubEntry>();
  private nextLocalId = 1;
  private reconnecting = false;
  private reconnectAttempts = 0;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly cfg: Required<WsConfig>;

  constructor(config: WsConfig) {
    this.cfg = {
      autoReconnect: true,
      reconnectIntervalMs: 2000,
      maxReconnectAttempts: 20,
      pingIntervalMs: 30_000,
      ...config
    };
  }

  // ── Public subscriptions ──────────────────────────────────────

  /**
   * Subscribe to changes on a specific account.
   *
   * @param pubkey  - Account public key to watch.
   * @param handler - Callback invoked on every account change.
   * @param opts    - Encoding and commitment options.
   * @returns Local subscription ID (use with {@link unsubscribe}).
   * @since 1.0.0
   */
  onAccountChange(pubkey: Pubkey, handler: (n: AccountNotification) => void, opts: AccountSubParams = {}): number {
    return this.subscribe('accountSubscribe', [pubkey, opts], handler);
  }

  /**
   * Subscribe to changes on all accounts owned by a program.
   *
   * @param programId - Program public key.
   * @param handler   - Callback invoked on every matching account change.
   * @param opts      - Encoding, commitment, and filter options.
   * @returns Local subscription ID.
   * @since 1.0.0
   */
  onProgramAccountChange(programId: Pubkey, handler: (n: ProgramNotification) => void, opts: ProgramSubParams = {}): number {
    return this.subscribe('programSubscribe', [programId, opts], handler);
  }

  /**
   * Subscribe to transaction logs.
   *
   * @param filter  - `'all'`, `'allWithVotes'`, or `{ mentions: [pubkey] }`.
   * @param handler - Callback invoked with signature + log lines.
   * @param opts    - Commitment options.
   * @returns Local subscription ID.
   * @since 1.0.0
   */
  onLogs(filter: LogsFilter, handler: (n: LogsNotification) => void, opts: LogsSubParams = {}): number {
    return this.subscribe('logsSubscribe', [filter, opts], handler);
  }

  /**
   * Subscribe to a specific transaction signature's confirmation.
   *
   * @param signature - Transaction signature to watch.
   * @param handler   - Callback invoked on confirmation or received.
   * @param opts      - Commitment + received-notification options.
   * @returns Local subscription ID.
   * @since 1.0.0
   */
  onSignature(signature: Signature, handler: (n: SignatureNotification) => void, opts: SignatureSubParams = {}): number {
    return this.subscribe('signatureSubscribe', [signature, opts], handler);
  }

  /**
   * Subscribe to slot changes.
   *
   * @param handler - Callback invoked on every new slot.
   * @returns Local subscription ID.
   * @since 1.0.0
   */
  onSlotChange(handler: (n: SlotNotification) => void): number {
    return this.subscribe('slotSubscribe', [], handler);
  }

  /**
   * Subscribe to root slot changes.
   *
   * @param handler - Callback invoked on every new root.
   * @returns Local subscription ID.
   * @since 1.0.0
   */
  onRootChange(handler: (n: RootNotification) => void): number {
    return this.subscribe('rootSubscribe', [], handler);
  }

  /**
   * Unsubscribe from a previously created subscription.
   *
   * @param localId - The ID returned by one of the `on*` methods.
   * @since 1.0.0
   */
  unsubscribe(localId: number): void {
    const entry = this.subs.get(localId);
    if (!entry) return;
    if (entry.id != null && this.ws?.readyState === WebSocket.OPEN) {
      const unsubMethod = entry.method.replace('Subscribe', 'Unsubscribe');
      this.sendJson({ jsonrpc: '2.0', id: localId, method: unsubMethod, params: [entry.id] });
    }
    this.subs.delete(localId);
  }

  /**
   * Close the WebSocket connection and clear all subscriptions.
   * Disables auto-reconnect.
   * @since 1.0.0
   */
  close(): void {
    (this.cfg as { autoReconnect: boolean }).autoReconnect = false;
    this.stopPing();
    this.ws?.close();
    this.ws = null;
    this.subs.clear();
  }

  // ── Internals ─────────────────────────────────────────────────

  private subscribe(method: string, params: unknown[], handler: (data: any) => void): number {
    const localId = this.nextLocalId++;
    const entry: SubEntry = { method, params, handler };
    this.subs.set(localId, entry);
    this.ensureConnected().then(() => this.sendSub(localId, entry));
    return localId;
  }

  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    await this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.cfg.endpoint);
      this.ws = ws;

      ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.startPing();
        resolve();
      });

      ws.on('message', (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(msg);
        } catch { /* ignore malformed */ }
      });

      ws.on('close', () => {
        this.stopPing();
        if (this.cfg.autoReconnect) this.scheduleReconnect();
      });

      ws.on('error', (err: Error) => {
        if (this.ws === ws && ws.readyState !== WebSocket.OPEN) reject(err);
      });
    });
  }

  private handleMessage(msg: any): void {
    if (msg.id != null && msg.result != null && typeof msg.result === 'number') {
      for (const [, entry] of this.subs) {
        if (!entry.id) {
          entry.id = msg.result;
          break;
        }
      }
      return;
    }

    if (msg.method && msg.params?.subscription != null) {
      for (const entry of this.subs.values()) {
        if (entry.id === msg.params.subscription) {
          entry.handler(msg.params);
          return;
        }
      }
    }
  }

  private sendSub(localId: number, entry: SubEntry): void {
    this.sendJson({ jsonrpc: '2.0', id: localId, method: entry.method, params: entry.params });
  }

  private sendJson(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    if (this.reconnectAttempts >= this.cfg.maxReconnectAttempts) return;
    this.reconnecting = true;
    this.reconnectAttempts++;

    setTimeout(async () => {
      this.reconnecting = false;
      try {
        await this.connect();
        for (const [localId, entry] of this.subs) {
          entry.id = undefined;
          this.sendSub(localId, entry);
        }
      } catch { /* will retry on next close */ }
    }, this.cfg.reconnectIntervalMs * Math.min(this.reconnectAttempts, 10));
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.ping();
    }, this.cfg.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}
