import type { Commitment as Web3Commitment, RpcResponseAndContext } from '@solana/web3.js';

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type Base58String = Brand<string, 'Base58String'>;
export type PublicKeyString = Brand<Base58String, 'PublicKeyString'>;
export type SignatureString = Brand<Base58String, 'SignatureString'>;

export type Slot = Brand<number, 'Slot'>;
export type Epoch = Brand<number, 'Epoch'>;
export type Lamports = Brand<bigint, 'Lamports'>;

export type Commitment = Web3Commitment | 'processed' | 'confirmed' | 'finalized';

export type RpcContext<T> = RpcResponseAndContext<T>;

export const toBase58 = (value: string): Base58String => value as Base58String;
export const toPublicKeyString = (value: string): PublicKeyString => value as PublicKeyString;
export const toSignatureString = (value: string): SignatureString => value as SignatureString;

export const toSlot = (value: number): Slot => value as Slot;
export const toEpoch = (value: number): Epoch => value as Epoch;
export const toLamports = (value: number | bigint): Lamports => BigInt(value) as Lamports;

export interface RpcPaginationOptions {
  page?: number;
  limit?: number;
}

export interface RpcSortOptions {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}
