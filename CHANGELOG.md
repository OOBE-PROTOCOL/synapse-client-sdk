# Changelog

All notable changes to `@oobe-protocol-labs/synapse-client-sdk` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] — 2025-07-15

### Added
- **Comprehensive JSDoc** across all 104 source files — every exported class, interface, function,
  type, and constant now carries `@module`, `@description`, `@param`, `@returns`, `@example`,
  and `@since` tags.
- **Geyser gRPC Parser** (`src/grpc/parser/`) — full streaming transaction decoder with 80+
  known-program registry, instruction-level decoding, inner-instruction flattening, and token
  balance extraction. Includes `GeyserParser` high-level class and raw `decode*` utilities.
- **Protocol Tools** — 49 new LangChain-compatible tools for on-chain protocols:
  - Jupiter DEX: 21 tools (swap, quote, route, limit orders, DCA, token list, price).
  - Raydium DEX: 16 tools (pools, liquidity, farming, swaps, CLMM positions).
  - Metaplex NFT: 12 tools (mint, update, verify, burn, delegate, collections).
- **Known Facilitators Registry** (`src/ai/gateway/x402/registry.ts`) — pre-configured
  facilitator endpoints for Coinbase-hosted and community-operated nodes.

### Changed
- **Endpoints refactor** — `SynapseNetwork` / `resolveEndpoint` / `autoSelectRegion` now live in
  `src/utils/synapse.ts` with latency-based region auto-selection.
- **Transport** — `HttpTransport.batch()` now returns typed array of results.
- Promoted from `1.0.0-beta` to stable `1.0.1`.

### Fixed
- Fixed TDZ (Temporal Dead Zone) issue in session manager class initialization.
- Fixed TypeScript strict-mode errors in x402 facilitator verification flow.

---

## [1.0.0-beta] — 2025-06-01

### Added
- **Core SDK** — `SynapseClient` with modular architecture: `rpc`, `das`, `ws`, `grpc` sub-clients.
- **53 Solana RPC methods** — fully typed, tree-shakeable, individual method files.
- **11 DAS methods** — Metaplex Read API / Helius DAS endpoints for NFT/cNFT.
- **WebSocket client** — typed PubSub subscriptions (account, program, logs, signature, slot, root).
- **gRPC transport** — optional `@grpc/grpc-js` adapter with proto loading and unary calls.
- **Zod schemas** — validation schemas for all 53 RPC methods and DAS operations.
- **LangChain tools** — AI-agent-compatible tool wrappers for every SDK method.
- **Agent Commerce Gateway** — session management, pricing/metering, response attestation,
  tool marketplace, and validator middleware.
- **x402 Protocol** — native v1/v2 HTTP 402 payment integration with buyer client, seller paywall,
  and facilitator verification.
- **Branded types** — `Pubkey`, `Signature`, `Slot`, `Lamports`, etc. with compile-time safety.
- **Utilities** — `lamportsToSol`, `solToLamports`, `isValidPubkey`, `sleep`, `chunk`, `retry`.
- **378 tests** across 10 test suites — core, transport, RPC methods, DAS, WebSocket, gRPC parser,
  AI tools, protocols, x402, and gateway.

---

[1.0.1]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.0-beta...v1.0.1
[1.0.0-beta]: https://github.com/oobe-protocol-labs/synapse-client-sdk/releases/tag/v1.0.0-beta
