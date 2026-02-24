/**
 * WebSocket subscription types — Solana PubSub API.
 */
import type { Pubkey, Commitment, Encoding, AccountInfo, Slot, Signature } from '../core/types';

export type SubscriptionId = number;

export interface WsConfig {
  endpoint: string;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
  pingIntervalMs?: number;
}

// ── Subscription params ────────────────────────────────────────
export interface AccountSubParams {
  commitment?: Commitment;
  encoding?: Encoding;
}

export interface ProgramSubParams {
  commitment?: Commitment;
  encoding?: Encoding;
  filters?: unknown[];
}

export interface LogsSubParams {
  commitment?: Commitment;
}

export type LogsFilter = 'all' | 'allWithVotes' | { mentions: [Pubkey] };

export interface SignatureSubParams {
  commitment?: Commitment;
  enableReceivedNotification?: boolean;
}

export interface SlotSubParams {}

export interface RootSubParams {}

// ── Notification payloads ──────────────────────────────────────
export interface AccountNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: AccountInfo;
  };
}

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

export interface SignatureNotification {
  subscription: SubscriptionId;
  result: {
    context: { slot: Slot };
    value: { err: unknown } | 'receivedSignature';
  };
}

export interface SlotNotification {
  parent: Slot;
  root: Slot;
  slot: Slot;
}

export interface RootNotification {
  result: Slot;
}

export type WsNotification =
  | AccountNotification
  | ProgramNotification
  | LogsNotification
  | SignatureNotification
  | SlotNotification
  | RootNotification;
