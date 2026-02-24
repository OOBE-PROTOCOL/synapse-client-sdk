/**
 * WsClient — typed Solana WebSocket subscription client.
 * Auto-reconnect, ping/pong keep-alive, subscription restore.
 */
import type { Pubkey, Signature, Commitment } from '../core/types';
import type {
  WsConfig, SubscriptionId,
  AccountSubParams, ProgramSubParams, LogsSubParams,
  LogsFilter, SignatureSubParams,
  AccountNotification, ProgramNotification,
  LogsNotification, SignatureNotification,
  SlotNotification, RootNotification
} from './types';

type WsImpl = typeof import('ws');

type SubEntry = {
  method: string;
  params: unknown[];
  handler: (data: any) => void;
  id?: SubscriptionId;
};

export class WsClient {
  private ws: InstanceType<WsImpl['default']> | null = null;
  private subs = new Map<number, SubEntry>();
  private nextLocalId = 1;
  private pendingUnsubs = new Set<SubscriptionId>();
  private reconnecting = false;
  private reconnectAttempts = 0;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly cfg: Required<WsConfig>;
  private WsConstructor!: WsImpl['default'];

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

  onAccountChange(pubkey: Pubkey, handler: (n: AccountNotification) => void, opts: AccountSubParams = {}): number {
    return this.subscribe('accountSubscribe', [pubkey, opts], handler);
  }

  onProgramAccountChange(programId: Pubkey, handler: (n: ProgramNotification) => void, opts: ProgramSubParams = {}): number {
    return this.subscribe('programSubscribe', [programId, opts], handler);
  }

  onLogs(filter: LogsFilter, handler: (n: LogsNotification) => void, opts: LogsSubParams = {}): number {
    return this.subscribe('logsSubscribe', [filter, opts], handler);
  }

  onSignature(signature: Signature, handler: (n: SignatureNotification) => void, opts: SignatureSubParams = {}): number {
    return this.subscribe('signatureSubscribe', [signature, opts], handler);
  }

  onSlotChange(handler: (n: SlotNotification) => void): number {
    return this.subscribe('slotSubscribe', [], handler);
  }

  onRootChange(handler: (n: RootNotification) => void): number {
    return this.subscribe('rootSubscribe', [], handler);
  }

  unsubscribe(localId: number): void {
    const entry = this.subs.get(localId);
    if (!entry) return;
    if (entry.id != null && this.ws?.readyState === 1) {
      const unsubMethod = entry.method.replace('Subscribe', 'Unsubscribe');
      this.sendJson({ jsonrpc: '2.0', id: localId, method: unsubMethod, params: [entry.id] });
    }
    this.subs.delete(localId);
  }

  close(): void {
    this.cfg.autoReconnect = false;
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
    if (this.ws?.readyState === 1) return;
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (!this.WsConstructor) {
      const mod = await import('ws');
      this.WsConstructor = (mod.default ?? mod) as any;
    }

    return new Promise((resolve, reject) => {
      const ws = new this.WsConstructor(this.cfg.endpoint);
      this.ws = ws;

      ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.startPing();
        resolve();
      });

      ws.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(msg);
        } catch { /* ignore malformed */ }
      });

      ws.on('close', () => {
        this.stopPing();
        if (this.cfg.autoReconnect) this.scheduleReconnect();
      });

      ws.on('error', (err) => {
        if (this.ws === ws && ws.readyState !== 1) reject(err);
      });
    });
  }

  private handleMessage(msg: any): void {
    // Subscription confirmation: { id, result: subscriptionId }
    if (msg.id != null && msg.result != null && typeof msg.result === 'number') {
      for (const [localId, entry] of this.subs) {
        if (!entry.id) {
          entry.id = msg.result;
          break;
        }
      }
      return;
    }

    // Notification: { method, params: { subscription, result } }
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
    if (this.ws?.readyState === 1) {
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
        // Re-subscribe all active subs
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
      if (this.ws?.readyState === 1) this.ws.ping();
    }, this.cfg.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}
