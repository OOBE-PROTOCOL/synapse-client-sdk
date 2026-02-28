# Changelog

All notable changes to `@oobe-protocol-labs/synapse-client-sdk` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — 2026-02-28

### Added

- **Context Provider System** (`src/context/`) — Full IoC (Inversion of Control) container with
  dependency injection, scoping, and framework-agnostic hooks. Enables components to access SDK
  services (RPC, DAS, WebSocket, Programs, AI Tools) through a unified context.
  - `SynapseContext` — Core container with `register()`, `resolve()`, `has()`, `createScope()`,
    `dispose()`, interceptor middleware, and event bus.
  - `createSynapseContext(config, opts?)` — Factory that auto-wires all SDK services into the
    container with pre-defined tokens.
  - `Tokens` namespace — Pre-defined `ServiceToken<T>` for every SDK module: `RPC`, `DAS`, `WS`,
    `GRPC`, `TRANSPORT`, `CLIENT`, `ACCOUNTS`, `PROGRAMS`, `DECODERS`, `KIT_RPC`, `KIT_SUBS`.
  - 6 service lifecycles: `singleton`, `transient`, `scoped`, `value`, `alias`, `asyncFactory`.
  - 5 provider types: `ValueProvider`, `FactoryProvider`, `ClassProvider`, `AliasProvider`,
    `AsyncFactoryProvider`.
  - `createToken<T>(name)` — Type-safe branded token factory.
  - Error classes: `ServiceNotFoundError`, `CircularDependencyError`, `AsyncProviderError`.
  - Module system: `ContextModule` interface for registering plugin bundles.

- **Memory-Safe References** (`src/context/refs.ts`) — Reference-counted cross-component service
  sharing with automatic cleanup. Designed for SDK-grade memory safety.
  - `ServiceRef<T>` — Strong reference with `acquire()` / `release()` lifecycle, `RefReleasedError`
    on use-after-free.
  - `WeakServiceRef<T>` — WeakRef-backed reference that degrades gracefully on GC.
  - `RefRegistry` — Central registry tracking all live refs with configurable leak detection.
  - `MemoryGuard` — Background sweep that detects leaked refs and logs/throws diagnostics.
  - `ServiceBinding<A, B>` — Couples two services with synchronized disposal.
  - Container integration: `ctx.acquireRef(token)`, `ctx.bind(tokenA, tokenB)`,
    `ctx.refCount(token)`, `ctx.enableMemoryGuard(config)`.

- **Context Hooks** (`src/context/hooks.ts`) — Framework-agnostic service accessors and adapters.
  - `setGlobalContext()` / `getContext()` / `tryGetContext()` — Global context management.
  - `useService(token)` / `tryUseService(token)` — Service resolution from global context.
  - `createServiceHook(token)` / `createBoundHook(token)` — Composable typed accessor factories.
  - `useSharedRef(token)` / `withRef(token, fn)` / `withRefAsync(token, fn)` — Safe scoped
    reference access with automatic release.
  - `createRefHook(token)` — Creates a reusable ref-acquiring hook for a given token.
  - `useBoundServices(tokenA, tokenB)` — Acquire two bound services atomically.
  - `autoWire(ctx)` — Proxy-based lazy service bag for zero-boilerplate access.
  - `createReactAdapter(config)` — React integration blueprint (Provider, useX hooks).
  - `createServerMiddleware(config)` — Express/Fastify request-scoped DI middleware.

- **`SynapseClientLike` interface** (`src/core/client.ts`) — Minimal structural interface
  (`{ readonly transport: HttpTransport }`) that all protocol tool factories now accept.
  Eliminates the need for `as any` casts when consumer SDK versions differ. Both the full
  `SynapseClient` class and a plain `{ transport }` object satisfy this interface.

- **Jupiter `smartSwap` compound tool** — All-in-one tool that chains `getQuote` → `swapInstructions`
  in a single AI agent call. Accepts human-readable params (`inputMint`, `outputMint`, `amount`,
  `userPublicKey`, `slippageBps`, etc.) and returns `{ quote, instructions, summary }` with a
  structured summary including route hops, instruction count, price impact, and lookup table count.
  Jupiter tool count: 21 → **22**.

- **Individual program subpath exports** — Each instruction encoder can now be imported via
  fine-grained sub-paths for tree-shaking:
  `./programs/system`, `./programs/spl-token`, `./programs/associated-token`,
  `./programs/memo`, `./programs/compute-budget`, `./programs/types`.

- **`createSolanaProgramsTools` re-exported** from `./ai` and `./ai/tools` barrels, alongside
  `solanaProgramsMethods`, `solanaProgramsMethodNames`, and `SolanaProgramsToolsConfig`.

### Fixed

- **Breaking type change in `createMetaplexTools`** — The function previously required the full
  `SynapseClient` class (which gained an `accounts` getter in v1.0.3), forcing consumers on
  older versions to use `as any` casts. Now accepts `SynapseClientLike` — any object with a
  `transport` property.
- **Same type coupling in 5 other factories** — `createJupiterOnchainTools`,
  `createRaydiumOnchainTools`, `createProtocolTools`, `createExecutableSolanaTools`, and
  `AgentGateway` / `createAgentGateway` all migrated from `SynapseClient` to `SynapseClientLike`.
  Zero `client: SynapseClient` parameter types remain in the SDK public API.
- **Stale JSDoc `@param` tags** — All `@param {SynapseClient}` annotations updated to
  `@param {SynapseClientLike}` across 6 files.
- **Missing barrel exports** — `createSolanaProgramsTools`, `solanaProgramsMethods`,
  `solanaProgramsMethodNames`, and `SolanaProgramsToolsConfig` were exported from
  `./ai/tools/protocols` but not re-exported from `./ai/tools` or `./ai`. Now available
  at all barrel levels.
- **Minor formatting** — Fixed missing whitespace before `createSynapse` factory in main barrel.

### Changed

- `SynapseClient` now `implements SynapseClientLike`.
- Jupiter tool count: **21 → 22** (added `smartSwap` compound tool).
- Total protocol tools: **69 → 70** (22 Jupiter + 16 Raydium + 12 Metaplex + 10 Jupiter
  On-Chain + 10 Raydium On-Chain).
- Total protocol tools including Solana Programs: **86** (70 protocol + 16 native programs).
- Context module tagged `@since 1.2.0`.
- Test suite: **655 tests** across 14 test files, all passing (77 context + 78 refs + 6 smartSwap
  + 494 existing).

---

## [1.0.8] — 2026-02-27

### Fixed
- **#21 — `getTokenList` 404 on `/tokens/v1/all`**: Jupiter Token API V1 is dead. Migrated to
  V2 endpoint: `GET /tokens/v2/tag?query=verified`. The `tags` input parameter is replaced by
  `query` accepting `"verified"` or `"lst"`. Response schema updated to V2 format (includes
  `id`, `organicScore`, `usdPrice`, `mcap`, `audit`, etc.).
- **#22 — `getTokenInfo` 404 on `/tokens/v1/{mint}`**: Same V1 deprecation. Migrated to V2
  search endpoint: `GET /tokens/v2/search?query={mint}`. The `mint` parameter is replaced by
  `query` (accepts mint address, symbol, name, or comma-separated list up to 100). Returns an
  array of matching tokens with V2 metadata.

### Changed
- Token API section header: V1 → V2 in schemas module.
- `tokensApiUrl` JSDoc updated to reference `/tokens/v2/...` paths.
- `examples/jupiter-standalone.ts` updated with V2 `query` parameters.

---

## [1.0.7] — 2026-02-27

### Fixed
- **#20 — `getTokenList` still "fetch failed" (for real this time)**: Root-caused to
  `tokens.jup.ag` being **completely dead** — the subdomain no longer resolves in DNS.
  Jupiter migrated all token endpoints to `api.jup.ag/tokens/v1/…`. Updated path from
  `/tokens` to `/tokens/v1/all` and removed the separate `JUPITER_TOKENS_API_URL` constant.
- **`getTokenInfo` broken**: Same root cause as #20 — was routing to dead `tokens.jup.ag`.
  Path updated from `/token/{mint}` to `/tokens/v1/{mint}` on `api.jup.ag`.
- **`throwOnError` not throwing exceptions**: `toolMap` only stored tools under **unprefixed**
  keys (e.g. `getQuote`), but documentation showed prefixed keys (`jupiter_getQuote`).
  Accessing `toolMap.jupiter_getQuote` returned `undefined`, causing a `TypeError` on
  `.invoke()` that bypassed the SDK's error handling entirely. `toolMap` now stores both
  prefixed and unprefixed keys.

### Removed
- **`getSwapHealth` tool**: Jupiter does not expose a `/swap/v1/health` endpoint — all
  tested paths return 401. Removed the registration entirely. Jupiter tool count: 22 → 21.
- **`JUPITER_TOKENS_API_URL` export**: The `tokens.jup.ag` base URL constant is no longer
  exported from any barrel (`ai`, `ai/tools`, `ai/tools/protocols`, `jupiter`). Token
  requests now route through `apiUrl` (default `api.jup.ag`).

### Added
- **`tokensApiUrl` config option** — New optional field on `JupiterToolsConfig`. Allows
  integrators to override the base URL for token endpoints independently of the main
  `apiUrl`. Defaults to `apiUrl` when omitted.
- **`examples/jupiter-standalone.ts`** — End-to-end standalone usage example showing
  `toolMap` access (prefixed + unprefixed keys), `throwOnError` with `try/catch`,
  `tokensApiUrl` config, and correct `getDCAOrders` fields.

### Changed
- Total protocol tools: **70 → 69** (21 Jupiter + 16 Raydium + 12 Metaplex + 10 Jupiter
  On-Chain + 10 Raydium On-Chain).

---

## [1.0.6] — 2026-02-27

### Fixed
- **#19 — `getDCAOrders` missing `includeFailedTx`**: Added optional `includeFailedTx` boolean
  (default `false`) to the `getDCAOrders` Zod schema. Jupiter's Recurring API expects this query
  parameter; omitting it caused a 400 "Bad Request" from the upstream.
- **#20 — `getTokenList` still fails "fetch failed"**: Root-caused to `Content-Type: application/json`
  being sent on **GET** requests. `tokens.jup.ag` rejects GETs with that header. The v1.0.5 fix
  (`fetch.bind(globalThis)`) was necessary but not sufficient. `ProtocolHttpClient` now only attaches
  `Content-Type: application/json` on **POST** requests; GET requests use bare common headers.

### Added
- **`getTokenInfo` tool** — New Jupiter Token API method (`GET /token/{mint}` on `tokens.jup.ag`).
  Returns detailed metadata for a single mint address. Jupiter tool count: 20 → 22.
- **`getSwapHealth` tool** — New Jupiter health-check method (`GET /swap/v1/health`). Returns the
  current Swap API health status as a plain string.
- **`getHeaders()` accessor** — `ProtocolHttpClient` and `ProtocolToolkit` now expose a
  `getHeaders()` method returning a copy of the common headers. Integrators no longer need to
  duplicate header logic.
- **`httpClient` on toolkit** — `ProtocolToolkit` now exposes its underlying `ProtocolHttpClient`
  instance, enabling advanced use-cases (custom middleware, manual requests).
- **`throwOnError` mode** — New `throwOnError?: boolean` option in `CreateProtocolToolsOpts`.
  When enabled, tool invocations throw a `ProtocolApiError` instead of returning a JSON-stringified
  error string — making it easy to use `try/catch` in agent pipelines.
- **Lazy protocol factories** (`src/ai/lazy.ts`) — `getJupiterTools(config)` and
  `getRaydiumTools(config)` use dynamic `import()` for tree-shaking-friendly, webpack/Next.js-safe
  lazy loading. Singletons are cached and invalidated on config change. Importable via
  `@oobe-protocol-labs/synapse-client-sdk/ai/lazy` sub-path.

### Changed
- Total protocol tools: **68 → 70** (22 Jupiter + 16 Raydium + 12 Metaplex + 10 Jupiter On-Chain
  + 10 Raydium On-Chain).

---

## [1.0.5] — 2026-02-27

### Fixed
- **#15 — AI barrel exports**: `./ai` sub-path now re-exports all protocol tool factories
  (`createJupiterTools`, `createRaydiumTools`, `createMetaplexTools`, `createJupiterOnchainTools`,
  `createRaydiumOnchainTools`, `createProtocolTools`), method schemas, shared infrastructure
  (`ProtocolHttpClient`, `buildProtocolTools`, `createMethodRegistry`), program-ID constants,
  and all protocol types. Added `./ai/tools` and `./ai/tools/protocols` sub-path exports to
  `package.json` for granular imports.
- **#16 — `getTokenList` fetch crash**: `ProtocolHttpClient` now binds `globalThis.fetch` with
  `.bind(globalThis)` to prevent context-loss errors in Node.js environments ("fetch failed",
  "Illegal invocation").
- **#17 — `getDCAOrders` missing `user` param**: Renamed schema field from `wallet` to `user` so
  the query string is serialised as `?user=…` — matching the Jupiter DCA API contract.
- **#18 — `createLimitOrder` params wrapper**: Removed the `params` object wrapper introduced in
  v1.0.4 (#10 fix). Jupiter Limit Order V2 actually expects a **flat** POST body with all fields
  at top level. The executor now sends the body as-is via the generic POST path.

### Added
- **Individual decoder sub-path exports** — each decoder module can now be imported independently
  via fine-grained sub-paths, useful for tree-shaking and type-only imports:
  `./decoders/token`, `./decoders/token-2022`, `./decoders/stake`, `./decoders/nonce`,
  `./decoders/lookup-table`, `./decoders/multisig`, `./decoders/layout`.

---

## [1.0.4] — 2026-02-27

### Added
- **Jupiter On-Chain AI Tools** (`src/ai/tools/protocols/jupiter-onchain/`) — 10 new LangChain-compatible
  tools that query Jupiter program state directly via local RPC transport, zero REST dependency.
  - `fetchAccount`, `searchProgramAccounts`, `getTransactionHistory`, `inspectTransaction`,
    `getLimitOrders`, `getDCAAccounts`, `getPerpsPositions`, `getTokenMintInfo`, `getTokenHoldings`,
    `resolvePrograms`.
  - Built-in program ID registry for 11 Jupiter programs (Swap V6, Limit Order V2, DCA, Perps,
    Governance, Lock, Vote, Router, Merkle Distributor, Token Ledger, Referral).
  - Memcmp-based position discovery filters for limits, DCA, and perps accounts.

- **Raydium On-Chain AI Tools** (`src/ai/tools/protocols/raydium-onchain/`) — 10 new LangChain-compatible
  tools that query Raydium program state directly via local RPC transport.
  - `fetchAccount`, `searchProgramAccounts`, `getTransactionHistory`, `inspectTransaction`,
    `getPoolState`, `getMultiplePoolStates`, `getPoolsByMint`, `getLPPositions`, `getFarmPositions`,
    `resolvePrograms`.
  - Built-in program ID registry for 7 Raydium programs (AMM V4, CLMM, CPMM, Staking, Farm V3/V5/V6).
  - Automatic pool type detection from owner program.

- **Configurable auth header** in `ProtocolHttpClient` — new `apiKeyHeader` field on
  `ProtocolClientConfig` allows protocols to specify custom auth headers (e.g. `x-api-key`)
  instead of the default `Authorization: Bearer`.

- **Super-factory supports 5 protocol toolkits** — `createProtocolTools()` now wires Jupiter,
  Raydium, Metaplex, Jupiter On-Chain, and Raydium On-Chain (68 total tools when all enabled).

### Fixed
- **#4 — Auth header**: Jupiter REST tools now send `x-api-key: <key>` instead of
  `Authorization: Bearer <key>`, matching Jupiter's actual API authentication.
- **#5 — Token List URL**: `getTokenList` now routes to `tokens.jup.ag/tokens` via a dedicated
  `ProtocolHttpClient` instead of the non-existent `api.jup.ag/tokens/v1` path.
- **#6 — getRouters removed**: Removed the `getRouters` method entirely — the
  `/ultra/v1/routers` endpoint does not exist (404). Jupiter method count: 22 → 20.
- **#7 — getHoldings params**: Changed input from `wallet: Pubkey` to
  `tokenAccountAddresses: Pubkey[]` (array, min 1, max 100), matching the actual API contract.
- **#8 — getLimitOrders schema**: Replaced `includeHistory: boolean` with
  `orderStatus: 'active' | 'history'` enum to match the Jupiter Limit Order V2 API.
- **#9 — getDCAOrders schema**: Added required `recurringType: 'time' | 'price' | 'all'` and
  `orderStatus: 'active' | 'history'` fields; removed non-existent `includeHistory`.
- **#10 — createLimitOrder body**: Executor now wraps `inputMint`, `outputMint`, `makingAmount`,
  `takingAmount`, `expiredAt`, `feeBps` inside a `params: {}` object as Jupiter expects.
- **#11 — executeTrigger schema**: Added required `requestId: string` to input schema.
- **#12 — executeDCA schema**: Added required `requestId: string` to input schema.
- **#13 — createDCA field rename**: Changed `maker` → `user` to match Jupiter DCA API.
- **#14 — cancelDCA field rename + param**: Changed `maker` → `user` and added required
  `recurringType: 'time' | 'price'` field.

### Changed
- Jupiter REST method count reduced from 22 → **20** (removed `getRouters`; count after all
  schema corrections).
- Total protocol tool count across all 5 toolkits: **68** (20 Jupiter + 16 Raydium + 12 Metaplex
  + 10 Jupiter On-Chain + 10 Raydium On-Chain).
- Test suite updated: **415 tests**, all passing.

---

## [1.0.3] — 2026-02-27

### Added
- **Native Solana account data decoders** (`src/decoders/`) — zero-dependency binary decoders
  verified field-by-field against official Solana source code (`solana-program/token`, `anza-xyz/agave`).
  - `AccountReader` — DataView-based binary reader with LE byte order, COption (C ABI) support.
  - `decodeTokenAccount` — SPL Token Account (165 bytes): mint, owner, amount, delegate, state,
    isNative, delegatedAmount, closeAuthority.
  - `decodeMint` — SPL Token Mint (82 bytes): mintAuthority, supply, decimals, isInitialized,
    freezeAuthority.
  - `decodeToken2022Account` / `decodeToken2022Mint` — Token Extensions with TLV parser
    (TransferFeeConfig, MintCloseAuthority, MetadataPointer, ImmutableOwner, MemoTransfer, etc.).
  - `decodeStakeAccount` — Stake program (200 bytes): Meta (authorized + lockup) + Delegation
    (voterPubkey, stake, activationEpoch, deactivationEpoch, warmupCooldownRate) + creditsObserved.
  - `decodeNonceAccount` — Durable nonce (80 bytes): version, state, authority, blockhash,
    lamportsPerSignature.
  - `decodeLookupTable` — Address Lookup Table (56-byte header + N×32 addresses):
    deactivationSlot, lastExtendedSlot, authority, addresses.
  - `decodeMultisig` — SPL Multisig (355 bytes): m, n, isInitialized, signers[11].
  - `encodeBase58` — self-contained base58 encoder (no external dependencies).
- **Typed account fetchers** (`src/accounts/`) — high-level account fetching with automatic
  decoding wired into `SynapseClient`.
  - `AccountsClient` class accessible via `client.accounts`.
  - `fetchTokenAccount` / `fetchMint` — auto-detects Token vs Token-2022 by program owner.
  - `fetchTokenAccountsByOwner` — batch fetch all token accounts for a wallet.
  - `fetchStakeAccount` / `fetchNonceAccount` / `fetchLookupTable`.
  - `getDecodedAccount<T>` / `getDecodedAccounts<T>` generic helpers.
- **Sub-path exports** — `./decoders` and `./accounts` added to `package.json` exports map.
- **37 new unit tests** for all decoders with hand-crafted byte buffers (415 total, all passing).

---

## [1.0.2] — 2026-02-26

### Added
- **@solana/kit bridge module** (`src/kit/index.ts`) — curated re-exports and bridge utilities
  between Synapse branded types and `@solana/kit` v6 native types.
  - `toKitAddress` / `fromKitAddress` for `Pubkey` ↔ `Address` conversion.
  - `toKitSignatureString` / `toKitLamports` for `Signature` & `Lamports`.
  - Re-exports: `Address`, `KeyPairSigner`, `createSolanaRpc`, `pipe`, codecs, account helpers.
- **`kitRpc` / `kitSubscriptions`** lazy accessors on `SynapseClient` — gives consumers direct
  access to `@solana/kit`-native `Rpc<SolanaRpcApi>` and `RpcSubscriptions<SolanaRpcSubscriptionsApi>`
  backed by the same endpoint.
- **`./kit` sub-path export** in `package.json` — `import { Address, toKitAddress } from '@oobe-protocol-labs/synapse-client-sdk/kit'`.

### Fixed
- **Critical: `@/` path aliases leaking into compiled output** — TypeScript `paths` aliases were
  not rewritten by `tsc`, causing `@/core/types` imports in `dist/cjs` and `dist/esm` that
  Webpack, Next.js, Vite, and other bundlers could not resolve. Converted all 9 `@/` imports to
  relative paths and removed the `paths` block from `tsconfig.json` to prevent regression.
- **ESM directory imports broken** — the post-build `fix-esm-imports.mjs` script blindly appended
  `.js` to all bare specifiers, producing `./tools.js` instead of `./tools/index.js` for directory
  re-exports (`tools/`, `protocols/`, `zod/`, `jupiter/`, `raydium/`, `metaplex/`, `x402/`).
  Rewrote the script with filesystem-aware resolution using `existsSync`.
- **`@langchain/core` peer dependency too permissive** — the open-ended `>=0.3.0` range could
  resolve `@langchain/core@1.x`, which is incompatible with `@langchain/openai@0.5.x`. Tightened
  to `>=0.3.0 <0.4.0`. Also updated `zod` peerDep to `>=3.23.0 || >=4.0.0`.

---

## [1.0.1] — 2025-07-15

### Added
- **Comprehensive JSDoc** across all 104 source files — every exported class, interface, function,
  type, and constant now carries `@module`, `@description`, `@param`, `@returns`, `@example`,
  and `@since` tags.
- **Geyser gRPC Parser** (`src/grpc/parser/`) — full streaming transaction decoder with 80+
  known-program registry, instruction-level decoding, inner-instruction flattening, and token
  balance extraction. Includes `GeyserParser` high-level class and raw `decode*` utilities.
- **Protocol Tools** — 48 new LangChain-compatible tools for on-chain protocols:
  - Jupiter DEX: 20 tools (swap, quote, route, limit orders, DCA, token list, price).
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

[1.2.0]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.8...v1.2.0
[1.0.8]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.0-beta...v1.0.1
[1.0.0-beta]: https://github.com/oobe-protocol-labs/synapse-client-sdk/releases/tag/v1.0.0-beta
