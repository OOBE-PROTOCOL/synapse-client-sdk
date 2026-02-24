/**
 * @module rpc/methods/get-cluster-nodes
 * @description Returns information about all the nodes participating in the cluster.
 * @since 1.0.0
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { ContactInfo } from '../../core/types';

/**
 * Fetch information about all nodes participating in the cluster.
 *
 * @param t - HTTP transport instance
 * @param opts - Additional call options
 * @returns Array of contact information for each cluster node
 *
 * @example
 * ```ts
 * const nodes = await getClusterNodes(transport);
 * console.log(`Cluster has ${nodes.length} nodes`);
 * ```
 *
 * @since 1.0.0
 */
export async function getClusterNodes(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<ContactInfo[]> {
  return t.request('getClusterNodes', [], opts);
}
