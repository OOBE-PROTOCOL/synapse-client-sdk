/**
 * @module ai/gateway/validator
 * @description ResponseValidator — Cryptographic attestation of RPC responses.
 *
 * Provides "Proof of Computation":
 * - Hashes request params + response body
 * - Signs the attestation with the gateway's Ed25519 key
 * - Allows third-party verification without re-executing the RPC call
 *
 * This is the foundation for:
 * - Selling validated/certified RPC responses
 * - Agent trust scoring based on attestation correctness
 * - On-chain dispute resolution (post attestation as evidence)
 *
 * @since 1.0.0
 */

import { createHash } from 'crypto';
import type { AgentId, ResponseAttestation, AttestedResult, GatewayConfig } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Hashing helpers
 * ═══════════════════════════════════════════════════════════════ */

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

/* ═══════════════════════════════════════════════════════════════
 *  ResponseValidator
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Cryptographic response attestation engine for Proof of Computation.
 *
 * Creates signed attestations of RPC responses that can be verified by buyers
 * without re-executing the call. Maintains a bounded ring buffer of attestation history.
 *
 * @example
 * ```ts
 * const validator = new ResponseValidator(config);
 * const attestation = await validator.attest(sessionId, 'getBalance', params, response, slot);
 * const integrity = ResponseValidator.verifyIntegrity(attestation, params, response);
 * ```
 *
 * @since 1.0.0
 */
export class ResponseValidator {
  private readonly attesterId: AgentId;
  private readonly signer: ((message: Uint8Array) => Promise<Uint8Array>) | null;

  /** In-memory attestation log (bounded ring buffer). */
  private readonly attestationLog: ResponseAttestation[] = [];
  private readonly maxLogSize: number;

  /**
   * @description Create a new ResponseValidator.
   * @param {GatewayConfig} config - Gateway config providing identity and signer
   * @param {number} [maxLogSize=10000] - Maximum attestation log size (ring buffer)
   * @since 1.0.0
   */
  constructor(config: GatewayConfig, maxLogSize = 10_000) {
    this.attesterId = config.identity.id;
    this.signer = config.signer ?? null;
    this.maxLogSize = maxLogSize;
  }

  /* ── Attestation creation ────────────────────────────────── */

  /**
   * @description Create an attestation for a completed RPC call.
   *
   * @param {string} sessionId - Session the call belongs to
   * @param {string} method - RPC method name
   * @param {unknown} params - Request params (will be hashed)
   * @param {unknown} response - Response body (will be hashed)
   * @param {number} slot - The Solana slot at the time of response
   * @returns {Promise<ResponseAttestation>} The signed ResponseAttestation
   * @since 1.0.0
   */
  async attest(
    sessionId: string,
    method: string,
    params: unknown,
    response: unknown,
    slot: number,
  ): Promise<ResponseAttestation> {
    const requestHash = sha256(canonicalize(params));
    const responseHash = sha256(canonicalize(response));

    // Build the message to sign: deterministic concatenation
    const message = `${method}|${requestHash}|${responseHash}|${slot}`;
    const messageBytes = new TextEncoder().encode(message);

    // Sign if signer is available, otherwise empty signature (unsigned attestation)
    let signature = '';
    if (this.signer) {
      const sig = await this.signer(messageBytes);
      signature = Buffer.from(sig).toString('base64');
    }

    const attestation: ResponseAttestation = {
      sessionId,
      method,
      requestHash,
      responseHash,
      slot,
      attesterId: this.attesterId,
      signature,
      timestamp: Date.now(),
    };

    // Push to ring buffer
    if (this.attestationLog.length >= this.maxLogSize) {
      this.attestationLog.shift();
    }
    this.attestationLog.push(attestation);

    return attestation;
  }

  /**
   * @description Wrap an RPC result with optional attestation.
   * @template T The type of the RPC result data
   * @param {T} data - The RPC result data
   * @param {string} sessionId - The session ID
   * @param {string} method - RPC method name
   * @param {unknown} params - Request params
   * @param {number} slot - Solana slot
   * @param {number} latencyMs - Call latency in milliseconds
   * @param {number} callIndex - Sequential call number
   * @param {boolean} shouldAttest - Whether to produce an attestation
   * @returns {Promise<AttestedResult<T>>} The wrapped result with optional attestation
   * @since 1.0.0
   */
  async wrapResult<T>(
    data: T,
    sessionId: string,
    method: string,
    params: unknown,
    slot: number,
    latencyMs: number,
    callIndex: number,
    shouldAttest: boolean,
  ): Promise<AttestedResult<T>> {
    const result: AttestedResult<T> = {
      data,
      latencyMs,
      callIndex,
    };

    if (shouldAttest) {
      result.attestation = await this.attest(sessionId, method, params, data, slot);
    }

    return result;
  }

  /* ── Verification (static — can be called by buyers) ─────── */

  /**
   * @description Verify the integrity of an attestation.
   * Checks that requestHash and responseHash match the provided data.
   * Signature verification requires the attester's public key.
   *
   * @param {ResponseAttestation} attestation - The attestation to verify
   * @param {unknown} params - Original request params
   * @param {unknown} response - Original response body
   * @returns {{ valid: boolean; requestMatch: boolean; responseMatch: boolean }} Verification result
   * @since 1.0.0
   */
  static verifyIntegrity(
    attestation: ResponseAttestation,
    params: unknown,
    response: unknown,
  ): { valid: boolean; requestMatch: boolean; responseMatch: boolean } {
    const requestHash = sha256(canonicalize(params));
    const responseHash = sha256(canonicalize(response));

    return {
      valid: requestHash === attestation.requestHash && responseHash === attestation.responseHash,
      requestMatch: requestHash === attestation.requestHash,
      responseMatch: responseHash === attestation.responseHash,
    };
  }

  /**
   * @description Verify a signature against an attestation.
   * The verifier function should be provided by the caller (e.g. using @solana/web3.js).
   *
   * @param {ResponseAttestation} attestation - The attestation to verify
   * @param {Function} verifier - Async function that verifies (message, signature, pubkey) → boolean
   * @param {string} attesterPubkey - The expected attester's public key
   * @returns {Promise<boolean>} Whether the signature is valid
   * @since 1.0.0
   */
  static async verifySignature(
    attestation: ResponseAttestation,
    verifier: (message: Uint8Array, signature: Uint8Array, pubkey: string) => Promise<boolean>,
    attesterPubkey: string,
  ): Promise<boolean> {
    if (!attestation.signature) return false;

    const message = `${attestation.method}|${attestation.requestHash}|${attestation.responseHash}|${attestation.slot}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(attestation.signature, 'base64');

    return verifier(messageBytes, signatureBytes, attesterPubkey);
  }

  /* ── Attestation log queries ─────────────────────────────── */

  /**
   * @description Get all attestations for a session.
   * @param {string} sessionId - The session ID to query
   * @returns {ResponseAttestation[]} Array of attestations for the session
   * @since 1.0.0
   */
  getSessionAttestations(sessionId: string): ResponseAttestation[] {
    return this.attestationLog.filter(a => a.sessionId === sessionId);
  }

  /**
   * @description Get attestations by method name.
   * @param {string} method - The RPC method name to filter by
   * @param {number} [limit=100] - Maximum number of results
   * @returns {ResponseAttestation[]} Array of matching attestations
   * @since 1.0.0
   */
  getMethodAttestations(method: string, limit = 100): ResponseAttestation[] {
    return this.attestationLog.filter(a => a.method === method).slice(-limit);
  }

  /**
   * @description Get total attestation count.
   * @returns {number} Total number of attestations in the log
   * @since 1.0.0
   */
  get totalAttestations(): number {
    return this.attestationLog.length;
  }

  /**
   * @description Export the full attestation log (for off-chain archival).
   * @returns {ResponseAttestation[]} Copy of the full attestation log
   * @since 1.0.0
   */
  exportLog(): ResponseAttestation[] {
    return [...this.attestationLog];
  }
}
