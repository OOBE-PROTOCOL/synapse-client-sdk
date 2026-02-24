import type { SynapseClient } from '../../client';
import type { RpcCallOptions, RpcGatewayConfig, RpcTransport } from './types';

export class SynapseTransport implements RpcTransport {
  constructor(private client: SynapseClient) {}

  request<T = unknown>(method: string, params: unknown[] = [], options: RpcCallOptions = {}): Promise<T> {
    return this.client.call<T>(method, params, options);
  }
}

export class RpcGatewayClient {
  constructor(private transport: RpcTransport) {}

  call<T = unknown>(method: string, params: unknown[] = [], options: RpcCallOptions = {}): Promise<T> {
    return this.transport.request<T>(method, params, options);
  }

  withDefaults(defaults: RpcCallOptions): RpcGatewayClient {
    const transport = this.transport;
    return new RpcGatewayClient({
      request<T = unknown>(method: string, params: unknown[] = [], options: RpcCallOptions = {}): Promise<T> {
        return transport.request<T>(method, params, { ...defaults, ...options });
      }
    });
  }

  static fromSynapseClient(client: SynapseClient): RpcGatewayClient {
    return new RpcGatewayClient(new SynapseTransport(client));
  }

  static fromTransport(transport: RpcTransport): RpcGatewayClient {
    return new RpcGatewayClient(transport);
  }

  static fromConfig(config: RpcGatewayConfig): RpcGatewayClient {
    const { SynapseClient: ClientCtor } = require('../../client') as { SynapseClient: new (cfg: RpcGatewayConfig) => SynapseClient };
    const client = new ClientCtor(config);
    return RpcGatewayClient.fromSynapseClient(client);
  }
}
