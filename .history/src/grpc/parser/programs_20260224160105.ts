/**
 * Known Solana program registry — maps program IDs to human-readable names.
 *
 * Covers system programs, SPL programs, major DeFi protocols (Jupiter,
 * Raydium, Meteora, Orca), NFT programs (Metaplex), and infrastructure.
 *
 * Use `resolveProgram()` for single lookups or `resolveProgramBatch()`
 * for bulk resolution. Both support custom program registries.
 *
 * @module grpc/parser/programs
 */

/* ═══════════════════════════════════════════════════════════════
 *  Registry — immutable Record<programId, name>
 *
 *  Grouped by category for maintainability.
 *  All keys are base58 program IDs on mainnet.
 * ═══════════════════════════════════════════════════════════════ */

// ── System & Runtime ───────────────────────────────────────────
const SYSTEM_PROGRAMS: Record<string, string> = {
  '11111111111111111111111111111111':                      'System Program',
  'Vote111111111111111111111111111111111111111':            'Vote Program',
  'Stake11111111111111111111111111111111111111':            'Stake Program',
  'Config1111111111111111111111111111111111111':            'Config Program',
  'BPFLoaderUpgradeab1e11111111111111111111111':           'BPF Upgradeable Loader',
  'BPFLoader2111111111111111111111111111111111':            'BPF Loader v2',
  'BPFLoader1111111111111111111111111111111111':            'BPF Loader v1',
  'NativeLoader1111111111111111111111111111111':            'Native Loader',
  'Ed25519SigVerify111111111111111111111111111':            'Ed25519 SigVerify',
  'KeccakSecp256k11111111111111111111111111111':            'Secp256k1',
  'ComputeBudget111111111111111111111111111111':            'Compute Budget',
  'AddressLookupTab1e1111111111111111111111111':            'Address Lookup Table',
  'Sysvar1111111111111111111111111111111111111':            'Sysvar',
  'SysvarC1ock11111111111111111111111111111111':            'Sysvar Clock',
  'SysvarEpochSchewordsdu1e111111111111111111111111111':   'Sysvar EpochSchedule',
  'SysvarRent111111111111111111111111111111111':            'Sysvar Rent',
  'SysvarS1otHashes111111111111111111111111111':            'Sysvar SlotHashes',
  'SysvarStakeHistory1111111111111111111111111':            'Sysvar StakeHistory',
  'SysvarRecentB1teleporths11111111111111111111111111111':  'Sysvar RecentBlockhashes',
};

// ── SPL Token ──────────────────────────────────────────────────
const SPL_PROGRAMS: Record<string, string> = {
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA':         'SPL Token',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb':         'SPL Token-2022',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL':        'Associated Token Account',
  'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX':         'Name Service',
  'Memo1UhkJBfCR6MNB0EcYLYQ':                             'Memo Program v1',
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr':        'Memo Program v2',
};

// ── Jupiter ────────────────────────────────────────────────────
const JUPITER_PROGRAMS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4':        'Jupiter Aggregator v6',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcPX7':          'Jupiter Aggregator v4',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph':         'Jupiter Aggregator v3',
  'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uN9y':          'Jupiter Aggregator v2',
  'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu':         'Jupiter Perps v2',
  'PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu':         'Jupiter Perps v1',
  'J1TnP8zvVxbtF5KFp5xRmWuvG9McnhzmBd9XGfCyuxFP':       'Jupiter Limit Order v2',
  'DCA265Vj8a9CE2Xng1bcnkRg2PeugTsRt':                    'Jupiter DCA',
  'DecZY86MU5Gj7kppfUCEmd4LbXXuyZH1yHaP2NTqdiZB':       'Jupiter Lock',
  'voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj':         'Jupiter Vote',
  'jCebN34bUfdeUYJT13J1yG16XWzFeATV2wq5iLAzWvo':         'Jupiter DAO',
};

// ── Raydium ────────────────────────────────────────────────────
const RAYDIUM_PROGRAMS: Record<string, string> = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8':       'Raydium AMM v4',
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK':       'Raydium CLMM',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C':       'Raydium CPMM',
  'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS':         'Raydium Route',
  'FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG':       'Raydium Farm/Staking',
  '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv':        'Raydium Acceleraytor (IDO)',
  '9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4':        'Raydium CLMM (Legacy)',
};

// ── Meteora ────────────────────────────────────────────────────
const METEORA_PROGRAMS: Record<string, string> = {
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo':        'Meteora DLMM',
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB':       'Meteora Dynamic Pools',
  'M3M3uxTv5tMtLquF6vYAiViY7sXqtgXYGeTkwpvMbXh':         'Meteora M3M3',
  'StakeVNja6WECn1AiawQ8QfMNy3wPMiujpELppiAtpX':          'Meteora Stake (Alpha Vault)',
  'LockpDhBt3nSQ1MjfDBFnLBfQN9DEsgWHoU7djQrPbB':          'Meteora Lock',
  '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi':       'Meteora Stable Pools',
  'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky':         'Meteora Multi-token Pools (Legacy)',
};

// ── Orca ───────────────────────────────────────────────────────
const ORCA_PROGRAMS: Record<string, string> = {
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc':         'Orca Whirlpool',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP':       'Orca Aquafarm (Legacy)',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1':       'Orca Token Swap v2',
  '82yxjeMsvaURa4MbZZ7WZZHfobirZYkH1zF8fmeGtyaQ':        'Orca Whirlpool (Devnet)',
};

// ── Metaplex / NFT ─────────────────────────────────────────────
const METAPLEX_PROGRAMS: Record<string, string> = {
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s':         'Metaplex Token Metadata',
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg':         'Metaplex Authorization Rules',
  'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY':        'Metaplex Bubblegum (cNFT)',
  'CMZYPASGWeTz7RNGHaRJfCq2XQ5pYK6nDvVQxzkH51zb':        'Metaplex Core Asset',
  'CndyV3LdqHUfDLRcAHkTna1Tn4LXYzRJqJq9k32qRoe':        'Metaplex Candy Machine v3',
  'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g':        'Metaplex Candy Guard',
  'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTGKUNZhgf3':         'Metaplex Candy Machine v2',
  'p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfh98':          'Metaplex Auction House',
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K':         'Metaplex M2 (Marketplace)',
  'TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp':          'Metaplex Compressed NFT',
  'noopb9bkMVfRPU8AsBHBnMs8cUQ4W3CdELma2cCi':             'Metaplex Noop',
};

// ── Marinade ───────────────────────────────────────────────────
const MARINADE_PROGRAMS: Record<string, string> = {
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD':         'Marinade Finance',
  'MnDEuKqJpPm4YhDRig1GNiXoVpUMxfLCSKP7KuNMTxH':        'Marinade Native Staking',
};

// ── Other Major Protocols ──────────────────────────────────────
const OTHER_PROGRAMS: Record<string, string> = {
  // Phoenix
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY':         'Phoenix DEX',
  // Tensor
  'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN':         'Tensor Swap',
  'TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp':          'Tensor Compressed',
  'TL1ST2iRBzuGTqLn1KXnGdSnEow62BzPnGiqyRXhWtW':         'Tensor Listing',
  // Magic Eden
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K':         'Magic Eden v2',
  'MEisE1HzehtrDpAAT8PnLHjpSSkRYakotTuJRPjTpo8':          'Magic Eden v3',
  // Marinade & Liquid staking
  'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy':         'Stake Pool',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX':          'Serum DEX v3',
  // Pyth Oracle
  'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH':        'Pyth Oracle v2',
  'pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT':          'Pyth Push Oracle',
  'rec5EKMGg6MxZYo9LFHCYGkXdrW3eXAqtiGZAiTpD7S':          'Pyth Receiver',
  // Switchboard
  'SW1TCH7qEPTdLsDu7MEn2NWGigB4tiN9Q7S':                   'Switchboard v2',
  // Wormhole
  'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth':          'Wormhole Core',
  'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb':          'Wormhole Token Bridge',
  // Jito
  'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb':          'Jito TipRouter',
  'jitoVjT9jRUyeXBRvEyEErH6mFig7NeFCmXR':                  'Jito Staking',
  // Helium
  'hemjuPXBpNvggtaUnN1MwT3wrdhttKEfosTcc2P9Pg8':           'Helium Entity Manager',
  // Squads
  'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu':          'Squads v3',
  'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMJkvj52pCf':          'Squads v4',
  // Drift
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH':          'Drift Protocol v2',
  // Marginfi
  'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA':          'MarginFi v2',
  // Kamino
  'KLend2g3cP87ber8LQsMXxsK2tMEHMbLuNbidQv8RQpsZ':       'Kamino Lending',
  'CLMM9tUoggJu2wagPkkqs9eFG4BWhVBZWkP1qv3Sp7tR':        'Kamino CLMM',
  // Flash Trade
  'FLASH6Lo6h3iasJKWEP2YyCAeb7j2MFNZ5HGKE':                'Flash Trade',
  // Bonk
  'BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs':          'Bonk Rewards',
};

/* ═══════════════════════════════════════════════════════════════
 *  Merged registry (frozen at module load)
 * ═══════════════════════════════════════════════════════════════ */

/** Complete program registry. Frozen at module load. */
export const KNOWN_PROGRAMS: Readonly<Record<string, string>> = Object.freeze({
  ...SYSTEM_PROGRAMS,
  ...SPL_PROGRAMS,
  ...JUPITER_PROGRAMS,
  ...RAYDIUM_PROGRAMS,
  ...METEORA_PROGRAMS,
  ...ORCA_PROGRAMS,
  ...METAPLEX_PROGRAMS,
  ...MARINADE_PROGRAMS,
  ...OTHER_PROGRAMS,
});

/* ═══════════════════════════════════════════════════════════════
 *  Category-grouped exports (for selective lookups)
 * ═══════════════════════════════════════════════════════════════ */

export {
  SYSTEM_PROGRAMS,
  SPL_PROGRAMS,
  JUPITER_PROGRAMS,
  RAYDIUM_PROGRAMS,
  METEORA_PROGRAMS,
  ORCA_PROGRAMS,
  METAPLEX_PROGRAMS,
  MARINADE_PROGRAMS,
  OTHER_PROGRAMS,
};

/* ═══════════════════════════════════════════════════════════════
 *  Lookup helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Resolve a single program ID to a human-readable name.
 *
 * @param programId - Base58 program ID.
 * @param custom - Optional extra registry (takes priority over built-in).
 * @returns The name if known, otherwise `undefined`.
 *
 * @example
 * ```ts
 * resolveProgram('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
 * // => 'Jupiter Aggregator v6'
 * ```
 */
export function resolveProgram(
  programId: string,
  custom?: Record<string, string>,
): string | undefined {
  return custom?.[programId] ?? KNOWN_PROGRAMS[programId];
}

/**
 * Resolve multiple program IDs at once.
 *
 * @param programIds - Array of base58 program IDs.
 * @param custom - Optional extra registry.
 * @returns Map of programId → name (only known programs included).
 */
export function resolveProgramBatch(
  programIds: readonly string[],
  custom?: Record<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of programIds) {
    const name = resolveProgram(id, custom);
    if (name) result.set(id, name);
  }
  return result;
}

/**
 * Check if a program ID belongs to a specific protocol category.
 *
 * @example
 * ```ts
 * isProgramInCategory('JUP6...', 'jupiter'); // true
 * isProgramInCategory('whirL...', 'raydium'); // false
 * ```
 */
export function isProgramInCategory(
  programId: string,
  category: 'system' | 'spl' | 'jupiter' | 'raydium' | 'meteora' | 'orca' | 'metaplex' | 'marinade',
): boolean {
  const registries: Record<string, Record<string, string>> = {
    system:   SYSTEM_PROGRAMS,
    spl:      SPL_PROGRAMS,
    jupiter:  JUPITER_PROGRAMS,
    raydium:  RAYDIUM_PROGRAMS,
    meteora:  METEORA_PROGRAMS,
    orca:     ORCA_PROGRAMS,
    metaplex: METAPLEX_PROGRAMS,
    marinade: MARINADE_PROGRAMS,
  };
  return programId in (registries[category] ?? {});
}

/**
 * Get the protocol category of a program ID.
 *
 * @returns Category name or `'unknown'`.
 */
export function getProgramCategory(
  programId: string,
): 'system' | 'spl' | 'jupiter' | 'raydium' | 'meteora' | 'orca' | 'metaplex' | 'marinade' | 'other' | 'unknown' {
  if (programId in SYSTEM_PROGRAMS)   return 'system';
  if (programId in SPL_PROGRAMS)      return 'spl';
  if (programId in JUPITER_PROGRAMS)  return 'jupiter';
  if (programId in RAYDIUM_PROGRAMS)  return 'raydium';
  if (programId in METEORA_PROGRAMS)  return 'meteora';
  if (programId in ORCA_PROGRAMS)     return 'orca';
  if (programId in METAPLEX_PROGRAMS) return 'metaplex';
  if (programId in MARINADE_PROGRAMS) return 'marinade';
  if (programId in OTHER_PROGRAMS)    return 'other';
  return 'unknown';
}

/** Total number of known programs. */
export const KNOWN_PROGRAMS_COUNT = Object.keys(KNOWN_PROGRAMS).length;
