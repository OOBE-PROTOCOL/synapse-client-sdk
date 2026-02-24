import type * as grpc from '@grpc/grpc-js';
import type * as protoLoader from '@grpc/proto-loader';

export interface GrpcClientConfig {
  endpoint: string;
  credentials?: grpc.ChannelCredentials;
  loaderOptions?: protoLoader.Options;
  metadata?: grpc.Metadata;
}

export interface GrpcServiceConfig {
  protoPath: string;
  packageName?: string;
  serviceName: string;
}
