import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { GrpcClientConfig, GrpcServiceConfig } from './types';

export class GrpcGatewayClient {
  private grpcObject?: grpc.GrpcObject;
  private loadedPackages = new Map<string, grpc.GrpcObject>();

  constructor(private config: GrpcClientConfig) {}

  loadProto(protoPath: string, packageName?: string): grpc.GrpcObject {
    const cacheKey = `${protoPath}:${packageName ?? ''}`;
    const cached = this.loadedPackages.get(cacheKey);
    if (cached) return cached;

    const definition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      ...(this.config.loaderOptions ?? {})
    });

    const grpcObject = grpc.loadPackageDefinition(definition);
    const scoped = packageName ? (grpcObject as any)[packageName] ?? grpcObject : grpcObject;

    this.loadedPackages.set(cacheKey, scoped);
    this.grpcObject = scoped;
    return scoped;
  }

  getService<TClient extends grpc.Client>(serviceName: string, grpcObject?: grpc.GrpcObject): TClient {
    const root = grpcObject ?? this.grpcObject;
    if (!root) {
      throw new Error('gRPC package not loaded. Call loadProto() first.');
    }

    const ServiceCtor = (root as any)[serviceName] as grpc.ServiceClientConstructor | undefined;
    if (!ServiceCtor) {
      throw new Error(`gRPC service not found: ${serviceName}`);
    }

    return new ServiceCtor(
      this.config.endpoint,
      this.config.credentials ?? grpc.credentials.createInsecure()
    ) as TClient;
  }

  createService<TClient extends grpc.Client>(config: GrpcServiceConfig): TClient {
    const grpcObject = this.loadProto(config.protoPath, config.packageName);
    return this.getService<TClient>(config.serviceName, grpcObject);
  }

  callUnary<TRequest, TResponse>(
    client: grpc.Client,
    method: string,
    request: TRequest,
    metadata: grpc.Metadata = this.config.metadata ?? new grpc.Metadata(),
    options: grpc.CallOptions = {}
  ): Promise<TResponse> {
    const fn = (client as any)[method] as
      | ((req: TRequest, meta: grpc.Metadata, opts: grpc.CallOptions, cb: grpc.requestCallback<TResponse>) => void)
      | ((req: TRequest, meta: grpc.Metadata, cb: grpc.requestCallback<TResponse>) => void)
      | ((req: TRequest, cb: grpc.requestCallback<TResponse>) => void)
      | undefined;

    if (!fn) {
      return Promise.reject(new Error(`gRPC method not found: ${method}`));
    }

    return new Promise<TResponse>((resolve, reject) => {
      const callback: grpc.requestCallback<TResponse> = (err, response) => {
        if (err) reject(err);
        else resolve(response as TResponse);
      };

      if (fn.length === 4) {
        fn.call(client, request, metadata, options, callback);
      } else if (fn.length === 3) {
        fn.call(client, request, metadata, callback);
      } else {
        fn.call(client, request, callback);
      }
    });
  }
}
