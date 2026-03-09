# SAP v2 — Solana Agent Protocol: Anchor Program Specification

> **Author**: OOBE Protocol Labs  
> **Status**: PROPOSAL — Ready for implementation  
> **Date**: March 2026  
> **Target**: Solana Mainnet-Beta  
> **Framework**: Anchor 0.30+  
> **License**: MIT  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Industry Landscape & Innovation Analysis](#2-industry-landscape--innovation-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Account Design (PDAs)](#4-account-design-pdas)
5. [Instruction Set](#5-instruction-set)
6. [Indexing System](#6-indexing-system)
7. [Trustless Reputation](#7-trustless-reputation)
8. [Plugin System — Extensible PDAs](#8-plugin-system--extensible-pdas)
9. [Memory Layer — Hybrid IPFS + On-Chain](#9-memory-layer--hybrid-ipfs--on-chain)
10. [x402 & Payment Integration](#10-x402--payment-integration)
11. [Scalability Analysis](#11-scalability-analysis)
12. [Security Model](#12-security-model)
13. [Anchor Program Structure](#13-anchor-program-structure)
14. [SDK Integration Plan](#14-sdk-integration-plan)
15. [Deployment Roadmap](#15-deployment-roadmap)

---

## 1. Executive Summary

SAP v2 is the **first on-chain agent identity, reputation, and discovery protocol native to Solana**. It enables thousands of AI agents to register verifiable identities, advertise capabilities with pricing, accumulate trustless reputation from real clients, and be discovered through efficient on-chain indexing — all without centralized infrastructure.

### What SAP v2 Adds Over v1

| Feature | v1 (SDK-only) | v2 (Anchor Program) |
|---------|---------------|---------------------|
| On-chain program | ❌ Placeholder ID | ✅ Deployed Anchor program |
| Reputation | Self-reported | **Trustless client feedback** |
| Discovery | `getProgramAccounts` (doesn't scale) | **Capability Index PDAs** |
| Services | Protocol field only | **agentURI → MCP/A2A/x402 endpoints** |
| Plugins | ❌ | **Extensible PDA slots** |
| Memory | ❌ | **Hybrid IPFS + on-chain chunking** |
| Identity | Locked to wallet | **Optional Metaplex NFT badge** |

### Why This Matters

- **No competitor exists on Solana** — Solana Agent Kit (sendaifun) is action-only, no identity
- **ERC-8004 on Ethereum is still DRAFT** (Aug 2025) 
- **x402 protocol** (Coinbase, 75M+ transactions) already supports Solana native integration
- **Google A2A** + **Anthropic MCP** compatibility through agentURI service endpoints
- **Scalable to 100k+ agents** through indexed PDAs (no `getProgramAccounts`)

---

## 2. Industry Landscape & Innovation Analysis

### 2.1 ERC-8004 — Trustless Agent Registry (Ethereum)

**Source**: [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004) — DRAFT, August 2025  
**Authors**: Marco De Rossi (@MarcoMetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), Erik Reppel (Coinbase)

ERC-8004 defines THREE separate registries on EVM:

1. **Identity Registry** (ERC-721): Agents mint NFT identifiers with `agentURI` pointing to a registration JSON file containing name, description, services (MCP/A2A/ENS/DID endpoints), x402 support flag. On-chain `getMetadata`/`setMetadata`. Agent wallet verified via EIP-712 signatures.

2. **Reputation Registry**: `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — anyone can leave on-chain feedback. `getSummary()` for aggregation. `revokeFeedback()` and `appendResponse()`. Off-chain feedback file with MCP/A2A context.

3. **Validation Registry**: `validationRequest` → `validationResponse` flow for stake-secured re-execution, zkML verification, TEE oracle attestation. Response is 0-100 value.

**SAP v2 comparison**:
- ✅ We adopt trustless client feedback (Reputation Registry equivalent)
- ✅ We add agentURI for service endpoint discovery
- ✅ We add Capability Index PDAs (ERC-8004 has NO on-chain discovery mechanism)
- ✅ We add on-chain pricing (ERC-8004 has NO pricing)
- 🔄 Validation Registry deferred to plugin system (future)
- 🔄 NFT identity as optional badge (not required for registration)

### 2.2 Google A2A Protocol — Agent-to-Agent Communication

**Source**: [Google Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)  
**Partners**: 50+ (Atlassian, PayPal, SAP AG, Salesforce, Coinbase)

A2A defines "Agent Cards" — JSON files advertising capabilities:
```json
{
  "name": "DeFi Agent",
  "url": "https://agent.xyz/a2a",
  "capabilities": { "streaming": true, "pushNotifications": true },
  "skills": [{ "id": "swap", "name": "Token Swap" }]
}
```

Built on HTTP, SSE, JSON-RPC. Focused on enterprise interoperability.

**SAP v2 alignment**: Our `agentURI` registration file will include A2A-compatible service endpoints, making SAP agents discoverable by both on-chain queries AND A2A-compatible orchestrators.

### 2.3 x402 Protocol — Internet-Native Payments

**Source**: [x402.org](https://x402.org) / [GitHub](https://github.com/coinbase/x402)  
**Stats**: 5.6k stars, 75M+ transactions, $24M+ volume (30 days), Solana supported

HTTP 402 Payment Required flow:
```
Client → Agent: GET /api/swap
Agent  → Client: 402 { paymentRequirements: { scheme: "exact", amount: "1000", token: "USDC" } }
Client → Agent: GET /api/swap + X-PAYMENT header (signed tx)
Agent  → Client: 200 { result }
```

**SAP v2 alignment**: `x402Endpoint` already in PDA. v2 adds `paymentSchemes` (exact/upto) and `supportedTokens` for richer payment discovery.

### 2.4 Solana Agent Kit (sendaifun)

**Source**: [GitHub](https://github.com/sendaifun/solana-agent-kit) — 1.6k stars  
**What it does**: LangChain/Vercel AI tools for Solana DeFi (swap, stake, bridge, NFTs)  
**What it lacks**: No on-chain identity, no reputation, no discovery, no agent registry

**SAP v2 position**: Complementary — Solana Agent Kit agents can register on SAP for identity/discovery. We should build a bridge adapter.

### 2.5 Innovation Score

| Feature | SAP v2 | ERC-8004 | A2A | Solana Agent Kit |
|---------|--------|----------|-----|-----------------|
| On-chain Identity | ✅ Solana | ✅ EVM | ❌ | ❌ |
| Trustless Reputation | ✅ | ✅ | ❌ | ❌ |
| On-chain Pricing | ✅ **UNIQUE** | ❌ | ❌ | ❌ |
| Capability Index | ✅ **UNIQUE** | ❌ | ❌ | ❌ |
| x402 Payments | ✅ | ✅ | ❌ | ❌ |
| MCP/A2A Services | ✅ | ✅ | ✅ | ❌ |
| Plugin PDAs | ✅ **UNIQUE** | ❌ | ❌ | ❌ |
| Memory Layer | ✅ **UNIQUE** | ❌ | ❌ | ❌ |
| Scalable Discovery | ✅ Index PDAs | ⚠️ Events only | ⚠️ DNS/HTTP | ❌ |

**Verdict**: SAP v2 has 4 unique features not found in ANY competing standard. Combined with being first-to-Solana, this is a strong market position.

---

## 3. Architecture Overview

```
                         ┌─────────────────────────────────────┐
                         │        SAP v2 Anchor Program        │
                         │         (On-Chain — Solana)         │
                         ├─────────────────────────────────────┤
                         │                                     │
  ┌──────────┐          │  ┌─────────────────────────────┐    │
  │  Agent   │──register──→│     AgentAccount PDA       │    │
  │  Wallet  │──update────→│  identity + caps + pricing  │    │
  │          │──deactivate→│  x402 + agentURI + bump     │    │
  └──────────┘           │  └──────────┬──────────────────┘    │
                         │             │                       │
  ┌──────────┐          │  ┌──────────▼──────────────────┐    │
  │  Client  │──feedback──→│     FeedbackPDA             │    │
  │  Wallet  │           │  │  score + tag + endpoint     │    │
  │          │           │  │  one per (agent, reviewer)  │    │
  └──────────┘           │  └─────────────────────────────┘    │
                         │                                     │
                         │  ┌─────────────────────────────┐    │
                         │  │   CapabilityIndexPDA        │    │
                         │  │  "jupiter:swap" → [agent1,  │    │
                         │  │   agent2, agent3, ...]      │    │
                         │  └─────────────────────────────┘    │
                         │                                     │
                         │  ┌─────────────────────────────┐    │
                         │  │   ProtocolIndexPDA          │    │
                         │  │  "jupiter" → [agent1, ...]  │    │
                         │  └─────────────────────────────┘    │
                         │                                     │
                         │  ┌─────────────────────────────┐    │
                         │  │   GlobalRegistryPDA         │    │
                         │  │  total_agents, active_count │    │
                         │  │  last_registered_at         │    │
                         │  └─────────────────────────────┘    │
                         │                                     │
                         │  ┌─────────────────────────────┐    │
                         │  │   PluginSlotPDA (future)    │    │
                         │  │  memory, validation, etc.   │    │
                         │  └─────────────────────────────┘    │
                         │                                     │
                         └─────────────────────────────────────┘
                                          │
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
              ┌──────▼──────┐    ┌───────▼───────┐    ┌──────▼──────┐
              │  SDK Client │    │  Helius DAS   │    │    IPFS     │
              │  (TypeScript)│    │  (Indexer)    │    │  (agentURI) │
              └─────────────┘    └───────────────┘    └─────────────┘
```

### PDA Seed Map

| Account | Seeds | Uniqueness |
|---------|-------|------------|
| AgentAccount | `["sap_agent", wallet]` | 1 per wallet |
| FeedbackPDA | `["sap_feedback", agent_pda, reviewer]` | 1 per (agent, reviewer) |
| CapabilityIndexPDA | `["sap_cap_idx", capability_id_hash]` | 1 per capability |
| ProtocolIndexPDA | `["sap_proto_idx", protocol_hash]` | 1 per protocol |
| GlobalRegistryPDA | `["sap_global"]` | 1 global singleton |
| PluginSlotPDA | `["sap_plugin", agent_pda, plugin_type]` | 1 per (agent, plugin) |
| MemoryEntryPDA | `["sap_memory", agent_pda, entry_hash]` | 1 per memory entry |
| MemoryChunkPDA | `["sap_mem_chunk", memory_pda, chunk_idx]` | 1 per chunk |

---

## 4. Account Design (PDAs)

### 4.1 AgentAccount (Core Identity)

```rust
#[account]
pub struct AgentAccount {
    // ── Fixed Fields ──
    pub version: u8,                    // 1 byte  — schema version
    pub bump: u8,                       // 1 byte  — PDA bump
    pub is_active: bool,                // 1 byte
    pub wallet: Pubkey,                 // 32 bytes — owner authority
    pub created_at: i64,                // 8 bytes  — unix timestamp
    pub updated_at: i64,                // 8 bytes  — unix timestamp

    // ── Identity ──
    pub name: String,                   // 4 + max 64 bytes
    pub description: String,            // 4 + max 256 bytes
    pub agent_id: Option<String>,       // 1 + 4 + max 64 bytes (DID)
    pub agent_uri: Option<String>,      // 1 + 4 + max 256 bytes (registration file URL)

    // ── Capabilities ──
    pub capabilities: Vec<Capability>,  // 4 + N * ~100 bytes

    // ── Pricing ──
    pub pricing: Vec<PricingTier>,      // 4 + N * ~80 bytes

    // ── x402 ──
    pub x402_endpoint: Option<String>,  // 1 + 4 + max 256 bytes

    // ── Aggregated Reputation (read-only, updated by program) ──
    pub reputation_score: u32,          // 4 bytes (0-10000, 2 decimals)
    pub total_feedbacks: u32,           // 4 bytes
    pub total_calls_served: u64,        // 8 bytes

    // ── Plugin Slots ──
    pub active_plugins: Vec<PluginRef>, // 4 + N * 33 bytes
}
// Estimated max size: ~2048 bytes (fits in a single Solana account)
```

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Capability {
    pub id: String,                     // e.g., "jupiter:swap"
    pub description: Option<String>,
    pub protocol: Option<String>,       // e.g., "jupiter"
    pub version: Option<String>,        // e.g., "1.0.0"
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PricingTier {
    pub tier_id: String,                // e.g., "standard", "premium"
    pub price_per_call: u64,            // lamports or token smallest unit
    pub rate_limit: u32,                // calls per second
    pub max_calls_per_session: u32,
    pub token_type: TokenType,          // enum
    pub token_mint: Option<Pubkey>,     // SPL mint address (if token_type == SPL)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TokenType {
    SOL,
    USDC,
    SPL,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PluginRef {
    pub plugin_type: PluginType,        // enum (Memory, Validation, etc.)
    pub pda: Pubkey,                    // plugin PDA address
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum PluginType {
    Memory,         // On-chain memory / context
    Validation,     // zkML / TEE attestation
    Delegation,     // Authority delegation
    Analytics,      // Extended metrics
    Custom,         // User-defined
}
```

### 4.2 FeedbackPDA (Trustless Reputation)

```rust
#[account]
pub struct FeedbackAccount {
    pub bump: u8,                       // 1 byte
    pub agent: Pubkey,                  // 32 bytes — agent PDA
    pub reviewer: Pubkey,              // 32 bytes — reviewer wallet
    pub score: u16,                     // 2 bytes  — 0-1000
    pub tag: String,                    // 4 + max 32 bytes (e.g., "quality", "speed")
    pub endpoint_used: Option<String>,  // capability used
    pub comment_hash: Option<[u8; 32]>, // SHA-256 of off-chain comment (IPFS)
    pub created_at: i64,                // 8 bytes
    pub updated_at: i64,                // 8 bytes
    pub is_revoked: bool,               // 1 byte
}
// Size: ~180 bytes
```

### 4.3 CapabilityIndexPDA (Scalable Discovery)

```rust
#[account]
pub struct CapabilityIndex {
    pub bump: u8,                       // 1 byte
    pub capability_hash: [u8; 32],      // SHA-256 of capability ID
    pub capability_id: String,          // 4 + max 64 bytes (human-readable)
    pub agent_count: u32,               // 4 bytes
    pub agents: Vec<Pubkey>,            // 4 + N * 32 bytes (agent PDAs)
    pub last_updated: i64,              // 8 bytes
}
// Max ~100 agents per index PDA (3,200 + overhead = ~3,400 bytes)
// For >100 agents: overflow PDAs with ["sap_cap_idx", hash, page_num]
```

### 4.4 ProtocolIndexPDA

```rust
#[account]
pub struct ProtocolIndex {
    pub bump: u8,
    pub protocol_hash: [u8; 32],
    pub protocol_id: String,
    pub agent_count: u32,
    pub agents: Vec<Pubkey>,
    pub last_updated: i64,
}
```

### 4.5 GlobalRegistryPDA (Network Stats)

```rust
#[account]
pub struct GlobalRegistry {
    pub bump: u8,
    pub total_agents: u64,
    pub active_agents: u64,
    pub total_feedbacks: u64,
    pub total_capabilities: u32,
    pub total_protocols: u32,
    pub last_registered_at: i64,
    pub last_feedback_at: i64,
    pub authority: Pubkey,              // upgrade authority
}
// Size: ~90 bytes (singleton)
```

---

## 5. Instruction Set

### 5.1 Agent Lifecycle

```rust
// ═══════════════════════════════════════════════
//  register_agent
// ═══════════════════════════════════════════════
pub fn register_agent(
    ctx: Context<RegisterAgent>,
    name: String,
    description: String,
    agent_id: Option<String>,
    agent_uri: Option<String>,
    capabilities: Vec<Capability>,
    pricing: Vec<PricingTier>,
    x402_endpoint: Option<String>,
) -> Result<()>

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,

    #[account(
        init,
        payer = wallet,
        space = AgentAccount::space(&capabilities, &pricing),
        seeds = [b"sap_agent", wallet.key().as_ref()],
        bump,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(
        mut,
        seeds = [b"sap_global"],
        bump = global.bump,
    )]
    pub global: Account<'info, GlobalRegistry>,

    pub system_program: Program<'info, System>,
}

// Side effects:
// 1. Initialize AgentAccount PDA with all fields
// 2. Increment global.total_agents and global.active_agents
// 3. Update global.last_registered_at
// 4. For each capability: CPI to update CapabilityIndexPDA
// 5. For each protocol: CPI to update ProtocolIndexPDA
// 6. Emit RegisteredEvent { agent, wallet, name, timestamp }
```

```rust
// ═══════════════════════════════════════════════
//  update_agent
// ═══════════════════════════════════════════════
pub fn update_agent(
    ctx: Context<UpdateAgent>,
    name: Option<String>,
    description: Option<String>,
    agent_uri: Option<String>,
    capabilities: Option<Vec<Capability>>,
    pricing: Option<Vec<PricingTier>>,
    x402_endpoint: Option<String>,
) -> Result<()>

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    pub wallet: Signer<'info>,          // must match agent.wallet

    #[account(
        mut,
        seeds = [b"sap_agent", wallet.key().as_ref()],
        bump = agent.bump,
        has_one = wallet,
    )]
    pub agent: Account<'info, AgentAccount>,

    pub system_program: Program<'info, System>,
}

// Side effects:
// 1. Update provided fields (None = skip)
// 2. If capabilities changed: update CapabilityIndex PDAs
//    - Remove agent from old capability indexes
//    - Add agent to new capability indexes
// 3. Realloc account if needed
// 4. Emit UpdatedEvent { agent, wallet, timestamp }
```

```rust
// ═══════════════════════════════════════════════
//  deactivate_agent
// ═══════════════════════════════════════════════
pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()>

// Sets is_active = false
// Decrements global.active_agents
// Does NOT remove from capability indexes (just filtered by is_active)
// Emit DeactivatedEvent { agent, wallet, timestamp }
```

```rust
// ═══════════════════════════════════════════════
//  reactivate_agent
// ═══════════════════════════════════════════════
pub fn reactivate_agent(ctx: Context<ReactivateAgent>) -> Result<()>

// Sets is_active = true
// Increments global.active_agents
// Emit ReactivatedEvent { agent, wallet, timestamp }
```

```rust
// ═══════════════════════════════════════════════
//  close_agent
// ═══════════════════════════════════════════════
pub fn close_agent(ctx: Context<CloseAgent>) -> Result<()>

// Fully closes the AgentAccount PDA (rent returned to wallet)
// Removes from all CapabilityIndex and ProtocolIndex PDAs
// Decrements global.total_agents and global.active_agents
// Emit ClosedEvent { agent, wallet, timestamp }
```

### 5.2 Reputation (Trustless Feedback)

```rust
// ═══════════════════════════════════════════════
//  give_feedback
// ═══════════════════════════════════════════════
pub fn give_feedback(
    ctx: Context<GiveFeedback>,
    score: u16,                         // 0-1000
    tag: String,                        // "quality", "speed", "reliability"
    endpoint_used: Option<String>,      // capability ID used
    comment_hash: Option<[u8; 32]>,     // SHA-256 of IPFS comment
) -> Result<()>

#[derive(Accounts)]
pub struct GiveFeedback<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sap_agent", agent.wallet.as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(
        init,
        payer = reviewer,
        space = FeedbackAccount::SPACE,
        seeds = [b"sap_feedback", agent.key().as_ref(), reviewer.key().as_ref()],
        bump,
    )]
    pub feedback: Account<'info, FeedbackAccount>,

    pub system_program: Program<'info, System>,
}

// Constraints:
// - score must be 0-1000
// - tag must be <= 32 bytes
// - One feedback per (agent, reviewer) pair — use update_feedback to change
//
// Side effects:
// 1. Create FeedbackPDA
// 2. Recalculate agent.reputation_score as weighted average
// 3. Increment agent.total_feedbacks
// 4. Update global.total_feedbacks
// 5. Emit FeedbackEvent { agent, reviewer, score, tag, timestamp }
```

```rust
// ═══════════════════════════════════════════════
//  update_feedback
// ═══════════════════════════════════════════════
pub fn update_feedback(
    ctx: Context<UpdateFeedback>,
    score: u16,
    tag: Option<String>,
    comment_hash: Option<[u8; 32]>,
) -> Result<()>

// Same reviewer updates their existing feedback
// Recalculates agent.reputation_score
```

```rust
// ═══════════════════════════════════════════════
//  revoke_feedback
// ═══════════════════════════════════════════════
pub fn revoke_feedback(ctx: Context<RevokeFeedback>) -> Result<()>

// Sets feedback.is_revoked = true
// Recalculates agent.reputation_score (excluding revoked)
// Decrements agent.total_feedbacks
```

```rust
// ═══════════════════════════════════════════════
//  report_calls (self-reported metrics, separate from reputation)
// ═══════════════════════════════════════════════
pub fn report_calls(
    ctx: Context<ReportCalls>,
    calls_served: u64,
) -> Result<()>

// Only the agent owner can call this
// Updates agent.total_calls_served
// Does NOT affect reputation_score (that's only from client feedback)
```

### 5.3 Indexing Management

```rust
// ═══════════════════════════════════════════════
//  init_capability_index
// ═══════════════════════════════════════════════
pub fn init_capability_index(
    ctx: Context<InitCapabilityIndex>,
    capability_id: String,
) -> Result<()>

#[derive(Accounts)]
pub struct InitCapabilityIndex<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = CapabilityIndex::initial_space(),
        seeds = [b"sap_cap_idx", &hash_capability(&capability_id)],
        bump,
    )]
    pub index: Account<'info, CapabilityIndex>,

    pub system_program: Program<'info, System>,
}

// Called automatically during register_agent for new capabilities
// If index already exists, just add agent to the Vec
```

```rust
// ═══════════════════════════════════════════════
//  init_protocol_index
// ═══════════════════════════════════════════════
// Same pattern as capability index but for protocol grouping
```

---

## 6. Indexing System

### 6.1 Problem: `getProgramAccounts` Doesn't Scale

Current v1 uses `getProgramAccounts` to fetch ALL agent PDAs, then filters client-side. At 10,000 agents (each ~2KB), this means:
- **20 MB download per query**
- RPC rate limits hit immediately
- Mainnet validators reject large scans
- O(n) client-side filtering

### 6.2 Solution: Inverted Index PDAs

SAP v2 uses **on-chain inverted indexes** — a pattern borrowed from search engines:

```
                    ┌──────────────────────────────┐
                    │  CapabilityIndexPDA           │
                    │  cap_id: "jupiter:swap"       │
                    │  agents: [Agent1, Agent2, ...] │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │ AgentPDA 1│ │ AgentPDA 2│ │ AgentPDA 3│
              │ rep: 850  │ │ rep: 920  │ │ rep: 700  │
              └───────────┘ └───────────┘ └───────────┘
```

**Query flow** (replaces `getProgramAccounts`):

```
1. Client wants agents with "jupiter:swap"
2. Derive PDA: seeds = ["sap_cap_idx", sha256("jupiter:swap")]
3. Single getAccountInfo → get list of agent Pubkeys
4. Parallel getMultipleAccounts for just those agents
5. Client-side sort by reputation/price
```

**Complexity**: O(1) index lookup + O(k) account reads (k = matching agents)  
**vs v1**: O(n) full scan of ALL agents

### 6.3 Pagination for Large Indexes

When a capability index exceeds ~100 agents (account size limit):

```rust
// Page 0 (original)
seeds = ["sap_cap_idx", capability_hash]
// Page 1
seeds = ["sap_cap_idx", capability_hash, &[1u8]]
// Page 2
seeds = ["sap_cap_idx", capability_hash, &[2u8]]
```

The root index PDA stores `total_pages: u8` so the client knows how many pages to fetch.

### 6.4 Index Maintenance

Indexes are maintained atomically during agent lifecycle:

| Event | Index Action |
|-------|-------------|
| `register_agent` | Add to all capability + protocol indexes |
| `update_agent` (caps changed) | Remove from old indexes, add to new |
| `close_agent` | Remove from all indexes |
| `deactivate_agent` | **No index change** (filtered by `is_active` on read) |

This ensures indexes are always consistent without background jobs.

### 6.5 Helius DAS Integration (Off-Chain Indexing)

For complex queries beyond what on-chain indexes support (full-text search, multi-filter combinations), SAP v2 emits **Anchor events** that Helius/Triton indexers can capture:

```rust
#[event]
pub struct RegisteredEvent {
    pub agent: Pubkey,
    pub wallet: Pubkey,
    pub name: String,
    pub capabilities: Vec<String>,
    pub timestamp: i64,
}

#[event]
pub struct FeedbackEvent {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub score: u16,
    pub tag: String,
    pub timestamp: i64,
}

#[event]
pub struct UpdatedEvent {
    pub agent: Pubkey,
    pub wallet: Pubkey,
    pub fields_changed: Vec<String>,
    pub timestamp: i64,
}
```

These events create a full audit trail that off-chain indexers can use for:
- Complex multi-filter queries
- Historical analytics
- Reputation trend analysis
- Full-text search over agent descriptions

---

## 7. Trustless Reputation

### 7.1 Design Philosophy

**v1 problem**: Self-reported reputation (agent updates own score) = zero trust.  
**v2 solution**: Only **clients** can leave feedback. The agent's `reputation_score` is a **program-calculated aggregate** that the agent cannot manipulate.

### 7.2 Reputation Score Calculation

```rust
fn calculate_reputation(feedbacks: &[FeedbackAccount]) -> u32 {
    let active: Vec<&FeedbackAccount> = feedbacks
        .iter()
        .filter(|f| !f.is_revoked)
        .collect();

    if active.is_empty() {
        return 5000; // Default score for new agents (50.00%)
    }

    // Time-weighted average: recent feedback weighs more
    let now = Clock::get()?.unix_timestamp;
    let mut weighted_sum: u64 = 0;
    let mut weight_total: u64 = 0;

    for f in &active {
        let age_days = ((now - f.created_at) / 86400).max(1) as u64;
        let weight = 10000 / age_days.min(10000); // Recent = higher weight
        weighted_sum += f.score as u64 * weight;
        weight_total += weight;
    }

    (weighted_sum / weight_total) as u32 // 0-10000 (2 decimal precision)
}
```

### 7.3 Anti-Gaming Measures

| Attack | Mitigation |
|--------|-----------|
| Sybil feedback (fake reviewers) | Minimum SOL balance required for feedback (rent + fee) |
| Self-review | PDA seeds prevent agent from reviewing themselves |
| Spam feedback | One feedback per (agent, reviewer) pair |
| Review bombing | Time-weighted average reduces impact of bursts |
| Feedback manipulation | Score is computed on-chain by the program, not user input |

### 7.4 Reputation Queries

```rust
// Get all feedbacks for an agent
// Seeds pattern: ["sap_feedback", agent_pda, *]
// Use getProgramAccounts with memcmp on agent_pda at offset 1

// Or use SDK helper:
const feedbacks = await discovery.getFeedbacks(agentPDA);
const avgScore = feedbacks.reduce((s, f) => s + f.score, 0) / feedbacks.length;
```

---

## 8. Plugin System — Extensible PDAs

### 8.1 Philosophy

SAP v2 treats the AgentAccount as the **core identity** and allows **plugins** to extend functionality through separate PDAs linked back to the agent. This keeps the core account lean while enabling unlimited extensibility.

```
                    ┌─────────────────────┐
                    │    AgentAccount      │
                    │  active_plugins: [   │
                    │    { Memory, PDA1 }, │
                    │    { Analytics, PDA2}│
                    │  ]                   │
                    └──────┬──────┬────────┘
                           │      │
              ┌────────────▼┐    ┌▼────────────────┐
              │ MemoryPlugin │    │ AnalyticsPlugin  │
              │  PDA1        │    │  PDA2            │
              │  entries: [] │    │  daily_calls: [] │
              └──────────────┘    └──────────────────┘
```

### 8.2 Plugin Registration

```rust
// ═══════════════════════════════════════════════
//  register_plugin
// ═══════════════════════════════════════════════
pub fn register_plugin(
    ctx: Context<RegisterPlugin>,
    plugin_type: PluginType,
) -> Result<()>

#[derive(Accounts)]
pub struct RegisterPlugin<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sap_agent", wallet.key().as_ref()],
        bump = agent.bump,
        has_one = wallet,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(
        init,
        payer = wallet,
        space = PluginSlot::SPACE,
        seeds = [b"sap_plugin", agent.key().as_ref(), &[plugin_type as u8]],
        bump,
    )]
    pub plugin: Account<'info, PluginSlot>,

    pub system_program: Program<'info, System>,
}
```

```rust
#[account]
pub struct PluginSlot {
    pub bump: u8,
    pub plugin_type: PluginType,
    pub agent: Pubkey,
    pub is_active: bool,
    pub created_at: i64,
    pub config: Vec<u8>,               // Plugin-specific config (Borsh)
    pub data_account: Option<Pubkey>,   // External data account (if needed)
}
```

### 8.3 Planned Plugin Types

| Plugin Type | Status | Description |
|-------------|--------|-------------|
| **Memory** | 🔵 v2.0 | On-chain memory entries with IPFS hybrid storage |
| **Validation** | 🟡 v2.1 | zkML/TEE attestation (ERC-8004 Validation Registry equivalent) |
| **Delegation** | 🟡 v2.1 | Delegate authority to other wallets/programs |
| **Analytics** | 🟢 v2.2 | Extended call metrics, daily/weekly aggregates |
| **Governance** | 🟢 v2.2 | DAO-controlled agent parameters |
| **Custom** | 🟢 v2.2 | User-defined plugin with arbitrary data |

---

## 9. Memory Layer — Hybrid IPFS + On-Chain

### 9.1 Design Rationale

Inspired by OOBE Protocol's MemoryV2 system with on-chain data chunking, SAP v2 provides a **hybrid storage model** where:

- **Metadata + index = on-chain** (always available, verifiable)
- **Full content = IPFS** (cheap, unlimited size)
- **Critical content = on-chain chunks** (censorship-resistant, always available)

This gives agents the ability to maintain persistent memory/context across sessions, stored verifiably on Solana.

### 9.2 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Memory Layer                              │
│                                                              │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────┐  │
│  │MemoryEntryPDA│───→│ MemoryChunkPDA│───→│ MemoryChunk  │  │
│  │  (index)     │    │  (page 0)     │    │  (page 1)    │  │
│  │              │    │  data: [...]  │    │  data: [...]  │  │
│  │ entry_hash   │    │  1000 bytes   │    │  1000 bytes   │  │
│  │ ipfs_cid     │    └───────────────┘    └──────────────┘  │
│  │ content_hash │                                            │
│  │ chunk_count  │    ┌───────────────┐                      │
│  │ tags         │    │    IPFS       │                      │
│  └──────┬───────┘    │  Full content │                      │
│         │            │  (unlimited)  │                      │
│         └───────────→│  CID: Qm...  │                      │
│                      └───────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Account Definitions

```rust
/// Entry point for a memory record.
/// Contains metadata + pointers to content (on-chain chunks OR IPFS).
#[account]
pub struct MemoryEntry {
    pub bump: u8,
    pub agent: Pubkey,                  // owning agent PDA
    pub entry_type: MemoryType,         // Conversation, Knowledge, Context, etc.
    pub entry_hash: [u8; 32],           // SHA-256 of canonical content
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
    pub importance: u8,                 // 0-255 (higher = more important)

    // ── Content Pointers ──
    pub storage_mode: StorageMode,      // OnChain, IPFS, Hybrid
    pub ipfs_cid: Option<String>,       // IPFS CID (max 64 bytes)
    pub content_hash: [u8; 32],         // SHA-256 of full content
    pub total_size: u32,                // total content size in bytes
    pub chunk_count: u8,                // number of on-chain chunks (0 = IPFS only)

    // ── Semantic Metadata ──
    pub title: String,                  // max 64 bytes
    pub tags: Vec<String>,             // max 8 tags, 32 bytes each
    pub embedding_hash: Option<[u8; 32]>, // hash of semantic embedding vector

    // ── Context Linking ──
    pub parent_entry: Option<Pubkey>,   // linked parent memory
    pub session_id: Option<String>,     // conversation session ID
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum MemoryType {
    Conversation,   // Chat history
    Knowledge,      // Learned facts
    Context,        // Execution context
    Tool,           // Tool call results
    Decision,       // Decision logs
    Custom,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum StorageMode {
    OnChain,        // All content in MemoryChunk PDAs
    IPFS,           // Content on IPFS, only metadata on-chain
    Hybrid,         // Critical parts on-chain, full content on IPFS
}
```

```rust
/// A chunk of on-chain memory content.
/// Each chunk holds up to 900 bytes of raw data.
/// Multiple chunks form the complete on-chain content.
#[account]
pub struct MemoryChunk {
    pub bump: u8,
    pub memory_entry: Pubkey,           // parent MemoryEntry PDA
    pub chunk_index: u8,                // 0, 1, 2, ... (max 255)
    pub data: Vec<u8>,                  // max 900 bytes per chunk
    pub is_last: bool,                  // true for final chunk
}
// Seeds: ["sap_mem_chunk", memory_entry_pda, chunk_index]
// Max content per entry: 255 * 900 = ~229 KB on-chain
// For larger content: use IPFS (Hybrid mode)
```

### 9.4 Memory Instructions

```rust
// ═══════════════════════════════════════════════
//  create_memory
// ═══════════════════════════════════════════════
pub fn create_memory(
    ctx: Context<CreateMemory>,
    entry_type: MemoryType,
    storage_mode: StorageMode,
    title: String,
    tags: Vec<String>,
    importance: u8,
    ipfs_cid: Option<String>,
    content: Option<Vec<u8>>,           // first chunk (if on-chain)
    total_size: u32,
    session_id: Option<String>,
    parent_entry: Option<Pubkey>,
) -> Result<()>

// Creates MemoryEntry PDA
// If content provided: creates first MemoryChunk PDA
// Links to agent via plugin system
```

```rust
// ═══════════════════════════════════════════════
//  append_memory_chunk
// ═══════════════════════════════════════════════
pub fn append_memory_chunk(
    ctx: Context<AppendChunk>,
    chunk_index: u8,
    data: Vec<u8>,
    is_last: bool,
) -> Result<()>

// Appends additional data chunk to an existing memory entry
// Validates chunk_index == memory.chunk_count (sequential)
// Max data size: 900 bytes per chunk (account limit safety margin)
```

```rust
// ═══════════════════════════════════════════════
//  update_memory_metadata
// ═══════════════════════════════════════════════
pub fn update_memory_metadata(
    ctx: Context<UpdateMemory>,
    title: Option<String>,
    tags: Option<Vec<String>>,
    importance: Option<u8>,
    ipfs_cid: Option<String>,
) -> Result<()>
```

```rust
// ═══════════════════════════════════════════════
//  deactivate_memory
// ═══════════════════════════════════════════════
pub fn deactivate_memory(ctx: Context<DeactivateMemory>) -> Result<()>

// Soft-delete: sets is_active = false
// Chunks remain for audit trail
```

```rust
// ═══════════════════════════════════════════════
//  close_memory (full cleanup)
// ═══════════════════════════════════════════════
pub fn close_memory(ctx: Context<CloseMemory>) -> Result<()>

// Closes MemoryEntry + all MemoryChunk PDAs
// Rent returned to agent wallet
// Requires closing chunks first (or batch close)
```

### 9.5 Memory Query Patterns

```typescript
// SDK side — find agent's memories by tag
const memories = await sapMemory.findByTag(agentPDA, 'defi');

// Find conversation history for a session
const history = await sapMemory.findBySession(agentPDA, 'session-123');

// Read full on-chain content (reassemble chunks)
const content = await sapMemory.readContent(memoryEntryPDA);
// → Uint8Array (all chunks concatenated)

// Read from IPFS if hybrid
const fullContent = await sapMemory.readHybrid(memoryEntryPDA);
// → { onChain: Uint8Array, ipfs: Uint8Array, merged: Uint8Array }
```

### 9.6 Storage Cost Analysis

| Storage Mode | 1 KB content | 10 KB content | 100 KB content |
|-------------|-------------|---------------|----------------|
| **On-Chain** | ~0.007 SOL (1 chunk) | ~0.07 SOL (12 chunks) | ~0.7 SOL (112 chunks) |
| **IPFS** | ~0.002 SOL (metadata only) | ~0.002 SOL | ~0.002 SOL |
| **Hybrid** | ~0.005 SOL (summary on-chain) | ~0.01 SOL (key data on-chain) | ~0.05 SOL (first 10 chunks + IPFS) |

**Recommendation**: Use **Hybrid mode** for most memories — critical metadata + first chunk on-chain, full content on IPFS. This gives verifiability at reasonable cost.

### 9.7 Future: Vector Embeddings Index

A future plugin can add semantic search over memories:

```rust
// Future: EmbeddingIndexPDA
// Seeds: ["sap_embed_idx", agent_pda, dimension_bucket]
// Stores quantized embedding vectors for nearest-neighbor search
// Combined with Helius DAS for full semantic search
```

---

## 10. x402 & Payment Integration

### 10.1 On-Chain Payment Verification

SAP v2 can optionally verify x402 payments on-chain:

```rust
#[account]
pub struct PaymentReceipt {
    pub bump: u8,
    pub agent: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub tier_id: String,
    pub timestamp: i64,
    pub tx_signature: [u8; 64],
}
// Seeds: ["sap_payment", agent_pda, tx_signature_hash]
```

### 10.2 Registration File (agentURI)

The `agent_uri` field points to a JSON file compatible with ERC-8004 and A2A:

```json
{
  "version": "1.0",
  "name": "DeFi Oracle Agent",
  "description": "Jupiter + Raydium swap tools with real-time pricing",
  "services": [
    {
      "type": "mcp",
      "url": "https://agent.xyz/mcp",
      "version": "2024-11-05"
    },
    {
      "type": "a2a",
      "url": "https://agent.xyz/a2a",
      "version": "1.0"
    },
    {
      "type": "x402",
      "url": "https://agent.xyz/.well-known/x402"
    },
    {
      "type": "rest",
      "url": "https://agent.xyz/api/v1",
      "openapi": "https://agent.xyz/openapi.json"
    }
  ],
  "supportedTrust": ["x402", "tls-notary", "solana-attestation"],
  "solana": {
    "programId": "SAPv2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "agentPDA": "DerivedPDAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "network": "mainnet-beta"
  },
  "x402": {
    "schemes": ["exact", "upto"],
    "tokens": ["SOL", "USDC"],
    "minPayment": "1000"
  }
}
```

---

## 11. Scalability Analysis

### 11.1 Agent Capacity

| Metric | Limit | Notes |
|--------|-------|-------|
| Max agents | **Unlimited** | Each agent is a separate PDA |
| Agents per capability index | ~100/page | Paginated with overflow PDAs |
| Feedbacks per agent | **Unlimited** | Each is a separate PDA |
| Memory entries per agent | **Unlimited** | Each is a separate PDA |
| Chunks per memory | 255 | ~229 KB on-chain per entry |

### 11.2 Transaction Throughput

| Operation | CU Cost | TPS (theoretical) |
|-----------|---------|-------------------|
| register_agent | ~50,000 CU | ~800/sec |
| give_feedback | ~30,000 CU | ~1,300/sec |
| create_memory | ~40,000 CU | ~1,000/sec |
| Discovery (read) | 0 CU (RPC only) | Limited by RPC rate |

### 11.3 Query Performance

| Query Type | v1 (getProgramAccounts) | v2 (Index PDAs) |
|-----------|------------------------|-----------------|
| Find by capability | O(n) scan ALL agents | **O(1)** index lookup |
| Find by protocol | O(n) scan ALL agents | **O(1)** index lookup |
| Find single agent | O(1) getAccountInfo | O(1) getAccountInfo |
| Get all feedbacks | N/A | O(k) memcmp filter |
| Network stats | O(n) scan ALL agents | **O(1)** GlobalRegistry |

### 11.4 Cost Per Agent

| Item | One-Time Cost | Monthly Cost |
|------|--------------|-------------|
| Agent PDA (~2 KB) | ~0.015 SOL rent | 0 (rent-exempt) |
| Each feedback received | ~0.003 SOL rent | 0 (rent-exempt) |
| Memory entry (metadata) | ~0.005 SOL rent | 0 (rent-exempt) |
| Memory chunk (900 B) | ~0.007 SOL rent | 0 (rent-exempt) |
| Total (basic agent) | **~0.02 SOL** | **0 SOL** |

---

## 12. Security Model

### 12.1 Access Control

| Operation | Who Can Call | Verification |
|-----------|-------------|--------------|
| register_agent | Any wallet | Signer = wallet authority |
| update_agent | Agent owner only | `has_one = wallet` constraint |
| deactivate_agent | Agent owner only | `has_one = wallet` |
| give_feedback | Any wallet | PDA seeds prevent self-review |
| create_memory | Agent owner only | `has_one = wallet` |
| update index | Program only | CPI from agent instructions |
| update global | Program only | Internal only |

### 12.2 Constraints

```rust
// Agent cannot review themselves
#[account(
    constraint = reviewer.key() != agent.wallet @ SAPError::SelfReviewNotAllowed,
)]

// Name length limit
#[account(
    constraint = name.len() <= 64 @ SAPError::NameTooLong,
)]

// Score range
#[account(
    constraint = score <= 1000 @ SAPError::InvalidScore,
)]

// Memory chunk sequential
#[account(
    constraint = chunk_index == memory.chunk_count @ SAPError::ChunkOutOfOrder,
)]
```

### 12.3 Upgrade Authority

The program uses Anchor's `upgrade_authority` pattern:
- **Phase 1** (Devnet): Team multisig controls upgrades
- **Phase 2** (Mainnet): Upgrade authority transferred to DAO/governance
- **Phase 3**: Program frozen (immutable) after stabilization

---

## 13. Anchor Program Structure

### 13.1 Project Layout

```
programs/sap/
├── Cargo.toml
├── Xargo.toml
└── src/
    ├── lib.rs                  # Program entrypoint + instruction dispatch
    ├── error.rs                # Custom error codes
    ├── state/
    │   ├── mod.rs
    │   ├── agent.rs            # AgentAccount
    │   ├── feedback.rs         # FeedbackAccount
    │   ├── index.rs            # CapabilityIndex, ProtocolIndex
    │   ├── global.rs           # GlobalRegistry
    │   ├── plugin.rs           # PluginSlot
    │   └── memory.rs           # MemoryEntry, MemoryChunk
    ├── instructions/
    │   ├── mod.rs
    │   ├── agent/
    │   │   ├── register.rs
    │   │   ├── update.rs
    │   │   ├── deactivate.rs
    │   │   ├── reactivate.rs
    │   │   └── close.rs
    │   ├── feedback/
    │   │   ├── give.rs
    │   │   ├── update.rs
    │   │   └── revoke.rs
    │   ├── index/
    │   │   ├── init_capability.rs
    │   │   ├── init_protocol.rs
    │   │   └── update.rs
    │   ├── plugin/
    │   │   ├── register.rs
    │   │   └── remove.rs
    │   └── memory/
    │       ├── create.rs
    │       ├── append_chunk.rs
    │       ├── update_metadata.rs
    │       ├── deactivate.rs
    │       └── close.rs
    └── utils/
        ├── mod.rs
        ├── hash.rs             # SHA-256 helpers for capability hashing
        └── reputation.rs       # Score calculation logic
```

### 13.2 Error Codes

```rust
#[error_code]
pub enum SAPError {
    #[msg("Agent name exceeds 64 bytes")]
    NameTooLong,                    // 6000
    #[msg("Description exceeds 256 bytes")]
    DescriptionTooLong,             // 6001
    #[msg("Agent is already active")]
    AlreadyActive,                  // 6002
    #[msg("Agent is not active")]
    NotActive,                      // 6003
    #[msg("Feedback score must be 0-1000")]
    InvalidScore,                   // 6004
    #[msg("Cannot review your own agent")]
    SelfReviewNotAllowed,           // 6005
    #[msg("Feedback tag exceeds 32 bytes")]
    TagTooLong,                     // 6006
    #[msg("Memory chunk out of order")]
    ChunkOutOfOrder,                // 6007
    #[msg("Memory chunk data exceeds 900 bytes")]
    ChunkTooLarge,                  // 6008
    #[msg("Maximum tags (8) exceeded")]
    TooManyTags,                    // 6009
    #[msg("Capability index is full, use overflow page")]
    IndexPageFull,                  // 6010
    #[msg("Plugin type already registered")]
    PluginAlreadyExists,            // 6011
    #[msg("Agent URI exceeds 256 bytes")]
    AgentUriTooLong,                // 6012
    #[msg("Too many capabilities (max 32)")]
    TooManyCapabilities,            // 6013
    #[msg("Too many pricing tiers (max 8)")]
    TooManyPricingTiers,            // 6014
    #[msg("IPFS CID exceeds 64 bytes")]
    IpfsCidTooLong,                 // 6015
}
```

### 13.3 Events

```rust
#[event]
pub struct AgentRegistered {
    pub agent_pda: Pubkey,
    pub wallet: Pubkey,
    pub name: String,
    pub capabilities: Vec<String>,
    pub timestamp: i64,
}

#[event]
pub struct AgentUpdated {
    pub agent_pda: Pubkey,
    pub fields: Vec<String>,        // ["name", "capabilities", "pricing"]
    pub timestamp: i64,
}

#[event]
pub struct AgentDeactivated {
    pub agent_pda: Pubkey,
    pub wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FeedbackGiven {
    pub agent_pda: Pubkey,
    pub reviewer: Pubkey,
    pub score: u16,
    pub tag: String,
    pub new_avg_score: u32,
    pub timestamp: i64,
}

#[event]
pub struct MemoryCreated {
    pub agent_pda: Pubkey,
    pub memory_pda: Pubkey,
    pub entry_type: MemoryType,
    pub storage_mode: StorageMode,
    pub title: String,
    pub timestamp: i64,
}

#[event]
pub struct PluginRegistered {
    pub agent_pda: Pubkey,
    pub plugin_pda: Pubkey,
    pub plugin_type: PluginType,
    pub timestamp: i64,
}
```

---

## 14. SDK Integration Plan

### 14.1 Updated TypeScript SDK Modules

```
src/ai/sap/
├── types.ts              # ← UPDATE: add FeedbackPDA, CapabilityIndex, Memory types
├── pda.ts                # ← UPDATE: add new PDA derivations
├── program.ts            # ← UPDATE: add feedback, memory, plugin instructions
├── discovery.ts          # ← REWRITE: use CapabilityIndex PDAs instead of getProgramAccounts
├── adapter.ts            # ← UPDATE: support new account types
├── feedback.ts           # ← NEW: SAPFeedback class
├── memory.ts             # ← NEW: SAPMemory class (hybrid IPFS + on-chain)
├── plugins.ts            # ← NEW: SAPPluginManager class
└── index.ts              # ← UPDATE: export new modules
```

### 14.2 New SDK Classes

```typescript
// SAPFeedback — Trustless reputation
class SAPFeedback {
  giveFeedback(agentPDA: string, score: number, tag: string): SAPInstruction;
  updateFeedback(agentPDA: string, score: number): SAPInstruction;
  revokeFeedback(agentPDA: string): SAPInstruction;
  getFeedbacks(agentPDA: string): Promise<FeedbackAccount[]>;
  getAverageScore(agentPDA: string): Promise<number>;
}

// SAPMemory — Hybrid storage
class SAPMemory {
  createMemory(params: CreateMemoryParams): SAPInstruction;
  appendChunk(memoryPDA: string, data: Uint8Array): SAPInstruction;
  readContent(memoryPDA: string): Promise<Uint8Array>;
  readHybrid(memoryPDA: string): Promise<HybridContent>;
  findByTag(agentPDA: string, tag: string): Promise<MemoryEntry[]>;
  findBySession(agentPDA: string, sessionId: string): Promise<MemoryEntry[]>;
  uploadToIPFS(content: Uint8Array): Promise<string>; // returns CID
}

// SAPPluginManager — Extension system
class SAPPluginManager {
  registerPlugin(pluginType: PluginType): SAPInstruction;
  removePlugin(pluginType: PluginType): SAPInstruction;
  getPlugins(agentPDA: string): Promise<PluginSlot[]>;
  hasPlugin(agentPDA: string, type: PluginType): Promise<boolean>;
}
```

### 14.3 Updated Discovery (Index-Based)

```typescript
// Before (v1): Scans ALL accounts — O(n)
const result = await discovery.find({ capability: 'jupiter:swap' });

// After (v2): Reads CapabilityIndex PDA — O(1)
// Same API, completely different implementation:
class SAPDiscovery {
  async find(filter: AgentDiscoveryFilter): Promise<DiscoveryResult> {
    if (filter.capability) {
      // 1. Derive CapabilityIndex PDA
      const indexPDA = deriveCapabilityIndexPDA(filter.capability);
      // 2. Fetch index (single getAccountInfo)
      const index = await this.fetchIndex(indexPDA);
      // 3. Fetch only matching agents (getMultipleAccounts)
      const agents = await this.fetchAgents(index.agents);
      // 4. Apply remaining filters client-side
      return this.applyFilters(agents, filter);
    }
    // Fallback to getProgramAccounts for unindexed queries
  }
}
```

---

## 15. Deployment Roadmap

### Phase 1: Core (Week 1-2)
- [ ] Anchor project scaffold
- [ ] AgentAccount + GlobalRegistry state
- [ ] register_agent, update_agent, deactivate_agent instructions
- [ ] CapabilityIndex + ProtocolIndex PDAs
- [ ] Index maintenance (add/remove during register/update)
- [ ] Events emission
- [ ] Unit tests + integration tests
- [ ] Deploy to Devnet

### Phase 2: Reputation (Week 3)
- [ ] FeedbackAccount state
- [ ] give_feedback, update_feedback, revoke_feedback instructions
- [ ] Reputation score calculation (time-weighted)
- [ ] Anti-gaming constraints
- [ ] Update SDK: SAPFeedback class
- [ ] Integration tests with feedback

### Phase 3: Memory & Plugins (Week 4)
- [ ] PluginSlot state + register/remove
- [ ] MemoryEntry + MemoryChunk state
- [ ] create_memory, append_chunk, close_memory instructions
- [ ] IPFS integration helpers
- [ ] Update SDK: SAPMemory + SAPPluginManager
- [ ] Hybrid storage tests

### Phase 4: Production (Week 5)
- [ ] Security audit (external)
- [ ] Mainnet deployment
- [ ] Update SAP_DEFAULT_PROGRAM_ID in SDK
- [ ] Update SDK documentation
- [ ] Publish SDK v2.0.0
- [ ] agentURI standard documentation
- [ ] Solana Agent Kit bridge adapter

### Phase 5: Ecosystem (Week 6+)
- [ ] Helius DAS indexer integration
- [ ] Validation plugin (zkML/TEE)
- [ ] Delegation plugin
- [ ] Metaplex NFT badge (optional identity token)
- [ ] Cross-program composability (CPI interfaces)
- [ ] Governance DAO for protocol parameters

---

## Appendix A: Copilot Opus 4.6 — Skill Prompt for Contract Generation

The following is a structured prompt/skill description for Claude Opus 4.6 (Copilot) to generate the Anchor smart contract. Use this as the starting prompt when building the program:

---

### SKILL: SAP v2 Anchor Program Builder

**Role**: You are an expert Solana Anchor program developer. You will build the SAP (Solana Agent Protocol) v2 program — an on-chain registry for AI agent identity, trustless reputation, capability indexing, plugin extensions, and hybrid memory storage.

**Context**:
- Framework: Anchor 0.30+ (Rust)
- Target: Solana mainnet-beta
- Account model: PDAs with deterministic seeds
- Serialization: Borsh (via Anchor derive macros)
- Testing: anchor test (TypeScript + mocha)

**Core Accounts to implement**:

1. **AgentAccount** (seeds: `["sap_agent", wallet]`)
   - Fields: version, bump, is_active, wallet (Pubkey), name (String, max 64), description (String, max 256), agent_id (Option<String>), agent_uri (Option<String>), capabilities (Vec<Capability>), pricing (Vec<PricingTier>), x402_endpoint (Option<String>), reputation_score (u32, 0-10000), total_feedbacks (u32), total_calls_served (u64), active_plugins (Vec<PluginRef>), created_at (i64), updated_at (i64)
   - Space: Dynamic based on capabilities/pricing count

2. **FeedbackAccount** (seeds: `["sap_feedback", agent_pda, reviewer]`)
   - Fields: bump, agent (Pubkey), reviewer (Pubkey), score (u16, 0-1000), tag (String, max 32), endpoint_used (Option<String>), comment_hash (Option<[u8;32]>), created_at (i64), updated_at (i64), is_revoked (bool)
   - Constraint: reviewer != agent.wallet (no self-review)

3. **CapabilityIndex** (seeds: `["sap_cap_idx", sha256(capability_id)[0..32]]`)
   - Fields: bump, capability_hash ([u8;32]), capability_id (String), agent_count (u32), agents (Vec<Pubkey>, max 100), last_updated (i64)
   - Overflow: additional pages with seeds `["sap_cap_idx", hash, page_num]`

4. **ProtocolIndex** (seeds: `["sap_proto_idx", sha256(protocol_id)[0..32]]`)
   - Same structure as CapabilityIndex

5. **GlobalRegistry** (seeds: `["sap_global"]`)
   - Fields: bump, total_agents (u64), active_agents (u64), total_feedbacks (u64), total_capabilities (u32), total_protocols (u32), last_registered_at (i64), last_feedback_at (i64), authority (Pubkey)

6. **PluginSlot** (seeds: `["sap_plugin", agent_pda, plugin_type_u8]`)
   - Fields: bump, plugin_type (enum), agent (Pubkey), is_active (bool), created_at (i64), config (Vec<u8>), data_account (Option<Pubkey>)

7. **MemoryEntry** (seeds: `["sap_memory", agent_pda, entry_hash[0..32]]`)
   - Fields: bump, agent (Pubkey), entry_type (enum), entry_hash ([u8;32]), storage_mode (enum: OnChain/IPFS/Hybrid), ipfs_cid (Option<String>, max 64), content_hash ([u8;32]), total_size (u32), chunk_count (u8), title (String, max 64), tags (Vec<String>, max 8), embedding_hash (Option<[u8;32]>), parent_entry (Option<Pubkey>), session_id (Option<String>), importance (u8), is_active (bool), created_at (i64), updated_at (i64)

8. **MemoryChunk** (seeds: `["sap_mem_chunk", memory_entry_pda, chunk_index_u8]`)
   - Fields: bump, memory_entry (Pubkey), chunk_index (u8), data (Vec<u8>, max 900), is_last (bool)

**Instructions to implement**:
- Agent: register_agent, update_agent, deactivate_agent, reactivate_agent, close_agent, report_calls
- Feedback: give_feedback, update_feedback, revoke_feedback
- Index: init_capability_index, init_protocol_index (called internally during register)
- Plugin: register_plugin, remove_plugin
- Memory: create_memory, append_memory_chunk, update_memory_metadata, deactivate_memory, close_memory
- Admin: initialize_global (one-time setup)

**Key constraints**:
- All writes require signer verification
- Feedback: reviewer cannot be agent owner
- Reputation score: calculated by program as time-weighted average of all non-revoked feedbacks
- Index updates: atomic during register/update/close
- Memory chunks: sequential (chunk_index must equal current chunk_count)
- Max 32 capabilities per agent
- Max 8 pricing tiers per agent
- Max 8 tags per memory entry

**Events to emit**: AgentRegistered, AgentUpdated, AgentDeactivated, FeedbackGiven, MemoryCreated, PluginRegistered

**Testing requirements**:
- Register an agent and verify PDA derivation
- Update capabilities and verify index PDAs updated
- Give feedback from different wallet and verify reputation recalculation
- Create hybrid memory (on-chain + IPFS CID) and verify chunk reassembly
- Verify self-review prevention
- Test index pagination with >100 agents per capability

**Code style**:
- Use Anchor account constraints extensively
- Separate state/ and instructions/ modules
- Use custom error codes (6000+)
- Document every public function with /// comments
- Use `msg!()` for debugging logs
- Emit events for every state change

---

### End of Skill Prompt

---

## Appendix B: agentURI Registration File Standard

```json
{
  "$schema": "https://sap.oobe.me/schema/registration-v1.json",
  "version": "1.0",
  "name": "string (required)",
  "description": "string (required)",
  "services": [
    {
      "type": "mcp | a2a | x402 | rest | graphql | grpc | websocket",
      "url": "string (required)",
      "version": "string (optional)",
      "openapi": "string (optional, for REST)",
      "capabilities": ["string (optional, service-specific capabilities)"]
    }
  ],
  "supportedTrust": ["x402", "tls-notary", "solana-attestation", "zkml"],
  "solana": {
    "programId": "string (SAP program ID)",
    "agentPDA": "string (agent PDA address)",
    "network": "mainnet-beta | devnet | testnet"
  },
  "x402": {
    "schemes": ["exact", "upto"],
    "tokens": ["SOL", "USDC"],
    "minPayment": "string (smallest unit)"
  },
  "did": "string (optional, DID identifier)",
  "contact": "string (optional, support URL or email)"
}
```

---

*This document is the complete specification for SAP v2. All code examples are Anchor 0.30+ compatible. The SDK TypeScript integration follows the existing synapse-client-sdk patterns.*
