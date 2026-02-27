/**
 * @module ai/tools/protocols/raydium-onchain/tools
 * @description Raydium On-Chain — LangChain tool factory.
 *
 * Creates 10 executable tools that query Raydium protocol state directly
 * from the Solana blockchain via the SDK's native RPC transport.
 * No external REST API dependency.
 *
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * const client = new SynapseClient({ endpoint: '...' });
 * const rayOnchain = createRaydiumOnchainTools(client);
 * ```
 *
 * @since 1.1.0
 */
import {
  buildProtocolTools,
  type ProtocolMethod,
  type ProtocolToolkit,
  type CreateProtocolToolsOpts,
} from '../shared';
import { raydiumOnchainMethods } from './schemas';
import type { SynapseClient } from '../../../../core/client';
import type { HttpTransport } from '../../../../core/transport';

/* ═══════════════════════════════════════════════════════════════
 *  Raydium Program ID registry
 *
 *  Canonical map from human-readable keys → on-chain program IDs.
 *  Source of truth: src/grpc/parser/programs.ts
 * ═══════════════════════════════════════════════════════════════ */

/** @internal */
export const RAYDIUM_PROGRAM_IDS: Record<string, { id: string; name: string }> = {
  amm_v4:       { id: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', name: 'Raydium AMM v4' },
  clmm:         { id: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', name: 'Raydium CLMM' },
  cpmm:         { id: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', name: 'Raydium CPMM' },
  route:        { id: 'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS',  name: 'Raydium Route' },
  farm:         { id: 'FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG', name: 'Raydium Farm/Staking' },
  acceleraytor: { id: '27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv', name: 'Raydium Acceleraytor (IDO)' },
  clmm_legacy:  { id: '9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4', name: 'Raydium CLMM (Legacy)' },
};

/** Reverse map: program ID → { key, name }. */
const RAYDIUM_ID_REVERSE = new Map<string, { key: string; name: string }>();
for (const [key, val] of Object.entries(RAYDIUM_PROGRAM_IDS)) {
  RAYDIUM_ID_REVERSE.set(val.id, { key, name: val.name });
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher — on-chain via RPC transport
 * ═══════════════════════════════════════════════════════════════ */

function createRaydiumOnchainExecutor(transport: HttpTransport) {
  return async (method: ProtocolMethod, input: Record<string, unknown>): Promise<unknown> => {
    switch (method.name) {
      case 'fetchAccount':
        return executeFetchAccount(transport, input);
      case 'searchProgramAccounts':
        return executeSearchProgramAccounts(transport, input);
      case 'getTransactionHistory':
        return executeGetTransactionHistory(transport, input);
      case 'inspectTransaction':
        return executeInspectTransaction(transport, input);
      case 'getPoolState':
        return executeGetPoolState(transport, input);
      case 'getMultiplePoolStates':
        return executeGetMultiplePoolStates(transport, input);
      case 'getPoolsByMint':
        return executeGetPoolsByMint(transport, input);
      case 'getLPPositions':
        return executeGetLPPositions(transport, input);
      case 'getFarmPositions':
        return executeGetFarmPositions(transport, input);
      case 'resolvePrograms':
        return executeResolvePrograms();
      default:
        throw new Error(`Unknown Raydium on-chain method: ${method.name}`);
    }
  };
}

/* ── Individual executors ───────────────────────────────────── */

async function executeFetchAccount(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const cfg: Record<string, unknown> = {};
  if (input.encoding) cfg.encoding = input.encoding;
  else cfg.encoding = 'base64';
  if (input.commitment) cfg.commitment = input.commitment;
  if (input.dataSlice) cfg.dataSlice = input.dataSlice;

  return transport.request('getAccountInfo', [input.address, cfg]);
}

async function executeSearchProgramAccounts(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const programKey = input.program as string;
  const entry = RAYDIUM_PROGRAM_IDS[programKey];
  if (!entry) throw new Error(`Unknown Raydium program: ${programKey}`);

  const cfg: Record<string, unknown> = {};
  if (input.encoding) cfg.encoding = input.encoding;
  else cfg.encoding = 'base64';
  if (input.commitment) cfg.commitment = input.commitment;
  if (input.dataSlice) cfg.dataSlice = input.dataSlice;
  if (input.filters) cfg.filters = input.filters;

  const accounts = await transport.request<Array<{ pubkey: string; account: unknown }>>(
    'getProgramAccounts',
    [entry.id, cfg],
  );

  const maxResults = (input.maxResults as number | undefined) ?? accounts.length;
  const truncated = accounts.length > maxResults;
  const sliced = truncated ? accounts.slice(0, maxResults) : accounts;

  return {
    programId: entry.id,
    programName: entry.name,
    accounts: sliced,
    totalFound: accounts.length,
    truncated,
  };
}

async function executeGetTransactionHistory(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const cfg: Record<string, unknown> = {};
  if (input.limit) cfg.limit = input.limit;
  else cfg.limit = 20;
  if (input.before) cfg.before = input.before;
  if (input.until) cfg.until = input.until;
  if (input.commitment) cfg.commitment = input.commitment;

  return transport.request('getSignaturesForAddress', [input.address, cfg]);
}

async function executeInspectTransaction(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const cfg: Record<string, unknown> = {
    encoding: 'jsonParsed',
    maxSupportedTransactionVersion: 0,
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const tx = await transport.request<{
    transaction: { message: { instructions: any[]; accountKeys: any[] } };
    meta: { innerInstructions?: any[]; err: unknown } | null;
    slot: number;
    blockTime: number | null;
  } | null>('getTransaction', [input.signature, cfg]);

  if (!tx) {
    return { transaction: null, raydiumInstructions: [], slot: 0, blockTime: null };
  }

  const raydiumInstructions: Array<{
    programId: string;
    programName: string;
    instructionIndex: number;
    data?: string;
    accounts?: string[];
    isInner: boolean;
  }> = [];

  // Top-level instructions
  const ixs = tx.transaction?.message?.instructions ?? [];
  for (let i = 0; i < ixs.length; i++) {
    const ix = ixs[i];
    const programId = ix.programId ?? ix.program;
    const info = RAYDIUM_ID_REVERSE.get(programId);
    if (info) {
      raydiumInstructions.push({
        programId,
        programName: info.name,
        instructionIndex: i,
        data: ix.data,
        accounts: ix.accounts,
        isInner: false,
      });
    }
  }

  // Inner instructions
  const innerIxs = tx.meta?.innerInstructions ?? [];
  for (const group of innerIxs) {
    const instructions = group.instructions ?? [];
    for (const ix of instructions) {
      const programId = ix.programId ?? ix.program;
      const info = RAYDIUM_ID_REVERSE.get(programId);
      if (info) {
        raydiumInstructions.push({
          programId,
          programName: info.name,
          instructionIndex: group.index,
          data: ix.data,
          accounts: ix.accounts,
          isInner: true,
        });
      }
    }
  }

  return {
    transaction: tx.transaction,
    raydiumInstructions,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
}

async function executeGetPoolState(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const poolAddress = input.poolAddress as string;
  const cfg: Record<string, unknown> = {};
  if (input.encoding) cfg.encoding = input.encoding;
  else cfg.encoding = 'base64';
  if (input.commitment) cfg.commitment = input.commitment;

  const result = await transport.request<{
    context: { slot: number };
    value: { data: unknown; executable: boolean; lamports: number; owner: string; rentEpoch: number } | null;
  }>('getAccountInfo', [poolAddress, cfg]);

  if (!result.value) {
    return {
      address: poolAddress,
      owner: null,
      lamports: 0,
      data: null,
      slot: result.context.slot,
      poolType: null,
    };
  }

  // Detect pool type from owner program
  const ownerInfo = RAYDIUM_ID_REVERSE.get(result.value.owner);
  const poolType = ownerInfo?.name ?? null;

  return {
    address: poolAddress,
    owner: result.value.owner,
    lamports: result.value.lamports,
    data: result.value.data,
    slot: result.context.slot,
    poolType,
  };
}

async function executeGetMultiplePoolStates(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const poolAddresses = input.poolAddresses as string[];
  const cfg: Record<string, unknown> = {};
  if (input.encoding) cfg.encoding = input.encoding;
  else cfg.encoding = 'base64';
  if (input.commitment) cfg.commitment = input.commitment;

  const result = await transport.request<{
    context: { slot: number };
    value: Array<{ data: unknown; executable: boolean; lamports: number; owner: string; rentEpoch: number } | null>;
  }>('getMultipleAccounts', [poolAddresses, cfg]);

  let found = 0;
  let missing = 0;
  const pools = result.value.map((acct, i) => {
    if (!acct) {
      missing++;
      return {
        address: poolAddresses[i],
        owner: null,
        lamports: null,
        data: null,
        poolType: null,
        exists: false,
      };
    }
    found++;
    const ownerInfo = RAYDIUM_ID_REVERSE.get(acct.owner);
    return {
      address: poolAddresses[i],
      owner: acct.owner,
      lamports: acct.lamports,
      data: acct.data,
      poolType: ownerInfo?.name ?? null,
      exists: true,
    };
  });

  return {
    pools,
    slot: result.context.slot,
    found,
    missing,
  };
}

async function executeGetPoolsByMint(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const programKey = input.program as string;
  const entry = RAYDIUM_PROGRAM_IDS[programKey];
  if (!entry) throw new Error(`Unknown Raydium program: ${programKey}`);

  const mint = input.mint as string;
  const mintOffset = input.mintOffset as number;
  const maxResults = (input.maxResults as number) || 50;

  const cfg: Record<string, unknown> = {
    encoding: 'base64',
    filters: [
      { memcmp: { offset: mintOffset, bytes: mint } },
    ],
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const accounts = await transport.request<Array<{ pubkey: string; account: { data: unknown; lamports: number } }>>(
    'getProgramAccounts',
    [entry.id, cfg],
  );

  const truncated = accounts.length > maxResults;
  const sliced = truncated ? accounts.slice(0, maxResults) : accounts;

  return {
    programId: entry.id,
    pools: sliced.map((a) => ({
      pubkey: a.pubkey,
      data: a.account.data,
      lamports: a.account.lamports,
    })),
    count: accounts.length,
    truncated,
  };
}

async function executeGetLPPositions(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const owner = input.owner as string;
  const lpMint = input.lpMint as string | undefined;

  const filter: Record<string, string> = lpMint
    ? { mint: lpMint }
    : { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' };

  const cfg: Record<string, unknown> = {
    encoding: 'jsonParsed',
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const result = await transport.request<{
    context: { slot: number };
    value: Array<{
      pubkey: string;
      account: {
        data: {
          parsed: {
            info: {
              mint: string;
              owner: string;
              tokenAmount: { amount: string; decimals: number; uiAmount: number | null };
            };
          };
        };
      };
    }>;
  }>('getTokenAccountsByOwner', [owner, filter, cfg]);

  const accounts = result.value.map((entry) => {
    const info = entry.account.data.parsed.info;
    return {
      pubkey: entry.pubkey,
      mint: info.mint,
      owner: info.owner,
      amount: info.tokenAmount.amount,
      decimals: info.tokenAmount.decimals,
      uiAmount: info.tokenAmount.uiAmount,
    };
  });

  return { accounts, count: accounts.length };
}

async function executeGetFarmPositions(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const entry = RAYDIUM_PROGRAM_IDS.farm;
  const owner = input.owner as string;

  // Raydium Farm user account layout:
  // [8 discriminator] [32 farm_id] [32 owner] ...
  // Owner field starts at offset 40
  const cfg: Record<string, unknown> = {
    encoding: 'base64',
    filters: [
      { memcmp: { offset: 40, bytes: owner } },
    ],
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const accounts = await transport.request<Array<{ pubkey: string; account: { data: unknown; lamports: number } }>>(
    'getProgramAccounts',
    [entry.id, cfg],
  );

  return {
    programId: entry.id,
    positions: accounts.map((a) => ({
      pubkey: a.pubkey,
      data: a.account.data,
      lamports: a.account.lamports,
    })),
    count: accounts.length,
  };
}

function executeResolvePrograms(): unknown {
  const programs = Object.entries(RAYDIUM_PROGRAM_IDS).map(([key, val]) => ({
    id: val.id,
    name: val.name,
    key,
  }));

  return { programs, count: programs.length };
}

/* ═══════════════════════════════════════════════════════════════
 *  createRaydiumOnchainTools()
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Raydium on-chain specific config (tool options — transport comes from SynapseClient).
 * @since 1.1.0
 */
export type RaydiumOnchainToolsConfig = CreateProtocolToolsOpts;

/**
 * @description Create LangChain-compatible tools for querying Raydium state on-chain.
 *
 * Unlike the REST-based Raydium tools (which call api-v3.raydium.io), these tools
 * query the Solana blockchain directly via the SDK's RPC transport.
 * Use them to inspect pool states, LP positions, farm positions, and any
 * Raydium program account in real-time.
 *
 * @param {SynapseClient} client - Initialised SynapseClient (provides HttpTransport)
 * @param {RaydiumOnchainToolsConfig} [opts={}] - Tool creation options
 * @returns {ProtocolToolkit} Toolkit with 10 Raydium on-chain tools
 *
 * @example
 * ```ts
 * const client = new SynapseClient({ endpoint: 'https://...' });
 * const rayOnchain = createRaydiumOnchainTools(client);
 *
 * // Fetch a pool state:
 * const poolTool = rayOnchain.toolMap.getPoolState;
 *
 * // Find farm positions for a wallet:
 * const farmTool = rayOnchain.toolMap.getFarmPositions;
 * ```
 *
 * @since 1.1.0
 */
export function createRaydiumOnchainTools(
  client: SynapseClient,
  opts: RaydiumOnchainToolsConfig = {},
): ProtocolToolkit {
  const execute = createRaydiumOnchainExecutor(client.transport);

  return buildProtocolTools(raydiumOnchainMethods, execute, {
    defaultPrefix: 'ray_onchain_',
    ...opts,
  });
}

/** Re-export schemas for direct access. */
export { raydiumOnchainMethods, raydiumOnchainMethodNames } from './schemas';
