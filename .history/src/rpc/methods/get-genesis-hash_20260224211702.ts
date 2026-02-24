/**
 * @module rpc/methods/get-genesis-hash
 * @description Returns the genesis hash of the ledger.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

/**
 * Fetch the genesis hash of the ledger.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Base-58 encoded genesis hash string
 *
 * @example
 * ```ts
 * const hash = await getGenesisHash(transport);
 * console.log(`Genesis hash: ${hash}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getGenesisHash(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<string> {
  return t.request('getGenesisHash', [], opts);
}
