/**
 * WebSocket subscription types — Solana PubSub API.
 *
 * Type definitions for all 6 subscription methods supported by the
 * Solana WebSocket PubSub interface, including params and notifications.
 *
 * @module websocket/types
 * @since 1.0.0
 */
import type { Pubkey, Commitment, Encoding, AccountInfo, Slot, Signature } from '../core/types';

/** Server-assigned subscription ID (numeric). @since 1.0.0 */
export type SubscriptionId = number;

/**
 * Configuration for the WebSocket client.
 * @since 1.0.0
 */
export interface WsConfig {
  /** WebSocket endpoint URL (`wss://…`). */
  endpoint: string;
  /** Auto-reconnect on disconnect (default `true`). */
  autoReconnect?: boolean;
  /** Delay between reconnect attempts in ms (default `2000`). */
  reconnectIntervalMs?: number;
  /** Maximum reconnect attempts before giving up (default `20`). */
  maxReconnectAttempts?: number;
  /** Ping interval to keep the connection alive in ms (default `30 000`). */
  pingIntervalMs?: number;
}

// ── Subscription params ────────────────────────────────────────

/** Parameters for `accountSubscribe`. @since 1.0.0 */
export interface AccountSubParams {
  commitment?: Commitment;
  encoding?: Encoding;
}

/** Parameters for `programSubscribe`. @since 1.0.0 */
export interface ProgramSubParams {
  commitment?: Commitment;
  encoding?: Encoding;
  filters?: unknown[];
}

/** Parameters for `logsSubscribe`. @since 1.0.0 */
export interface LogsSubParams {
  commitment?: Commitment;
}

/** Filter for `logsSubscribe` — `'all'`, `'allWithVotes'`, or `{ mentions: [pubkey] }`. @since 1.0.0 */
export type LogsFilter = 'all' | 'allWithVotes' | { mentions: [Pubkey] };

/** Parameters for `signatureSubscribe`. @since 1.0.0 */
export interface SignatureSubParams {
  commitment?: Commitment;
  enableReceivedNotification?: boolean;
}

/** Parameters for `slotSubscribe` (no options). @since 1.0.0 */
export interface SlotSubParams {}

/** Parameters for `rootSubscribe` (no options). @since 1.0.0 */
export interface RootSubParams {}

// ── Notification payloads ──────────────────────────────────────

/** Notification payload for `accountSubscribe`. @since 1.0.0 */
export interface AccountNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: AccountInfo;
  };
}

/** Notification payload for `programSubscribe`. @since 1.0.0 */
export interface ProgramNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: {
      pubkey: Pubkey;
      account: AccountInfo;
    };
  };
}

/** Notification payload for `logsSubscribe`. @since 1.0.0 */
export interface LogsNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: {
      signature: Signature;
      err: unknown;
      logs: string[];
    };
  };
}

/** Notification payload for `signatureSubscribe`. @since 1.0.0 */
export interface SignatureNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: { err: unknown } | 'receivedSignature';
  };
}

/** Notification payload for `slotSubscribe`. @since 1.0.0 */
export interface SlotNotification {
  parent: Slot;
  root: Slot;
  slot: Slot;
}

/** Notification payload for `rootSubscribe`. @since 1.0.0 */
export interface RootNotification {
  result: Slot;
}

/** Union of all WebSocket notification types. @since 1.0.0 */
export type WsNotification =
  | AccountNotification
  | ProgramNotification
  | LogsNotification
  | SignatureNotification
  | SlotNotification
  | RootNotification;
