/**
 * @module ai/sap/validator
 * @description SAP — Deep validation engine for agent registration & updates.
 *
 * Goes far beyond the basic name/description length checks: validates
 * capability ID format, pricing consistency, wallet pubkey format,
 * URL structure, duplicate detection, and cross-field coherence.
 *
 * Can operate in **strict** mode (throws on first error) or **lenient**
 * mode (collects all issues and returns a report).
 *
 * @example
 * ```ts
 * import { SAPValidator } from '@oobe-protocol-labs/synapse-client-sdk/ai/sap';
 *
 * const validator = new SAPValidator({ strict: false });
 * const report = validator.validateRegistration({
 *   walletPubkey: 'ABC...',
 *   name: 'My Agent',
 *   description: 'Tools',
 *   capabilities: [{ id: 'bad_format' }],  // ← will flag this
 *   pricing: [{ tierId: '', pricePerCall: 0n, rateLimit: -1, ... }],
 * });
 *
 * if (!report.valid) {
 *   console.error(report.errors);   // detailed error list
 *   console.warn(report.warnings);  // non-fatal suggestions
 * }
 * ```
 *
 * @since 1.4.0
 */

import type {
  RegisterAgentParams,
  UpdateAgentParams,
  AgentCapability,
  AgentPricingOnChain,
} from './types';
import { SAPCapabilityRegistry } from './registry';

/* ═══════════════════════════════════════════════════════════════
 *  Types
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Severity of a validation finding.
 * @since 1.4.0
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * @description A single validation finding.
 * @since 1.4.0
 */
export interface ValidationIssue {
  /** Severity level. */
  severity: ValidationSeverity;
  /** Machine-readable error code. */
  code: string;
  /** Human-readable message. */
  message: string;
  /** The field path that triggered the issue (e.g. `"capabilities[2].id"`). */
  field?: string;
  /** The offending value. */
  value?: unknown;
}

/**
 * @description Complete validation report.
 * @since 1.4.0
 */
export interface ValidationReport {
  /** `true` if zero errors (warnings/info are OK). */
  valid: boolean;
  /** Error-severity issues (block registration). */
  errors: ValidationIssue[];
  /** Warning-severity issues (allow but flag). */
  warnings: ValidationIssue[];
  /** Informational notes. */
  info: ValidationIssue[];
  /** Total time spent validating (ms). */
  durationMs: number;
}

/**
 * @description Error thrown in strict mode when validation fails.
 * @since 1.4.0
 */
export class SAPValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly issues: ValidationIssue[],
  ) {
    super(message);
    this.name = 'SAPValidationError';
  }
}

/**
 * @description Validator configuration.
 * @since 1.4.0
 */
export interface SAPValidatorConfig {
  /** Throw on first error (default: `false` → collect all). */
  strict?: boolean;
  /** Capability registry for validating capability IDs. If omitted, uses default. */
  registry?: SAPCapabilityRegistry;
  /** Allow unrecognised capability IDs (default: `true` — warn but don't error). */
  allowUnknownCapabilities?: boolean;
  /** Maximum number of capabilities per agent (default: 50). */
  maxCapabilities?: number;
  /** Maximum number of pricing tiers per agent (default: 10). */
  maxPricingTiers?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Regex Patterns
 * ═══════════════════════════════════════════════════════════════ */

/** `protocol:method` — letters, digits, underscores, hyphens on each side. */
const CAPABILITY_ID_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z][a-zA-Z0-9_-]*$/;

/** Basic Base58 character set check (does NOT verify length). */
const BASE58_REGEX = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

/** Solana pubkey is 32–44 base58 characters. */
const SOLANA_PUBKEY_REGEX = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{32,44}$/;

/** URL starting with https:// */
const HTTPS_URL_REGEX = /^https:\/\/.+/;

/* ═══════════════════════════════════════════════════════════════
 *  SAPValidator
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Deep validation engine for SAP agent data.
 *
 * Checks performed:
 * - **Wallet pubkey**: Base58, 32–44 chars, valid character set
 * - **Name**: Non-empty, ≤ 64 UTF-8 bytes, no control characters
 * - **Description**: Non-empty, ≤ 512 UTF-8 bytes
 * - **Capabilities**: `protocol:method` format, no duplicates, max count,
 *   registry check (known vs unknown)
 * - **Pricing**: Non-empty tierId, positive pricePerCall, rateLimit > 0,
 *   maxCallsPerSession ≥ 0, valid tokenType, no duplicate tiers,
 *   SPL requires tokenMint
 * - **x402 Endpoint**: Must be HTTPS, valid URL structure
 * - **Cross-field**: At least one capability for each pricing tier's
 *   implied protocol (warning)
 *
 * @since 1.4.0
 */
export class SAPValidator {
  private readonly config: Required<SAPValidatorConfig>;

  constructor(config?: SAPValidatorConfig) {
    this.config = {
      strict: config?.strict ?? false,
      registry: config?.registry ?? SAPCapabilityRegistry.default(),
      allowUnknownCapabilities: config?.allowUnknownCapabilities ?? true,
      maxCapabilities: config?.maxCapabilities ?? 50,
      maxPricingTiers: config?.maxPricingTiers ?? 10,
    };
  }

  /* ── Public API ── */

  /**
   * @description Validate a full registration payload.
   * @param {RegisterAgentParams} params - Registration parameters
   * @returns {ValidationReport}
   * @throws {SAPValidationError} In strict mode, on first error
   * @since 1.4.0
   */
  validateRegistration(params: RegisterAgentParams): ValidationReport {
    const start = performance.now();
    const issues: ValidationIssue[] = [];

    // Wallet
    this.validateWalletPubkey(params.walletPubkey, issues);

    // Name & Description
    this.validateName(params.name, issues);
    this.validateDescription(params.description, issues);

    // Capabilities
    this.validateCapabilities(params.capabilities ?? [], issues);

    // Pricing
    this.validatePricing(params.pricing ?? [], issues);

    // x402 Endpoint
    if (params.x402Endpoint !== undefined) {
      this.validateX402Endpoint(params.x402Endpoint, issues);
    } else {
      issues.push({
        severity: 'warning',
        code: 'MISSING_X402_ENDPOINT',
        message: 'No x402 endpoint specified — agent will not be callable via x402 protocol',
        field: 'x402Endpoint',
      });
    }

    // Cross-field checks
    this.validateCrossField(params, issues);

    return this.buildReport(issues, start);
  }

  /**
   * @description Validate an update payload.
   * Only validates fields that are present (non-undefined).
   * @param {UpdateAgentParams} params - Update parameters
   * @returns {ValidationReport}
   * @throws {SAPValidationError} In strict mode, on first error
   * @since 1.4.0
   */
  validateUpdate(params: UpdateAgentParams): ValidationReport {
    const start = performance.now();
    const issues: ValidationIssue[] = [];

    this.validateWalletPubkey(params.walletPubkey, issues);

    if (params.name !== undefined) this.validateName(params.name, issues);
    if (params.description !== undefined) this.validateDescription(params.description, issues);
    if (params.capabilities !== undefined) this.validateCapabilities(params.capabilities, issues);
    if (params.pricing !== undefined) this.validatePricing(params.pricing, issues);
    if (params.x402Endpoint !== undefined) this.validateX402Endpoint(params.x402Endpoint, issues);

    return this.buildReport(issues, start);
  }

  /**
   * @description Validate a single capability entry.
   * @param {AgentCapability} cap - Capability to validate
   * @returns {ValidationReport}
   * @since 1.4.0
   */
  validateCapability(cap: AgentCapability): ValidationReport {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    this.checkCapability(cap, 0, issues);
    return this.buildReport(issues, start);
  }

  /**
   * @description Validate a single pricing tier.
   * @param {AgentPricingOnChain} tier - Pricing tier to validate
   * @returns {ValidationReport}
   * @since 1.4.0
   */
  validatePricingTier(tier: AgentPricingOnChain): ValidationReport {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    this.checkPricingTier(tier, 0, issues);
    return this.buildReport(issues, start);
  }

  /* ── Internal: Wallet ── */

  private validateWalletPubkey(pubkey: string, issues: ValidationIssue[]): void {
    if (!pubkey || typeof pubkey !== 'string') {
      issues.push({
        severity: 'error',
        code: 'INVALID_WALLET_EMPTY',
        message: 'Wallet public key is required',
        field: 'walletPubkey',
        value: pubkey,
      });
      return;
    }

    if (!SOLANA_PUBKEY_REGEX.test(pubkey)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_WALLET_FORMAT',
        message: `Wallet public key must be 32-44 Base58 characters, got ${pubkey.length} chars`,
        field: 'walletPubkey',
        value: pubkey,
      });
    }

    if (!BASE58_REGEX.test(pubkey)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_WALLET_CHARSET',
        message: 'Wallet public key contains invalid Base58 characters',
        field: 'walletPubkey',
        value: pubkey,
      });
    }
  }

  /* ── Internal: Name ── */

  private validateName(name: string, issues: ValidationIssue[]): void {
    if (!name || typeof name !== 'string') {
      issues.push({
        severity: 'error',
        code: 'INVALID_NAME_EMPTY',
        message: 'Agent name is required and must be a non-empty string',
        field: 'name',
        value: name,
      });
      return;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      issues.push({
        severity: 'error',
        code: 'INVALID_NAME_WHITESPACE',
        message: 'Agent name cannot be only whitespace',
        field: 'name',
        value: name,
      });
    }

    const bytes = new TextEncoder().encode(name);
    if (bytes.length > 64) {
      issues.push({
        severity: 'error',
        code: 'NAME_TOO_LONG',
        message: `Agent name exceeds 64 UTF-8 bytes (got ${bytes.length})`,
        field: 'name',
        value: name,
      });
    }

    if (bytes.length < 3) {
      issues.push({
        severity: 'warning',
        code: 'NAME_TOO_SHORT',
        message: 'Agent name is very short — consider a more descriptive name',
        field: 'name',
        value: name,
      });
    }

    // Control characters
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(name)) {
      issues.push({
        severity: 'error',
        code: 'NAME_CONTROL_CHARS',
        message: 'Agent name contains control characters',
        field: 'name',
        value: name,
      });
    }
  }

  /* ── Internal: Description ── */

  private validateDescription(desc: string, issues: ValidationIssue[]): void {
    if (!desc || typeof desc !== 'string') {
      issues.push({
        severity: 'error',
        code: 'INVALID_DESC_EMPTY',
        message: 'Agent description is required',
        field: 'description',
        value: desc,
      });
      return;
    }

    const bytes = new TextEncoder().encode(desc);
    if (bytes.length > 512) {
      issues.push({
        severity: 'error',
        code: 'DESC_TOO_LONG',
        message: `Description exceeds 512 UTF-8 bytes (got ${bytes.length})`,
        field: 'description',
        value: desc,
      });
    }

    if (bytes.length < 10) {
      issues.push({
        severity: 'warning',
        code: 'DESC_TOO_SHORT',
        message: 'Description is very short — add more detail for better discoverability',
        field: 'description',
        value: desc,
      });
    }
  }

  /* ── Internal: Capabilities ── */

  private validateCapabilities(caps: AgentCapability[], issues: ValidationIssue[]): void {
    if (caps.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'NO_CAPABILITIES',
        message: 'Agent has no capabilities — it will not appear in capability searches',
        field: 'capabilities',
      });
      return;
    }

    if (caps.length > this.config.maxCapabilities) {
      issues.push({
        severity: 'error',
        code: 'TOO_MANY_CAPABILITIES',
        message: `Too many capabilities: ${caps.length} exceeds max of ${this.config.maxCapabilities}`,
        field: 'capabilities',
      });
    }

    // Duplicate check
    const seenIds = new Set<string>();
    for (let i = 0; i < caps.length; i++) {
      const cap = caps[i];
      if (seenIds.has(cap.id)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_CAPABILITY',
          message: `Duplicate capability ID "${cap.id}"`,
          field: `capabilities[${i}].id`,
          value: cap.id,
        });
      }
      seenIds.add(cap.id);
      this.checkCapability(cap, i, issues);
    }

    // Registry validation
    const idsToCheck = caps.map(c => c.id);
    const { unknown, deprecated } = this.config.registry.validate(idsToCheck);

    if (unknown.length > 0) {
      const severity: ValidationSeverity = this.config.allowUnknownCapabilities ? 'warning' : 'error';
      for (const id of unknown) {
        issues.push({
          severity,
          code: 'UNKNOWN_CAPABILITY',
          message: `Capability "${id}" is not in the standard registry${this.config.allowUnknownCapabilities ? ' (allowed but may reduce discoverability)' : ''}`,
          field: 'capabilities',
          value: id,
        });
      }
    }

    if (deprecated.length > 0) {
      for (const id of deprecated) {
        const def = this.config.registry.get(id);
        issues.push({
          severity: 'warning',
          code: 'DEPRECATED_CAPABILITY',
          message: `Capability "${id}" is deprecated: ${def?.deprecated}`,
          field: 'capabilities',
          value: id,
        });
      }
    }
  }

  private checkCapability(cap: AgentCapability, index: number, issues: ValidationIssue[]): void {
    if (!cap.id || typeof cap.id !== 'string') {
      issues.push({
        severity: 'error',
        code: 'CAPABILITY_ID_EMPTY',
        message: `Capability at index ${index} has no ID`,
        field: `capabilities[${index}].id`,
      });
      return;
    }

    if (!CAPABILITY_ID_REGEX.test(cap.id)) {
      issues.push({
        severity: 'error',
        code: 'CAPABILITY_ID_FORMAT',
        message: `Capability ID "${cap.id}" must follow "protocol:method" format (letters, digits, underscores, hyphens)`,
        field: `capabilities[${index}].id`,
        value: cap.id,
      });
    }
  }

  /* ── Internal: Pricing ── */

  private validatePricing(tiers: AgentPricingOnChain[], issues: ValidationIssue[]): void {
    if (tiers.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'NO_PRICING',
        message: 'Agent has no pricing tiers — it cannot be used as a paid service',
        field: 'pricing',
      });
      return;
    }

    if (tiers.length > this.config.maxPricingTiers) {
      issues.push({
        severity: 'error',
        code: 'TOO_MANY_PRICING_TIERS',
        message: `Too many pricing tiers: ${tiers.length} exceeds max of ${this.config.maxPricingTiers}`,
        field: 'pricing',
      });
    }

    // Duplicate tier IDs
    const seenTiers = new Set<string>();
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (seenTiers.has(tier.tierId)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_PRICING_TIER',
          message: `Duplicate pricing tier ID "${tier.tierId}"`,
          field: `pricing[${i}].tierId`,
          value: tier.tierId,
        });
      }
      seenTiers.add(tier.tierId);
      this.checkPricingTier(tier, i, issues);
    }
  }

  private checkPricingTier(tier: AgentPricingOnChain, index: number, issues: ValidationIssue[]): void {
    // Tier ID
    if (!tier.tierId || typeof tier.tierId !== 'string' || tier.tierId.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'PRICING_TIER_ID_EMPTY',
        message: `Pricing tier at index ${index} has no tier ID`,
        field: `pricing[${index}].tierId`,
      });
    }

    // Price
    if (typeof tier.pricePerCall !== 'bigint') {
      issues.push({
        severity: 'error',
        code: 'PRICING_INVALID_TYPE',
        message: `pricePerCall must be a bigint, got ${typeof tier.pricePerCall}`,
        field: `pricing[${index}].pricePerCall`,
        value: tier.pricePerCall,
      });
    } else if (tier.pricePerCall < 0n) {
      issues.push({
        severity: 'error',
        code: 'PRICING_NEGATIVE',
        message: `pricePerCall cannot be negative`,
        field: `pricing[${index}].pricePerCall`,
        value: tier.pricePerCall,
      });
    } else if (tier.pricePerCall === 0n) {
      issues.push({
        severity: 'info',
        code: 'PRICING_FREE',
        message: `Pricing tier "${tier.tierId}" is free (pricePerCall = 0)`,
        field: `pricing[${index}].pricePerCall`,
      });
    }

    // Rate limit
    if (typeof tier.rateLimit !== 'number' || !Number.isFinite(tier.rateLimit)) {
      issues.push({
        severity: 'error',
        code: 'PRICING_RATE_LIMIT_INVALID',
        message: 'rateLimit must be a finite number',
        field: `pricing[${index}].rateLimit`,
        value: tier.rateLimit,
      });
    } else if (tier.rateLimit <= 0) {
      issues.push({
        severity: 'error',
        code: 'PRICING_RATE_LIMIT_ZERO',
        message: 'rateLimit must be > 0',
        field: `pricing[${index}].rateLimit`,
        value: tier.rateLimit,
      });
    }

    // Max calls
    if (typeof tier.maxCallsPerSession !== 'number' || !Number.isFinite(tier.maxCallsPerSession)) {
      issues.push({
        severity: 'error',
        code: 'PRICING_MAX_CALLS_INVALID',
        message: 'maxCallsPerSession must be a finite number',
        field: `pricing[${index}].maxCallsPerSession`,
        value: tier.maxCallsPerSession,
      });
    } else if (tier.maxCallsPerSession < 0) {
      issues.push({
        severity: 'error',
        code: 'PRICING_MAX_CALLS_NEGATIVE',
        message: 'maxCallsPerSession cannot be negative (use 0 for unlimited)',
        field: `pricing[${index}].maxCallsPerSession`,
        value: tier.maxCallsPerSession,
      });
    }

    // Token type
    const validTokenTypes = ['SOL', 'USDC', 'SPL'];
    if (!validTokenTypes.includes(tier.tokenType)) {
      issues.push({
        severity: 'error',
        code: 'PRICING_INVALID_TOKEN_TYPE',
        message: `tokenType must be one of ${validTokenTypes.join(', ')}, got "${tier.tokenType}"`,
        field: `pricing[${index}].tokenType`,
        value: tier.tokenType,
      });
    }

    // SPL requires tokenMint
    if (tier.tokenType === 'SPL' && (!tier.tokenMint || !SOLANA_PUBKEY_REGEX.test(tier.tokenMint))) {
      issues.push({
        severity: 'error',
        code: 'PRICING_SPL_NO_MINT',
        message: 'SPL token type requires a valid tokenMint address',
        field: `pricing[${index}].tokenMint`,
        value: tier.tokenMint,
      });
    }

    // Warn if SOL/USDC has unnecessary tokenMint
    if (tier.tokenType !== 'SPL' && tier.tokenMint) {
      issues.push({
        severity: 'warning',
        code: 'PRICING_UNNECESSARY_MINT',
        message: `tokenMint is set but tokenType is "${tier.tokenType}" — tokenMint is only used for SPL`,
        field: `pricing[${index}].tokenMint`,
        value: tier.tokenMint,
      });
    }
  }

  /* ── Internal: x402 Endpoint ── */

  private validateX402Endpoint(endpoint: string, issues: ValidationIssue[]): void {
    if (!endpoint || typeof endpoint !== 'string') {
      issues.push({
        severity: 'error',
        code: 'X402_ENDPOINT_EMPTY',
        message: 'x402 endpoint cannot be empty when specified',
        field: 'x402Endpoint',
      });
      return;
    }

    if (!HTTPS_URL_REGEX.test(endpoint)) {
      issues.push({
        severity: 'error',
        code: 'X402_NOT_HTTPS',
        message: 'x402 endpoint must use HTTPS',
        field: 'x402Endpoint',
        value: endpoint,
      });
    }

    // Check URL validity
    try {
      new URL(endpoint);
    } catch {
      issues.push({
        severity: 'error',
        code: 'X402_INVALID_URL',
        message: `x402 endpoint is not a valid URL: "${endpoint}"`,
        field: 'x402Endpoint',
        value: endpoint,
      });
    }

    // Recommend .well-known/x402 path convention
    if (!endpoint.includes('.well-known/x402')) {
      issues.push({
        severity: 'info',
        code: 'X402_PATH_CONVENTION',
        message: 'Consider using the /.well-known/x402 path convention for your x402 endpoint',
        field: 'x402Endpoint',
        value: endpoint,
      });
    }
  }

  /* ── Internal: Cross-field ── */

  private validateCrossField(params: RegisterAgentParams, issues: ValidationIssue[]): void {
    const caps = params.capabilities ?? [];
    const tiers = params.pricing ?? [];

    // Agent with pricing but no capabilities is suspicious
    if (tiers.length > 0 && caps.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'PRICING_WITHOUT_CAPABILITIES',
        message: 'Agent has pricing tiers but no capabilities — what is being priced?',
        field: 'capabilities',
      });
    }

    // Agent with capabilities but no pricing (might be intentional for free agents)
    if (caps.length > 0 && tiers.length === 0) {
      issues.push({
        severity: 'info',
        code: 'CAPABILITIES_WITHOUT_PRICING',
        message: 'Agent has capabilities but no pricing tiers — agent services will be free',
        field: 'pricing',
      });
    }

    // Check that all capability protocols are consistent
    const protocols = new Set(caps.map(c => c.id.split(':')[0]));
    if (protocols.size > 5) {
      issues.push({
        severity: 'warning',
        code: 'TOO_MANY_PROTOCOLS',
        message: `Agent spans ${protocols.size} protocols — consider splitting into specialized agents for better discoverability`,
        field: 'capabilities',
      });
    }
  }

  /* ── Internal: Report building ── */

  private buildReport(issues: ValidationIssue[], startTime: number): ValidationReport {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const info = issues.filter(i => i.severity === 'info');
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    const report: ValidationReport = {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      durationMs,
    };

    // Strict mode: throw on first error
    if (this.config.strict && errors.length > 0) {
      throw new SAPValidationError(
        errors[0].message,
        errors[0].code,
        issues,
      );
    }

    return report;
  }
}
