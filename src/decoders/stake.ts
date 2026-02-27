/**
 * Solana Stake Account decoder.
 *
 * Decodes the native stake program account layout into typed objects,
 * including meta (authorized, lockup) and delegation fields.
 *
 * @module decoders/stake
 * @since 1.1.0
 */

import type { Pubkey } from '../core/types';
import { AccountReader } from './layout';

// ── Stake account state enum ──────────────────────────────────

/** Stake account type discriminator. @since 1.1.0 */
export type StakeAccountType = 'uninitialized' | 'initialized' | 'delegated' | 'rewardsPool';

const STAKE_TYPES: readonly StakeAccountType[] = [
  'uninitialized', 'initialized', 'delegated', 'rewardsPool',
];

// ── Decoded types ──────────────────────────────────────────────

/** Authorized staker and withdrawer. @since 1.1.0 */
export interface StakeAuthorized {
  staker: Pubkey;
  withdrawer: Pubkey;
}

/** Lockup configuration. @since 1.1.0 */
export interface StakeLockup {
  /** Unix timestamp until which stake is locked. 0 = no time lock. */
  unixTimestamp: bigint;
  /** Epoch until which stake is locked. 0 = no epoch lock. */
  epoch: bigint;
  /** Custodian who can override the lockup. */
  custodian: Pubkey;
}

/** Stake account metadata (always present after initialization). @since 1.1.0 */
export interface StakeMeta {
  rentExemptReserve: bigint;
  authorized: StakeAuthorized;
  lockup: StakeLockup;
}

/** Stake delegation information (only present when type = 'delegated'). @since 1.1.0 */
export interface StakeDelegation {
  voterPubkey: Pubkey;
  stake: bigint;
  activationEpoch: bigint;
  deactivationEpoch: bigint;
  /** @deprecated Unused in modern Solana runtime, always 0.25 */
  warmupCooldownRate: number;
}

/** Fully decoded stake account. @since 1.1.0 */
export interface DecodedStakeAccount {
  type: StakeAccountType;
  meta: StakeMeta | null;
  stake: StakeDelegation | null;
  creditsObserved: bigint | null;
}

// ── Constants ──────────────────────────────────────────────────

/** Stake Program ID. @since 1.1.0 */
export const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

// ── Decoder ────────────────────────────────────────────────────

/**
 * Decode a Solana stake account from raw bytes.
 *
 * Layout (200 bytes for delegated):
 * - [0..4]     u32   — discriminator (0=uninit, 1=init, 2=stake, 3=rewards)
 * - [4..124]   meta  — rentExemptReserve(8) + authorized(64) + lockup(48)
 * - [124..200] stake — delegation(72) + creditsObserved(8) [only if type=2]
 *
 * @param data - Raw stake account data.
 * @returns Decoded stake account.
 * @throws {Error} If data is too short.
 * @since 1.1.0
 */
export function decodeStakeAccount(data: Uint8Array): DecodedStakeAccount {
  if (data.length < 4) {
    throw new Error(`Stake account data too short: expected >= 4 bytes, got ${data.length}`);
  }

  const r = new AccountReader(data);

  const typeIdx = r.u32();                         // [0..4]
  const type = STAKE_TYPES[typeIdx] ?? 'uninitialized';

  if (type === 'uninitialized') {
    return { type, meta: null, stake: null, creditsObserved: null };
  }

  // Meta is always present for initialized/delegated/rewardsPool
  if (data.length < 124) {
    throw new Error(
      `Stake account data too short for meta: expected >= 124 bytes, got ${data.length}`,
    );
  }

  const rentExemptReserve = r.u64();               // [4..12]
  const staker = r.pubkey();                       // [12..44]
  const withdrawer = r.pubkey();                   // [44..76]
  const unixTimestamp = r.i64();                   // [76..84]
  const epoch = r.u64();                           // [84..92]
  const custodian = r.pubkey();                    // [92..124]

  const meta: StakeMeta = {
    rentExemptReserve,
    authorized: { staker, withdrawer },
    lockup: { unixTimestamp, epoch, custodian },
  };

  if (type !== 'delegated') {
    return { type, meta, stake: null, creditsObserved: null };
  }

  // Delegation is present for type=2 (delegated)
  if (data.length < 200) {
    throw new Error(
      `Stake account data too short for delegation: expected >= 200 bytes, got ${data.length}`,
    );
  }

  const voterPubkey = r.pubkey();                  // [124..156]
  const stakeAmount = r.u64();                     // [156..164]
  const activationEpoch = r.u64();                 // [164..172]
  const deactivationEpoch = r.u64();               // [172..180]
  const warmupCooldownRate = r.f64();              // [180..188]
  const creditsObserved = r.u64();                 // [188..196]

  return {
    type,
    meta,
    stake: {
      voterPubkey,
      stake: stakeAmount,
      activationEpoch,
      deactivationEpoch,
      warmupCooldownRate,
    },
    creditsObserved,
  };
}
