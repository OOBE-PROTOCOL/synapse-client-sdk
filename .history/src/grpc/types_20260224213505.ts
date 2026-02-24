/**
 * @module grpc/types
 * @description gRPC transport types — optional peer dependency on `@grpc/grpc-js`.
 * Defines configuration interfaces and type aliases for the gRPC transport layer.
 * @since 1.0.0
 */

/**
 * Configuration for initializing a {@link GrpcTransport} instance.
 *
 * @example
 * ```ts
 * const config: GrpcTransportConfig = {
 *   endpoint: 'localhost:50051',
 *   protoPath: './proto/geyser.proto',
 *   packageName: 'geyser',
 *   tls: false,
 * };
 * ```
 * @since 1.0.0
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

/**
 * Per-call options for gRPC unary requests.
 *
 * @since 1.0.0
 */
export interface GrpcCallOptions {
  deadline?: number;
  metadata?: Record<string, string>;
}

/**
 * Minimal gRPC unary method signature (callback-style).
 *
 * @typeParam TReq - The request message type.
 * @typeParam TRes - The response message type.
 * @since 1.0.0
 */
export type UnaryMethod<TReq, TRes> = (
  request: TReq,
  callback: (error: Error | null, response: TRes) => void
) => void;
