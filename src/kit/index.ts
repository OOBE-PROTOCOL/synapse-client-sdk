/**
 * @solana/kit bridge — native Solana types, signers, and RPC for the Synapse SDK.
 *
 * This module re-exports curated types and functions from `@solana/kit` (the
 * official Anza Solana TypeScript SDK) and provides bridge utilities to convert
 * between Synapse branded types and Kit native types.
 *
 * @module kit
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { toKitAddress, generateKeyPairSigner } from '@oobe-protocol-labs/synapse-client-sdk/kit';
 *
 * const client = new SynapseClient({ endpoint: 'https://rpc.synapse.com' });
 *
 * // Bridge Synapse Pubkey -> Kit Address
 * const addr = toKitAddress(Pubkey('So11111111111111111111111111111111111111112'));
 *
 * // Use Kit's native RPC (fully typed 53 methods)
 * const kitRpc = client.kitRpc;
 * const balance = await kitRpc.getBalance(addr).send();
 *
 * // Generate a signer
 * const signer = await generateKeyPairSigner();
 * ```
 */

// ─────────────────────────────────────────────────────────────────
// Re-exports from @solana/kit — curated for SDK consumers
// ─────────────────────────────────────────────────────────────────

// ── Addresses ──────────────────────────────────────────────────
export type { Address } from '@solana/kit';
export {
  address,
  isAddress,
  assertIsAddress,
  getAddressFromPublicKey,
  getAddressEncoder,
  getAddressDecoder,
  getAddressCodec,
  getAddressComparator,
  getProgramDerivedAddress,
  createAddressWithSeed,
} from '@solana/kit';

// ── Keys & Signatures ─────────────────────────────────────────
export type { SignatureBytes } from '@solana/kit';
export {
  generateKeyPair,
  createKeyPairFromBytes,
  createKeyPairFromPrivateKeyBytes,
  signBytes,
  verifySignature,
  signature as kitSignature,
  isSignature as isKitSignature,
  assertIsSignature as assertIsKitSignature,
} from '@solana/kit';

// ── Signers ────────────────────────────────────────────────────
export type {
  KeyPairSigner,
  TransactionSigner,
  MessageSigner,
  TransactionPartialSigner,
  MessagePartialSigner,
  NoopSigner,
  TransactionModifyingSigner,
  TransactionSendingSigner,
} from '@solana/kit';
export {
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createSignerFromKeyPair,
  createNoopSigner,
  isKeyPairSigner,
  assertIsKeyPairSigner,
  isTransactionSigner,
  assertIsTransactionSigner,
  addSignersToTransactionMessage,
} from '@solana/kit';

// ── RPC ────────────────────────────────────────────────────────
export type {
  Rpc,
  RpcTransport,
  SolanaRpcApi,
  SolanaRpcApiDevnet,
  SolanaRpcApiMainnet,
  SolanaRpcApiTestnet,
} from '@solana/kit';
export {
  createSolanaRpc,
  createSolanaRpcFromTransport,
  createSolanaRpcApi,
  createDefaultRpcTransport,
  createRpc,
  DEFAULT_RPC_CONFIG,
} from '@solana/kit';

// ── RPC Subscriptions ──────────────────────────────────────────
export type {
  RpcSubscriptions,
  SolanaRpcSubscriptionsApi,
} from '@solana/kit';
export {
  createSolanaRpcSubscriptions,
  createSolanaRpcSubscriptions_UNSTABLE,
  createSolanaRpcSubscriptionsFromTransport,
  createSolanaRpcSubscriptionsApi,
  createDefaultRpcSubscriptionsTransport,
  createDefaultSolanaRpcSubscriptionsChannelCreator,
  DEFAULT_RPC_SUBSCRIPTIONS_CONFIG,
} from '@solana/kit';

// ── Transaction building ───────────────────────────────────────
export type {
  TransactionMessage,
  TransactionMessageWithBlockhashLifetime,
} from '@solana/kit';
export {
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessageLifetimeUsingDurableNonce,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  prependTransactionMessageInstruction,
  prependTransactionMessageInstructions,
  compileTransaction,
  compileTransactionMessage,
  signTransactionMessageWithSigners,
  partiallySignTransactionMessageWithSigners,
  signAndSendTransactionMessageWithSigners,
  partiallySignTransaction,
  signTransaction,
  pipe,
} from '@solana/kit';

// ── Transaction sending & confirmation ─────────────────────────
export {
  sendAndConfirmTransactionFactory,
  sendAndConfirmDurableNonceTransactionFactory,
  sendTransactionWithoutConfirmingFactory,
  airdropFactory,
} from '@solana/kit';

// ── RPC types ──────────────────────────────────────────────────
export type { Commitment as KitCommitment } from '@solana/kit';
export {
  lamports,
  blockhash,
  unixTimestamp as kitUnixTimestamp,
  commitmentComparator,
} from '@solana/kit';

// ── Cluster helpers ────────────────────────────────────────────
export {
  devnet,
  mainnet,
  testnet,
} from '@solana/kit';

// ── Account helpers ────────────────────────────────────────────
export {
  fetchEncodedAccount,
  fetchEncodedAccounts,
  fetchJsonParsedAccount,
  fetchJsonParsedAccounts,
  decodeAccount,
  parseBase58RpcAccount,
  parseBase64RpcAccount,
  parseJsonRpcAccount,
  assertAccountExists,
  assertAccountDecoded,
} from '@solana/kit';
export { AccountRole } from '@solana/kit';

// ── Codecs ─────────────────────────────────────────────────────
export {
  getBase58Encoder,
  getBase58Decoder,
  getBase58Codec,
  getBase64Encoder,
  getBase64Decoder,
  getBase64Codec,
} from '@solana/kit';

// ── Errors ─────────────────────────────────────────────────────
export { SolanaError } from '@solana/kit';

// ── Offchain messages ──────────────────────────────────────────
export {
  createSignableMessage,
} from '@solana/kit';

// ─────────────────────────────────────────────────────────────────
// Bridge utilities — Synapse branded types <-> Kit native types
// ─────────────────────────────────────────────────────────────────

import type { Address } from '@solana/kit';
import {
  address as kitAddress,
  lamports as kitLamportsFactory,
} from '@solana/kit';
import type { Pubkey, Signature as SynapseSig, Lamports as SynapseLamports } from '../core/types';

/**
 * Convert a Synapse branded {@link Pubkey} to a Kit {@link Address}.
 *
 * @param pubkey - A Synapse `Pubkey` (base58 string).
 * @returns A Kit `Address` with full type-level validation.
 * @since 1.1.0
 *
 * @example
 * ```ts
 * import { Pubkey } from '@oobe-protocol-labs/synapse-client-sdk';
 * import { toKitAddress } from '@oobe-protocol-labs/synapse-client-sdk/kit';
 *
 * const addr = toKitAddress(Pubkey('So11111111111111111111111111111111111111112'));
 * ```
 */
export function toKitAddress(pubkey: Pubkey): Address {
  return kitAddress(pubkey as unknown as string);
}

/**
 * Convert a Kit {@link Address} to a Synapse branded {@link Pubkey}.
 *
 * @param addr - A Kit `Address`.
 * @returns A Synapse `Pubkey`.
 * @since 1.1.0
 */
export function fromKitAddress(addr: Address): Pubkey {
  return addr as unknown as Pubkey;
}

/**
 * Convert a Synapse branded {@link Signature} to a Kit signature string.
 *
 * @param sig - A Synapse `Signature` (base58 string).
 * @returns The raw base58 string (Kit uses plain strings for tx signatures in RPC responses).
 * @since 1.1.0
 */
export function toKitSignatureString(sig: SynapseSig): string {
  return sig as unknown as string;
}

/**
 * Convert a Synapse branded {@link Lamports} (bigint) to Kit lamports.
 *
 * Kit's `lamports()` factory produces an opaque branded bigint.
 *
 * @param amount - Synapse `Lamports` (bigint).
 * @returns Kit-branded lamports value.
 * @since 1.1.0
 */
export function toKitLamports(amount: SynapseLamports) {
  return kitLamportsFactory(amount as unknown as bigint);
}
