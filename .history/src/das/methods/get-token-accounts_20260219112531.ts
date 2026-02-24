import type { HttpTransport, CallOptions } from '../../core/transport';
import type { DasOpts } from '../types';
import type { Pubkey } from '../../core/types';

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

export interface GetTokenAccountsParams {
  owner?: Pubkey;
  mint?: Pubkey;
  page?: number;
  limit?: number;
  cursor?: string;
  showZeroBalance?: boolean;
}

export async function getTokenAccounts(
  t: HttpTransport,
  params: GetTokenAccountsParams,
  opts: DasOpts & CallOptions = {}
): Promise<TokenAccountsByOwnerResult> {
  const { commitment, ...rest } = opts;
  return t.request('getTokenAccounts', [{ ...params, ...(commitment ? { commitment } : {}) }], rest);
}
