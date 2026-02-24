/**
 * Token methods — SPL Token account queries via jsonParsed encoding.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey, Commitment, RpcContext, TokenAccount, TokenAmount, DataSlice } from '../../core/types';

export interface GetTokenAccountsOpts extends CallOptions {
  commitment?: Commitment;
  mint?: Pubkey;
  programId?: Pubkey;
  minContextSlot?: number;
  dataSlice?: DataSlice;
}

export async function getTokenAccountBalance(
  t: HttpTransport,
  tokenAccount: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenAccountBalance', [tokenAccount, { commitment }], opts);
}

export async function getTokenAccountsByOwner(
  t: HttpTransport,
  owner: Pubkey,
  filter: { mint: Pubkey } | { programId: Pubkey },
  opts: CallOptions & { commitment?: Commitment; minContextSlot?: number; dataSlice?: DataSlice } = {}
): Promise<RpcContext<TokenAccount[]>> {
  const { commitment = 'confirmed', minContextSlot, dataSlice, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment, encoding: 'jsonParsed' };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  if (dataSlice) cfg.dataSlice = dataSlice;
  return t.request('getTokenAccountsByOwner', [owner, filter, cfg], rest);
}

export async function getTokenAccountsByDelegate(
  t: HttpTransport,
  delegate: Pubkey,
  filter: { mint: Pubkey } | { programId: Pubkey },
  opts: CallOptions & { commitment?: Commitment; minContextSlot?: number; dataSlice?: DataSlice } = {}
): Promise<RpcContext<TokenAccount[]>> {
  const { commitment = 'confirmed', minContextSlot, dataSlice, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment, encoding: 'jsonParsed' };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  if (dataSlice) cfg.dataSlice = dataSlice;
  return t.request('getTokenAccountsByDelegate', [delegate, filter, cfg], rest);
}

export async function getTokenLargestAccounts(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<{ address: Pubkey; amount: string; decimals: number; uiAmount: number | null; uiAmountString: string }[]>> {
  return t.request('getTokenLargestAccounts', [mint, { commitment }], opts);
}

export async function getTokenSupply(
  t: HttpTransport,
  mint: Pubkey,
  commitment: Commitment = 'confirmed',
  opts: CallOptions = {}
): Promise<RpcContext<TokenAmount>> {
  return t.request('getTokenSupply', [mint, { commitment }], opts);
}

export async function getLargestAccounts(
  t: HttpTransport,
  opts: CallOptions & { commitment?: Commitment; filter?: 'circulating' | 'nonCirculating' } = {}
): Promise<RpcContext<{ address: Pubkey; lamports: number }[]>> {
  const { commitment, filter, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (filter) cfg.filter = filter;
  return t.request('getLargestAccounts', [cfg], rest);
}

/**
 * @deprecated Deprecated in solana-core v2.0. Use alternative approach:
 * https://github.com/solana-developers/solana-rpc-get-stake-activation
 */
export async function getStakeActivation(
  t: HttpTransport,
  stakeAccount: Pubkey,
  opts: CallOptions & { commitment?: Commitment; epoch?: number; minContextSlot?: number } = {}
): Promise<{ state: 'active' | 'inactive' | 'activating' | 'deactivating'; active: number; inactive: number }> {
  const { commitment, epoch, minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (epoch != null) cfg.epoch = epoch;
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getStakeActivation', [stakeAccount, cfg], rest);
}

export async function getFeeForMessage(
  t: HttpTransport,
  message: string,
  commitment: Commitment = 'confirmed',
  opts: CallOptions & { minContextSlot?: number } = {}
): Promise<RpcContext<number | null>> {
  const { minContextSlot, ...rest } = opts;
  const cfg: Record<string, unknown> = { commitment };
  if (minContextSlot != null) cfg.minContextSlot = minContextSlot;
  return t.request('getFeeForMessage', [message, cfg], rest);
}
