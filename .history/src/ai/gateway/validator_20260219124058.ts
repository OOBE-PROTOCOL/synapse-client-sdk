/**
 * ResponseValidator — Cryptographic attestation of RPC responses.
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

export class ResponseValidator {
  private readonly attesterId: AgentId;
  private readonly signer: ((message: Uint8Array) => Promise<Uint8Array>) | null;

  /** In-memory attestation log (bounded ring buffer). */
  private readonly attestationLog: ResponseAttestation[] = [];
  private readonly maxLogSize: number;

  constructor(config: GatewayConfig, maxLogSize = 10_000) {
    this.attesterId = config.identity.id;
    this.signer = config.signer ?? null;
    this.maxLogSize = maxLogSize;
  }

  /* ── Attestation creation ────────────────────────────────── */

  /**
   * Create an attestation for a completed RPC call.
   *
   * @param sessionId — session the call belongs to
   * @param method — RPC method name
   * @param params — request params (will be hashed)
   * @param response — response body (will be hashed)
   * @param slot — the Solana slot at the time of response
   * @returns the signed ResponseAttestation
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
   * Wrap an RPC result with optional attestation.
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
   * Verify the integrity of an attestation.
   * Checks that requestHash and responseHash match the provided data.
   * Signature verification requires the attester's public key.
   *
   * @param attestation — the attestation to verify
   * @param params — original request params
   * @param response — original response body
   * @returns verification result
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
   * Verify a signature against an attestation.
   * The verifier function should be provided by the caller (e.g. using @solana/web3.js).
   *
   * @param attestation — the attestation to verify
   * @param verifier — async function that verifies (message, signature, pubkey) → boolean
   * @param attesterPubkey — the expected attester's public key
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

  /** Get all attestations for a session */
  getSessionAttestations(sessionId: string): ResponseAttestation[] {
    return this.attestationLog.filter(a => a.sessionId === sessionId);
  }

  /** Get attestations by method */
  getMethodAttestations(method: string, limit = 100): ResponseAttestation[] {
    return this.attestationLog.filter(a => a.method === method).slice(-limit);
  }

  /** Get total attestation count */
  get totalAttestations(): number {
    return this.attestationLog.length;
  }

  /** Export the full attestation log (for off-chain archival). */
  exportLog(): ResponseAttestation[] {
    return [...this.attestationLog];
  }
}
