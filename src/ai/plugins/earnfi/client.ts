/**
 * @module ai/plugins/earnfi/client
 * @description Self-contained HTTP + x402 client for the EarnFi Agent API.
 * No external @earnfi/* npm dependency — uses fetch + optional @solana/web3.js for payments.
 * @since 2.0.6
 */

export const EARNFI_DEFAULT_API_BASE = 'https://app.earnfi.fun/api/ai-agent/v1';

export type EarnFiWalletLike = {
  publicKey: { toBase58(): string };
  signTransaction: (tx: unknown) => Promise<unknown>;
};

export type X402Accept = {
  scheme: 'exact';
  network: string;
  amount: string;
  payTo: string;
  asset: string;
  extra?: { feePayer?: string; tokenDecimals?: number };
  [k: string]: unknown;
};

export type X402Challenge = {
  x402Version: number;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: X402Accept[];
};

export type EarnFiHttpClientConfig = {
  baseUrl?: string;
  agentToken?: string;
  wallet?: EarnFiWalletLike;
  connection?: unknown;
  fetchImpl?: typeof fetch;
};

function b64encodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64');
}

function b64decodeJson(b64: string): unknown {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function paymentRequiredHeader(headers: Headers): string | null {
  return headers.get('payment-required') ?? headers.get('PAYMENT-REQUIRED');
}

async function parseJsonResponse(r: Response): Promise<{ status: number; headers: Headers; json: unknown }> {
  const text = await r.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { status: r.status, headers: r.headers, json };
}

/**
 * @description HTTP client for EarnFi Agent API (`ai-agent/v1`).
 */
export class EarnFiHttpClient {
  readonly baseUrl: string;
  readonly agentToken?: string;
  readonly wallet?: EarnFiWalletLike;
  readonly connection?: unknown;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EarnFiHttpClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? EARNFI_DEFAULT_API_BASE).replace(/\/$/, '');
    this.agentToken = config.agentToken;
    this.wallet = config.wallet;
    this.connection = config.connection;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private url(path: string, params?: Record<string, string | undefined>): string {
    const u = new URL(path.replace(/^\//, ''), this.baseUrl + '/');
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') u.searchParams.set(k, v);
      }
    }
    return u.toString();
  }

  async get(path: string, params?: Record<string, string | undefined>) {
    const r = await this.fetchImpl(this.url(path, params), { method: 'GET' });
    return parseJsonResponse(r);
  }

  async post(path: string, body: unknown, params?: Record<string, string | undefined>) {
    const r = await this.fetchImpl(this.url(path, params), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return parseJsonResponse(r);
  }

  /** GET that handles 402 → sign USDC tx → retry with PAYMENT-SIGNATURE. */
  async x402Get(path: string, params?: Record<string, string | undefined>) {
    const target = this.url(path, params);
    const r1 = await this.fetchImpl(target, { method: 'GET' });
    if (r1.status !== 402) {
      return parseJsonResponse(r1);
    }

    const header = paymentRequiredHeader(r1.headers);
    if (!header) {
      const t = await r1.text();
      throw new Error(`402 without Payment-Required header: ${t}`);
    }

    const challenge = b64decodeJson(header) as X402Challenge;
    const accept = challenge.accepts?.[0];
    if (!accept) throw new Error('402 challenge missing accepts[0]');

    const paymentSig = await this.signExactSvmPayment(accept);
    const r2 = await this.fetchImpl(target, {
      method: 'GET',
      headers: { 'PAYMENT-SIGNATURE': b64encodeJson(paymentSig) },
    });
    const parsed = await parseJsonResponse(r2);
    return { ...parsed, paymentRequired: challenge };
  }

  private async signExactSvmPayment(requirements: X402Accept): Promise<{ signed_tx: string; requirements: X402Accept }> {
    if (!this.wallet || !this.connection) {
      throw new Error(
        'EarnFi paid creates require wallet + connection in createEarnFiPlugin(). ' +
          'Install peer deps: @solana/web3.js @solana/spl-token',
      );
    }

    const web3 = await import('@solana/web3.js');
    const spl = await import('@solana/spl-token');

    const { PublicKey, Transaction, ComputeBudgetProgram } = web3;
    const { getAssociatedTokenAddressSync, createTransferCheckedInstruction } = spl;

    const connection = this.connection as InstanceType<typeof web3.Connection>;
    const mint = new PublicKey(requirements.asset);
    const payTo = new PublicKey(requirements.payTo);
    const feePayerStr =
      requirements.extra && typeof requirements.extra === 'object' ? requirements.extra.feePayer : null;
    const walletPk = new PublicKey(this.wallet.publicKey.toBase58());
    const feePayer = feePayerStr ? new PublicKey(String(feePayerStr)) : walletPk;

    const decimalsRaw =
      requirements.extra && typeof requirements.extra === 'object' ? requirements.extra.tokenDecimals : null;
    const decimals = typeof decimalsRaw === 'number' ? decimalsRaw : 6;
    const amountAtomic = BigInt(String(requirements.amount));

    const requireAta = async (owner: InstanceType<typeof PublicKey>, label: string) => {
      const ata = getAssociatedTokenAddressSync(mint, owner, true);
      const info = await connection.getAccountInfo(ata, 'finalized');
      if (!info) {
        throw new Error(`Missing ${label} USDC ATA (${ata.toBase58()}). Fund ATAs before paying.`);
      }
      return ata;
    };

    const fromAta = await requireAta(walletPk, 'sender');
    const toAta = await requireAta(payTo, 'recipient (payTo)');

    const tx = new Transaction();
    tx.feePayer = feePayer;
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 15_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: BigInt(1) }));
    tx.add(createTransferCheckedInstruction(fromAta, mint, toAta, walletPk, amountAtomic, decimals));

    const signed = (await this.wallet.signTransaction(tx)) as InstanceType<typeof Transaction>;
    const signedBytes = signed.serialize({ requireAllSignatures: false, verifySignatures: false });

    return {
      signed_tx: Buffer.from(signedBytes).toString('base64'),
      requirements,
    };
  }

  tokenParam(): Record<string, string | undefined> {
    return this.agentToken ? { agent_token: this.agentToken } : {};
  }
}
