/**
 * gRPC transport types — optional peer dependency on @grpc/grpc-js.
 */

export interface GrpcTransportConfig {
  endpoint: string;
  /** Path to .proto file for custom services */
  protoPath?: string;
  /** Package name inside the proto definition */
  packageName?: string;
  /** If true, use TLS credentials (default: insecure) */
  tls?: boolean;
  /** Custom metadata sent with every call */
  metadata?: Record<string, string>;
  /** Deadline in ms for unary calls */
  deadline?: number;
}

export interface GrpcCallOptions {
  deadline?: number;
  metadata?: Record<string, string>;
}

/**
 * Minimal gRPC unary method signature.
 * Matches both generated stubs and dynamic clients.
 */
export type UnaryMethod<TReq, TRes> = (
  request: TReq,
  callback: (error: Error | null, response: TRes) => void
) => void;
