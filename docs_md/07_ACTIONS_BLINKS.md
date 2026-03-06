# 07 — Actions & Blinks: Solana Actions Server + Blink Generator

> **Import**: `@…/synapse-client-sdk/ai/actions`  
> **Source**: `src/ai/actions/`  
> **Prerequisites**: [01_CORE.md](./01_CORE.md) (SynapseClient)

---

## Overview

**Solana Actions** are a protocol for exposing on-chain operations as HTTP endpoints. **Blinks** (Blockchain Links) are shareable URLs that embed action metadata so wallets and apps can render them as interactive buttons.

This module provides:

| Component | What it does |
|-----------|-------------|
| `ActionServer` | Define + serve Solana Actions via HTTP |
| `BlinkGenerator` | Create shareable Blink URLs + metadata |

### Architecture

```
User clicks Blink URL
        │
        ▼
┌─────────────────────────────┐
│  Wallet / App (e.g. Phantom)│
│  1. Fetch GET /action       │◄──── returns ActionMetadata (JSON)
│  2. Render buttons          │
│  3. User clicks "Swap"      │
│  4. POST /action            │────► ActionServer handles request
│  5. Receive transaction     │◄──── returns serialized tx
│  6. Sign + send             │
└─────────────────────────────┘
```

---

## Quick Start

### Define and serve an action

```ts
import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const server = new ActionServer({
  baseUrl: 'https://myapp.com',
  actions: {},
});

// Define an action
server.defineAction('swap-sol-usdc', {
  title:       'Swap SOL → USDC',
  icon:        'https://myapp.com/icon.png',
  description: 'Swap SOL for USDC via Jupiter',
  label:       'Swap',
  parameters: [
    { name: 'amount', label: 'SOL Amount', type: 'number', required: true },
  ],
  handler: async (params, account) => {
    // params.amount → user input
    // account → user's wallet public key
    // Return a serialized transaction
    return {
      transaction: serializedTx,   // base64-encoded
      message:     `Swapping ${params.amount} SOL for USDC`,
    };
  },
});

// Serve with Express
import express from 'express';
const app = express();
app.use('/actions', server.toExpressMiddleware());
app.listen(3000);
```

### Generate a Blink

```ts
import { BlinkGenerator } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const blink = new BlinkGenerator({ baseUrl: 'https://myapp.com' });

// Create a shareable URL
const url = blink.createUrl('swap-sol-usdc', { amount: 1 });
// → 'https://myapp.com/actions/swap-sol-usdc?amount=1'

// Generate metadata for social embeds
const metadata = blink.createMetadata('swap-sol-usdc', {
  title: 'Swap 1 SOL → USDC',
  icon:  'https://myapp.com/icon.png',
  description: 'Click to swap SOL for USDC',
});
```

---

## ActionServer

### Constructor

```ts
const server = new ActionServer(config: ActionServerConfig);
```

```ts
interface ActionServerConfig {
  baseUrl:        string;                     // Your server's public URL
  actions?:       Record<string, ActionDefinition>;  // Pre-defined actions
  corsOrigins?:   string[];                   // CORS allowed origins (default: ['*'])
  rateLimitMs?:   number;                     // Min ms between requests per IP
}
```

### Methods

| Method | Signature | Description |
|--------|----------|-------------|
| `defineAction` | `(id, definition) → void` | Register an action handler |
| `handleRequest` | `(req) → ActionResponse` | Process an incoming request |
| `toExpressMiddleware` | `() → RequestHandler` | Express/Connect middleware |
| `toFetchHandler` | `() → (req: Request) → Response` | Fetch API handler (Bun/Deno/CF Workers) |

### `ActionDefinition`

```ts
interface ActionDefinition {
  title:       string;
  icon:        string;                   // URL to icon image
  description: string;
  label:       string;                   // Button text
  disabled?:   boolean;                  // Grey out the button
  error?:      { message: string };      // Error state
  links?: {
    actions: LinkedAction[];             // Multiple action buttons
  };
  parameters?: ActionParameter[];
  handler:     ActionHandler;
}

interface ActionParameter {
  name:       string;
  label:      string;
  type:       'text' | 'number' | 'email' | 'url' | 'textarea' | 'select';
  required?:  boolean;
  options?:   SelectOption[];            // For type: 'select'
  pattern?:   string;                    // Regex validation
  min?:       number;
  max?:       number;
  patternDescription?: string;
}

type ActionHandler = (
  params:  Record<string, any>,
  account: string,                        // User's wallet pubkey
) => Promise<ActionHandlerResponse>;

interface ActionHandlerResponse {
  transaction: string;                    // Base64-encoded serialized tx
  message?:    string;                    // Optional success message
}
```

### `LinkedAction`

Multiple buttons in one action:

```ts
server.defineAction('donate', {
  title: 'Donate SOL',
  icon:  'https://myapp.com/icon.png',
  description: 'Support the project',
  label: 'Donate',
  links: {
    actions: [
      { label: '0.1 SOL', href: '/actions/donate?amount=0.1' },
      { label: '0.5 SOL', href: '/actions/donate?amount=0.5' },
      { label: '1 SOL',   href: '/actions/donate?amount=1' },
      { label: 'Custom',  href: '/actions/donate?amount={amount}', parameters: [
        { name: 'amount', label: 'SOL Amount', type: 'number', required: true },
      ]},
    ],
  },
  handler: async (params, account) => {
    return { transaction: buildDonateTx(params.amount, account) };
  },
});
```

---

## BlinkGenerator

### Constructor

```ts
const blink = new BlinkGenerator(config: BlinkConfig);
```

```ts
interface BlinkConfig {
  baseUrl:    string;           // Must match ActionServer's baseUrl
  actionsPath?: string;        // Default: '/actions'
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `createUrl(actionId, params?)` | `string` | Shareable action URL |
| `createMetadata(actionId, meta)` | `ActionMetadata` | JSON metadata for embeds |
| `toMetaTags(metadata)` | `string` | HTML `<meta>` tags for social cards |
| `toHtmlPage(metadata)` | `string` | Full HTML page with embedded metadata |

### Creating shareable links

```ts
const blink = new BlinkGenerator({ baseUrl: 'https://myapp.com' });

// Simple URL
const url = blink.createUrl('swap-sol-usdc');
// → 'https://myapp.com/actions/swap-sol-usdc'

// URL with preset parameters
const url2 = blink.createUrl('swap-sol-usdc', { amount: 5, slippage: 50 });
// → 'https://myapp.com/actions/swap-sol-usdc?amount=5&slippage=50'
```

### Embedding in HTML

```ts
const metadata = blink.createMetadata('swap-sol-usdc', {
  title:       'Swap SOL → USDC',
  description: 'One-click swap on Jupiter',
  icon:        'https://myapp.com/icon.png',
});

// For <head> of existing page
const metaTags = blink.toMetaTags(metadata);
// → '<meta property="og:title" content="Swap SOL → USDC" />...'

// Full standalone page
const html = blink.toHtmlPage(metadata);
// → '<!DOCTYPE html>...'
```

---

## Deployment Examples

### Express (Node.js)

```ts
import express from 'express';
import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const server = new ActionServer({ baseUrl: 'https://myapp.com', actions: {} });
server.defineAction('my-action', { /* ... */ });

const app = express();
app.use(express.json());
app.use('/actions', server.toExpressMiddleware());
app.listen(3000, () => console.log('Actions server on :3000'));
```

### Bun

```ts
import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const server = new ActionServer({ baseUrl: 'https://myapp.com', actions: {} });
server.defineAction('my-action', { /* ... */ });

const handler = server.toFetchHandler();

Bun.serve({
  port: 3000,
  fetch: handler,
});
```

### Deno

```ts
import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const server = new ActionServer({ baseUrl: 'https://myapp.com', actions: {} });
server.defineAction('my-action', { /* ... */ });

const handler = server.toFetchHandler();

Deno.serve({ port: 3000 }, handler);
```

### Cloudflare Workers

```ts
import { ActionServer } from '@oobe-protocol-labs/synapse-client-sdk/ai/actions';

const server = new ActionServer({ baseUrl: 'https://myapp.com', actions: {} });
server.defineAction('my-action', { /* ... */ });

const handler = server.toFetchHandler();

export default {
  fetch: handler,
};
```

---

## Solana Actions Spec Compliance

The ActionServer implements the [Solana Actions & Blinks specification](https://solana.com/docs/advanced/actions):

| Spec requirement | SDK support |
|-----------------|------------|
| GET returns `ActionGetResponse` | ✅ |
| POST accepts `{ account: string }` | ✅ |
| POST returns `{ transaction: string }` | ✅ |
| `actions.json` at `/.well-known/` | ✅ via `toExpressMiddleware` |
| CORS headers | ✅ configurable |
| Multiple linked actions | ✅ via `links.actions` |
| Parameter validation | ✅ via `ActionParameter` |
| Error responses | ✅ via `error` field |

### `actions.json` endpoint

The middleware automatically serves `/.well-known/actions.json`:

```json
{
  "rules": [
    { "pathPattern": "/actions/**", "apiPath": "/actions/**" }
  ]
}
```

---

## Types Reference

### ActionMetadata

```ts
interface ActionMetadata {
  title:       string;
  description: string;
  icon:        string;
  label:       string;
  disabled?:   boolean;
  error?:      { message: string };
  links?:      { actions: LinkedAction[] };
}
```

### ActionResponse

```ts
// GET response
interface ActionGetResponse extends ActionMetadata {
  // All ActionMetadata fields
}

// POST response
interface ActionPostResponse {
  transaction: string;     // Base64 serialized tx
  message?:    string;
}

// POST request body
interface ActionPostRequest {
  account: string;         // User's wallet pubkey (base58)
}
```

### ActionError

```ts
class ActionError extends Error {
  statusCode: number;
  actionId:   string;
}
```

---

## Best Practices

1. **Always validate parameters** — use `pattern` and `min`/`max` in `ActionParameter`
2. **Use linked actions for presets** — "0.1 SOL / 0.5 SOL / 1 SOL / Custom"
3. **Return helpful `message`** — shown to user after signing
4. **Set `disabled: true` when unavailable** — greys out button instead of erroring
5. **Use `toFetchHandler()` for edge runtimes** — works everywhere (Bun, Deno, CF Workers)
6. **Serve icons over HTTPS** — wallets may reject HTTP icon URLs

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Wallet doesn't show action buttons | Missing CORS headers | Set `corsOrigins: ['*']` or specific origin |
| `ActionError: unknown action` | Action ID not registered | Call `defineAction` before handling requests |
| Transaction rejected by wallet | Malformed serialized tx | Ensure base64-encoded `VersionedTransaction` |
| Blink URL returns 404 | `actionsPath` mismatch | Check `baseUrl` + `actionsPath` match your routes |
| `actions.json` not served | Middleware not mounted at root | Mount middleware at `/` or add `/.well-known` route |

---

## Next Steps

- **[06_INTENTS.md](./06_INTENTS.md)** — Chain actions into multi-step intent pipelines
- **[09_PIPELINES.md](./09_PIPELINES.md)** — End-to-end production integration patterns
