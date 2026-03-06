/**
 * @module ai/actions
 * @description Solana Actions & Blinks — Turn agent tools into shareable URLs.
 *
 * Sub-modules:
 *  - `types`   — Solana Actions spec types + Synapse extensions
 *  - `server`  — Framework-agnostic HTTP request handler
 *  - `blinks`  — Blink URL generation and social metadata
 *
 * @example
 * ```ts
 * import {
 *   ActionServer,
 *   BlinkGenerator,
 *   createBlinkFromAction,
 * } from '@oobe-protocol-labs/synapse-client-sdk/ai';
 *
 * // 1. Create server
 * const server = new ActionServer({ baseUrl: 'https://myagent.xyz' });
 *
 * // 2. Define actions
 * server.defineAction({
 *   id: 'swap',
 *   icon: 'https://myagent.xyz/icon.png',
 *   title: 'Swap via Jupiter',
 *   description: 'Swap any SPL token with best price',
 *   label: 'Swap Now',
 *   parameters: [
 *     { name: 'from', label: 'From Token' },
 *     { name: 'to', label: 'To Token' },
 *     { name: 'amount', label: 'Amount', type: 'number' },
 *   ],
 *   handler: async (ctx) => ({
 *     transaction: await buildSwapTx(ctx.account, ctx.params),
 *   }),
 * });
 *
 * // 3. Generate Blink
 * const blinks = new BlinkGenerator({
 *   actionUrl: 'https://myagent.xyz/api/actions/swap',
 * });
 * const shareUrl = blinks.createUrl({ from: 'SOL', to: 'USDC', amount: '1000000000' });
 * // → Share on Twitter, Discord, etc.
 * ```
 *
 * @since 1.3.0
 */

/* ── Types ── */
export type {
  ActionType,
  ActionParameter,
  LinkedAction,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ActionsJson,
  ActionsJsonRule,
  ActionHandler,
  ActionContext,
  ActionDefinition,
  ActionServerConfig,
  BlinkConfig,
  BlinkMetadata,
} from './types';

/* ── Server ── */
export {
  ActionServer,
  ActionServerError,
} from './server';

/* ── Blinks ── */
export {
  BlinkGenerator,
  createBlinkFromAction,
  DEFAULT_RESOLVER_URL,
  ACTION_SCHEME,
} from './blinks';
