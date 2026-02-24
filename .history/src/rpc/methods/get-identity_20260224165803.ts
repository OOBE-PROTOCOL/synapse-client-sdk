/**
 * @module rpc/methods/get-identity
 * @description Returns the identity public key for the current node.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { Pubkey } from '../../core/types';

/**
 * Fetch the identity public key for the current node.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Object containing the identity public key of the node
 *
 * @example
 * ```ts
 * const { identity } = await getIdentity(transport);
 * console.log(`Node identity: ${identity}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getIdentity(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<{ identity: Pubkey }> {
  return t.request('getIdentity', [], opts);
}
