/**
 * getClusterNodes — returns information about all the nodes participating in the cluster.
 */
import type { HttpTransport, CallOptions } from '../../core/transport';
import type { ContactInfo } from '../../core/types';

export async function getClusterNodes(
  t: HttpTransport,
  opts: CallOptions = {}
): Promise<ContactInfo[]> {
  return t.request('getClusterNodes', [], opts);
}
