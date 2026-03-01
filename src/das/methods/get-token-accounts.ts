/**
 * @module das/methods/get-token-accounts
 * @description Fetches token accounts filtered by owner or mint address.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasOpts } from '../types';
import type { Pubkey } from '../../core/types';

/**
 * Paginated result of token accounts for an owner.
 * @since 1.0.0
 */
export interface TokenAccountsByOwnerResult {
  total: number;
  limit: number;
  page: number;
  token_accounts: {
    address: Pubkey;
    mint: Pubkey;
    owner: Pubkey;
    amount: number;
    delegated_amount?: number;
    frozen?: boolean;
  }[];
}

/**
 * Parameters for fetching token accounts.
 * @since 1.0.0
 */
export interface GetTokenAccountsParams {
  owner?: Pubkey;
  mint?: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  showZeroBalance?: boolean;
}

/**
 * Fetch token accounts filtered by owner or mint address.
 *
 * @param t - HTTP transport instance
 * @param params - Owner/mint address and pagination options
 * @param opts - Commitment level and call options
 * @returns Paginated list of token accounts with balances
 *
 * @example
 * ```ts
 * const result = await getTokenAccounts(transport, {
 *   owner: 'Owner111...',
 *   showZeroBalance: false,
 * });
 * result.token_accounts.forEach(ta => console.log(ta.mint, ta.amount));
 * ```
 *
 * @since 1.0.0
 */
export async function getTokenAccounts(
  t: HttpTransport,
  params: GetTokenAccountsParams,
  opts: DasOpts & CallOptions = {}
): Promise<TokenAccountsByOwnerResult> {
  const { commitment, ...rest } = opts;
  return t.request('getTokenAccounts', { ...params, ...(commitment ? { commitment } : {}) }, rest);
}
