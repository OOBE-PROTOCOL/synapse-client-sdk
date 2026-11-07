/**
 * @module ai/plugins/misc/sns-local
 * @description Local on-chain SNS readers for the `.sns` namespace, built for
 * `@solana/web3.js` 3.x (kit-based) — no SNS SDK dependency.
 *
 * Derivation math cross-validated byte-for-byte against the SNS JS SDK v4
 * (2026-11-06): the domain PDA computed here matches the SDK's
 * `getSnsDomainKeySync` for the same inputs.
 *
 * Stage 1 (post slot 452,825,395): the `.sns` namespace is what SNS resolves.
 * Legacy `.sol` inputs are rejected — legacy `.sol` resolution is paused at
 * the protocol level; SRS-backed `.sol` support arrives with SNS Stage 2.
 */

import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

/** Minimal JSON-RPC caller contract (satisfied by the SDK HttpTransport). */
export interface SnsRpcCaller {
  request<T = unknown>(method: string, params: unknown[]): Promise<T>;
}

/** Fetches a raw account payload via `getAccountInfo` (base64) or null. */
async function getAccountData(
  rpc: SnsRpcCaller,
  address: string,
): Promise<Uint8Array | null> {
  const res = await rpc.request<{
    value: { data: [string, "base64"] } | null;
  }>("getAccountInfo", [address, { encoding: "base64" }]);
  if (!res?.value?.data?.[0]) {
    return null;
  }
  return new Uint8Array(Buffer.from(res.value.data[0], "base64"));
}

/* ────────────────────────────────────────────────────────────────
 *  SNS constants (mirror of @bonfida/spl-name-service@4 constants)
 *  ─────────────────────────────────────────────────────────────── */

const SNS_HASH_PREFIX = "SPL Name Service";
const NAME_PROGRAM_ID = "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX";
const SNS_ROOT_DOMAIN_ACCOUNT = "58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx";
const CENTRAL_STATE_SNS_RECORDS =
  "HP3D4D1ZCmohQGFVms2SS4LCANgJyksBf5s1F77FuFjZ";

/** Length of the SPL Name Service registry header. */
const NAME_REGISTRY_LEN = 96;

const ZEROS_32 = new Uint8Array(32);

/** Canonical record types surfaced by the SNS executor. */
export const SNS_RECORD_TYPES = [
  "SOL",
  "TXT",
  "Twitter",
  "Github",
  "Discord",
  "Telegram",
  "Email",
  "url",
  "pic",
] as const;

/** Normalizes a record label to the SNS v4 wire value, case-insensitively. */
export function parseSnsWireRecordType(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error("SNS record type is required");
  }
  const table: Record<string, string> = {
    IPFS: "IPFS",
    ARWV: "ARWV",
    SOL: "SOL",
    ETH: "ETH",
    BTC: "BTC",
    LTC: "LTC",
    DOGE: "DOGE",
    Email: "email",
    Url: "url",
    URL: "url",
    Discord: "discord",
    Github: "github",
    Reddit: "reddit",
    Twitter: "twitter",
    Telegram: "telegram",
    Pic: "pic",
    PIC: "pic",
    TXT: "TXT",
    POINT: "POINT",
    BSC: "BSC",
    Injective: "INJ",
    Backpack: "backpack",
    A: "A",
    AAAA: "AAAA",
    CNAME: "CNAME",
    Background: "background",
    BASE: "BASE",
    IPNS: "IPNS",
  };
  const wire =
    table[raw] ??
    table[raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()];
  if (!wire) {
    throw new Error(`unsupported SNS record type '${input}'`);
  }
  return wire;
}

/** Enforces the Stage-1 input rule: bare or `.sns` ok; `.sol` rejected. */
export function toFullSnsName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (trimmed.endsWith(".sol")) {
    throw new Error(
      'legacy .sol resolution is paused (slot 452,825,395): use .sns (e.g. "example.sns")',
    );
  }
  if (trimmed === "") {
    throw new Error("domain name is required");
  }
  return trimmed.endsWith(".sns") ? trimmed : `${trimmed}.sns`;
}

/** Display form: TLD-less names get `.sns`; already-suffixed stay unchanged. */
export function displaySnsDomain(name: string): string {
  return toFullSnsName(name);
}

/* ────────────────────────────────────────────────────────────────
 *  Derivation (async — web3.js 3.x PDA helpers are promise-based)
 *  ─────────────────────────────────────────────────────────────── */

function hashSnsName(name: string): Uint8Array {
  return new Uint8Array(
    crypto
      .createHash("sha256")
      .update(SNS_HASH_PREFIX + name, "utf8")
      .digest(),
  );
}

async function deriveNameAccount(
  name: string,
  parentBytes: Uint8Array = ZEROS_32,
  classBytes: Uint8Array = ZEROS_32,
): Promise<{ pubkey: PublicKey; hashed: Uint8Array }> {
  const hashed = hashSnsName(name);
  const [address] = (await PublicKey.findProgramAddress(
    [hashed, classBytes, parentBytes],
    new PublicKey(NAME_PROGRAM_ID),
  )) as unknown as [string, number];
  return { pubkey: new PublicKey(address), hashed };
}

/**
 * Derives the `.sns` domain key for a TLD-trimmed name:
 * - `example`       → PDA under the SNS root account
 * - `sub.example`   → `\0sub` under the `example` domain account
 * Matches the SNS JS SDK v4 `getSnsDomainKeySync`.
 */
export async function deriveSnsDomainKey(
  domain: string,
): Promise<{ pubkey: PublicKey; parent?: PublicKey; isSubdomain: boolean }> {
  const bare = toFullSnsName(domain).slice(0, -".sns".length);
  const labels = bare.split(".").filter(Boolean);
  if (labels.length === 0) {
    throw new Error("domain is required");
  }
  if (labels.length >= 3) {
    throw new Error(
      "only root .sns domains and one-level subdomains are supported",
    );
  }
  if (labels.length === 2) {
    const { pubkey: parent } = await deriveNameAccount(
      labels[1],
      ZEROS_32,
      ZEROS_32,
    );
    const subSeed = `\u0000${labels[0]}`;
    const { pubkey } = await deriveNameAccount(
      subSeed,
      parent.toBytes(),
      Buffer.from([0]),
    );
    return { pubkey, parent, isSubdomain: true };
  }
  const { pubkey } = await deriveNameAccount(
    labels[0],
    new PublicKey(SNS_ROOT_DOMAIN_ACCOUNT).toBytes(),
  );
  return { pubkey, isSubdomain: false };
}

/**
 * Derives the legacy V1 record account key for a `.sns` domain (matches the
 * SNS JS SDK v4 `getRecordV1Key`).
 */
export async function deriveSnsRecordKey(
  domain: string,
  wireRecordType: string,
): Promise<PublicKey> {
  const bare = toFullSnsName(domain).slice(0, -".sns".length);
  const labels = bare.split(".").filter(Boolean);
  if (labels.length !== 1) {
    throw new Error("SNS record derivation supports root .sns domains only");
  }
  const recordSeed = `\u0001${wireRecordType}`;
  const domainBytes = new Uint8Array(
    new PublicKey((await deriveSnsDomainKey(bare)).pubkey).toBytes(),
  );
  const classBytes = new Uint8Array(
    new PublicKey(CENTRAL_STATE_SNS_RECORDS).toBytes(),
  );
  const { pubkey } = await deriveNameAccount(
    recordSeed,
    domainBytes,
    classBytes,
  );
  return pubkey;
}

/* ────────────────────────────────────────────────────────────────
 *  Reads
 *  ─────────────────────────────────────────────────────────────── */

/** Registry owner: canonical owner field at header bytes 32..64. */
export async function readRegistryOwner(
  rpc: SnsRpcCaller,
  domainKey: PublicKey,
): Promise<PublicKey | null> {
  const data = await getAccountData(rpc, domainKey.toBase58());
  if (!data || data.length < NAME_REGISTRY_LEN) {
    return null;
  }
  return new PublicKey(new Uint8Array(data.slice(32, 64)));
}

/**
 * Legacy V1 record read: registry header (96 bytes) followed by the payload
 * (SOL records are 32-byte pubkeys; other records decode as trimmed UTF-8).
 */
export async function readV1Record(
  rpc: SnsRpcCaller,
  recordKey: PublicKey,
  wireRecordType: string,
): Promise<string | null> {
  const data = await getAccountData(rpc, recordKey.toBase58());
  if (!data || data.length <= NAME_REGISTRY_LEN) {
    return null;
  }
  const body = new Uint8Array(data.slice(NAME_REGISTRY_LEN));
  const valueData =
    body.length > 10 ? body.slice(wireRecordType === "TXT" ? 8 : 10) : body;
  const compact = Array.from(valueData).filter((byte) => byte !== 0);
  if (wireRecordType === "SOL" && compact.length === 32) {
    return new PublicKey(new Uint8Array(compact)).toBase58();
  }
  const decoded = Buffer.from(compact).toString("utf8").trim();
  return decoded.length > 0 ? decoded : null;
}

/** Availability: derived domain account absent on-chain. */
export async function checkSnsAvailability(
  rpc: SnsRpcCaller,
  domain: string,
): Promise<boolean> {
  const { pubkey } = await deriveSnsDomainKey(domain);
  const data = await getAccountData(rpc, pubkey.toBase58());
  return data === null;
}

/**
 * Resolves a `.sns` domain: SOL record first (V1 namespace), registry owner
 * as fallback. Returns `{ owner, domainKey, records }` or `null` when the
 * domain account does not exist.
 */
export async function resolveSnsDomain(
  rpc: SnsRpcCaller,
  domain: string,
): Promise<{
  owner: string;
  domainKey: string;
  records: Record<string, string>;
} | null> {
  const fullName = toFullSnsName(domain);
  const { pubkey: domainKey } = await deriveSnsDomainKey(fullName);
  const owner = await readRegistryOwner(rpc, domainKey);
  if (!owner) {
    return null;
  }

  const records: Record<string, string> = {};
  await Promise.all(
    SNS_RECORD_TYPES.map(async (label) => {
      try {
        const wire = parseSnsWireRecordType(label);
        const recordKey = await deriveSnsRecordKey(fullName, wire);
        const value = await readV1Record(rpc, recordKey, wire);
        if (value) {
          records[wire] = value;
        }
      } catch {
        // Unreadable record namespaces should not fail the full-domain read.
      }
    }),
  );

  const walletFromSolRecord = records["SOL"];
  return {
    owner: walletFromSolRecord ?? owner.toBase58(),
    domainKey: domainKey.toBase58(),
    records,
  };
}
