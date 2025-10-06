/**
 * @file defi/utils.ts
 * @module SolanaDeFi
 * @author Keepeeto
 * @license MIT
 * @description Solana DeFi utilities: discovery, quoting and swap execution via Jupiter and Raydium.
 *              Clean, strongly-typed API with event emissions for observability. No Kamino deps.
 */

import { EventEmitter } from 'eventemitter3';
import type { Connection, PublicKey, VersionedTransaction, Transaction, Commitment } from '@solana/web3.js';
import type { SynapseClient } from '../client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RiskTolerance = 'low' | 'medium' | 'high';

// DeFi Event Mapping for type-safe EventEmitter
export interface DeFiEventMap {
  'defi:quote': { quote: QuoteResponse };
  'defi:swap:built': { tx: BuildSwapTxResult };
  'defi:swap:sent': { signature: string };
  'defi:tx:decoded': { txType: string };
  'defi:health': { ok: boolean; details: Record<string, any> };
  'defi:warning': { message: string };
  'defi:error': { error: Error; context?: Record<string, any> };
}

export enum JUPITER_VERSIONED_URL {
  v6 = 'https://quote-api.jup.ag/v6',
  v5 = 'https://quote-api.jup.ag/v5',
  v4 = 'https://quote-api.jup.ag/v4',
}

export interface DeFiConfig {
  client: SynapseClient;
  connection?: Connection; // optional override; falls back to client
  defaultCommitment?: Commitment;

  // Jupiter config
  jupiter?: {
    /** Jupiter Quote/Swap API base URL (override if self-hosting) */
    baseUrl?: JUPITER_VERSIONED_URL | string; // default: https://quote-api.jup.ag
    /** Percent fee in basis points for platforms (0-10000). Forwarded to Jupiter. */
    platformFeeBps?: number;
    /** Address to receive platform fees */
    platformFeeAccount?: string;
    /** If true, ask Jupiter to return a legacy tx instead of v0 */
    asLegacyTransaction?: boolean;
    /** Override paths for custom aggregator deployment */
    quotePath?: string;
    swapPath?: string;
  };

  // Raydium config (via REST aggregator). If you use the official SDK, you can
  // inject custom builders through `raydium.customSwapBuilder`.
  raydium?: {
    /** Raydium Aggregator base URL */
    baseUrl?: string; // e.g. https://api.raydium.io
    /** Optional: provide a custom builder using Raydium SDK v2 to create swap IX/Tx. */
    customSwapBuilder?: (params: RaydiumBuildSwapParams) => Promise<BuildSwapTxResult>;
    /** Override paths for custom aggregator deployment */
    quotePath?: string;
    swapPath?: string;
  };

  // Token registry for getTokenInfo (optional)
  tokenRegistry?: (mint: string) => Promise<TokenInfo>;

  // Logging level
  logLevel?: 'debug' | 'info' | 'error' | 'none';
}

// Internal normalized config type
interface NormalizedDeFiConfig {
  client: SynapseClient;
  connection?: Connection;
  defaultCommitment: Commitment;
  jupiter: {
    baseUrl: string;
    platformFeeBps: number;
    platformFeeAccount: string | undefined;
    asLegacyTransaction: boolean;
    quotePath: string;
    swapPath: string;
  };
  raydium: {
    baseUrl: string;
    customSwapBuilder?: (params: RaydiumBuildSwapParams) => Promise<BuildSwapTxResult>;
    quotePath: string;
    swapPath: string;
  };
  tokenRegistry?: (mint: string) => Promise<TokenInfo>;
  logLevel: 'debug' | 'info' | 'error' | 'none';
}

export interface TokenInfo {
  mint: string; // base58
  symbol?: string;
  name?: string;
  decimals?: number;
  verified?: boolean;
  priceUSD?: number;
}

export interface QuoteRequestCommon {
  inputMint: string; // base58
  outputMint: string; // base58
  /** Raw amount in base units (e.g., 1 SOL -> 1_000_000_000) */
  amount: string | number; // use string to avoid JS precision issues
  /** Slippage in basis points (e.g., 50 = 0.5%). Must be 0-10000 */
  slippageBps?: number;
  /** Prefer direct (single-hop) routes */
  onlyDirectRoutes?: boolean;
  /** If provided, routes may be tailored to this wallet (e.g., account state) */
  userPublicKey?: string; // base58
}

export interface JupiterQuoteRequest extends QuoteRequestCommon {
  /** Choose price/size tradeoff; defaults to SMART */
  swapMode?: 'ExactIn' | 'ExactOut';
  /** Restrict to DEXes */
  dexes?: string[]; // e.g., ["Orca", "Raydium", "Whirlpool"]
  /** Maximum accounts in the swap transaction (Jupiter param) */
  maxAccounts?: number;
}

export interface RaydiumQuoteRequest extends QuoteRequestCommon {
  /** program IDs allowlist/denylist, pool types, etc., depending on aggregator */
  allowAmmV4?: boolean;
  allowClmm?: boolean;
}

export interface QuoteResponse {
  inAmount: string; // base units
  outAmount: string; // base units
  priceImpactPct?: number;
  route?: any; // raw aggregator route object for debugging
  context?: Record<string, any>;
}

export interface BuildSwapTxResult {
  /** Base64-encoded serialized transaction to sign & send */
  txBase64: string;
  /** Optional human-readable route info */
  route?: any;
  /** Any aggregator-specific metadata */
  meta?: Record<string, any>;
}

export interface ExecuteSwapParams {
  /** Recipient/signer public key (payer). */
  payer: string; // base58
  /** Pre-built swap tx (base64) OR a builder callback */
  txBase64?: string;
  build?: () => Promise<BuildSwapTxResult>;
  /** If true, return the prepared Transaction/VersionedTransaction without sending. */
  dryRun?: boolean;
  /** Optional: max retries, skip preflight, etc. */
  sendOpts?: {
    skipPreflight?: boolean;
    maxRetries?: number;
    preflightCommitment?: Commitment;
  };
}

export interface RaydiumBuildSwapParams extends QuoteRequestCommon {
  payer: string; // base58
  /** Additional settings per Raydium aggregator/SDK */
  priorityFeeInMicroLamports?: number;
}

// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------

/**
 * Normalize base URL by removing trailing slashes and version paths
 */
function normalizeBaseUrl(url: string): string {
  if (!url) return '';
  return url.replace(/\/+$/, '').replace(/\/v\d+$/i, '');
}

/**
 * Validate slippage basis points (0-10000)
 */
function validateSlippageBps(slippage: number | undefined): number {
  if (slippage === undefined) return 50;
  if (slippage < 0 || slippage > 10000) {
    throw new Error(`Invalid slippageBps: ${slippage}. Must be between 0 and 10000.`);
  }
  return slippage;
}

/**
 * Validate Solana address (base58 format)
 */
async function validateSolanaAddress(address: string): Promise<boolean> {
  try {
    const { PublicKey } = await import('@solana/web3.js');
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cross-platform fetch wrapper
 * Supports modern browsers, Node.js 18+, and older Node.js with cross-fetch
 */
async function universalFetch(url: string, options?: RequestInit): Promise<Response> {
  // Modern browsers and Node.js 18+
  if (typeof fetch !== 'undefined') {
    return fetch(url, options);
  }
  
  // Node.js < 18 fallback - try to use cross-fetch if available
  // Note: Install with `npm install cross-fetch` if needed
  try {
    // Dynamic import without type checking (cross-fetch is optional)
    const crossFetch = await (Function('return import("cross-fetch")')() as Promise<any>);
    return (crossFetch.default || crossFetch)(url, options);
  } catch {
    throw new Error(
      'Fetch not available. Please upgrade to Node.js 18+ or install cross-fetch: npm install cross-fetch'
    );
  }
}

export class SynapseSolanaEngine extends EventEmitter {
  private client: SynapseClient;
  private cfg: NormalizedDeFiConfig;
  private requestIdCounter = 0;

  constructor(config: DeFiConfig) {
    super();
    
    // Normalize configuration with proper defaults
    this.cfg = {
      client: config.client,
      connection: config.connection ?? (config.client as any)?.connection,
      defaultCommitment: config.defaultCommitment ?? 'confirmed',
      jupiter: {
        baseUrl: normalizeBaseUrl(config.jupiter?.baseUrl ?? JUPITER_VERSIONED_URL.v6),
        platformFeeBps: config.jupiter?.platformFeeBps ?? 0,
        platformFeeAccount: config.jupiter?.platformFeeAccount,
        asLegacyTransaction: config.jupiter?.asLegacyTransaction ?? false,
        quotePath: config.jupiter?.quotePath ?? '/v6/quote',
        swapPath: config.jupiter?.swapPath ?? '/v6/swap',
      },
      raydium: {
        baseUrl: normalizeBaseUrl(config.raydium?.baseUrl ?? 'https://api.raydium.io'),
        customSwapBuilder: config.raydium?.customSwapBuilder,
        quotePath: config.raydium?.quotePath ?? '/v2/amm/quote',
        swapPath: config.raydium?.swapPath ?? '/v2/amm/swap',
      },
      tokenRegistry: config.tokenRegistry,
      logLevel: config.logLevel ?? 'info',
    };

    this.client = config.client;

    if (this.cfg.logLevel === 'debug') {
      this.log('debug', '🚀 Synapse DeFi Engine initialized', this.cfg);
    }
  }

  /**
   * Internal logging helper
   */
  private log(level: 'debug' | 'info' | 'error', message: string, data?: any) {
    const levels = { debug: 0, info: 1, error: 2, none: 3 };
    const cfgLevel = levels[this.cfg.logLevel];
    const msgLevel = levels[level];

    if (msgLevel >= cfgLevel) {
      const prefix = `[SynapseDeFi:${level.toUpperCase()}]`;
      if (data) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Generate unique request ID for tracing
   */
  private getRequestId(): string {
    return `defi-${Date.now()}-${++this.requestIdCounter}`;
  }

  // ---------------------------------------------------------------------------
  // Token helpers (lightweight; plug your own registries/oracles as needed)
  // ---------------------------------------------------------------------------

  /**
   * Get token info from registry or well-known tokens
   * @param mint - Token mint address (base58)
   * @returns TokenInfo object with symbol, decimals, etc.
   * @note Override via config.tokenRegistry for custom token data sources
   */
  async getTokenInfo(mint: string): Promise<TokenInfo> {
    // Use custom registry if provided
    if (this.cfg.tokenRegistry) {
      return this.cfg.tokenRegistry(mint);
    }

    // Lightweight fallback map; replace with your registry/oracle integration
    const wellKnown: Record<string, TokenInfo> = {
      So11111111111111111111111111111111111111112: {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        verified: true,
      },
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USDC',
        decimals: 6,
        verified: true,
      },
    };

    return wellKnown[mint] ?? { mint, verified: false };
  }

  // ---------------------------------------------------------------------------
  // Jupiter
  // ---------------------------------------------------------------------------

  /** Fetch a quote from Jupiter. */
  async jupiterQuote(params: JupiterQuoteRequest): Promise<QuoteResponse> {
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Jupiter quote request`, params);

    // Validate inputs
    const slippage = validateSlippageBps(params.slippageBps);
    
    if (params.userPublicKey && !(await validateSolanaAddress(params.userPublicKey))) {
      throw new Error(`Invalid userPublicKey: ${params.userPublicKey}`);
    }

    const base = this.cfg.jupiter.baseUrl;
    const search = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: String(params.amount),
      slippageBps: String(slippage),
      onlyDirectRoutes: String(params.onlyDirectRoutes ?? false),
      asLegacyTransaction: String(this.cfg.jupiter.asLegacyTransaction),
      swapMode: params.swapMode ?? 'ExactIn',
      maxAccounts: params.maxAccounts ? String(params.maxAccounts) : '',
      userPublicKey: params.userPublicKey ?? '',
    });

    if (params.dexes?.length) search.set('dexes', params.dexes.join(','));

    const url = `${base}${this.cfg.jupiter.quotePath}?${search.toString()}`;
    
    try {
      const res = await universalFetch(url);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '<no-body>');
        throw new Error(`Jupiter quote failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const data = (await res.json()) as any;

      // Jupiter v6 returns object { data: { inAmount, outAmount, otherRouteFields... } } or just direct fields
      const quote = (data?.data ?? data) as any;
      const out: QuoteResponse = {
        inAmount: String(quote.inAmount),
        outAmount: String(quote.outAmount),
        priceImpactPct: Number(quote.priceImpactPct ?? 0),
        route: quote,
        context: { aggregator: 'jupiter', requestId },
      };

      this.emit('defi:quote', { quote: out });
      this.log('info', `[${requestId}] Jupiter quote success`, { 
        inAmount: out.inAmount, 
        outAmount: out.outAmount,
        priceImpactPct: out.priceImpactPct,
      });
      
      return out;
    } catch (error) {
      this.log('error', `[${requestId}] Jupiter quote error`, error);
      this.emit('defi:error', { error: error as Error, context: { requestId, params } });
      throw error;
    }
  }

  /** Build a swap transaction via Jupiter Swap API. */
  async jupiterBuildSwapTx(args: {
    payer: string; // base58
    quoteResponse?: any; // pass-through from jupiterQuote if you wish to reuse
    quoteArgs?: JupiterQuoteRequest; // or recompute a fresh quote
    dynamicSlippageBps?: number; // overrides quote slippage
    wrapAndUnwrapSol?: boolean;
    restrictIntermediateTokens?: string[]; // mints allowlist for route legs
    asLegacyTransaction?: boolean;
  }): Promise<BuildSwapTxResult> {
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Jupiter build swap tx`, args);

    // Validate payer address
    if (!(await validateSolanaAddress(args.payer))) {
      throw new Error(`Invalid payer address: ${args.payer}`);
    }

    const base = this.cfg.jupiter.baseUrl;

    // Ensure we have a quote
    let route = args.quoteResponse;
    if (!route) {
      if (!args.quoteArgs) throw new Error('Provide either quoteResponse or quoteArgs');
      const fresh = await this.jupiterQuote(args.quoteArgs);
      route = fresh.route;
    }

    const body: any = {
      quoteResponse: route,
      userPublicKey: args.payer,
      wrapAndUnwrapSol: args.wrapAndUnwrapSol ?? true,
      dynamicSlippage: args.dynamicSlippageBps ? { slippageBps: validateSlippageBps(args.dynamicSlippageBps) } : undefined,
      asLegacyTransaction: args.asLegacyTransaction ?? this.cfg.jupiter.asLegacyTransaction,
    };

    if (this.cfg.jupiter.platformFeeBps && this.cfg.jupiter.platformFeeAccount) {
      body.feeAccount = this.cfg.jupiter.platformFeeAccount;
      body.platformFeeBps = this.cfg.jupiter.platformFeeBps;
    }
    if (args.restrictIntermediateTokens?.length) {
      body.restrictIntermediateTokens = args.restrictIntermediateTokens;
    }

    try {
      const res = await universalFetch(`${base}${this.cfg.jupiter.swapPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '<no-body>');
        throw new Error(`Jupiter swap build failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const data = (await res.json()) as any;
      const out: BuildSwapTxResult = {
        txBase64: data.swapTransaction ?? data.txBase64 ?? data?.data?.swapTransaction,
        route,
        meta: { aggregator: 'jupiter', requestId },
      };

      if (!out.txBase64) throw new Error('Jupiter did not return a swap transaction');
      
      this.emit('defi:swap:built', { tx: out });
      this.log('info', `[${requestId}] Jupiter swap tx built successfully`);
      
      return out;
    } catch (error) {
      this.log('error', `[${requestId}] Jupiter swap build error`, error);
      this.emit('defi:error', { error: error as Error, context: { requestId, args } });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Raydium
  // ---------------------------------------------------------------------------

  /**
   * Fetch a quote from Raydium Aggregator (REST). If you use the Raydium SDK,
   * prefer injecting a custom builder/quoting path via `raydium.customSwapBuilder`.
   */
  async raydiumQuote(params: RaydiumQuoteRequest): Promise<QuoteResponse> {
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Raydium quote request`, params);

    const base = this.cfg.raydium.baseUrl;
    if (!base) throw new Error('Raydium baseUrl not configured');

    // Validate inputs
    const slippage = validateSlippageBps(params.slippageBps);

    // NOTE: Public aggregators may have different query names; tweak as needed.
    const search = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: String(params.amount),
      slippageBps: String(slippage),
      onlyDirectRoutes: String(params.onlyDirectRoutes ?? false),
      userPublicKey: params.userPublicKey ?? '',
    });

    const url = `${base}${this.cfg.raydium.quotePath}?${search.toString()}`;
    
    try {
      const res = await universalFetch(url);
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '<no-body>');
        throw new Error(`Raydium quote failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const data = (await res.json()) as any;

      const route = (data?.data ?? data) as any;
      const out: QuoteResponse = {
        inAmount: String(route.inAmount ?? params.amount),
        outAmount: String(route.outAmount ?? route.amountOut ?? 0),
        priceImpactPct: Number(route.priceImpactPct ?? 0),
        route,
        context: { aggregator: 'raydium', requestId },
      };

      this.emit('defi:quote', { quote: out });
      this.log('info', `[${requestId}] Raydium quote success`, {
        inAmount: out.inAmount,
        outAmount: out.outAmount,
        priceImpactPct: out.priceImpactPct,
      });
      
      return out;
    } catch (error) {
      this.log('error', `[${requestId}] Raydium quote error`, error);
      this.emit('defi:error', { error: error as Error, context: { requestId, params } });
      throw error;
    }
  }

  /**
   * Build a Raydium swap transaction.
   * - Prefer `raydium.customSwapBuilder` to use the official SDK for precision.
   * - Fallback to REST aggregator transaction builder if available.
   */
  async raydiumBuildSwapTx(args: RaydiumBuildSwapParams & { route?: any }): Promise<BuildSwapTxResult> {
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Raydium build swap tx`, args);

    // Validate payer address
    if (!(await validateSolanaAddress(args.payer))) {
      throw new Error(`Invalid payer address: ${args.payer}`);
    }

    // If custom builder present (SDK), prefer it.
    if (this.cfg.raydium.customSwapBuilder) {
      try {
        const built = await this.cfg.raydium.customSwapBuilder(args);
        this.emit('defi:swap:built', { tx: built });
        this.log('info', `[${requestId}] Raydium swap tx built via custom builder`);
        return built;
      } catch (error) {
        this.log('error', `[${requestId}] Raydium custom builder error`, error);
        this.emit('defi:error', { error: error as Error, context: { requestId, args } });
        throw error;
      }
    }

    const base = this.cfg.raydium.baseUrl;
    if (!base) throw new Error('Raydium baseUrl not configured');

    const body: any = {
      inputMint: args.inputMint,
      outputMint: args.outputMint,
      amount: String(args.amount),
      slippageBps: String(validateSlippageBps(args.slippageBps)),
      userPublicKey: args.payer,
      onlyDirectRoutes: String(args.onlyDirectRoutes ?? false),
      priorityFeeInMicroLamports: args.priorityFeeInMicroLamports ?? undefined,
      route: args.route ?? undefined, // if you already fetched a route
    };

    try {
      const res = await universalFetch(`${base}${this.cfg.raydium.swapPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '<no-body>');
        throw new Error(`Raydium swap build failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const data = (await res.json()) as any;

      const out: BuildSwapTxResult = {
        txBase64: data.swapTransaction ?? data.txBase64 ?? data?.data?.swapTransaction,
        route: data.route ?? args.route,
        meta: { aggregator: 'raydium', requestId },
      };

      if (!out.txBase64) throw new Error('Raydium did not return a swap transaction');
      
      this.emit('defi:swap:built', { tx: out });
      this.log('info', `[${requestId}] Raydium swap tx built successfully`);
      
      return out;
    } catch (error) {
      this.log('error', `[${requestId}] Raydium swap build error`, error);
      this.emit('defi:error', { error: error as Error, context: { requestId, args } });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Execution helpers
  // ---------------------------------------------------------------------------

  /** 
   * Decode a base64 transaction into a Transaction or VersionedTransaction.
   * Supports both Node.js (Buffer) and browser (atob) environments.
   */
  async decodeBase64Tx(txBase64: string): Promise<Transaction | VersionedTransaction> {
    // Support Node and Browser
    let bytes: Uint8Array;
    
    if (typeof Buffer !== 'undefined') {
      // Node.js environment
      bytes = Buffer.from(txBase64, 'base64');
    } else if (typeof atob !== 'undefined') {
      // Browser environment
      const bin = atob(txBase64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      bytes = arr;
    } else {
      throw new Error('No base64 decoder available (Buffer or atob)');
    }

    // Try to import and deserialize as VersionedTransaction first, fallback to legacy Transaction
    const sol = await import('@solana/web3.js');
    
    if ((sol as any).VersionedTransaction?.deserialize) {
      try {
        return (sol as any).VersionedTransaction.deserialize(bytes);
      } catch {
        // Fall back to legacy transaction
        return sol.Transaction.from(bytes);
      }
    }
    
    // No VersionedTransaction available, use legacy
    return sol.Transaction.from(bytes);
  }

  /** 
   * Sign and (optionally) send a prepared base64 transaction.
   * @requires SynapseClient to implement signAndSend(tx, opts) or sendRawTransaction(raw, opts)
   */
  async executeSwap(params: ExecuteSwapParams): Promise<{ signature?: string; tx?: Transaction | VersionedTransaction }>{
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Execute swap`, params);

    let built: BuildSwapTxResult | undefined;

    if (params.txBase64) {
      built = { txBase64: params.txBase64 };
    } else if (params.build) {
      built = await params.build();
    } else {
      throw new Error('executeSwap requires txBase64 or a build() callback');
    }

    const tx = await this.decodeBase64Tx(built.txBase64);
    const txType = tx.constructor.name;
    this.emit('defi:tx:decoded', { txType });
    this.log('info', `[${requestId}] Transaction decoded: ${txType}`);

    if (params.dryRun) {
      this.log('info', `[${requestId}] Dry run mode - returning unsigned tx`);
      return { tx };
    }

    // Delegate to SynapseClient if it exposes a signer/sender
    const conn: Connection = (this.cfg.connection as any) ?? (this.client as any).connection;

    // Check if client has signAndSend method
    if (typeof (this.client as any).signAndSend === 'function') {
      try {
        const sig = await (this.client as any).signAndSend(tx, params.sendOpts);
        this.emit('defi:swap:sent', { signature: sig });
        this.log('info', `[${requestId}] Swap sent via signAndSend: ${sig}`);
        return { signature: sig };
      } catch (error) {
        this.log('error', `[${requestId}] signAndSend failed`, error);
        this.emit('defi:error', { error: error as Error, context: { requestId, method: 'signAndSend' } });
        throw error;
      }
    }

    // Check if client has sendRawTransaction method
    if (typeof (this.client as any).sendRawTransaction === 'function') {
      try {
        // Serialize the transaction properly based on type
        let raw: Buffer | Uint8Array;
        
        if ((tx as any).serialize) {
          raw = (tx as any).serialize();
        } else if ((tx as any).serializeMessage) {
          // VersionedTransaction uses serializeMessage
          raw = (tx as any).serializeMessage();
        } else {
          // Fallback to original base64 if serialization not available
          raw = typeof Buffer !== 'undefined' 
            ? Buffer.from(built.txBase64, 'base64')
            : Uint8Array.from(atob(built.txBase64), c => c.charCodeAt(0));
        }
        
        const sig = await (this.client as any).sendRawTransaction(raw, params.sendOpts);
        this.emit('defi:swap:sent', { signature: sig });
        this.log('info', `[${requestId}] Swap sent via sendRawTransaction: ${sig}`);
        return { signature: sig };
      } catch (error) {
        this.log('error', `[${requestId}] sendRawTransaction failed`, error);
        this.emit('defi:error', { error: error as Error, context: { requestId, method: 'sendRawTransaction' } });
        throw error;
      }
    }

    // If we reach here, we can't send. Return the tx for the caller to handle.
    const warning = 'SynapseClient does not implement signAndSend or sendRawTransaction. Returning unsigned transaction.';
    this.emit('defi:warning', { message: warning });
    this.log('error', `[${requestId}] ${warning}`);
    
    return { tx };
  }

  // Convenience wrappers -----------------------------------------------------

  async swapWithJupiter(all: {
    payer: string;
    quoteArgs: JupiterQuoteRequest;
    dynamicSlippageBps?: number;
    restrictIntermediateTokens?: string[];
    asLegacyTransaction?: boolean;
    dryRun?: boolean;
    sendOpts?: ExecuteSwapParams['sendOpts'];
  }) {
    const built = await this.jupiterBuildSwapTx({
      payer: all.payer,
      quoteArgs: all.quoteArgs,
      dynamicSlippageBps: all.dynamicSlippageBps,
      restrictIntermediateTokens: all.restrictIntermediateTokens,
      asLegacyTransaction: all.asLegacyTransaction,
    });

    return this.executeSwap({
      payer: all.payer,
      txBase64: built.txBase64,
      dryRun: all.dryRun,
      sendOpts: all.sendOpts,
    });
  }

  async swapWithRaydium(all: RaydiumBuildSwapParams & {
    route?: any;
    dryRun?: boolean;
    sendOpts?: ExecuteSwapParams['sendOpts'];
  }) {
    const built = await this.raydiumBuildSwapTx(all);
    return this.executeSwap({ payer: all.payer, txBase64: built.txBase64, dryRun: all.dryRun, sendOpts: all.sendOpts });
  }

  // Health check -------------------------------------------------------------

  async healthCheck() {
    const requestId = this.getRequestId();
    this.log('debug', `[${requestId}] Health check`);

    const ok = Boolean(this.cfg.jupiter.baseUrl) && Boolean(this.cfg.raydium.baseUrl);
    const details = {
      jupiterBase: this.cfg.jupiter.baseUrl,
      jupiterPaths: { quote: this.cfg.jupiter.quotePath, swap: this.cfg.jupiter.swapPath },
      raydiumBase: this.cfg.raydium.baseUrl,
      raydiumPaths: { quote: this.cfg.raydium.quotePath, swap: this.cfg.raydium.swapPath },
      hasCustomBuilder: Boolean(this.cfg.raydium.customSwapBuilder),
      hasTokenRegistry: Boolean(this.cfg.tokenRegistry),
      logLevel: this.cfg.logLevel,
    };
    
    this.emit('defi:health', { ok, details });
    this.log('info', `[${requestId}] Health check: ${ok ? 'OK' : 'FAILED'}`, details);
    
    return { ok, details };
  }
}

// -----------------------------------------------------------------------------
// Event Names (for convenience & type safety)
// -----------------------------------------------------------------------------

export type DeFiEvents = keyof DeFiEventMap;

// -----------------------------------------------------------------------------
// Usage notes
// -----------------------------------------------------------------------------
/**
 * Example:
 *
 * const engine = new SolanaDeFiEngine({ client: synapseClient, jupiter: { platformFeeBps: 50, platformFeeAccount: FEE_ACCT } });
 *
 * // Quote & swap with Jupiter
 * const res = await engine.swapWithJupiter({
 *   payer: wallet.publicKey.toBase58(),
 *   quoteArgs: {
 *     inputMint: SOL_MINT,
 *     outputMint: USDC_MINT,
 *     amount: 1_000_000_000n.toString(),
 *     slippageBps: 50,
 *     userPublicKey: wallet.publicKey.toBase58(),
 *   },
 *   dynamicSlippageBps: 50,
 * });
 *
 * // Raydium (via REST or custom SDK builder)
 * const rRes = await engine.swapWithRaydium({
 *   payer: wallet.publicKey.toBase58(),
 *   inputMint: SOL_MINT,
 *   outputMint: USDC_MINT,
 *   amount: 1_000_000_000n.toString(),
 *   slippageBps: 50,
 * });
 */
