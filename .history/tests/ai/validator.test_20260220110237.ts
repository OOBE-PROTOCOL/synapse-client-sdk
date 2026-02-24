/**
 * Tests for ResponseValidator — Proof-of-Computation attestation.
 *
 * Verifies:
 * - Attestation creation with hashing
 * - Attestation with signer produces non-empty signature
 * - Attestation without signer produces empty signature
 * - wrapResult includes attestation when shouldAttest=true
 * - wrapResult omits attestation when shouldAttest=false
 * - verifyIntegrity validates hash correctness
 * - verifyIntegrity detects tampered data
 * - Attestation log (ring buffer) works
 * - Session-filtered attestation queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseValidator } from '../../src/ai/gateway/validator';
import { makeGatewayConfig, makeMockSigner } from './_helpers';

describe('ResponseValidator', () => {
  let validator: ResponseValidator;
  let validatorWithSigner: ResponseValidator;

  beforeEach(() => {
    validator = new ResponseValidator(makeGatewayConfig());
    validatorWithSigner = new ResponseValidator(
      makeGatewayConfig({ signer: makeMockSigner() }),
    );
  });

  /* ── Attestation creation ───────────────────────────── */

  describe('Attestation creation', () => {
    it('creates an attestation with correct fields', async () => {
      const att = await validator.attest(
        'session-1', 'getBalance', { pubkey: 'abc' }, { value: 1000 }, 42,
      );

      expect(att.sessionId).toBe('session-1');
      expect(att.method).toBe('getBalance');
      expect(att.requestHash).toBeTruthy();
      expect(att.responseHash).toBeTruthy();
      expect(att.slot).toBe(42);
      expect(att.attesterId).toBeTruthy();
      expect(att.timestamp).toBeGreaterThan(0);
    });

    it('produces deterministic hashes for same input', async () => {
      const att1 = await validator.attest('s1', 'getBalance', { pubkey: 'abc' }, { value: 1000 }, 42);
      const att2 = await validator.attest('s1', 'getBalance', { pubkey: 'abc' }, { value: 1000 }, 42);

      expect(att1.requestHash).toBe(att2.requestHash);
      expect(att1.responseHash).toBe(att2.responseHash);
    });

    it('produces different hashes for different inputs', async () => {
      const att1 = await validator.attest('s1', 'getBalance', { pubkey: 'abc' }, { value: 1000 }, 42);
      const att2 = await validator.attest('s1', 'getBalance', { pubkey: 'xyz' }, { value: 2000 }, 42);

      expect(att1.requestHash).not.toBe(att2.requestHash);
      expect(att1.responseHash).not.toBe(att2.responseHash);
    });

    it('unsigned attestation has empty signature', async () => {
      const att = await validator.attest('s1', 'getBalance', {}, {}, 0);
      expect(att.signature).toBe('');
    });

    it('signed attestation has non-empty base64 signature', async () => {
      const att = await validatorWithSigner.attest('s1', 'getBalance', {}, {}, 0);
      expect(att.signature).toBeTruthy();
      expect(att.signature.length).toBeGreaterThan(0);
      // Verify it's valid base64
      expect(() => Buffer.from(att.signature, 'base64')).not.toThrow();
    });
  });

  /* ── wrapResult ─────────────────────────────────────── */

  describe('wrapResult', () => {
    it('includes attestation when shouldAttest=true', async () => {
      const result = await validator.wrapResult(
        { value: 999 }, 'session-1', 'getSlot', {}, 42, 15, 1, true,
      );

      expect(result.data).toEqual({ value: 999 });
      expect(result.latencyMs).toBe(15);
      expect(result.callIndex).toBe(1);
      expect(result.attestation).toBeDefined();
      expect(result.attestation!.method).toBe('getSlot');
    });

    it('omits attestation when shouldAttest=false', async () => {
      const result = await validator.wrapResult(
        { value: 999 }, 'session-1', 'getSlot', {}, 42, 15, 1, false,
      );

      expect(result.data).toEqual({ value: 999 });
      expect(result.attestation).toBeUndefined();
    });

    it('preserves complex data objects', async () => {
      const complexData = {
        context: { slot: 42 },
        value: { lamports: 1_000_000, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false },
      };

      const result = await validator.wrapResult(
        complexData, 's1', 'getAccountInfo', { pubkey: 'x' }, 42, 20, 1, true,
      );

      expect(result.data).toEqual(complexData);
    });
  });

  /* ── Integrity verification ─────────────────────────── */

  describe('verifyIntegrity (static)', () => {
    it('returns valid=true for matching data', async () => {
      const params = { pubkey: 'abc123' };
      const response = { value: 42 };
      const att = await validator.attest('s1', 'getBalance', params, response, 100);

      const verification = ResponseValidator.verifyIntegrity(att, params, response);
      expect(verification.valid).toBe(true);
      expect(verification.requestMatch).toBe(true);
      expect(verification.responseMatch).toBe(true);
    });

    it('detects tampered request', async () => {
      const params = { pubkey: 'abc123' };
      const response = { value: 42 };
      const att = await validator.attest('s1', 'getBalance', params, response, 100);

      const verification = ResponseValidator.verifyIntegrity(
        att,
        { pubkey: 'TAMPERED' }, // Different params
        response,
      );

      expect(verification.valid).toBe(false);
      expect(verification.requestMatch).toBe(false);
      expect(verification.responseMatch).toBe(true);
    });

    it('detects tampered response', async () => {
      const params = { pubkey: 'abc123' };
      const response = { value: 42 };
      const att = await validator.attest('s1', 'getBalance', params, response, 100);

      const verification = ResponseValidator.verifyIntegrity(
        att,
        params,
        { value: 9999 }, // Different response
      );

      expect(verification.valid).toBe(false);
      expect(verification.requestMatch).toBe(true);
      expect(verification.responseMatch).toBe(false);
    });
  });

  /* ── Signature verification ─────────────────────────── */

  describe('verifySignature (static)', () => {
    it('calls the verifier function with correct args', async () => {
      const att = await validatorWithSigner.attest('s1', 'getBalance', {}, {}, 42);

      let calledWith: { message: Uint8Array; signature: Uint8Array; pubkey: string } | null = null;
      const mockVerifier = async (msg: Uint8Array, sig: Uint8Array, pk: string) => {
        calledWith = { message: msg, signature: sig, pubkey: pk };
        return true;
      };

      const valid = await ResponseValidator.verifySignature(att, mockVerifier, 'pubkey123');
      expect(valid).toBe(true);
      expect(calledWith).not.toBeNull();
      expect(calledWith!.pubkey).toBe('pubkey123');
    });

    it('returns false for unsigned attestation', async () => {
      const att = await validator.attest('s1', 'getBalance', {}, {}, 42);

      const result = await ResponseValidator.verifySignature(
        att,
        async () => true, // verifier that always passes
        'pubkey',
      );
      expect(result).toBe(false); // no signature → always false
    });
  });

  /* ── Attestation log ────────────────────────────────── */

  describe('Attestation log', () => {
    it('stores attestations in the log', async () => {
      await validator.attest('s1', 'getBalance', {}, {}, 0);
      await validator.attest('s1', 'getSlot', {}, {}, 0);
      await validator.attest('s2', 'getVersion', {}, {}, 0);

      expect(validator.totalAttestations).toBe(3);
    });

    it('filters by session', async () => {
      await validator.attest('session-A', 'getBalance', {}, {}, 0);
      await validator.attest('session-A', 'getSlot', {}, {}, 0);
      await validator.attest('session-B', 'getVersion', {}, {}, 0);

      const sessionA = validator.getSessionAttestations('session-A');
      expect(sessionA.length).toBe(2);
      expect(sessionA.every(a => a.sessionId === 'session-A')).toBe(true);
    });

    it('filters by method', async () => {
      await validator.attest('s1', 'getBalance', {}, {}, 0);
      await validator.attest('s2', 'getBalance', {}, {}, 0);
      await validator.attest('s3', 'getSlot', {}, {}, 0);

      const balanceAtts = validator.getMethodAttestations('getBalance');
      expect(balanceAtts.length).toBe(2);
    });

    it('exports full log', async () => {
      for (let i = 0; i < 5; i++) {
        await validator.attest(`s${i}`, 'getBalance', {}, {}, 0);
      }

      const log = validator.exportLog();
      expect(log.length).toBe(5);
      // Exported log is a copy
      log.pop();
      expect(validator.totalAttestations).toBe(5);
    });

    it('ring buffer evicts old entries', async () => {
      // Create validator with small max log
      const smallValidator = new ResponseValidator(makeGatewayConfig(), 3);

      await smallValidator.attest('s1', 'm1', {}, {}, 0);
      await smallValidator.attest('s2', 'm2', {}, {}, 0);
      await smallValidator.attest('s3', 'm3', {}, {}, 0);
      await smallValidator.attest('s4', 'm4', {}, {}, 0);

      expect(smallValidator.totalAttestations).toBe(3); // Oldest evicted
      const log = smallValidator.exportLog();
      expect(log[0].method).toBe('m2'); // m1 was evicted
    });
  });
});
