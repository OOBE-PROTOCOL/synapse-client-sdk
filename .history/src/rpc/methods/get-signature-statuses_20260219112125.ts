/**
 * getSignatureStatuses — poll confirmation status for one or more sigs.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Signature, SignatureStatus, RpcContext } from '../../core/types';

export interface GetSignatureStatusesOpts extends CallOptions {
  searchTransactionHistory?: boolean;
}

export async function getSignatureStatuses(
  t: HttpTransport,
  signatures: Signature[],
  opts: GetSignatureStatusesOpts = {}
): Promise<RpcContext<(SignatureStatus | null)[]>> {
  const { searchTransactionHistory, ...rest } = opts;
  const cfg: Record<string, unknown> = {};
  if (searchTransactionHistory) cfg.searchTransactionHistory = true;
  return t.request('getSignatureStatuses', [signatures, cfg], rest);
}
