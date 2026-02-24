/**
 * @module rpc/methods/get-health
 * @description Returns the current health status of the node.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';

/**
 * Fetch the current health status of the node.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns `"ok"` if the node is healthy, otherwise an error is thrown
 *
 * @example
 * ```ts
 * const status = await getHealth(transport);
 * console.log(`Node health: ${status}`);
 * ```
 *
 * @since 1.0.0
 */
export async function getHealth(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<string> {
  return t.request('getHealth', [], opts);
}
