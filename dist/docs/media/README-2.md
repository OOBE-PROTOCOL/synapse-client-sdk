# DeFi Module - Synapse Client SDK

Enterprise-grade DeFi integration layer for Solana blockchain with production-ready implementations for Jupiter V6, Jito Block Engine, SPL token operations, and multi-source price aggregation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Synapse Client SDK - DeFi                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │   Jupiter V6   │  │ Jito Bundles   │  │  Token Data     │  │
│  │   Integration  │  │   MEV Shield   │  │  SPL Accounts   │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Price Feed    │  │ MEV Protection │  │   Arbitrage     │  │
│  │  Aggregation   │  │    Engine      │  │   Detection     │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │   Portfolio    │  │  Flash Loan    │  │ Yield Farming   │  │
│  │   Analytics    │  │   Simulator    │  │     Finder      │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                    Synapse RPC Client Layer                     │
└─────────────────────────────────────────────────────────────────┘
```

## Module Capabilities

### Production Integrations

| Module | Protocol | Features | Status |
|--------|----------|----------|--------|
| **JupiterIntegration** | Jupiter V6 API | Route aggregation, best price discovery, swap execution, token listings | Production Ready |
| **JitoIntegration** | Jito Block Engine | MEV protection, bundle submission, tip optimization, 8 regional endpoints | Production Ready |
| **TokenDataIntegration** | Solana RPC | SPL token accounts, supply queries, holder distribution, balance tracking | Production Ready |
| **PriceFeedIntegration** | Jupiter + Birdeye | Multi-source aggregation, median price calculation, streaming updates | Production Ready |

### Advanced Feature Modules

| Module | Use Case | Complexity | Implementation |
|--------|----------|------------|----------------|
| **MEVProtection** | Sandwich attack prevention | High | Jito bundle integration + simulation |
| **ArbitrageDetector** | Cross-DEX opportunity scanning | High | Multi-source price comparison |
| **PortfolioAnalytics** | Risk assessment & diversification | Medium | Token analysis + scoring algorithms |
| **FlashLoanSimulator** | Profitability analysis | Medium | Transaction simulation engine |
| **YieldFarmingFinder** | APY discovery | Low | Protocol API aggregation |

---

## Technical Specifications

### Installation

```bash
npm install @oobe-protocol-labs/synapse-client-sdk
# or
pnpm add @oobe-protocol-labs/synapse-client-sdk
```

### Type System

All modules provide comprehensive TypeScript definitions with strict type checking:

```typescript
import type {
  JupiterQuoteParams,
  JupiterQuoteResponse,
  JitoBundle,
  JitoBundleStatus,
  TokenAccountInfo,
  TokenSupply,
  PriceData,
  AggregatedPrice,
} from '@oobe-protocol-labs/synapse-client-sdk/defi';
```

---

## Implementation Guide

### 1. Jupiter V6 Integration

#### API Endpoint Configuration

| Environment | Base URL | Rate Limit |
|-------------|----------|------------|
| Production | `https://quote-api.jup.ag/v6` | 100 req/min |
| Custom | User-defined | Varies |

#### Quote Parameters

```typescript
interface JupiterQuoteParams {
  inputMint: string;           // Base58 encoded mint address
  outputMint: string;          // Base58 encoded mint address
  amount: number;              // Amount in smallest unit (lamports/decimals)
  slippageBps?: number;        // Slippage tolerance (basis points, default: 50)
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;  // Skip multi-hop routes
  asLegacyTransaction?: boolean;
  maxAccounts?: number;        // Limit for transaction size optimization
  platformFeeBps?: number;     // Platform fee in basis points
}
```

#### Implementation Example

```typescript
import { SynapseClient } from '@oobe-protocol-labs/synapse-client-sdk';
import { JupiterIntegration } from '@oobe-protocol-labs/synapse-client-sdk/defi';
import { Keypair, VersionedTransaction } from '@solana/web3.js';

// Initialize client
const client = new SynapseClient({
  endpoint: 'https://your-synapse-gateway.com',
  apiKey: process.env.SYNAPSE_API_KEY
});

const jupiter = new JupiterIntegration(client);

// Step 1: Quote acquisition
const quote = await jupiter.getQuote({
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: 1_000_000_000, // 1 SOL (9 decimals)
  slippageBps: 50, // 0.5% slippage tolerance
});

// Step 2: Transaction construction
const wallet = Keypair.fromSecretKey(/* your secret key */);

const result = await jupiter.executeSwap(
  {
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: 1_000_000_000,
    slippageBps: 50,
  },
  wallet.publicKey.toBase58(),
  {
    signTransaction: async (tx: VersionedTransaction) => {
      tx.sign([wallet]);
      return tx;
    },
  }
);

console.log('Transaction signature:', result.signature);
```

#### Quote Response Structure

```typescript
interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;      // Price impact percentage
  routePlan: Array<{           // Multi-hop route details
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
  }>;
}
```

---

### 2. Jito Block Engine Integration

#### Regional Endpoints

| Region | Tip Account | Latency (ms) | Recommended For |
|--------|-------------|--------------|-----------------|
| **Mainnet** | `96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5` | ~50 | Global fallback |
| **New York** | `HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe` | ~10 | US East Coast |
| **Amsterdam** | `Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY` | ~15 | Europe |
| **Frankfurt** | `ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49` | ~15 | Central Europe |
| **Tokyo** | `DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh` | ~20 | Asia-Pacific |

#### Bundle Submission Protocol

```typescript
import { JitoIntegration } from '@oobe-protocol-labs/synapse-client-sdk/defi';
import { SystemProgram, Transaction, Keypair } from '@solana/web3.js';

const jito = new JitoIntegration(client);

// Region-based tip account selection
const tipAccount = jito.getTipAccount('ny'); // Optimal for US East

// Transaction construction with tip
const wallet = Keypair.fromSecretKey(/* your secret key */);
const tx = new Transaction();

// Add swap instructions
// tx.add(...);

// Append Jito tip instruction
const tipInstruction = jito.createTipInstruction(
  wallet.publicKey,
  1_000_000, // 0.001 SOL tip
  tipAccount
);
tx.add(tipInstruction);

// Serialize and submit bundle
const serializedTx = tx.serialize().toString('base64');

const bundle = await jito.submitBundle({
  transactions: [serializedTx],
  tipLamports: 1_000_000,
});

console.log('Bundle ID:', bundle.bundleId);
```

#### Bundle Status Monitoring

```typescript
// Asynchronous status polling
const status = await jito.getBundleStatus(bundle.bundleId);

console.log('Bundle State:', {
  bundleId: status.bundleId,
  status: status.status, // 'pending' | 'processing' | 'landed' | 'failed'
  slot: status.slot,
  confirmations: status.confirmations,
});

// Automated confirmation waiting
try {
  await jito.waitForBundleConfirmation(bundle.bundleId, {
    maxWaitTime: 60000, // 60 seconds
    pollingInterval: 2000, // 2 seconds
  });
  console.log('Bundle confirmed');
} catch (error) {
  console.error('Bundle failed or timeout');
}
```

---

### 3. Token Data Integration

#### SPL Token Account Structure

```typescript
interface TokenAccountInfo {
  pubkey: string;              // Token account address
  mint: string;                // Token mint address
  owner: string;               // Owner wallet address
  amount: string;              // Raw amount (smallest unit)
  decimals: number;            // Token decimals
  uiAmount: number;            // Human-readable amount
  delegate?: string;           // Delegate authority (optional)
  delegatedAmount?: string;    // Delegated amount (optional)
  isNative: boolean;           // Native SOL wrapper flag
  rentExemptReserve?: string;  // Rent reserve amount
  closeAuthority?: string;     // Close authority (optional)
}
```

#### Implementation

```typescript
import { TokenDataIntegration } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const tokenData = new TokenDataIntegration(client);

// Query all SPL token accounts
const tokens = await tokenData.getTokenAccountsByOwner(
  'YourWalletAddressHere'
);

console.log(`Total token accounts: ${tokens.length}`);

// Process token holdings
tokens.forEach(token => {
  console.log(`Mint: ${token.mint}`);
  console.log(`Balance: ${token.uiAmount} (${token.amount} raw)`);
  console.log(`Decimals: ${token.decimals}`);
});

// Query SOL balance (lamports → SOL conversion)
const balance = await tokenData.getBalance('YourWalletAddressHere');
console.log(`SOL Balance: ${balance} SOL`);

// Token supply information
const supply = await tokenData.getTokenSupply(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
);

console.log('Token Supply:', {
  amount: supply.amount,
  decimals: supply.decimals,
  uiAmount: supply.uiAmount,
  uiAmountString: supply.uiAmountString,
});

// Largest token holders
const largestAccounts = await tokenData.getTokenLargestAccounts(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  20 // Top 20 holders
);

console.log('Top Holders:', largestAccounts.map(acc => ({
  address: acc.address,
  uiAmount: acc.uiAmount,
})));
```

---

### 4. Price Feed Aggregation

#### Multi-Source Architecture

```
┌─────────────────────────────────────────────┐
│       Price Feed Aggregation Layer          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │   Jupiter    │      │   Birdeye    │    │
│  │  Price API   │      │   API v3     │    │
│  └──────────────┘      └──────────────┘    │
│         │                      │            │
│         └──────────┬───────────┘            │
│                    │                        │
│            ┌───────▼────────┐               │
│            │ Median Calc.   │               │
│            │ Outlier Filter │               │
│            └───────┬────────┘               │
│                    │                        │
│            ┌───────▼────────┐               │
│            │ Aggregated     │               │
│            │ Price Output   │               │
│            └────────────────┘               │
└─────────────────────────────────────────────┘
```

#### Implementation

```typescript
import { PriceFeedIntegration } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const priceFeed = new PriceFeedIntegration(client);

// Jupiter batch price query
const prices = await priceFeed.getJupiterPrices([
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

prices.forEach((priceData, mint) => {
  console.log(`${priceData.symbol}: $${priceData.price}`);
});

// Multi-source aggregation with median calculation
const solPrice = await priceFeed.getAggregatedPrice(
  'So11111111111111111111111111111111111111112',
  ['jupiter', 'birdeye'] // Redundancy for accuracy
);

console.log('Aggregated Price Data:', {
  price: solPrice.price,
  sources: solPrice.sources,
  confidence: solPrice.confidence,
  timestamp: solPrice.timestamp,
});

// Real-time price streaming
priceFeed.startPriceStream(
  ['So11111111111111111111111111111111111111112'],
  (updates) => {
    updates.forEach(update => {
      console.log(`${update.mint}: $${update.price}`);
    });
  },
  5000 // 5-second polling interval
);
```

---

### 5. MEV Protection Engine

#### Protection Strategies

| Strategy | Method | Effectiveness | Gas Overhead |
|----------|--------|---------------|--------------|
| **Jito Bundles** | Private mempool | 95% | +0.001 SOL tip |
| **Transaction Simulation** | Pre-flight check | 70% | Negligible |
| **Slippage Optimization** | Dynamic adjustment | 60% | None |
| **Priority Fees** | Fee market bidding | 40% | Variable |

#### Configuration

#### Configuration

```typescript
import { MEVProtection } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const mevProtection = new MEVProtection({
  enableJitoBundle: true,
  jitoBlockEngineUrl: 'https://mainnet.block-engine.jito.wtf',
  maxTipLamports: 10_000_000, // 0.01 SOL maximum tip
  enableSimulation: true,
  slippageBps: 50, // 0.5% slippage tolerance
});

// Transaction protection workflow
const txBase64 = '...'; // Serialized transaction (base64)

const result = await mevProtection.protectSwap(txBase64, {
  tipLamports: 1_000_000, // 0.001 SOL tip
  skipSimulation: false,
});

console.log('Protection Result:', {
  protected: result.protected,
  bundleId: result.bundleId,
  estimatedMEVSaved: result.estimatedMEVSaved,
  simulation: result.simulation,
});

// Risk assessment
const risk = await mevProtection.estimateMEVRisk(
  'So11111111111111111111111111111111111111112', // Input mint (SOL)
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Output mint (USDC)
  1_000_000_000 // Amount (1 SOL)
);

console.log('MEV Risk Assessment:', {
  risk: risk.risk, // 'low' | 'medium' | 'high'
  estimatedLoss: risk.estimatedLoss,
  recommendation: risk.recommendation,
});
```

---

### 6. Arbitrage Detection

#### Detection Algorithm

```
1. Fetch prices from multiple DEXes (Jupiter, Raydium, Orca)
2. Calculate cross-DEX price differences
3. Identify profitable arbitrage paths (up to N hops)
4. Estimate gas costs and net profit
5. Filter by minimum profit threshold
6. Return ranked opportunities by profitability
```

#### Implementation

```typescript
import { ArbitrageDetector } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const arbDetector = new ArbitrageDetector(client);

// Opportunity discovery
const opportunities = await arbDetector.findOpportunities({
  minProfitPercent: 1.0, // Minimum 1% profit after gas
  maxHops: 3, // Maximum path complexity
  tokens: ['SOL', 'USDC', 'USDT'], // Token whitelist
});

console.log('Arbitrage Opportunities:', opportunities);

// Continuous scanning with event-driven architecture
arbDetector.on('arbitrage-found', (opportunities) => {
  opportunities.forEach(opp => {
    console.log(`Arbitrage Path: ${opp.path.join(' → ')}`);
    console.log(`Profit: ${opp.netProfit} (${opp.profitPercent}%)`);
    console.log(`Exchanges: ${opp.exchanges.join(' → ')}`);
    console.log(`Confidence: ${(opp.confidence * 100).toFixed(1)}%`);
  });
});

arbDetector.startScanning(30000); // 30-second interval

// Cleanup
process.on('SIGINT', () => {
  arbDetector.stopScanning();
});
```

---

### 7. Portfolio Analytics

#### Metrics Calculation

| Metric | Formula | Range |
|--------|---------|-------|
| **Risk Score** | `concentration_risk + count_risk` | 0-100 |
| **Diversification** | `(count_score × 0.7) + (spread_score × 0.3)` | 0-100 |
| **PnL** | `current_value - initial_value` | -∞ to +∞ |

#### Implementation

```typescript
import { PortfolioAnalytics } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const portfolio = new PortfolioAnalytics(client);

// Comprehensive wallet analysis
const metrics = await portfolio.analyzeWallet('YourWalletAddressHere');

console.log('Portfolio Overview:', {
  totalValue: `$${metrics.totalValue.toLocaleString()}`,
  holdingsCount: metrics.holdings.length,
  riskScore: `${metrics.riskScore}/100`,
  diversificationScore: `${metrics.diversificationScore}/100`,
});

console.log('\nPerformance Metrics:');
console.log(`24h PnL: ${metrics.pnl24h >= 0 ? '+' : ''}$${metrics.pnl24h}`);
console.log(`7d PnL: ${metrics.pnl7d >= 0 ? '+' : ''}$${metrics.pnl7d}`);
console.log(`30d PnL: ${metrics.pnl30d >= 0 ? '+' : ''}$${metrics.pnl30d}`);

console.log('\nTop Holdings:');
metrics.topPerformers.forEach((holding, index) => {
  console.log(`${index + 1}. ${holding.symbol || holding.mint.slice(0, 8)}`);
  console.log(`   Value: $${holding.usdValue.toFixed(2)}`);
  console.log(`   Allocation: ${holding.allocation.toFixed(2)}%`);
  console.log(`   24h Change: ${holding.change24h}%`);
});

console.log('\nRecommendations:');
metrics.recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. ${rec}`);
});
```

---

### 8. Flash Loan Simulator

#### Simulation Engine

```
┌──────────────────────────────────────────┐
│      Flash Loan Simulation Engine        │
├──────────────────────────────────────────┤
│                                          │
│  1. Loan Acquisition (virtual)           │
│  2. Execute Action Chain:                │
│     • Swap on DEX A                      │
│     • Arbitrage on DEX B                 │
│     • Liquidation (if applicable)        │
│  3. Loan Repayment + Fee (0.09%)         │
│  4. Calculate Net Profit/Loss            │
│  5. Generate Execution Log               │
│                                          │
└──────────────────────────────────────────┘
```

#### Implementation

```typescript
import { FlashLoanSimulator } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const flashLoan = new FlashLoanSimulator(client);

// Arbitrage simulation
const simulation = await flashLoan.simulate({
  loanAmount: 100_000, // 100k USDC loan
  tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  actions: [
    {
      type: 'swap',
      description: 'Buy SOL on Jupiter (lower price)',
      inputAmount: 100_000,
      outputAmount: 500, // 500 SOL
      exchange: 'Jupiter',
    },
    {
      type: 'swap',
      description: 'Sell SOL on Raydium (higher price)',
      inputAmount: 500,
      outputAmount: 102_000, // 102k USDC
      exchange: 'Raydium',
    },
  ],
});

console.log('Simulation Result:', {
  success: simulation.success,
  loanAmount: simulation.loanAmount,
  finalAmount: simulation.loanAmount + simulation.netProfit,
  estimatedProfit: simulation.estimatedProfit,
  estimatedCost: simulation.estimatedCost,
  netProfit: simulation.netProfit,
  roi: ((simulation.netProfit / simulation.loanAmount) * 100).toFixed(2) + '%',
});

console.log('\nExecution Log:');
simulation.logs.forEach((log, index) => {
  console.log(`${index + 1}. ${log}`);
});
```

---

### 9. Yield Farming Finder

#### Protocol Coverage

| Protocol | TVL | APY Range | Integration Status |
|----------|-----|-----------|-------------------|
| Marinade | $1.5B | 5-10% | Active |
| Orca | $500M | 10-50% | Active |
| Raydium | $300M | 15-80% | Active |
| Kamino | $200M | 20-100% | Planned |
| Drift | $150M | 10-60% | Planned |

#### Implementation

```typescript
import { YieldFarmingFinder } from '@oobe-protocol-labs/synapse-client-sdk/defi';

const yieldFinder = new YieldFarmingFinder(client);

// Discover high-yield opportunities
const opportunities = await yieldFinder.findOpportunities({
  minAPY: 15, // Minimum 15% annual percentage yield
  maxRisk: 'medium', // Risk tolerance: 'low' | 'medium' | 'high'
  protocols: ['Marinade', 'Orca', 'Raydium'], // Protocol filter
});

console.log(`Found ${opportunities.length} yield opportunities`);

// Display results in tabular format
console.table(opportunities.map(opp => ({
  Protocol: opp.protocol,
  Pool: opp.pool,
  APY: `${opp.apy.toFixed(2)}%`,
  TVL: `$${(opp.tvl / 1_000_000).toFixed(1)}M`,
  Tokens: opp.tokens.join('/'),
  Risk: opp.risk.toUpperCase(),
})));

// Detailed opportunity analysis
opportunities.forEach(opp => {
  console.log(`\n${opp.protocol} - ${opp.pool}`);
  console.log(`  APY: ${opp.apy}%`);
  console.log(`  TVL: $${opp.tvl.toLocaleString()}`);
  console.log(`  Tokens: ${opp.tokens.join(' + ')}`);
  console.log(`  Risk Level: ${opp.risk}`);
  console.log(`  URL: ${opp.url}`);
});
```

---

## Event-Driven Architecture

All integration modules extend `EventEmitter` for real-time monitoring and observability.

### Event Types by Module

| Module | Events | Payload |
|--------|--------|---------|
| **Jupiter** | `jupiter-quote-start`, `jupiter-quote-complete`, `jupiter-quote-error` | Quote params/result |
| **Jito** | `jito-bundle-submit`, `jito-bundle-submitted`, `jito-bundle-error` | Bundle data |
| **TokenData** | `token-accounts-fetch-start`, `token-accounts-fetch-complete`, `token-accounts-fetch-error` | Account data |
| **PriceFeed** | `price-update`, `price-source-error` | Price data |
| **MEVProtection** | `mev-protection-start`, `mev-protection-complete`, `mev-protection-error` | Protection result |
| **ArbitrageDetector** | `arbitrage-scan-start`, `arbitrage-found`, `scanning-started`, `scanning-stopped` | Opportunities |

### Event Listener Implementation

```typescript
// Jupiter quote monitoring
jupiter.on('jupiter-quote-start', (params) => {
  console.log('[Jupiter] Quote request:', params);
});

jupiter.on('jupiter-quote-complete', (result) => {
  console.log('[Jupiter] Quote received:', {
    route: result.routePlan.length + ' hops',
    priceImpact: result.priceImpactPct,
  });
});

jupiter.on('jupiter-quote-error', (error) => {
  console.error('[Jupiter] Quote failed:', error.message);
});

// Jito bundle tracking
jito.on('jito-bundle-submitted', (result) => {
  console.log('[Jito] Bundle ID:', result.bundleId);
});

// Token account monitoring
tokenData.on('token-accounts-fetch-complete', (data) => {
  console.log(`[TokenData] Fetched ${data.count} token accounts`);
});

// Price feed updates
priceFeed.on('price-update', (update) => {
  console.log(`[PriceFeed] ${update.symbol}: $${update.price}`);
});

// MEV protection events
mevProtection.on('mev-protection-complete', (result) => {
  if (result.protected) {
    console.log('[MEV] Transaction protected via Jito bundle');
  }
});
```

---

## Error Handling

### DeFiError Type System

```typescript
class DeFiError extends Error {
  constructor(
    message: string,
    public operation: string,     // 'quote' | 'swap' | 'bundle' | etc.
    public provider?: string,     // 'jupiter' | 'jito' | etc.
    public originalError?: Error  // Underlying error
  );
}
```

### Error Handling Pattern

```typescript
import { DeFiError } from '@oobe-protocol-labs/synapse-client-sdk';

try {
  const quote = await jupiter.getQuote(params);
} catch (error) {
  if (error instanceof DeFiError) {
    console.error('DeFi Operation Failed:', {
      operation: error.operation,
      provider: error.provider,
      message: error.message,
      originalError: error.originalError?.message,
    });
    
    // Operation-specific error handling
    switch (error.operation) {
      case 'quote':
        // Handle quote failure (retry, fallback DEX, etc.)
        break;
      case 'swap':
        // Handle swap failure (refund, revert, etc.)
        break;
      case 'bundle':
        // Handle bundle failure (standard tx submission, etc.)
        break;
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Best Practices

### 1. MEV Protection Threshold

```typescript
// Apply MEV protection for transactions above threshold
const PROTECTION_THRESHOLD = 1_000_000_000; // 1 SOL

async function executeSwap(params) {
  const quote = await jupiter.getQuote(params);
  
  if (params.amount > PROTECTION_THRESHOLD) {
    // Use Jito bundle for large swaps
    const tx = await jupiter.getSwapTransaction(params, userAddress);
    const result = await mevProtection.protectSwap(tx.swapTransaction);
    return result;
  } else {
    // Standard execution for small swaps
    return await jupiter.executeSwap(params, userAddress, signer);
  }
}
```

### 2. Price Impact Validation

```typescript
const MAX_PRICE_IMPACT = 5.0; // 5% maximum acceptable impact

const quote = await jupiter.getQuote(params);

if (parseFloat(quote.priceImpactPct) > MAX_PRICE_IMPACT) {
  throw new Error(`Price impact too high: ${quote.priceImpactPct}%`);
}
```

### 3. Multi-Source Price Validation

```typescript
async function getValidatedPrice(mint: string): Promise<number> {
  const sources: ('jupiter' | 'birdeye')[] = ['jupiter', 'birdeye'];
  const aggregated = await priceFeed.getAggregatedPrice(mint, sources);
  
  // Require minimum confidence threshold
  if (aggregated.confidence < 0.8) {
    throw new Error('Price confidence too low');
  }
  
  return aggregated.price;
}
```

### 4. Bundle Status Monitoring

```typescript
async function submitWithConfirmation(bundle: JitoBundle) {
  const result = await jito.submitBundle(bundle);
  
  // Poll for confirmation with exponential backoff
  const confirmed = await jito.waitForBundleConfirmation(
    result.bundleId,
    {
      maxWaitTime: 60000, // 60 seconds timeout
      pollingInterval: 2000, // Initial 2-second interval
    }
  );
  
  if (!confirmed) {
    // Fallback to standard transaction submission
    console.warn('Bundle failed, falling back to standard tx');
  }
  
  return confirmed;
}
```

### 5. Rate Limit Handling

```typescript
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
const prices = await fetchWithRetry(() => 
  priceFeed.getJupiterPrices(mints)
);
```

---

## Performance Optimization

### Batch Operations

```typescript
// Inefficient: Multiple sequential calls
for (const mint of mints) {
  const price = await priceFeed.getJupiterPrices([mint]);
}

// Efficient: Single batch call
const prices = await priceFeed.getJupiterPrices(mints);
```

### Connection Pooling

```typescript
// Reuse client instance across operations
const client = new SynapseClient({ endpoint, apiKey });

const jupiter = new JupiterIntegration(client);
const jito = new JitoIntegration(client);
const tokenData = new TokenDataIntegration(client);
const priceFeed = new PriceFeedIntegration(client);
```

### Caching Strategy

```typescript
class PriceCache {
  private cache = new Map<string, { price: number; timestamp: number }>();
  private TTL = 30000; // 30 seconds

  async getPrice(mint: string, fetcher: () => Promise<number>): Promise<number> {
    const cached = this.cache.get(mint);
    
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.price;
    }
    
    const price = await fetcher();
    this.cache.set(mint, { price, timestamp: Date.now() });
    
    return price;
  }
}
```

---

## API Reference

### Type Exports

```typescript
export {
  // Jupiter types
  JupiterQuoteParams,
  JupiterQuoteResponse,
  JupiterSwapRequest,
  JupiterSwapResult,
  
  // Jito types
  JitoBundle,
  JitoBundleStatus,
  JitoBundleResult,
  
  // Token types
  TokenAccountInfo,
  TokenSupply,
  TokenLargestAccount,
  
  // Price types
  PriceData,
  AggregatedPrice,
  
  // Advanced feature types
  MEVProtectionConfig,
  MEVProtectionResult,
  ArbitrageOpportunity,
  PortfolioMetrics,
  FlashLoanSimulation,
  YieldOpportunity,
};
```

### Class Exports

```typescript
export {
  // Core integrations
  JupiterIntegration,
  JitoIntegration,
  TokenDataIntegration,
  PriceFeedIntegration,
  
  // Advanced features
  MEVProtection,
  ArbitrageDetector,
  PortfolioAnalytics,
  FlashLoanSimulator,
  YieldFarmingFinder,
  
  // Errors
  DeFiError,
};
```

---

## System Requirements

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@solana/web3.js` | `^1.87.0` | Solana blockchain interaction |
| `eventemitter3` | `^5.0.1` | Event-driven architecture |
| `@oobe-protocol-labs/synapse-client-sdk` | `latest` | Core SDK functionality |

### Runtime Requirements

- **Node.js**: `>=18.0.0`
- **TypeScript**: `>=5.0.0` (for development)
- **Network**: Stable internet connection for RPC calls
- **Memory**: Minimum 512MB available RAM

---

## Related Documentation

- [Synapse Client SDK Core Documentation](../README.md)
- [Jupiter V6 API Reference](https://station.jup.ag/docs/apis/swap-api)
- [Jito Block Engine Documentation](https://docs.jito.wtf/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [SPL Token Program Specification](https://spl.solana.com/token)

---

## License

MIT License - See [LICENSE](../LICENSE) for complete terms.

---

## Contributing

Contributions are welcome. Please refer to [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Code style and conventions
- Testing requirements
- Pull request process
- Issue reporting

---

**Synapse DeFi Module** - Production-grade Solana DeFi integration layer
