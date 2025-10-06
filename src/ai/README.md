# AI Module - OOBE Protocol

Professional AI module with OOBE Protocol implementation for advanced Solana operations including PDA management, Zero-Combine data fetching, and Merkle tree operations.

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Components](#components)
- [OOBE Protocol](#oobe-protocol)
- [Implementation](#implementation)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Module (OOBE)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  PDA Manager   │  │  Zero-Combine   │  │    Merkle       │ │
│  │  (Address      │→ │    Fetcher      │→ │  Operations     │ │
│  │  Derivation)   │  │ (Data Reconst.) │  │ (Proof Gen.)    │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
│          ↓                    ↓                      ↓          │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   On-Chain     │  │  Batch Proof    │  │   Transaction   │ │
│  │    Storage     │  │  Verification   │  │    Signing      │ │
│  │   (Solana)     │  │   (Multi-PDA)   │  │   (Optional)    │ │
│  └────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    OOBE Protocol Layer                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **PDA Management** | Program Derived Address generation and verification | Production |
| **Zero-Combine** | Large dataset reconstruction from on-chain chunks | Production |
| **Merkle Operations** | Tree generation, proof creation, verification | Production |
| **Batch Operations** | Multi-wallet and multi-PDA batch processing | Production |
| **Transaction Signing** | Optional transaction construction and signing | Production |
| **OOBE Protocol** | Full OOBE Protocol implementation | Production |
| **Retry Logic** | Automatic retry with exponential backoff | Production |
| **Event Emission** | Progress tracking and error handling | Production |

---

## Components

### 1. PDA Manager

Program Derived Address management for on-chain Merkle data storage.

```typescript
import { SynapseClient } from '@synapse/client-sdk';
import { PDAManager } from '@synapse/client-sdk/ai';

const client = new SynapseClient({ 
  endpoint: process.env.SYNAPSE_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY 
});

const pdaManager = new PDAManager(client, 'walletAddress');

// Get PDAs for wallet
const pdas = pdaManager.getUserPDAs();
console.log('Leaf PDA:', pdas.leafPDA.toBase58());
console.log('Root PDA:', pdas.rootPDA.toBase58());

// Check PDA existence
const { leafExists, rootExists } = await pdaManager.checkPDAExistence(pdas);

// Batch check multiple PDAs
const accounts = await pdaManager.getBatchPDAAccountInfo([
  pdas.leafPDA, 
  pdas.rootPDA
]);
```

**Features:**
- Deterministic PDA derivation
- Existence verification
- Batch account queries
- Event emission for tracking

---

### 2. Zero-Combine Fetcher

Large dataset reconstruction from on-chain transaction chunks.

```typescript
import { ZeroCombineFetcher } from '@synapse/client-sdk/ai';

const fetcher = new ZeroCombineFetcher(
  client,
  'walletAddress',
  {
    batchSize: 100,
    delayMs: 2000,
    maxRetries: 3,
  }
);

// Fetch and reconstruct all proof records
const result = await fetcher.execute();
console.log('Proof records:', result.tools);
console.log('Merkle roots:', result.roots);

// Batch fetch for multiple wallets
const wallets = ['wallet1', 'wallet2', 'wallet3'];
const resultsMap = await fetcher.batchExecuteForWallets(wallets);

wallets.forEach(wallet => {
  const result = resultsMap.get(wallet);
  console.log(`${wallet}: ${result?.tools.length || 0} records`);
});
```

**Features:**
- Automatic pagination with configurable batch size
- Chunked data reconstruction
- Multi-wallet batch processing
- Retry logic with exponential backoff
- Progress tracking via events

---

### 3. Merkle Operations

Complete Merkle tree operations: generation, proof creation, and verification.

#### Basic Usage (Without Signing)

```typescript
import { MerkleOperation } from '@synapse/client-sdk/ai';

const merkle = new MerkleOperation(
  client,
  'walletAddress',
  {
    batchSize: 50,
    delayMs: 1000,
    maxRetries: 3,
  }
);

// Create Merkle tree
const data = ['event1', 'event2', 'event3'];
const root = merkle.createMerkleTree(data);
console.log('Merkle Root:', root);

// Generate proof
const proof = merkle.getMerkleProof('event1');
console.log('Proof:', proof);

// Verify proof
const isValid = merkle.verifyProof(
  proof.leaf, 
  proof.proof, 
  proof.root
);
console.log('Valid:', isValid);

// Batch verify multiple proofs
const proofs = [
  { leaf: 'hash1', proof: ['hash2'], root: 'rootHash' },
  { leaf: 'hash3', proof: ['hash4'], root: 'rootHash2' },
];
const results = merkle.batchVerifyProofs(proofs);
console.log('Verification results:', results);
```

#### Advanced Usage (With Transaction Signing)

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { MerkleOperation } from '@synapse/client-sdk/ai';

// Setup Connection and Keypair
const connection = new Connection('https://api.mainnet-beta.solana.com');
const signer = Keypair.fromSecretKey(/* your secret key */);

const merkle = new MerkleOperation(
  client,
  signer.publicKey.toBase58(),
  {
    batchSize: 50,
    delayMs: 1000,
    maxRetries: 3,
  }
);

// Inscribe Merkle root on-chain
const data = ['event1', 'event2', 'event3'];
const root = merkle.createMerkleTree(data);

const txSignature = await merkle.inscribeMerkleRoot(
  root,
  connection,
  signer
);

console.log('Transaction signature:', txSignature);
console.log('Explorer:', `https://solscan.io/tx/${txSignature}`);
```

**Features:**
- SHA256-based Merkle tree construction
- Efficient proof generation
- Batch proof verification
- On-chain inscription (optional)
- Transaction construction and signing

---

## OOBE Protocol

### Protocol Overview

OOBE (On-chain Off-chain Blockchain Encoding) Protocol is a data storage and retrieval system that:

1. **Splits large datasets** into manageable chunks
2. **Stores chunks** as Solana transaction memos
3. **Derives PDAs** for organized storage
4. **Reconstructs data** from distributed chunks
5. **Verifies integrity** using Merkle proofs

### Protocol Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OOBE Protocol Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Data Chunking                                           │
│     [Large Dataset] → [Chunk1, Chunk2, ..., ChunkN]        │
│                                                              │
│  2. PDA Derivation                                          │
│     [Wallet + Program] → [LeafPDA, RootPDA]                │
│                                                              │
│  3. On-Chain Storage                                        │
│     [Chunks] → [Solana Transactions with Memos]            │
│                                                              │
│  4. Data Reconstruction                                     │
│     [Transaction History] → [Combined Dataset]              │
│                                                              │
│  5. Merkle Verification                                     │
│     [Dataset + Proof] → [Verified Data]                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Use Cases

| Use Case | Description | Benefits |
|----------|-------------|----------|
| **AI Agent Storage** | Store AI agent state and memory | Decentralized, verifiable |
| **Event Logging** | Immutable audit trail | Tamper-proof, transparent |
| **Data Provenance** | Proof of data origin | Cryptographic verification |
| **Distributed Storage** | Large dataset distribution | Scalable, resilient |

---

## Implementation

### Complete Example: AI Agent State Storage

```typescript
import { SynapseClient } from '@synapse/client-sdk';
import { 
  PDAManager,
  ZeroCombineFetcher,
  MerkleOperation 
} from '@synapse/client-sdk/ai';

// Initialize client
const client = new SynapseClient({
  endpoint: process.env.SYNAPSE_ENDPOINT!,
  apiKey: process.env.SYNAPSE_API_KEY,
});

// 1. Derive PDAs for agent storage
const pdaManager = new PDAManager(client, 'agentWalletAddress');
const pdas = pdaManager.getUserPDAs();
console.log('Agent PDAs:', pdas);

// 2. Verify PDAs exist
const { leafExists, rootExists } = await pdaManager.checkPDAExistence(pdas);
if (!leafExists || !rootExists) {
  console.log('PDAs not initialized. Creating...');
  // Initialize PDAs (requires signing)
}

// 3. Fetch agent state from on-chain
const fetcher = new ZeroCombineFetcher(client, 'agentWalletAddress');
const agentState = await fetcher.execute();
console.log('Agent state loaded:', agentState.tools.length, 'records');

// 4. Create Merkle proof for verification
const merkle = new MerkleOperation(client, 'agentWalletAddress');
const events = agentState.tools.map(tool => JSON.stringify(tool));
const merkleRoot = merkle.createMerkleTree(events);

// 5. Verify specific event
const eventToVerify = events[0];
const proof = merkle.getMerkleProof(eventToVerify);
const isValid = merkle.verifyProof(proof.leaf, proof.proof, proof.root);

console.log('Event verification:', isValid ? 'VALID' : 'INVALID');
```

### Batch Processing Multiple Agents

```typescript
// Batch process multiple AI agents
const agentWallets = [
  'agent1WalletAddress',
  'agent2WalletAddress',
  'agent3WalletAddress',
];

const fetcher = new ZeroCombineFetcher(client, agentWallets[0]);
const resultsMap = await fetcher.batchExecuteForWallets(agentWallets);

agentWallets.forEach(wallet => {
  const state = resultsMap.get(wallet);
  if (state) {
    console.log(`Agent ${wallet}:`);
    console.log(`  Events: ${state.tools.length}`);
    console.log(`  Roots: ${state.roots.length}`);
  }
});
```

---

## Best Practices

### 1. PDA Management

```typescript
// ✅ Recommended: Cache PDAs
const pdaCache = new Map<string, { leafPDA: PublicKey; rootPDA: PublicKey }>();

function getPDACached(wallet: string) {
  if (pdaCache.has(wallet)) {
    return pdaCache.get(wallet)!;
  }
  
  const pdaManager = new PDAManager(client, wallet);
  const pdas = pdaManager.getUserPDAs();
  pdaCache.set(wallet, pdas);
  return pdas;
}

// ❌ Not recommended: Create new manager every time
const pdas = new PDAManager(client, wallet).getUserPDAs(); // Inefficient
```

### 2. Zero-Combine Fetching

```typescript
// ✅ Recommended: Use batch operations
const results = await fetcher.batchExecuteForWallets(wallets);

// ❌ Not recommended: Sequential fetches
for (const wallet of wallets) {
  const result = await new ZeroCombineFetcher(client, wallet).execute();
}
```

### 3. Merkle Proof Verification

```typescript
// ✅ Recommended: Batch verify proofs
const proofs = events.map(event => merkle.getMerkleProof(event));
const results = merkle.batchVerifyProofs(proofs.map(p => ({
  leaf: p.leaf,
  proof: p.proof,
  root: p.root,
})));

// ❌ Not recommended: Verify one by one
for (const event of events) {
  const proof = merkle.getMerkleProof(event);
  merkle.verifyProof(proof.leaf, proof.proof, proof.root);
}
```

### 4. Error Handling

```typescript
// ✅ Recommended: Handle errors gracefully
try {
  const result = await fetcher.execute();
} catch (error) {
  console.error('Fetch failed:', error);
  // Retry with different parameters
  const result = await fetcher.execute({ 
    batchSize: 50, 
    maxRetries: 5 
  });
}

// ❌ Not recommended: No error handling
const result = await fetcher.execute(); // May fail
```

### 5. Event Monitoring

```typescript
// ✅ Recommended: Monitor progress with events
fetcher.on('fetch-progress', ({ current, total }) => {
  console.log(`Progress: ${current}/${total} (${(current/total*100).toFixed(1)}%)`);
});

fetcher.on('fetch-error', (error) => {
  console.error('Fetch error:', error);
  // Implement recovery logic
});

fetcher.on('fetch-complete', (result) => {
  console.log('Fetch completed:', result.tools.length, 'records');
});

// ❌ Not recommended: No progress tracking
const result = await fetcher.execute(); // Black box
```

---

## API Reference

### PDAManager

#### Constructor

```typescript
constructor(client: SynapseClient, userWallet: string)
```

Creates a new PDA Manager instance.

---

#### getUserPDAs()

```typescript
getUserPDAs(): { leafPDA: PublicKey; rootPDA: PublicKey }
```

Derives PDAs for the user wallet.

**Returns:** Leaf and Root PDAs

---

#### checkPDAExistence()

```typescript
async checkPDAExistence(pdas: { 
  leafPDA: PublicKey; 
  rootPDA: PublicKey 
}): Promise<{ leafExists: boolean; rootExists: boolean }>
```

Checks if PDAs exist on-chain.

**Returns:** Existence status

---

#### BatchOptionRequest {
  batchSize: number;
  delayMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

**interface** | Option for batch reqs
---

#### getBatchPDAAccountInfo()

```typescript
async getBatchPDAAccountInfo(
  pdas: PublicKey[]
): Promise<(AccountInfo | null)[]>
```

Batch fetch account info for multiple PDAs.

**Returns:** Array of account infos

---

### ZeroCombineFetcher

#### Constructor

```typescript
constructor(
  client: SynapseClient,
  userWallet: string,
  options?: {
    batchSize?: number;
    delayMs?: number;
    maxRetries?: number;
  }
)
```

Creates a new Zero-Combine Fetcher.

---

#### execute()

```typescript
async execute(): Promise<{
  tools: any[];
  roots: string[];
}>
```

Fetches and reconstructs data from on-chain.

**Returns:** Reconstructed data

---

#### batchExecuteForWallets()

```typescript
async batchExecuteForWallets(
  wallets: string[]
): Promise<Map<string, { tools: any[]; roots: string[] }>>
```

Batch fetch for multiple wallets.

**Returns:** Map of wallet to results

---

### MerkleOperation

#### Constructor

```typescript
constructor(
  client: SynapseClient,
  userWallet: string,
  options?: {
    batchSize?: number;
    delayMs?: number;
    maxRetries?: number;
  }
)
```

Creates a new Merkle Operation instance.

---

#### createMerkleTree()

```typescript
createMerkleTree(data: string[]): string
```

Creates Merkle tree and returns root hash.

**Returns:** Merkle root

---

#### getMerkleProof()

```typescript
getMerkleProof(leaf: string): {
  leaf: string;
  proof: string[];
  root: string;
}
```

Generates Merkle proof for a leaf.

**Returns:** Proof object

---

#### verifyProof()

```typescript
verifyProof(
  leaf: string,
  proof: string[],
  root: string
): boolean
```

Verifies a Merkle proof.

**Returns:** Verification result

---

#### batchVerifyProofs()

```typescript
batchVerifyProofs(proofs: Array<{
  leaf: string;
  proof: string[];
  root: string;
}>): boolean[]
```

Batch verify multiple proofs.

**Returns:** Array of verification results

---

#### inscribeMerkleRoot()

```typescript
async inscribeMerkleRoot(
  root: string,
  connection: Connection,
  signer: Keypair
): Promise<string>
```

Inscribes Merkle root on-chain.

**Parameters:**
- `root`: Merkle root hash
- `connection`: Solana connection
- `signer`: Transaction signer

**Returns:** Transaction signature

---

## Performance

| Operation | Complexity | Latency | Notes |
|-----------|-----------|---------|-------|
| PDA Derivation | O(1) | <1ms | Deterministic |
| PDA Existence Check | O(n) | 50-200ms | RPC call |
| Zero-Combine Fetch | O(n) | 1-10s | Depends on data size |
| Merkle Tree Creation | O(n log n) | 10-100ms | CPU-intensive |
| Merkle Proof Generation | O(log n) | <1ms | Tree traversal |
| Proof Verification | O(log n) | <1ms | Hash comparison |
| Batch Operations | O(n) | Linear | Parallel processing |

---

## Troubleshooting

### Issue: PDA not found

**Solutions:**
- Verify wallet address is correct
- Check if PDAs have been initialized
- Use correct program ID

```typescript
const { leafExists, rootExists } = await pdaManager.checkPDAExistence(pdas);
if (!leafExists) {
  console.log('Leaf PDA not initialized');
}
```

---

### Issue: Zero-Combine fetch timeout

**Solutions:**
- Increase `maxRetries` option
- Reduce `batchSize` for slower networks
- Increase `delayMs` between batches

```typescript
const fetcher = new ZeroCombineFetcher(client, wallet, {
  batchSize: 50,    // Reduce from 100
  delayMs: 3000,    // Increase from 2000
  maxRetries: 5,    // Increase from 3
});
```

---

### Issue: Merkle proof verification fails

**Solutions:**
- Verify data ordering is consistent
- Check for data corruption
- Ensure same hash algorithm

```typescript
// Ensure consistent ordering
const sortedData = data.sort();
const root = merkle.createMerkleTree(sortedData);
```

---

**AI Module** - OOBE Protocol implementation for advanced Solana operations

Built for decentralized AI agent infrastructure
// Crea MerkleOperation con signing support
const merkle = new MerkleOperation(
  client,
  signer.publicKey.toBase58(),
  { batchSize: 50 },
  connection,  // Connection per RPC
  signer       // Signer per firmare transactions
);

// Ora puoi inscrivere on-chain (transazioni firmate automaticamente)
const validationResult = {
  merkleRoot: root,
  merkleProof: proof.proof,
  merkleLeaf: { input: 'hash1', result: 'hash2' },
  merkleEvents: Buffer.from('compressed data').toString('base64'),
};

const inscription = await merkle.inscribeOnChain(validationResult);
console.log('Inscription signatures:', {
  zeroChunk: inscription.zeroChunkSign,
  root: inscription.signatureRoot,
});

// Batch inscribe multiple proofs
const results = await merkle.batchInscribeOnChain([
  validationResult1,
  validationResult2,
  validationResult3,
]);
```

#### Uso con Wallet Adapter (Browser/React)
```typescript
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { MerkleOperation } from '@synapse/client-sdk/ai';

function MyComponent() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const handleInscribe = async () => {
    if (!wallet.publicKey) return;

    const merkle = new MerkleOperation(
      client,
      wallet.publicKey.toBase58(),
      { batchSize: 50 }
    );

    // Ottieni transaction unsigned
    const tx = await merkle.createUnsignedMemoTransaction(
      pdaAddress,
      Buffer.from('your data')
    );

    // Firma con wallet adapter
    const signed = await wallet.signTransaction(tx);

    // Invia manualmente
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(signature);
  };
}
```

## Configurazione Batch

Tutti i moduli supportano `BatchOptionRequest` per ottimizzare le performance:

```typescript
import type { BatchOptionRequest } from '@synapse/client-sdk/ai';

const batchConfig: BatchOptionRequest = {
  batchSize: 100,        // Numero di richieste per batch
  delayMs: 2000,         // Delay tra batches (ms)
  maxRetries: 3,         // Tentativi massimi per richiesta fallita
  retryDelayMs: 1000,    // Delay tra retry (ms)
};
```

## Best Practices

### 1. PDAManager
- Usa `getBatchPDAAccountInfo()` per check multipli in parallelo
- Cache i PDAs derivati per evitare ricalcoli
- Verifica sempre l'esistenza dei PDAs prima di usarli

### 2. ZeroCombineFetcher
- Configura `batchSize` in base al rate limit dell'RPC
- Usa `delayMs` appropriati per evitare throttling
- Per multiple wallets, usa `batchExecuteForWallets()` invece di loop sequenziali

### 3. MerkleOperation
- **Con Connection/Signer**: Transazioni firmate automaticamente, ideale per backend/script
- **Senza Connection/Signer**: Usa `createUnsignedMemoTransaction()` e firma esternamente (wallet adapter)
- **Batch Operations**: Usa `batchInscribeOnChain()` per inserire multipli proof contemporaneamente
- Configura `maxRetries` per gestire network failures
- Chunking automatico per dati > 560 bytes (limite memo transactions)

## Compatibilità OOBE Protocol

Tutti i moduli sono compatibili con [OOBE Protocol](https://github.com/CryptoFamilyNFT/oobe-protocol):

- ✅ PDA derivation deterministico (SHA-256)
- ✅ Zero chunk pattern (128 bytes: 2 merkle leaves + signature)
- ✅ Chunked data linking via previous signatures
- ✅ Batch optimization per performance
- ✅ Memo program integration per storage on-chain

## Esempi Completi

Vedi la cartella `/examples` per esempi completi di:
- Backend automation (con Keypair)
- Frontend integration (con wallet adapter)
- Batch processing di large datasets
- Merkle proof generation e verification
- On-chain data inscription

## TypeScript Support

Tutti i moduli sono completamente tipizzati con TypeScript:

```typescript
import type {
  PDAConfig,
  UserPDAs,
  ZeroChunk,
  SignatureInfo,
  ProofRecord,
  FetchConfig,
  ZeroCombineResult,
  MerkleLeaf,
  MerkleProof,
  MerkleValidationResult,
  ChunkInfo,
  InscriptionResult,
  BatchOptionRequest,
} from '@synapse/client-sdk/ai';
```

## License

MIT
