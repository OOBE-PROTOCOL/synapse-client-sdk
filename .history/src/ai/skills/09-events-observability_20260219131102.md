# Skill 09 — Events & Observability

## Obiettivo

Usare il **sistema eventi** del gateway per monitoring real-time, alerting, logging strutturato e metriche operative.

---

## Concetti chiave

| Concetto | Descrizione |
|----------|-------------|
| `GatewayEvent` | Evento con type, sessionId, timestamp, data |
| `GatewayEventType` | Union di tutti i tipi di evento (20+ tipi) |
| `gateway.on()` | Subscribe a un tipo di evento (ritorna unsubscribe) |
| `gateway.getMetrics()` | Metriche aggregate del gateway |

---

## 1. Tutti i tipi di evento

### Sessioni

| Evento | Quando | Data |
|--------|--------|------|
| `session:created` | Nuova sessione aperta | `{ sessionId, buyer, tier, budget }` |
| `session:activated` | Sessione attivata | `{ sessionId }` |
| `session:paused` | Sessione in pausa | `{ sessionId }` |
| `session:exhausted` | Budget o call limit esauriti | `{ sessionId, reason }` |
| `session:settled` | Sessione chiusa e settlement completato | `{ sessionId }` |
| `session:expired` | TTL scaduto | `{ sessionId }` |

### Chiamate RPC

| Evento | Quando | Data |
|--------|--------|------|
| `call:before` | Prima dell'esecuzione | `{ method, params }` |
| `call:after` | Dopo l'esecuzione | `{ method, latencyMs, cost, attested }` |
| `call:error` | Errore durante l'esecuzione | `{ method, error }` |
| `call:attested` | Attestation generata | `{ attestation }` |

### Budget & Rate Limiting

| Evento | Quando | Data |
|--------|--------|------|
| `ratelimit:exceeded` | Rate limit raggiunto | `{ method, retryAfterMs }` |
| `budget:warning` | Budget sotto soglia | `{ sessionId, budgetRemaining }` |
| `budget:exhausted` | Budget esaurito | `{ sessionId, budgetRemaining }` |

### Pagamenti

| Evento | Quando | Data |
|--------|--------|------|
| `payment:intent` | PaymentIntent ricevuto | `{ intent }` |
| `payment:settled` | Pagamento completato | `{ sessionId, receipt }` |

### x402 Protocol

| Evento | Quando | Data |
|--------|--------|------|
| `x402:payment-required` | 402 generato (seller) | `{ method }` |
| `x402:payment-verified` | Pagamento verificato (seller) | `{ method, payer }` |
| `x402:payment-settled` | Settlement on-chain (seller) | `{ transaction, network }` |
| `x402:payment-sent` | Pagamento inviato (buyer) | `{ url, method, amount, transaction }` |

---

## 2. Sottoscrivere eventi

### Evento singolo

```typescript
const unsubscribe = gateway.on('call:after', (event) => {
  console.log(`[${event.type}] ${event.data.method}: ${event.data.latencyMs}ms`);
});

// Per rimuovere il listener
unsubscribe();
```

### Tutti gli eventi

```typescript
gateway.on('*', (event) => {
  console.log(JSON.stringify({
    type: event.type,
    sessionId: event.sessionId,
    timestamp: new Date(event.timestamp).toISOString(),
    data: event.data,
  }));
});
```

---

## 3. Pattern: Structured Logging

```typescript
function setupGatewayLogging(gateway: AgentGateway) {
  // ── Performance log
  gateway.on('call:after', (event) => {
    const { method, latencyMs, cost, attested } = event.data as any;
    console.log(JSON.stringify({
      level: 'info',
      type: 'rpc_call',
      method,
      latencyMs,
      cost,
      attested,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
    }));
  });

  // ── Error log
  gateway.on('call:error', (event) => {
    const { method, error } = event.data as any;
    console.error(JSON.stringify({
      level: 'error',
      type: 'rpc_error',
      method,
      error,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
    }));
  });

  // ── Rate limit warnings
  gateway.on('ratelimit:exceeded', (event) => {
    console.warn(JSON.stringify({
      level: 'warn',
      type: 'rate_limit',
      ...event.data as object,
      sessionId: event.sessionId,
    }));
  });

  // ── x402 payment tracking
  gateway.on('x402:payment-settled', (event) => {
    console.log(JSON.stringify({
      level: 'info',
      type: 'x402_settlement',
      ...event.data as object,
      timestamp: event.timestamp,
    }));
  });

  gateway.on('x402:payment-sent', (event) => {
    console.log(JSON.stringify({
      level: 'info',
      type: 'x402_payment_sent',
      ...event.data as object,
      timestamp: event.timestamp,
    }));
  });
}
```

---

## 4. Pattern: Alerting

```typescript
function setupAlerts(gateway: AgentGateway) {
  // Alert: budget basso
  gateway.on('budget:warning', async (event) => {
    await sendAlert('BUDGET_LOW', {
      sessionId: event.sessionId,
      remaining: (event.data as any).budgetRemaining,
    });
  });

  // Alert: troppi errori
  let errorCount = 0;
  const ERROR_THRESHOLD = 10;
  const WINDOW_MS = 60_000;

  gateway.on('call:error', async (event) => {
    errorCount++;
    setTimeout(() => errorCount--, WINDOW_MS);

    if (errorCount >= ERROR_THRESHOLD) {
      await sendAlert('HIGH_ERROR_RATE', {
        errors: errorCount,
        windowMs: WINDOW_MS,
        lastError: (event.data as any).error,
      });
    }
  });

  // Alert: latenza alta
  gateway.on('call:after', async (event) => {
    const { latencyMs, method } = event.data as any;
    if (latencyMs > 2000) {
      await sendAlert('HIGH_LATENCY', { method, latencyMs });
    }
  });

  // Alert: x402 settlement fallito
  gateway.on('x402:payment-settled', async (event) => {
    const data = event.data as any;
    if (!data.transaction) {
      await sendAlert('SETTLEMENT_FAILED', { ...data });
    }
  });
}
```

---

## 5. Metriche aggregate

```typescript
const metrics = gateway.getMetrics();

// Struttura:
// {
//   totalCallsServed: number,
//   totalRevenue: string,          // BigInt as string
//   activeSessions: number,
//   totalSessions: number,
//   avgLatencyMs: number,
//   totalAttestations: number,
//   marketplaceStats: {
//     totalListings: number,
//     totalSellers: number,
//     totalBundles: number,
//     avgPricePerCall: bigint,
//     avgReputation: number,
//     avgUptime: number,
//   },
//   x402: {
//     paywallEnabled: boolean,
//     clientEnabled: boolean,
//     clientPayments: number,
//   },
// }
```

### Dashboard periodica

```typescript
setInterval(() => {
  const m = gateway.getMetrics();

  // Emetti metriche per Prometheus/Datadog/etc.
  emitGauge('gateway.calls_served', m.totalCallsServed);
  emitGauge('gateway.active_sessions', m.activeSessions);
  emitGauge('gateway.avg_latency_ms', m.avgLatencyMs);
  emitGauge('gateway.attestations', m.totalAttestations);
  emitGauge('gateway.revenue', Number(BigInt(m.totalRevenue)));
  emitGauge('gateway.x402_payments', m.x402.clientPayments);
  emitGauge('marketplace.listings', m.marketplaceStats.totalListings);
}, 15_000); // Ogni 15 secondi
```

---

## 6. Pattern: Latency percentiles

```typescript
const latencies: number[] = [];

gateway.on('call:after', (event) => {
  latencies.push((event.data as any).latencyMs);

  // Mantieni solo ultimi 1000
  if (latencies.length > 1000) latencies.shift();
});

function getPercentile(p: number): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

// Uso:
// getPercentile(50)  → p50 (mediana)
// getPercentile(95)  → p95
// getPercentile(99)  → p99
```

---

## 7. Pattern: Session tracking

```typescript
const sessionMetrics = new Map<string, {
  calls: number;
  errors: number;
  totalLatency: number;
  startedAt: number;
}>();

gateway.on('session:created', (event) => {
  sessionMetrics.set(event.sessionId, {
    calls: 0,
    errors: 0,
    totalLatency: 0,
    startedAt: event.timestamp,
  });
});

gateway.on('call:after', (event) => {
  const m = sessionMetrics.get(event.sessionId);
  if (m) {
    m.calls++;
    m.totalLatency += (event.data as any).latencyMs;
  }
});

gateway.on('call:error', (event) => {
  const m = sessionMetrics.get(event.sessionId);
  if (m) m.errors++;
});

gateway.on('session:settled', (event) => {
  const m = sessionMetrics.get(event.sessionId);
  if (m) {
    console.log(`Session ${event.sessionId} summary:`);
    console.log(`  Duration: ${Date.now() - m.startedAt}ms`);
    console.log(`  Calls: ${m.calls}`);
    console.log(`  Errors: ${m.errors}`);
    console.log(`  Avg latency: ${m.calls > 0 ? m.totalLatency / m.calls : 0}ms`);
  }
  sessionMetrics.delete(event.sessionId);
});
```

---

## 8. Pattern: x402 Revenue tracking

```typescript
let totalX402Revenue = 0n;
const revenueByMethod = new Map<string, bigint>();

gateway.on('x402:payment-settled', (event) => {
  const { transaction } = event.data as any;
  if (transaction) {
    // Qui dovresti parsare il valore dalla tx on-chain
    // Per semplicità, incrementa un counter
    totalX402Revenue++;
  }
});

gateway.on('x402:payment-required', (event) => {
  const { method } = event.data as any;
  // Track quanti 402 generiamo per metodo
  const current = revenueByMethod.get(method) ?? 0n;
  revenueByMethod.set(method, current + 1n);
});
```

---

## 9. Buyer-side: tracking spese

```typescript
// x402 buyer payments
gateway.on('x402:payment-sent', (event) => {
  const { url, method, amount, transaction } = event.data as any;
  console.log(`💸 Paid ${amount} for ${method} → tx: ${transaction}`);
});

// Stats aggregate
const buyerStats = gateway.getX402ClientStats();
if (buyerStats) {
  console.log(`Payments made: ${buyerStats.payments}`);
  for (const [key, amount] of buyerStats.totalPaid) {
    console.log(`  ${key}: ${amount} atomic units`);
  }
}
```

---

## Best practices

1. **Usa `*` solo per debug** — In produzione, sottoscrivi solo gli eventi che ti servono.
2. **Unsubscribe quando non serve** — `const unsub = gateway.on(...); unsub();`
3. **Structured logging** — JSON con level, type, timestamp per parsing automatico.
4. **Alerting su errori e latenza** — Non aspettare che i buyer se ne vadano.
5. **Export metriche** — Integra con Prometheus, Datadog, o il tuo sistema di monitoring.
6. **Garbage collect session metrics** — Rimuovi le metriche delle sessioni chiuse.
