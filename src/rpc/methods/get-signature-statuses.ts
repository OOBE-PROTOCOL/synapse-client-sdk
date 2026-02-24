/**
 * @module rpc/methods/get-signature-statuses
 * @description Returns the confirmation status for one or more transaction signatures.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Signature, SignatureStatus, RpcContext } from '../../core/types';

/**
 * Options for {@link getSignatureStatuses}.
 *
 * @since 1.0.0
 */
export interface GetSignatureStatusesOpts extends CallOptions {
  searchTransactionHistory?: boolean;
}

/**
 * Poll the confirmation status for one or more transaction signatures.
 *
 * @param t - HTTP transport instance
 * @param signatures - Array of transaction signatures to query
 * @param opts - Options including whether to search transaction history
 * @returns Array of signature statuses (or `null` for unknown signatures) wrapped in RPC context
 *
 * @example
 * ```ts
 * const { value } = await getSignatureStatuses(transport, [sig1, sig2]);
 * ```
 *
 * @since 1.0.0
 */
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
