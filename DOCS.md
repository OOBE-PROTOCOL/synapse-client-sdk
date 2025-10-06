# Synapse Client SDK - Documentation Guide

##  Come Aprire e Consultare la Documentazione

La documentazione completa del Synapse Client SDK è generata automaticamente da **TypeDoc** e si trova nella cartella `dist/docs/`.

---

##  Quick Start - Aprire i Docs

### Metodo 1: Browser (Raccomandato)

#### macOS
```bash
cd packages/synapse-client-sdk/dist/docs
open index.html
```

#### Linux
```bash
cd packages/synapse-client-sdk/dist/docs
xdg-open index.html
```

#### Windows
```bash
cd packages\synapse-client-sdk\dist\docs
start index.html
```

### Metodo 2: Server HTTP Locale

#### Con Node.js (serve)
```bash
# Installa serve globalmente (solo la prima volta)
npm install -g serve

# Avvia il server
cd packages/synapse-client-sdk/dist/docs
serve -p 8080
```
Poi apri: **http://localhost:8080**

#### Con pnpm dlx (nessuna installazione)
```bash
cd packages/synapse-client-sdk/dist/docs
pnpm dlx serve -p 8080
```
Poi apri: **http://localhost:8080**

### Metodo 3: VS Code Live Server

1. Installa l'estensione **Live Server** in VS Code
2. Clicca destro su `dist/docs/index.html`
3. Seleziona **"Open with Live Server"**

---

## 📂 Struttura della Documentazione

```
dist/docs/
├── index.html              #  Homepage - inizia da qui
├── modules.html            #  Lista di tutti i moduli
├── hierarchy.html          #  Gerarchia delle classi
├── classes/                #  Documentazione delle classi
│   ├── SynapseClient.html
│   ├── WebSocketClient.html
│   ├── SmartCaching.html
│   ├── CircuitBreaker.html
│   └── ...
├── interfaces/             #  Documentazione delle interfacce
│   ├── SynapseConfig.html
│   ├── DeFiConfig.html
│   └── ...
├── functions/              #  Funzioni utility
├── types/                  #  Type definitions
└── assets/                 #  CSS e risorse
```

---

## 🔍 Navigazione nella Documentazione

### Homepage (`index.html`)
- Panoramica generale del SDK
- Link rapidi ai moduli principali
- Getting started guide

### Moduli Principali

#### 1. **Core Module**
- Percorso: `classes/SynapseClient.html`
- Cosa trovi: Client principale RPC, batch requests, statistiche

#### 2. **Advanced Module**
- Percorso: `classes/SmartCaching.html`, `classes/CircuitBreaker.html`
- Cosa trovi: Caching multi-layer, circuit breaker, load balancer

#### 3. **WebSocket Module**
- Percorso: `classes/WebSocketClient.html`
- Cosa trovi: Real-time subscriptions, auto-reconnect

#### 4. **DeFi Module**
- Percorso: `classes/SynapseSolanaEngine.html`
- Cosa trovi: Jupiter integration, Raydium, swap transactions

#### 5. **AI Module**
- Percorso: `classes/PDAManager.html`, `classes/ZeroCombineFetcher.html`
- Cosa trovi: OOBE Protocol, PDA management, Merkle operations

#### 6. **NFT Module**
- Percorso: `classes/NFTDataIntegration.html`
- Cosa trovi: Metaplex, compressed NFTs, collection queries

---

## Come Usare la Documentazione

### 1. Cercare una Classe

**Esempio:** Vuoi documentazione per `SmartCaching`

1. Apri `index.html`
2. Cerca nella sidebar o usa Ctrl+F per "SmartCaching"
3. Oppure vai direttamente a `classes/SmartCaching.html`

### 2. Cercare un'Interfaccia

**Esempio:** Vuoi vedere `DeFiConfig`

1. Vai su `modules.html`
2. Cerca "Interfaces"
3. Clicca su `DeFiConfig`
4. Oppure vai direttamente a `interfaces/DeFiConfig.html`

### 3. Vedere Tutti i Metodi di una Classe

1. Apri la classe (es. `classes/SynapseClient.html`)
2. Scorri la sidebar sinistra per vedere:
   - **Constructor** - Come inizializzare
   - **Properties** - Proprietà pubbliche
   - **Methods** - Tutti i metodi disponibili
   - **Events** - Eventi emessi

### 4. Vedere Esempi di Codice

Ogni metodo include:
- **Signature** - Firma TypeScript
- **Parameters** - Parametri con tipi
- **Returns** - Tipo di ritorno
- **Description** - Descrizione dettagliata
- **Example** - Esempio di utilizzo (quando disponibile)

---

##  Rigenerare la Documentazione

Se hai modificato il codice sorgente e vuoi aggiornare i docs:

```bash
cd packages/synapse-client-sdk

# Ricompila tutto (inclusa la documentazione)
pnpm build

# Solo documentazione (più veloce)
pnpm run build:docs
```

La documentazione sarà rigenerata in `dist/docs/`.

---

## Configurazione TypeDoc

La configurazione di TypeDoc è nel file `tsconfig.json` sotto la sezione `typedocOptions`:

```json
{
  "typedocOptions": {
    "entryPoints": ["src/index.ts"],
    "out": "dist/docs",
    "plugin": ["typedoc-plugin-markdown"],
    "theme": "default"
  }
}
```

---

## Pubblicare i Docs Online

### GitHub Pages

```bash
# 1. Crea branch gh-pages
git checkout --orphan gh-pages

# 2. Copia i docs
cp -r packages/synapse-client-sdk/dist/docs/* .

# 3. Commit e push
git add .
git commit -m "Deploy documentation"
git push origin gh-pages

# 4. Abilita GitHub Pages nelle repo settings
# Settings > Pages > Source: gh-pages branch
```

Docs disponibili su: `https://cryptofamilynft.github.io/synapse/`

### Vercel/Netlify

1. **Vercel:**
   ```bash
   cd packages/synapse-client-sdk/dist/docs
   vercel --prod
   ```

2. **Netlify:**
   ```bash
   cd packages/synapse-client-sdk/dist/docs
   netlify deploy --prod --dir .
   ```

---

## 📱 Docs Offline

Per consultare i docs senza internet:

1. Copia la cartella `dist/docs/` sul tuo dispositivo
2. Apri `index.html` con un browser
3. Tutti i link funzioneranno in locale

---

## 🔗 Link Utili

### Documentazione Moduli

- **Core Client:** `classes/SynapseClient.html`
- **WebSocket:** `classes/WebSocketClient.html`
- **DeFi Engine:** `classes/SynapseSolanaEngine.html`
- **Smart Caching:** `classes/SmartCaching.html`
- **Circuit Breaker:** `classes/CircuitBreaker.html`
- **PDA Manager:** `classes/PDAManager.html`
- **NFT Integration:** `classes/NFTDataIntegration.html`

### Configurazioni

- **SynapseConfig:** `interfaces/SynapseConfig.html`
- **DeFiConfig:** `interfaces/DeFiConfig.html`
- **WebSocketConfig:** `interfaces/WebSocketConfig.html`
- **SmartCacheConfig:** `interfaces/SmartCacheConfig.html`

---

## 🎨 Personalizzare il Theme

Per cambiare il tema della documentazione, modifica `tsconfig.json`:

```json
{
  "typedocOptions": {
    "theme": "default",  // o "minimal", "dark"
    "customCss": "./custom-docs.css"
  }
}
```

---

## 🐛 Troubleshooting

### I link non funzionano
- **Causa:** File aperti direttamente senza server HTTP
- **Soluzione:** Usa Python/Node server o VS Code Live Server

### Documentazione non aggiornata
```bash
# Pulisci e ricostruisci
rm -rf dist/docs
pnpm build
```

### Mancano alcuni metodi
- **Causa:** Metodi privati o non documentati
- **Soluzione:** Aggiungi JSDoc ai metodi nel codice sorgente

---

## 📊 Statistiche Documentazione

```
Classi documentate: 20+
Interfacce: 50+
Funzioni: 30+
Type Aliases: 40+
Pagine totali: 150+
```

---

## ✅ Checklist Quick Start

- [ ] Naviga a `packages/synapse-client-sdk/dist/docs/`
- [ ] Apri `index.html` con browser o server HTTP
- [ ] Esplora la sidebar per trovare classi/interfacce
- [ ] Usa la barra di ricerca per trovare API specifiche
- [ ] Leggi esempi di codice nelle descrizioni dei metodi
- [ ] Consulta `hierarchy.html` per capire le relazioni tra classi

---

## 🎓 Best Practices

1. **Inizia sempre da `index.html`** per overview generale
2. **Usa `modules.html`** per vedere tutti i moduli disponibili
3. **Consulta `interfaces/`** per vedere i parametri di configurazione
4. **Leggi `classes/`** per API dettagliate dei metodi
5. **Controlla `hierarchy.html`** per capire l'architettura

---

## 🚀 Esempio Sessione Tipica

```bash
# 1. Apri i docs
cd packages/synapse-client-sdk/dist/docs
python3 -m http.server 8080

# 2. Browser → http://localhost:8080

# 3. Navigazione:
#    - Homepage → Overview
#    - Sidebar → SynapseClient
#    - Methods → call(), batch()
#    - Interfaces → SynapseConfig
#    - Examples → Copy/paste nei tuoi progetti
```

---

## 📞 Supporto

- **Issues:** [GitHub Issues](https://github.com/CryptoFamilyNFT/synapse/issues)
- **Discussions:** [GitHub Discussions](https://github.com/CryptoFamilyNFT/synapse/discussions)
- **Docs Source:** `src/**/*.ts` (JSDoc comments)

---

**Happy Coding! 🎉**

*Documentazione generata con ❤️ da TypeDoc*
