# Changelog

All notable changes to `@oobe-protocol-labs/synapse-client-sdk` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.4]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/oobe-protocol-labs/synapse-client-sdk/compare/v1.0.0-beta...v1.0.1
[1.0.0-beta]: https://github.com/oobe-protocol-labs/synapse-client-sdk/releases/tag/v1.0.0-beta
