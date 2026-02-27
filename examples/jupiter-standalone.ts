/**
 * Jupiter SDK — Standalone usage (no agents)
 *
 * Demonstrates the v1.0.7 fixes:
 *  - #20: getTokenList now routes to api.jup.ag/tokens/v1/all (tokens.jup.ag is dead)
 *  - getTokenInfo routes to api.jup.ag/tokens/v1/{mint}
 *  - tokensApiUrl configurable — user controls the endpoint
 *  - throwOnError works — throws ProtocolApiError on failures
 *  - toolMap accessible with BOTH prefixed and unprefixed keys
 *
 * NOTE: toolMap keys work both ways:
 *   jupiter.toolMap.getQuote          ← unprefixed (recommended)
 *   jupiter.toolMap.jupiter_getQuote  ← prefixed   (also works)
 */
import { createJupiterTools } from '@oobe-protocol-labs/synapse-client-sdk/ai';

// ── 1. Create toolkit ─────────────────────────────────────────
const jupiter = createJupiterTools({
  apiKey: process.env.JUPITER_API_KEY, // optional — higher rate limits
  // tokensApiUrl: 'https://custom-tokens-api.example.com', // override if needed
  throwOnError: true,                  // throw ProtocolApiError on failures
});

// Access underlying HTTP client & headers (DX v1.0.6+)
console.log('Headers:', jupiter.getHeaders());
console.log('Base URL:', jupiter.httpClient.baseUrl);

async function main() {
  // ── 2. getTokenList — fix #20 (now routes to api.jup.ag/tokens/v1/all)
  try {
    const tokens = await jupiter.toolMap.getTokenList.invoke({});
    const parsed = JSON.parse(tokens);
    console.log(`Token list: ${parsed.length} tokens loaded`);
  } catch (err) {
    console.error('getTokenList error (throwOnError works!):', err);
  }

  // ── 3. getTokenInfo — routes to api.jup.ag/tokens/v1/{mint}
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  try {
    const info = await jupiter.toolMap.getTokenInfo.invoke({ mint: SOL_MINT });
    console.log('SOL token info:', info);
  } catch (err) {
    console.error('getTokenInfo error:', err);
  }

  // ── 4. getQuote ───────────────────────────────────────────
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const quote = await jupiter.toolMap.getQuote.invoke({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    amount: '1000000000', // 1 SOL in lamports (string)
    slippageBps: 50,
  });
  console.log('Quote SOL → USDC:', quote);

  // ── 5. getPrice ───────────────────────────────────────────
  const price = await jupiter.toolMap.getPrice.invoke({
    ids: SOL_MINT,
  });
  console.log('SOL price:', price);

  // ── 6. getDCAOrders — fix #19 (includeFailedTx) ──────────
  const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const dcaOrders = await jupiter.toolMap.getDCAOrders.invoke({
    user: WALLET,
    recurringType: 'all',
    orderStatus: 'active',
    includeFailedTx: false, // now properly serialised (was missing → 400)
  });
  console.log('DCA orders:', dcaOrders);

  // ── 7. Direct httpClient usage (advanced) ─────────────────
  //    For endpoints not covered by tools, use the raw client:
  const raw = await jupiter.httpClient.get('/tokens/v1/all');
  console.log('Raw token list (direct):', Array.isArray(raw) ? `${(raw as any[]).length} tokens` : raw);
}

main().catch(console.error);
