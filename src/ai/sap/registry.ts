/**
 * @module ai/sap/registry
 * @description SAP — Canonical capability registry for the agent sub-network.
 *
 * Defines the **standard capability catalog** — every protocol/method pair
 * that SAP-registered agents can advertise. This gives the network a shared
 * vocabulary so discovery queries are reliable and unambiguous.
 *
 * Capabilities follow the `protocol:method` convention (e.g. `jupiter:swap`).
 * Each entry carries metadata: human description, category, expected I/O
 * schema hints, and minimum version.
 *
 * @example
 * ```ts
 * import { SAPCapabilityRegistry } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const reg = SAPCapabilityRegistry.default();
 *
 * // List everything Jupiter supports
 * const jupiterCaps = reg.byProtocol('jupiter');
 *
 * // Check if a capability ID is known
 * const valid = reg.has('jupiter:swap');          // true
 * const unknown = reg.has('made_up:blah');        // false
 *
 * // All capabilities in the 'defi' category
 * const defi = reg.byCategory('defi');
 *
 * // Full catalog
 * const all = reg.list();
 * ```
 *
 * @since 1.4.0
 */

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Category of a registered capability.
 * @since 1.4.0
 */
export type CapabilityCategory =
  | 'defi'
  | 'nft'
  | 'data'
  | 'ai'
  | 'governance'
  | 'payments'
  | 'identity'
  | 'infrastructure'
  | 'oracle'
  | 'social'
  | 'custom';

/**
 * @description Schema hint describing expected input/output for a capability.
 * Not a full JSON-Schema — just enough for agents to negotiate compatibility.
 * @since 1.4.0
 */
export interface CapabilityIOSchema {
  /** Short key-type pairs, e.g. `{ inputMint: 'string', amount: 'bigint' }` */
  fields: Record<string, 'string' | 'number' | 'bigint' | 'boolean' | 'bytes' | 'object'>;
}

/**
 * @description Full metadata for a registered capability.
 * @since 1.4.0
 */
export interface CapabilityDefinition {
  /** Canonical ID (`protocol:method`). */
  id: string;
  /** Protocol namespace (e.g. `jupiter`). */
  protocol: string;
  /** Human-readable description. */
  description: string;
  /** Functional category. */
  category: CapabilityCategory;
  /** Minimum version that supports this capability. */
  minVersion?: string;
  /** Expected input schema. */
  input?: CapabilityIOSchema;
  /** Expected output schema. */
  output?: CapabilityIOSchema;
  /** Related capability IDs (often used together). */
  relatedCapabilities?: string[];
  /** Whether this is a critical/core capability. */
  isCritical?: boolean;
  /** Deprecation notice (if any). */
  deprecated?: string;
}

/* ═══════════════════════════════════════════════════════════════
 *  Default Catalog
 * ═══════════════════════════════════════════════════════════════ */

const DEFAULT_CAPABILITIES: CapabilityDefinition[] = [
  // ── Jupiter ──
  {
    id: 'jupiter:swap',
    protocol: 'jupiter',
    description: 'Execute a token swap via Jupiter aggregator',
    category: 'defi',
    isCritical: true,
    input:  { fields: { inputMint: 'string', outputMint: 'string', amount: 'bigint', slippageBps: 'number' } },
    output: { fields: { txSignature: 'string', outputAmount: 'bigint' } },
    relatedCapabilities: ['jupiter:getQuote', 'jupiter:getRoutes'],
  },
  {
    id: 'jupiter:getQuote',
    protocol: 'jupiter',
    description: 'Get a price quote for a token swap',
    category: 'defi',
    input:  { fields: { inputMint: 'string', outputMint: 'string', amount: 'bigint' } },
    output: { fields: { outputAmount: 'bigint', priceImpact: 'number', routes: 'object' } },
    relatedCapabilities: ['jupiter:swap'],
  },
  {
    id: 'jupiter:getRoutes',
    protocol: 'jupiter',
    description: 'Get available swap routes between two tokens',
    category: 'defi',
    input:  { fields: { inputMint: 'string', outputMint: 'string' } },
    output: { fields: { routes: 'object' } },
  },
  {
    id: 'jupiter:limitOrder',
    protocol: 'jupiter',
    description: 'Place a limit order via Jupiter',
    category: 'defi',
    input:  { fields: { inputMint: 'string', outputMint: 'string', amount: 'bigint', price: 'bigint' } },
    output: { fields: { orderId: 'string', txSignature: 'string' } },
  },
  {
    id: 'jupiter:dcaCreate',
    protocol: 'jupiter',
    description: 'Create a DCA (dollar cost average) order',
    category: 'defi',
    input:  { fields: { inputMint: 'string', outputMint: 'string', totalAmount: 'bigint', intervalSeconds: 'number', numOrders: 'number' } },
    output: { fields: { dcaId: 'string', txSignature: 'string' } },
  },

  // ── Raydium ──
  {
    id: 'raydium:swap',
    protocol: 'raydium',
    description: 'Execute a swap via Raydium AMM',
    category: 'defi',
    input:  { fields: { inputMint: 'string', outputMint: 'string', amount: 'bigint', slippageBps: 'number' } },
    output: { fields: { txSignature: 'string', outputAmount: 'bigint' } },
  },
  {
    id: 'raydium:getPoolInfo',
    protocol: 'raydium',
    description: 'Get pool info (TVL, volume, APR) from Raydium',
    category: 'data',
    input:  { fields: { poolAddress: 'string' } },
    output: { fields: { tvl: 'bigint', volume24h: 'bigint', apr: 'number' } },
  },
  {
    id: 'raydium:addLiquidity',
    protocol: 'raydium',
    description: 'Add liquidity to a Raydium pool',
    category: 'defi',
    input:  { fields: { poolAddress: 'string', amountA: 'bigint', amountB: 'bigint' } },
    output: { fields: { txSignature: 'string', lpTokenAmount: 'bigint' } },
  },

  // ── Marinade ──
  {
    id: 'marinade:stake',
    protocol: 'marinade',
    description: 'Stake SOL via Marinade liquid staking',
    category: 'defi',
    isCritical: true,
    input:  { fields: { amount: 'bigint' } },
    output: { fields: { txSignature: 'string', mSOLReceived: 'bigint' } },
  },
  {
    id: 'marinade:unstake',
    protocol: 'marinade',
    description: 'Unstake mSOL to SOL',
    category: 'defi',
    input:  { fields: { amount: 'bigint' } },
    output: { fields: { txSignature: 'string', solReceived: 'bigint' } },
  },

  // ── Drift ──
  {
    id: 'drift:perp',
    protocol: 'drift',
    description: 'Open a perpetual futures position on Drift',
    category: 'defi',
    input:  { fields: { market: 'string', direction: 'string', size: 'bigint', leverage: 'number' } },
    output: { fields: { positionId: 'string', txSignature: 'string' } },
  },
  {
    id: 'drift:getPosition',
    protocol: 'drift',
    description: 'Get current perpetual positions for a wallet',
    category: 'data',
    input:  { fields: { wallet: 'string' } },
    output: { fields: { positions: 'object' } },
  },

  // ── Solend / Lending ──
  {
    id: 'solend:lend',
    protocol: 'solend',
    description: 'Supply tokens to Solend lending pool',
    category: 'defi',
    input:  { fields: { mint: 'string', amount: 'bigint' } },
    output: { fields: { txSignature: 'string', cTokenReceived: 'bigint' } },
  },
  {
    id: 'solend:borrow',
    protocol: 'solend',
    description: 'Borrow tokens from Solend',
    category: 'defi',
    input:  { fields: { mint: 'string', amount: 'bigint' } },
    output: { fields: { txSignature: 'string' } },
  },

  // ── Metaplex / NFT ──
  {
    id: 'metaplex:mint',
    protocol: 'metaplex',
    description: 'Mint a new NFT via Metaplex',
    category: 'nft',
    input:  { fields: { name: 'string', uri: 'string', sellerFeeBasisPoints: 'number' } },
    output: { fields: { mint: 'string', txSignature: 'string' } },
  },
  {
    id: 'metaplex:getNFTMetadata',
    protocol: 'metaplex',
    description: 'Fetch NFT metadata from on-chain',
    category: 'data',
    input:  { fields: { mint: 'string' } },
    output: { fields: { name: 'string', uri: 'string', creators: 'object' } },
  },

  // ── AI / Analytics ──
  {
    id: 'ai:sentimentAnalysis',
    protocol: 'ai',
    description: 'Analyze market sentiment from social/on-chain signals',
    category: 'ai',
    input:  { fields: { token: 'string', sources: 'object' } },
    output: { fields: { score: 'number', confidence: 'number', signals: 'object' } },
  },
  {
    id: 'ai:riskScore',
    protocol: 'ai',
    description: 'Compute a risk score for a wallet or protocol',
    category: 'ai',
    input:  { fields: { target: 'string', targetType: 'string' } },
    output: { fields: { score: 'number', factors: 'object' } },
  },
  {
    id: 'ai:pricePredictor',
    protocol: 'ai',
    description: 'Generate short-term price predictions for a token',
    category: 'ai',
    input:  { fields: { mint: 'string', horizonMinutes: 'number' } },
    output: { fields: { predictions: 'object', confidence: 'number' } },
  },
  {
    id: 'ai:summarize',
    protocol: 'ai',
    description: 'Summarize on-chain activity for a wallet or protocol',
    category: 'ai',
    input:  { fields: { target: 'string', period: 'string' } },
    output: { fields: { summary: 'string', metrics: 'object' } },
  },

  // ── Oracle ──
  {
    id: 'pyth:getPrice',
    protocol: 'pyth',
    description: 'Get real-time price feed from Pyth Network',
    category: 'oracle',
    isCritical: true,
    input:  { fields: { feedId: 'string' } },
    output: { fields: { price: 'bigint', confidence: 'bigint', timestamp: 'number' } },
  },
  {
    id: 'switchboard:readFeed',
    protocol: 'switchboard',
    description: 'Read a data feed from Switchboard oracle',
    category: 'oracle',
    input:  { fields: { feedAddress: 'string' } },
    output: { fields: { value: 'bigint', timestamp: 'number' } },
  },

  // ── Payments ──
  {
    id: 'payments:transfer',
    protocol: 'payments',
    description: 'Transfer SOL or SPL tokens to a recipient',
    category: 'payments',
    input:  { fields: { to: 'string', amount: 'bigint', mint: 'string' } },
    output: { fields: { txSignature: 'string' } },
  },
  {
    id: 'payments:streamCreate',
    protocol: 'payments',
    description: 'Create a token streaming payment (e.g. via Streamflow)',
    category: 'payments',
    input:  { fields: { recipient: 'string', amount: 'bigint', durationSeconds: 'number', mint: 'string' } },
    output: { fields: { streamId: 'string', txSignature: 'string' } },
  },

  // ── Governance ──
  {
    id: 'realms:vote',
    protocol: 'realms',
    description: 'Cast a vote in a Realms DAO proposal',
    category: 'governance',
    input:  { fields: { proposalAddress: 'string', vote: 'boolean' } },
    output: { fields: { txSignature: 'string' } },
  },
  {
    id: 'realms:createProposal',
    protocol: 'realms',
    description: 'Create a new governance proposal',
    category: 'governance',
    input:  { fields: { realm: 'string', title: 'string', description: 'string', instructions: 'object' } },
    output: { fields: { proposalAddress: 'string', txSignature: 'string' } },
  },

  // ── Identity ──
  {
    id: 'sns:resolveDomain',
    protocol: 'sns',
    description: 'Resolve a .sol domain to a wallet address',
    category: 'identity',
    input:  { fields: { domain: 'string' } },
    output: { fields: { wallet: 'string' } },
  },

  // ── Infrastructure ──
  {
    id: 'infra:rpcProxy',
    protocol: 'infra',
    description: 'Proxy an RPC call with load balancing and caching',
    category: 'infrastructure',
    input:  { fields: { method: 'string', params: 'object' } },
    output: { fields: { result: 'object' } },
  },
  {
    id: 'infra:webhookRelay',
    protocol: 'infra',
    description: 'Relay webhook notifications for on-chain events',
    category: 'infrastructure',
    input:  { fields: { eventType: 'string', targetUrl: 'string', filter: 'object' } },
    output: { fields: { subscriptionId: 'string' } },
  },
];

/* ═══════════════════════════════════════════════════════════════
 *  SAPCapabilityRegistry
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Canonical catalog of capabilities for the SAP agent network.
 *
 * Provides lookup / filtering by ID, protocol, category, and supports
 * custom registrations so third-party protocols can extend the catalog
 * at runtime.
 *
 * @since 1.4.0
 */
export class SAPCapabilityRegistry {
  private readonly capabilities: Map<string, CapabilityDefinition> = new Map();

  /**
   * @param {CapabilityDefinition[]} [initial] - Seed capabilities
   */
  constructor(initial?: CapabilityDefinition[]) {
    if (initial) {
      for (const cap of initial) this.capabilities.set(cap.id, cap);
    }
  }

  /* ── Factory ── */

  /**
   * @description Create a registry pre-loaded with all default (known) capabilities.
   * @returns {SAPCapabilityRegistry}
   * @since 1.4.0
   */
  static default(): SAPCapabilityRegistry {
    return new SAPCapabilityRegistry(DEFAULT_CAPABILITIES);
  }

  /**
   * @description Create an empty registry (for testing or fully custom setups).
   * @returns {SAPCapabilityRegistry}
   * @since 1.4.0
   */
  static empty(): SAPCapabilityRegistry {
    return new SAPCapabilityRegistry();
  }

  /* ── Mutation ── */

  /**
   * @description Register a new capability (or overwrite an existing one).
   * @param {CapabilityDefinition} def - Capability definition
   * @since 1.4.0
   */
  register(def: CapabilityDefinition): void {
    if (!def.id.includes(':')) {
      throw new Error(`Capability ID must follow "protocol:method" format, got "${def.id}"`);
    }
    this.capabilities.set(def.id, def);
  }

  /**
   * @description Register multiple capabilities at once.
   * @param {CapabilityDefinition[]} defs - Capability definitions
   * @since 1.4.0
   */
  registerMany(defs: CapabilityDefinition[]): void {
    for (const def of defs) this.register(def);
  }

  /**
   * @description Remove a capability from the registry.
   * @param {string} id - Capability ID
   * @returns {boolean} `true` if the capability was found and removed
   * @since 1.4.0
   */
  remove(id: string): boolean {
    return this.capabilities.delete(id);
  }

  /* ── Lookup ── */

  /**
   * @description Check if a capability ID is registered.
   * @param {string} id - Capability ID (e.g. `"jupiter:swap"`)
   * @returns {boolean}
   * @since 1.4.0
   */
  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  /**
   * @description Get a single capability by ID.
   * @param {string} id - Capability ID
   * @returns {CapabilityDefinition | undefined}
   * @since 1.4.0
   */
  get(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  /**
   * @description List all registered capabilities.
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  list(): CapabilityDefinition[] {
    return [...this.capabilities.values()];
  }

  /**
   * @description Get all registered capability IDs.
   * @returns {string[]}
   * @since 1.4.0
   */
  ids(): string[] {
    return [...this.capabilities.keys()];
  }

  /**
   * @description Total number of registered capabilities.
   * @returns {number}
   * @since 1.4.0
   */
  get size(): number {
    return this.capabilities.size;
  }

  /* ── Filtering ── */

  /**
   * @description Get all capabilities for a given protocol.
   * @param {string} protocol - Protocol name (e.g. `"jupiter"`)
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  byProtocol(protocol: string): CapabilityDefinition[] {
    return this.list().filter(c => c.protocol === protocol);
  }

  /**
   * @description Get all capabilities in a given category.
   * @param {CapabilityCategory} category
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  byCategory(category: CapabilityCategory): CapabilityDefinition[] {
    return this.list().filter(c => c.category === category);
  }

  /**
   * @description Get all unique protocol names.
   * @returns {string[]}
   * @since 1.4.0
   */
  protocols(): string[] {
    return [...new Set(this.list().map(c => c.protocol))];
  }

  /**
   * @description Get all unique categories in use.
   * @returns {CapabilityCategory[]}
   * @since 1.4.0
   */
  categories(): CapabilityCategory[] {
    return [...new Set(this.list().map(c => c.category))];
  }

  /**
   * @description Search capabilities by free-text query (matches id, description, protocol).
   * @param {string} query - Search text (case-insensitive)
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  search(query: string): CapabilityDefinition[] {
    const q = query.toLowerCase();
    return this.list().filter(c =>
      c.id.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.protocol.toLowerCase().includes(q),
    );
  }

  /**
   * @description Get all critical (core) capabilities.
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  critical(): CapabilityDefinition[] {
    return this.list().filter(c => c.isCritical);
  }

  /**
   * @description Get deprecated capabilities.
   * @returns {CapabilityDefinition[]}
   * @since 1.4.0
   */
  deprecated(): CapabilityDefinition[] {
    return this.list().filter(c => c.deprecated);
  }

  /**
   * @description Validate a list of capability IDs against the registry.
   * Returns unknown IDs (not registered) — useful during agent registration.
   * @param {string[]} ids - Capability IDs to check
   * @returns {{ known: string[]; unknown: string[]; deprecated: string[] }}
   * @since 1.4.0
   */
  validate(ids: string[]): { known: string[]; unknown: string[]; deprecated: string[] } {
    const known: string[] = [];
    const unknown: string[] = [];
    const deprecated: string[] = [];

    for (const id of ids) {
      const def = this.capabilities.get(id);
      if (!def) {
        unknown.push(id);
      } else {
        known.push(id);
        if (def.deprecated) deprecated.push(id);
      }
    }

    return { known, unknown, deprecated };
  }

  /**
   * @description Get the dependency graph: which capabilities are frequently used together.
   * @param {string} id - Root capability ID
   * @returns {string[]} Related capability IDs (transitive, max 2 levels)
   * @since 1.4.0
   */
  relatedGraph(id: string): string[] {
    const seen = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);

      const def = this.capabilities.get(current);
      if (def?.relatedCapabilities) {
        for (const rel of def.relatedCapabilities) {
          if (!seen.has(rel)) queue.push(rel);
        }
      }
    }

    seen.delete(id); // remove the root
    return [...seen];
  }
}
