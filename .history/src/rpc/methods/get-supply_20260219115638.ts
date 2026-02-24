/**
 * getSupply — returns information about the current supply.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Commitment, RpcContext, Supply } from '../../core/types';

export async function getSupply(
  t: HttpTransport,
  opts: CallOptions & { commitment?: Commitment; excludeNonCirculatingAccountsList?: boolean } = {}
): Promise<RpcContext<Supply>> {
  const { commitment, excludeNonCirculatingAccountsList, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (commitment) cfg.commitment = commitment;
  if (excludeNonCirculatingAccountsList != null) cfg.excludeNonCirculatingAccountsList = excludeNonCirculatingAccountsList;
  return t.request('getSupply', [cfg], rest);
}
