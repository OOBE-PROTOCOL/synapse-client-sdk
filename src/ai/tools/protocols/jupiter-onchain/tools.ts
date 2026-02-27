/**
 * @module ai/tools/protocols/jupiter-onchain/tools
 * @description Jupiter On-Chain — LangChain tool factory.
 *
 * Creates 10 executable tools that query Jupiter protocol state directly
 * from the Solana blockchain via the SDK's native RPC transport and
 * binary decoders. No external REST API dependency.
 *
 * ```ts
 * import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
 * const client = new SynapseClient({ endpoint: '...' });
 * const jupOnchain = createJupiterOnchainTools(client);
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
import { jupiterOnchainMethods } from './schemas';
import type { SynapseClient } from '../../../../core/client';
import type { HttpTransport } from '../../../../core/transport';
import type { Pubkey, Commitment } from '../../../../core/types';
import { fetchMint } from '../../../../accounts/token';
import { base64ToBytes } from '../../../../accounts/helpers';

/* ═══════════════════════════════════════════════════════════════
 *  Jupiter Program ID registry
 *
 *  Canonical map from human-readable keys → on-chain program IDs.
 *  Source of truth: src/grpc/parser/programs.ts
 * ═══════════════════════════════════════════════════════════════ */

/** @internal */
export const JUPITER_PROGRAM_IDS: Record<string, { id: string; name: string }> = {
  aggregator_v6:   { id: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  name: 'Jupiter Aggregator v6' },
  aggregator_v4:   { id: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcPX7',   name: 'Jupiter Aggregator v4' },
  aggregator_v3:   { id: 'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph',  name: 'Jupiter Aggregator v3' },
  aggregator_v2:   { id: 'JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uN9y',   name: 'Jupiter Aggregator v2' },
  perps_v2:        { id: 'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu',  name: 'Jupiter Perps v2' },
  perps_v1:        { id: 'PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu',  name: 'Jupiter Perps v1' },
  limit_order_v2:  { id: 'J1TnP8zvVxbtF5KFp5xRmWuvG9McnhzmBd9XGfCyuxFP', name: 'Jupiter Limit Order v2' },
  dca:             { id: 'DCA265Vj8a9CE2Xng1bcnkRg2PeugTsRt',             name: 'Jupiter DCA' },
  lock:            { id: 'DecZY86MU5Gj7kppfUCEmd4LbXXuyZH1yHaP2NTqdiZB', name: 'Jupiter Lock' },
  vote:            { id: 'voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj',  name: 'Jupiter Vote' },
  dao:             { id: 'jCebN34bUfdeUYJT13J1yG16XWzFeATV2wq5iLAzWvo',  name: 'Jupiter DAO' },
};

/** Reverse map: program ID → { key, name }. */
const JUPITER_ID_REVERSE = new Map<string, { key: string; name: string }>();
for (const [key, val] of Object.entries(JUPITER_PROGRAM_IDS)) {
  JUPITER_ID_REVERSE.set(val.id, { key, name: val.name });
}

/* ═══════════════════════════════════════════════════════════════
 *  Execution dispatcher — on-chain via RPC transport
 * ═══════════════════════════════════════════════════════════════ */

function createJupiterOnchainExecutor(transport: HttpTransport) {
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
      case 'getLimitOrders':
        return executeGetPositionsByOwner(transport, input, 'limit_order_v2', 8);
      case 'getDCAAccounts':
        return executeGetPositionsByOwner(transport, input, 'dca', 8);
      case 'getPerpsPositions':
        return executeGetPerpsPositions(transport, input);
      case 'getTokenMintInfo':
        return executeGetTokenMintInfo(transport, input);
      case 'getTokenHoldings':
        return executeGetTokenHoldings(transport, input);
      case 'resolvePrograms':
        return executeResolvePrograms();
      default:
        throw new Error(`Unknown Jupiter on-chain method: ${method.name}`);
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
  const entry = JUPITER_PROGRAM_IDS[programKey];
  if (!entry) throw new Error(`Unknown Jupiter program: ${programKey}`);

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
    return { transaction: null, jupiterInstructions: [], slot: 0, blockTime: null };
  }

  // Extract Jupiter instructions from both top-level and inner instructions
  const jupiterInstructions: Array<{
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
    const info = JUPITER_ID_REVERSE.get(programId);
    if (info) {
      jupiterInstructions.push({
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
      const info = JUPITER_ID_REVERSE.get(programId);
      if (info) {
        jupiterInstructions.push({
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
    jupiterInstructions,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
}

/**
 * Shared executor for position discovery tools (limit orders, DCA).
 * Uses getProgramAccounts with a memcmp filter on the owner/user field.
 *
 * @param ownerOffset - Byte offset of the owner pubkey in the account data.
 *                      For Anchor programs: 8 (discriminator) = offset 8.
 */
async function executeGetPositionsByOwner(
  transport: HttpTransport,
  input: Record<string, unknown>,
  programKey: string,
  ownerOffset: number,
): Promise<unknown> {
  const entry = JUPITER_PROGRAM_IDS[programKey];
  if (!entry) throw new Error(`Unknown Jupiter program: ${programKey}`);

  const owner = input.owner as string;

  const cfg: Record<string, unknown> = {
    encoding: 'base64',
    filters: [
      { memcmp: { offset: ownerOffset, bytes: owner } },
    ],
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const accounts = await transport.request<Array<{ pubkey: string; account: { data: unknown; lamports: number } }>>(
    'getProgramAccounts',
    [entry.id, cfg],
  );

  const mapped = accounts.map((a) => ({
    pubkey: a.pubkey,
    data: a.account.data,
    lamports: a.account.lamports,
  }));

  const resultKey = programKey === 'limit_order_v2' ? 'orders' :
                    programKey === 'dca' ? 'accounts' : 'positions';

  return {
    programId: entry.id,
    [resultKey]: mapped,
    count: mapped.length,
  };
}

async function executeGetPerpsPositions(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const version = (input.version as string) || 'v2';
  const programKey = version === 'v1' ? 'perps_v1' : 'perps_v2';
  const entry = JUPITER_PROGRAM_IDS[programKey];
  if (!entry) throw new Error(`Unknown Jupiter Perps version: ${version}`);

  const trader = input.trader as string;

  const cfg: Record<string, unknown> = {
    encoding: 'base64',
    filters: [
      { memcmp: { offset: 8, bytes: trader } },
    ],
  };
  if (input.commitment) cfg.commitment = input.commitment;

  const accounts = await transport.request<Array<{ pubkey: string; account: { data: unknown; lamports: number } }>>(
    'getProgramAccounts',
    [entry.id, cfg],
  );

  return {
    programId: entry.id,
    programName: entry.name,
    positions: accounts.map((a) => ({
      pubkey: a.pubkey,
      data: a.account.data,
      lamports: a.account.lamports,
    })),
    count: accounts.length,
  };
}

async function executeGetTokenMintInfo(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const mint = input.mint as Pubkey;
  const commitment = input.commitment as Commitment | undefined;

  const result = await fetchMint(transport, mint, { commitment });

  if (!result) {
    throw new Error(`Mint account not found: ${mint}`);
  }

  return {
    mintAuthority: result.decoded.mintAuthority,
    supply: result.decoded.supply.toString(),
    decimals: result.decoded.decimals,
    isInitialized: result.decoded.isInitialized,
    freezeAuthority: result.decoded.freezeAuthority,
    slot: result.slot,
  };
}

async function executeGetTokenHoldings(
  transport: HttpTransport,
  input: Record<string, unknown>,
): Promise<unknown> {
  const owner = input.owner as string;
  const mint = input.mint as string | undefined;
  const programId = (input.programId as string) || 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

  // Build the filter
  const filter: Record<string, string> = mint
    ? { mint }
    : { programId };

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
              delegate?: string | null;
              state: string;
            };
          };
        };
        lamports: number;
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
      delegate: info.delegate ?? null,
      state: info.state,
    };
  });

  return { accounts, count: accounts.length };
}

function executeResolvePrograms(): unknown {
  const programs = Object.entries(JUPITER_PROGRAM_IDS).map(([key, val]) => ({
    id: val.id,
    name: val.name,
    key,
  }));

  return { programs, count: programs.length };
}

/* ═══════════════════════════════════════════════════════════════
 *  createJupiterOnchainTools()
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @description Jupiter on-chain specific config (tool options — transport comes from SynapseClient).
 * @since 1.1.0
 */
export type JupiterOnchainToolsConfig = CreateProtocolToolsOpts;

/**
 * @description Create LangChain-compatible tools for querying Jupiter state on-chain.
 *
 * Unlike the REST-based Jupiter tools (which call api.jup.ag), these tools
 * query the Solana blockchain directly via the SDK's RPC transport and
 * native binary decoders. Use them to inspect limit orders, DCA positions,
 * perps positions, and any Jupiter program account in real-time.
 *
 * @param {SynapseClient} client - Initialised SynapseClient (provides HttpTransport)
 * @param {JupiterOnchainToolsConfig} [opts={}] - Tool creation options
 * @returns {ProtocolToolkit} Toolkit with 10 Jupiter on-chain tools
 *
 * @example
 * ```ts
 * const client = new SynapseClient({ endpoint: 'https://...' });
 * const jupOnchain = createJupiterOnchainTools(client);
 *
 * // Find all limit orders for a wallet:
 * const orders = jupOnchain.toolMap.getLimitOrders;
 *
 * // Inspect a Jupiter swap transaction:
 * const inspector = jupOnchain.toolMap.inspectTransaction;
 * ```
 *
 * @since 1.1.0
 */
export function createJupiterOnchainTools(
  client: SynapseClient,
  opts: JupiterOnchainToolsConfig = {},
): ProtocolToolkit {
  const execute = createJupiterOnchainExecutor(client.transport);

  return buildProtocolTools(jupiterOnchainMethods, execute, {
    defaultPrefix: 'jup_onchain_',
    ...opts,
  });
}

/** Re-export schemas for direct access. */
export { jupiterOnchainMethods, jupiterOnchainMethodNames } from './schemas';
