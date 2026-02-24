/**
 * GrpcTransport — thin adapter over @grpc/grpc-js.
 * Uses dynamic require so the module stays optional.
 */
import type { GrpcTransportConfig, GrpcCallOptions } from './types';

type GrpcModule = typeof import('@grpc/grpc-js');
type ProtoLoaderModule = typeof import('@grpc/proto-loader');

export class GrpcTransport {
  private grpc!: GrpcModule;
  private protoLoader!: ProtoLoaderModule;
  private services = new Map<string, any>();
  private loaded = false;

  constructor(private readonly cfg: GrpcTransportConfig) {}

  /** Lazy-load grpc dependencies */
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

  /** Load a .proto and register all services */
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

  /** Get or create a service stub */
  getService<T = any>(serviceName: string): T {
    this.ensureLoaded();
    const Ctor = this.services.get(serviceName);
    if (!Ctor) throw new Error(`Service "${serviceName}" not loaded. Call loadProto() first.`);

    const creds = this.cfg.tls
      ? this.grpc.credentials.createSsl()
      : this.grpc.credentials.createInsecure();

    return new Ctor(this.cfg.endpoint, creds) as T;
  }

  /** Generic unary call with promise wrapper + deadline */
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

  close(): void {
    // Services are lightweight stubs; no explicit close needed.
    this.services.clear();
  }
}
