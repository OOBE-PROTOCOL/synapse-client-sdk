/**
 * WsClient — typed Solana WebSocket subscription client.
 *
 * Provides a clean API for all 6 Solana PubSub subscription methods
 * with automatic reconnect, ping/pong keep-alive, and subscription
 * restore after reconnection.
 *
 * **Cross-platform**: Uses the native `WebSocket` global when available
 * (browsers, Deno, Cloudflare Workers, Next.js client components) and
 * falls back to the `ws` npm package on Node.js / Bun.
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
import { isBrowser } from '../utils/env';
import type { Pubkey, Signature } from '../core/types';
import type {
  WsConfig, SubscriptionId,
  AccountSubParams, ProgramSubParams, LogsSubParams,
  LogsFilter, SignatureSubParams,
  AccountNotification, ProgramNotification,
  LogsNotification, SignatureNotification,
  SlotNotification, RootNotification
} from './types';

// ── Cross-platform WebSocket adapter ───────────────────────────

/**
 * Minimal WebSocket interface shared between the native browser
 * `WebSocket` and the Node.js `ws` package.
 * @internal
 */
interface WsLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  ping?(): void;
  on?(event: string, handler: (...args: any[]) => void): void;
  addEventListener?(event: string, handler: (...args: any[]) => void): void;
  removeEventListener?(event: string, handler: (...args: any[]) => void): void;
}

/** @internal readyState constants (same for browser and `ws`). */
const WS_OPEN = 1;

/**
 * Resolve the WebSocket constructor for the current runtime.
 *
 * - Browser / Edge / Deno: `globalThis.WebSocket` (native).
 * - Node.js / Bun: dynamic `require('ws')`.
 *
 * @internal
 * @throws {Error} If no WebSocket implementation is available.
 */
const getWsConstructor = (): new (url: string) => WsLike => {
  // Browser-native WebSocket (or Node >= 22 with experimental flag)
  if (typeof globalThis !== 'undefined' && (globalThis as any).WebSocket) {
    return (globalThis as any).WebSocket;
  }
  // Node.js fallback — dynamic require to avoid bundler warnings
  try {
    return require('ws');
  } catch {
    throw new Error(
      'No WebSocket implementation found. Install the "ws" package for Node.js: pnpm add ws'
    );
  }
};

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
 * Works in **both browser and Node.js** environments.
 *
 * @since 1.0.0
 */
export class WsClient {
  private ws: WsLike | null = null;
  private subs = new Map<number, SubEntry>();
  private nextLocalId = 1;
  private reconnecting = false;
  private reconnectAttempts = 0;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly cfg: Required<WsConfig>;
  private readonly _isBrowser: boolean;

  constructor(config: WsConfig) {
    this.cfg = {
      autoReconnect: true,
      reconnectIntervalMs: 2000,
      maxReconnectAttempts: 20,
      pingIntervalMs: 30_000,
      ...config
    };
    this._isBrowser = isBrowser();
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
    if (entry.id != null && this.ws?.readyState === WS_OPEN) {
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
    if (this.ws?.readyState === WS_OPEN) return;
    await this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const WsCtor = getWsConstructor();
      const ws = new WsCtor(this.cfg.endpoint) as WsLike;
      this.ws = ws;

      // ── Node.js `ws` — uses EventEmitter-style `.on()` ──────
      if (typeof ws.on === 'function') {
        ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        });

        ws.on('message', (raw: any) => {
          try {
            const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
            this.handleMessage(msg);
          } catch { /* ignore malformed */ }
        });

        ws.on('close', () => {
          this.stopPing();
          if (this.cfg.autoReconnect) this.scheduleReconnect();
        });

        ws.on('error', (err: Error) => {
          if (this.ws === ws && ws.readyState !== WS_OPEN) reject(err);
        });
      }
      // ── Browser native WebSocket — uses `.addEventListener()` ─
      else if (typeof ws.addEventListener === 'function') {
        ws.addEventListener('open', () => {
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        });

        ws.addEventListener('message', (evt: any) => {
          try {
            const data = typeof evt === 'string' ? evt : (evt.data ?? evt);
            const msg = JSON.parse(typeof data === 'string' ? data : String(data));
            this.handleMessage(msg);
          } catch { /* ignore malformed */ }
        });

        ws.addEventListener('close', () => {
          this.stopPing();
          if (this.cfg.autoReconnect) this.scheduleReconnect();
        });

        ws.addEventListener('error', () => {
          if (this.ws === ws && ws.readyState !== WS_OPEN) {
            reject(new Error('WebSocket connection failed'));
          }
        });
      }
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
    if (this.ws?.readyState === WS_OPEN) {
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
    // Browser WebSocket does not expose .ping() — the browser handles
    // TCP keep-alive automatically. Only Node.js `ws` has .ping().
    if (typeof this.ws?.ping === 'function') {
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WS_OPEN && typeof this.ws.ping === 'function') {
          this.ws.ping();
        }
      }, this.cfg.pingIntervalMs);
    }
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}
