/**
 * @module ai/plugins/blinks
 * @description Blinks Plugin — Solana Actions / Blinks discovery and execution.
 *
 * ```ts
 * import { BlinksPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/blinks';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(BlinksPlugin);
 * ```
 *
 * Implements the Solana Actions spec for AI agents:
 *  - **blinks** (6)  — getAction, executeAction, confirmAction, resolveBlinkUrl,
 *                       validateActionsJson, buildActionUrl
 *
 * @since 2.0.0
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import { blinksMethods } from './schemas';

export { blinksMethods, allBlinksMethods } from './schemas';

/* ═══════════════════════════════════════════════════════════════
 *  Blinks Plugin
 * ═══════════════════════════════════════════════════════════════ */

export const BlinksPlugin: SynapsePlugin = {
  meta: {
    id: 'blinks',
    name: 'Blinks Plugin',
    description:
      'Solana Actions / Blinks — discover, inspect, execute, and share on-chain actions via URL',
    version: '2.0.0',
    tags: ['blinks', 'actions', 'solana-actions', 'dial.to', 'shareable'],
    mcpResources: [
      'solana://action/{actionUrl}',
      'solana://blink/{blinkUrl}',
    ],
  },

  protocols: [
    {
      id: 'blinks',
      name: 'Solana Actions (Blinks)',
      methods: blinksMethods,
      requiresClient: false,
    },
  ],

  install(context: PluginContext) {
    return {
      executor: async (
        method: ProtocolMethod,
        input: Record<string, unknown>,
        _ctx: PluginContext,
      ) => {
        return executeBlinks(method, input);
      },
    };
  },
};

/* ═══════════════════════════════════════════════════════════════
 *  Executor
 *
 *  All Blinks methods are HTTP-based (Actions spec uses GET/POST).
 *  No RPC transport needed — pure HTTP client.
 * ═══════════════════════════════════════════════════════════════ */

const ACTIONS_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function executeBlinks(
  method: ProtocolMethod,
  input: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (method.name) {
      /* ── GET Action Metadata ─────────────────────────────────── */
      case 'getAction': {
        const url = input.actionUrl as string;
        const res = await fetch(url, {
          method: 'GET',
          headers: ACTIONS_HEADERS,
        });
        if (!res.ok) {
          return {
            error: `Action endpoint returned ${res.status}`,
            actionUrl: url,
          };
        }
        return await res.json();
      }

      /* ── POST Execute Action ─────────────────────────────────── */
      case 'executeAction': {
        let url = input.actionUrl as string;

        // Substitute template parameters: {paramName} → value
        const params = (input.params ?? {}) as Record<string, string>;
        for (const [key, value] of Object.entries(params)) {
          url = url.replace(`{${key}}`, encodeURIComponent(value));
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: ACTIONS_HEADERS,
          body: JSON.stringify({ account: input.wallet }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          return {
            error: `Action POST returned ${res.status}: ${text}`,
            actionUrl: url,
          };
        }
        return await res.json();
      }

      /* ── Confirm Action (chain callback) ─────────────────────── */
      case 'confirmAction': {
        // Per the Actions spec, some endpoints accept a callback PATCH/POST
        // with the tx signature for chained actions.
        const url = input.actionUrl as string;
        const res = await fetch(url, {
          method: 'POST',
          headers: ACTIONS_HEADERS,
          body: JSON.stringify({ signature: input.signature }),
        });
        if (!res.ok) {
          return { error: `Confirm returned ${res.status}`, actionUrl: url };
        }
        const data = await res.json();
        return {
          ...(data as any),
          confirmed: true,
        };
      }

      /* ── Resolve Blink URL → Action URL ──────────────────────── */
      case 'resolveBlinkUrl': {
        const blinkUrl = input.blinkUrl as string;
        const url = new URL(blinkUrl);

        // dial.to format: https://dial.to/?action=solana-action:https://...
        const actionParam = url.searchParams.get('action');
        if (actionParam) {
          const actionUrl = actionParam.replace(/^solana-action:/, '');
          return {
            actionUrl,
            provider: url.hostname,
            isInterstitial: true,
          };
        }

        // Direct action URL
        return {
          actionUrl: blinkUrl,
          provider: url.hostname,
          isInterstitial: false,
        };
      }

      /* ── Validate actions.json ───────────────────────────────── */
      case 'validateActionsJson': {
        const domain = input.domain as string;
        const actionsUrl = `https://${domain.replace(/^https?:\/\//, '')}/actions.json`;

        const res = await fetch(actionsUrl, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          return {
            valid: false,
            error: `actions.json not found at ${actionsUrl} (HTTP ${res.status})`,
          };
        }
        const data = (await res.json()) as any;
        const rules = data?.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
          return {
            valid: false,
            error: 'actions.json found but contains no rules array',
          };
        }
        return {
          valid: true,
          rules: rules.map((r: any) => ({
            pathPattern: r.pathPattern ?? r.pathPrefix ?? '',
            apiPath: r.apiPath ?? '',
          })),
        };
      }

      /* ── Build Action URL ────────────────────────────────────── */
      case 'buildActionUrl': {
        let actionUrl = input.baseUrl as string;
        const params = (input.params ?? {}) as Record<string, string>;

        // Append query params
        const urlObj = new URL(actionUrl);
        for (const [key, value] of Object.entries(params)) {
          urlObj.searchParams.set(key, value);
        }
        actionUrl = urlObj.toString();

        const provider = (input.blinkProvider as string) ?? 'none';
        let blinkUrl: string | undefined;

        if (provider !== 'none') {
          switch (provider) {
            case 'dial.to':
              blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
              break;
            case 'phantom':
              blinkUrl = `https://phantom.app/ul/browse/${encodeURIComponent(actionUrl)}`;
              break;
            case 'backpack':
              blinkUrl = `https://backpack.app/browse/${encodeURIComponent(actionUrl)}`;
              break;
          }
        }

        return {
          actionUrl,
          blinkUrl,
          shareable: blinkUrl ?? actionUrl,
        };
      }

      default:
        return { error: `Unknown blinks method: ${method.name}` };
    }
  } catch (err) {
    return {
      error: String(err),
      method: method.name,
      message: 'Blinks operation failed. Check URL accessibility and network connectivity.',
    };
  }
}

export default BlinksPlugin;
