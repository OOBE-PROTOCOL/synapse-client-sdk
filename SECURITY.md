# Security Policy

## Supported Versions

| Version | Supported          | Notes                                  |
| ------- | ------------------ | -------------------------------------- |
| 2.0.x   | :white_check_mark: | Current stable — actively maintained   |
| 1.x.x   | :x:                | End-of-life — upgrade to 2.0           |
| < 1.0   | :x:                | Pre-release — not supported            |

Only the latest **2.0.x** release receives security patches. We recommend always running the most recent version.

---

## Dependency Overview

### Production Dependencies (shipped to consumers)

| Package          | Version   | Purpose                        | Risk Profile |
| ---------------- | --------- | ------------------------------ | ------------ |
| `@solana/kit`    | ^6.1.0    | Solana native types & RPC      | Low — Solana Labs maintained |
| `eventemitter3`  | ^5.0.1    | Event emitter (zero deps)      | Minimal — no network I/O |
| `ws`             | ^8.18.3   | WebSocket client (Node.js)     | Low — widely audited |

> The SDK ships only **3 production dependencies** with zero transitive sub-dependencies of concern. The MCP server/client, gRPC parser, decoders, and all 110 plugin tools are implemented with **zero external runtime dependencies**.

### Peer Dependencies (optional — consumer-installed)

| Package          | Requirement            | When Needed                         |
| ---------------- | ---------------------- | ----------------------------------- |
| `@langchain/core`| >=0.3.0 <0.4.0        | AI tools / plugin system            |
| `zod`            | >=3.23.0 \|\| >=4.0.0 | Schema validation for AI tools      |
| `ioredis`        | >=5.0.0               | `RedisStore` persistence backend    |
| `pg`             | >=8.0.0               | PostgreSQL persistence backend      |
| `typescript`     | >=5.0.0               | Type checking (dev only)            |

### Known Advisories in Dev/Peer Dependencies

The following advisories affect **devDependencies or peer dependency sub-trees only** — they do **not** ship in the published package:

| Severity | Package | Advisory | Affects | Mitigation |
| -------- | ------- | -------- | ------- | ---------- |
| **High** | `@langchain/core` <0.3.80 | [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) | Peer dep (optional) | Upgrade: `npm i @langchain/core@latest` |
| **High** | `rollup` <4.59.0 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | Dev only (vitest→vite→rollup) | Not shipped — dev toolchain only |
| Moderate | `langsmith` <0.4.6 | [GHSA-v34v-rq6j-cj6p](https://github.com/advisories/GHSA-v34v-rq6j-cj6p) | Peer dep sub-tree (@langchain/core→langsmith) | Upgrade `@langchain/core` |
| Moderate | `mdast-util-to-hast` <13.2.1 | [GHSA-4fh9-h7wg-q85m](https://github.com/advisories/GHSA-4fh9-h7wg-q85m) | Dev only (typedoc→shiki) | Not shipped |
| Moderate | `markdown-it` <14.1.1 | [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m) | Dev only (typedoc) | Not shipped |

**None of these advisories affect the published npm package.** The `rollup`, `typedoc`, `markdown-it`, and `shiki` vulnerabilities exist exclusively in the dev toolchain and are never included in `dist/`.

---

## API Key Security

- **OOBE API keys** are passed via URL query parameter (`?api_key=`). Always store them in environment variables (`OOBE_API_KEY`), never in committed source code.
- **Jupiter API keys** should follow the same practice (`JUPITER_API_KEY`).
- In Next.js deployments, use server-only env vars (without `NEXT_PUBLIC_` prefix) to ensure keys are never exposed to the client bundle.
- The SDK never logs, persists, or transmits API keys beyond the target RPC endpoint.

---

## Transport Security

| Transport  | Protocol | Encryption |
| ---------- | -------- | ---------- |
| RPC        | HTTPS    | TLS 1.2+  |
| WebSocket  | WSS      | TLS 1.2+  |
| gRPC       | HTTPS    | TLS 1.2+  |
| MCP stdio  | stdin/stdout | Process-local (no network) |
| MCP SSE    | HTTPS    | TLS 1.2+ (consumer-configured) |

All OOBE Protocol endpoints (`us-1-mainnet.oobeprotocol.ai`, `staging.oobeprotocol.ai`) enforce TLS and reject plain HTTP.

---

## Reporting a Vulnerability

If you discover a security vulnerability in the Synapse Client SDK, please report it responsibly:

1. **Email**: Send a detailed report to **security@oobeprotocol.ai**
2. **Subject line**: `[SECURITY] synapse-client-sdk — <brief description>`
3. **Include**:
   - Affected version(s)
   - Steps to reproduce
   - Impact assessment
   - Suggested fix (if any)

### What to Expect

| Timeline | Action |
| -------- | ------ |
| **< 48 hours** | Acknowledgment of your report |
| **< 7 days** | Initial triage and severity assessment |
| **< 30 days** | Fix developed, tested, and released (for confirmed vulnerabilities) |
| **On release** | Public advisory + credit (unless you prefer anonymity) |

### Scope

**In scope:**
- `@oobe-protocol-labs/synapse-client-sdk` npm package (source in `src/`)
- Published `dist/` output
- RPC/WSS/gRPC transport layer
- MCP server & client bridge
- Plugin system tool execution
- x402 payment flow
- API key handling

**Out of scope:**
- OOBE Protocol backend infrastructure (report to infra team separately)
- Third-party dependencies with their own security policies (`@solana/kit`, `@langchain/core`, etc.)
- Documentation site (`docs/`)

---

## Security Best Practices for SDK Users

1. **Pin exact versions** in production: `"@oobe-protocol-labs/synapse-client-sdk": "2.0.0"`
2. **Run `npm audit` / `pnpm audit`** regularly — especially for peer deps like `@langchain/core`
3. **Rotate API keys** periodically and immediately if compromised
4. **Validate all user input** before passing to SDK methods (the branded type system helps enforce this at compile time)
5. **Use server-side only** for all RPC/signing operations — never expose private keys or API keys in browser bundles
6. **Keep `@langchain/core` updated** to >=0.3.80 if using the AI tools module (serialization injection fix)
