# 12 — EarnFi: Human Execution Plugin

> **Import**: `@oobe-protocol-labs/synapse-client-sdk/ai/plugins/earnfi`
> **Partner**: [EarnFi](https://earnfi.fun) — human work + social campaigns via x402 USDC
> **Live docs**: https://app.earnfi.fun/skill.md

---

## Overview

EarnFi is **human execution infrastructure** for SAP / Synapse agents. SAP agents delegate real-world work; EarnFi handles identity, x402 settlement, and human fulfillment internally.

```
SAP / Synapse Agent
       │
       ▼
createEarnFiPlugin()  ──►  EarnFi Agent API (ai-agent/v1)
       │                         │
       │                         ├── agent_token (EarnFi identity)
       │                         ├── x402 USDC (paid creates)
       │                         └── secret (free polling)
       ▼
   Human workers
```

**Not** a replacement for SAP on-chain identity — EarnFi issues its own `agent_token` for API auth.

---

## Quick start

```ts
import { SynapseAgentKit } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins';
import { createEarnFiPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/earnfi';
import { Connection, Keypair } from '@solana/web3.js';

const wallet = { /* signTransaction + publicKey */ };
const connection = new Connection(process.env.RPC_URL!);

const kit = new SynapseAgentKit({ rpcUrl: process.env.RPC_URL! })
  .use(createEarnFiPlugin({
    agentToken: process.env.EARNFI_AGENT_TOKEN,
    wallet,
    connection,
  }));

const tools = kit.getTools();
```

### Peer dependencies (paid creates only)

```bash
pnpm add @solana/web3.js @solana/spl-token
```

Free reads (`getCatalog`, `getJob` with `secret`) work with fetch only.

---

## MCP preset (alternative)

Connect hosted EarnFi MCP at `https://app.earnfi.fun/mcp`:

```ts
import { McpClientBridge } from '@oobe-protocol-labs/synapse-client-sdk/ai/mcp';

const bridge = new McpClientBridge();
await bridge.connectPreset('earnfi', {
  env: { EARNFI_AGENT_TOKEN: process.env.EARNFI_AGENT_TOKEN! },
});
kit.use(bridge.toPlugin());
```

---

## SAP capability mapping

| SAP capability | Plugin method |
|----------------|---------------|
| `human.social.engagement` | `createSocialJob` |
| `human.task.manual` | `createManualJob` |
| `human.contest.bounty` | `createContestJob` |
| `human.interrupt.qa` | `createInterrupt` |

---

## x402 payment flow

1. Call paid create **without** `PAYMENT-SIGNATURE` → **402** + `Payment-Required` header
2. Build USDC transfer from `accepts[0]` (3 instructions: compute limit, compute price, TransferChecked)
3. Retry same URL with header **`PAYMENT-SIGNATURE`**: base64 JSON `{ signed_tx, requirements }`

See https://app.earnfi.fun/skill.md for facilitator `feePayer` rules.

---

## References

| Resource | URL |
|----------|-----|
| Skill | https://app.earnfi.fun/skill.md |
| OpenAPI | https://app.earnfi.fun/openapi-x402.json |
| MCP | https://app.earnfi.fun/mcp |
| x402 discovery | https://app.earnfi.fun/.well-known/x402 |

Maintainer: [@earnfidotfun](https://github.com/earnfidotfun)
