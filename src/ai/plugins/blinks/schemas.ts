/**
 * @module ai/plugins/blinks/schemas
 * @description Blinks Plugin — Zod schemas for Solana Actions (Blinks) protocol.
 *
 * Implements the Solana Actions spec (https://solana.com/docs/advanced/actions):
 *  - **blinks** (6 methods — discover, inspect, execute, and track Solana Actions / Blinks)
 *
 * @since 2.0.0
 */
import { z } from 'zod';
import { createMethodRegistry } from '../../tools/protocols/shared';

const zPubkey = z.string().describe('Solana public key (base58)');
const zTx     = z.string().describe('Base64-encoded serialized transaction');

/* ═══════════════════════════════════════════════════════════════
 *  Blinks — Solana Actions
 * ═══════════════════════════════════════════════════════════════ */

const { register: regBlinks, methods: blinksMethods } = createMethodRegistry('blinks');

regBlinks(
  'getAction',
  z.object({
    actionUrl: z.string().url().describe('Solana Action URL (https endpoint implementing the Actions spec)'),
  }),
  z.object({
    type: z.enum(['action', 'completed']).optional(),
    icon: z.string().url().optional().describe('Icon URL for the Action'),
    title: z.string().describe('Action title'),
    description: z.string().describe('Action description'),
    label: z.string().describe('Button label text'),
    disabled: z.boolean().optional(),
    error: z.object({ message: z.string() }).optional(),
    links: z.object({
      actions: z.array(z.object({
        href: z.string().describe('Action endpoint URL (may contain template params)'),
        label: z.string(),
        parameters: z.array(z.object({
          name: z.string(),
          label: z.string().optional(),
          required: z.boolean().optional(),
          type: z.enum(['text', 'number', 'email', 'url', 'date', 'select', 'textarea', 'radio', 'checkbox'])
            .optional(),
          options: z.array(z.object({
            label: z.string(),
            value: z.string(),
          })).optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional(),
          patternDescription: z.string().optional(),
        })).optional(),
      })).optional(),
    }).optional(),
  }),
  'Fetch metadata for a Solana Action (Blink) — returns title, description, available actions, and parameters.',
);

regBlinks(
  'executeAction',
  z.object({
    actionUrl: z.string().url().describe('Action endpoint URL (from getAction links)'),
    wallet: zPubkey.describe('User wallet to sign the transaction'),
    params: z.record(z.string(), z.string()).optional()
      .describe('Key-value parameters to fill Action template variables'),
  }),
  z.object({
    transaction: zTx.describe('Base64-encoded transaction to be signed'),
    message: z.string().optional().describe('Human-readable message from the Action provider'),
    redirect: z.string().url().optional().describe('Optional redirect URL after completion'),
  }),
  'Execute a Solana Action — sends wallet to the Action endpoint and receives a transaction to sign.',
);

regBlinks(
  'confirmAction',
  z.object({
    actionUrl: z.string().url(),
    signature: z.string().describe('Transaction signature after signing and submitting'),
  }),
  z.object({
    type: z.literal('completed').optional(),
    icon: z.string().url().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    label: z.string().optional(),
    nextAction: z.string().url().optional().describe('URL for a chained follow-up action'),
  }),
  'Confirm a completed Solana Action by sending the tx signature back to the Action provider.',
);

regBlinks(
  'resolveBlinkUrl',
  z.object({
    blinkUrl: z.string().url().describe('Blink URL (e.g. https://dial.to/?action=solana-action:...)'),
  }),
  z.object({
    actionUrl: z.string().url().describe('Resolved Solana Action URL'),
    provider: z.string().optional().describe('Blink provider (dial.to, phantom, etc.)'),
    isInterstitial: z.boolean().optional().describe('Whether this is a proxy/interstitial Blink URL'),
  }),
  'Resolve a Blink URL (e.g. dial.to link) to its underlying Solana Action URL.',
);

regBlinks(
  'validateActionsJson',
  z.object({
    domain: z.string().describe('Domain to check for actions.json (e.g. "jupiter.exchange")'),
  }),
  z.object({
    valid: z.boolean(),
    rules: z.array(z.object({
      pathPattern: z.string(),
      apiPath: z.string(),
    })).optional(),
    error: z.string().optional(),
  }),
  'Validate a domain\'s actions.json file — checks if a website correctly implements the Solana Actions spec.',
);

regBlinks(
  'buildActionUrl',
  z.object({
    baseUrl: z.string().url().describe('Action API endpoint'),
    params: z.record(z.string(), z.string()).optional().describe('Template parameters to encode'),
    blinkProvider: z.enum(['dial.to', 'phantom', 'backpack', 'none']).optional().default('none')
      .describe('Optionally wrap in a Blink provider URL'),
  }),
  z.object({
    actionUrl: z.string().url().describe('Constructed Solana Action URL'),
    blinkUrl: z.string().url().optional().describe('Blink-wrapped URL (if provider selected)'),
    shareable: z.string().optional().describe('Short shareable URL'),
  }),
  'Build and optionally wrap a Solana Action URL for sharing as a Blink.',
);

/* ═══════════════════════════════════════════════════════════════
 *  Exports
 * ═══════════════════════════════════════════════════════════════ */

export { blinksMethods };

export const allBlinksMethods = [...blinksMethods] as const;
