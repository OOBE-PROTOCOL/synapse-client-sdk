/**
 * @module rpc/methods/get-version
 * @description Returns the current Solana version running on the node.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

/**
 * Fetch the current Solana version running on the node.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Object containing the solana-core version string and feature-set identifier
 *
 * @example
 * ```ts
 * const version = await getVersion(transport);
 * console.log(version['solana-core']);
 * ```
 *
 * @since 1.0.0
 */
export async function getVersion(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ 'solana-core': string; 'feature-set': number }> {
  return t.request('getVersion', [], opts);
}
