/**
 * @module grpc/transport
 * @description GrpcTransport — thin adapter over `@grpc/grpc-js`.
 * Uses dynamic `require` so the module stays optional. Provides proto
 * loading, service stub creation, and promise-based unary calls.
 * @since 1.0.0
 */
import type { GrpcTransportConfig, GrpcCallOptions } from './types';

// Dynamic types — resolved at runtime only
type GrpcModule = any;
type ProtoLoaderModule = any;

/**
 * Thin adapter over `@grpc/grpc-js` for performing gRPC calls.
 *
 * Dependencies (`@grpc/grpc-js`, `@grpc/proto-loader`) are loaded lazily
 * at runtime so they remain optional peer dependencies.
 *
 * @example
 * ```ts
 * const transport = new GrpcTransport({
 *   endpoint: 'localhost:50051',
 *   protoPath: './geyser.proto',
 *   packageName: 'geyser',
 * });
 * transport.loadProto();
 * const svc = transport.getService<GeyserService>('Geyser');
 * const result = await transport.unary(svc, 'GetSlot', {});
 * ```
 * @since 1.0.0
 */
export class GrpcTransport {
  private grpc!: GrpcModule;
  private protoLoader!: ProtoLoaderModule;
  private services = new Map<string, any>();
  private loaded = false;

  /**
   * Create a new gRPC transport instance.
   *
   * @param cfg - Transport configuration options.
   * @since 1.0.0
   */
  constructor(private readonly cfg: GrpcTransportConfig) {}

  /**
   * Lazy-load gRPC dependencies (`@grpc/grpc-js` and `@grpc/proto-loader`).
   *
   * @throws {Error} If the peer dependencies are not installed.
   * @since 1.0.0
   */
  private ensureLoaded(): void {
    if (this.loaded) return;
    try {
      this.grpc = require('@grpc/grpc-js');
      this.protoLoader = require('@grpc/proto-loader');
    } catch {
      throw new Error(
        'gRPC transport requires @grpc/grpc-js and @grpc/proto-loader as peer dependencies. ' +
        'Install them: pnpm add @grpc/grpc-js @grpc/proto-loader'
      );
    }
    this.loaded = true;
  }

  /**
   * Load a `.proto` file and register all discovered service constructors.
   *
   * @param protoPath - Path to the `.proto` file. Falls back to {@link GrpcTransportConfig.protoPath}.
   * @param packageName - Dot-separated package name. Falls back to {@link GrpcTransportConfig.packageName}.
   * @throws {Error} If no proto path is provided or a package segment is missing.
   * @since 1.0.0
   */
  loadProto(protoPath?: string, packageName?: string): void {
    this.ensureLoaded();
    const path = protoPath ?? this.cfg.protoPath;
    if (!path) throw new Error('No protoPath provided');

    const definition = this.protoLoader.loadSync(path, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    let root = this.grpc.loadPackageDefinition(definition);
    const pkg = packageName ?? this.cfg.packageName;
    if (pkg) {
      for (const segment of pkg.split('.')) {
        root = (root as any)[segment];
        if (!root) throw new Error(`Package segment not found: ${segment}`);
      }
    }

    // Register every service constructor found
    for (const [name, value] of Object.entries(root)) {
      if (typeof value === 'function' && (value as any).service) {
        this.services.set(name, value);
      }
    }
  }

  /**
   * Get or create a gRPC service stub connected to the configured endpoint.
   *
   * @typeParam T - The expected service stub type.
   * @param serviceName - Name of the service as defined in the `.proto` file.
   * @returns A connected service stub instance.
   * @throws {Error} If the service has not been loaded via {@link loadProto}.
   * @since 1.0.0
   */
  getService<T = any>(serviceName: string): T {
    this.ensureLoaded();
    const Ctor = this.services.get(serviceName);
    if (!Ctor) throw new Error(`Service "${serviceName}" not loaded. Call loadProto() first.`);

    const creds = this.cfg.tls
      ? this.grpc.credentials.createSsl()
      : this.grpc.credentials.createInsecure();

    return new Ctor(this.cfg.endpoint, creds) as T;
  }

  /**
   * Execute a unary gRPC call wrapped in a promise.
   *
   * Automatically applies metadata and deadline from both the transport
   * configuration and per-call options.
   *
   * @typeParam TReq - Request message type.
   * @typeParam TRes - Response message type.
   * @param service - The service stub obtained from {@link getService}.
   * @param method - The RPC method name on the service.
   * @param request - The request payload.
   * @param opts - Optional per-call overrides for deadline and metadata.
   * @returns A promise that resolves with the response message.
   * @since 1.0.0
   */
  unary<TReq, TRes>(
    service: any,
    method: string,
    request: TReq,
    opts: GrpcCallOptions = {}
  ): Promise<TRes> {
    this.ensureLoaded();
    const fn = service[method];
    if (typeof fn !== 'function') {
      return Promise.reject(new Error(`Method "${method}" not found on service`));
    }

    const meta = new this.grpc.Metadata();
    const allMeta = { ...this.cfg.metadata, ...opts.metadata };
    for (const [k, v] of Object.entries(allMeta)) {
      meta.set(k, v);
    }

    const deadline = opts.deadline ?? this.cfg.deadline;
    const callOpts = deadline ? { deadline: Date.now() + deadline } : {};

    return new Promise<TRes>((resolve, reject) => {
      fn.call(service, request, meta, callOpts, (err: Error | null, res: TRes) => {
        err ? reject(err) : resolve(res);
      });
    });
  }

  /**
   * Clear all cached service stubs.
   *
   * @since 1.0.0
   */
  close(): void {
    // Services are lightweight stubs; no explicit close needed.
    this.services.clear();
  }
}
