# GitHub Pages Setup Guide

Complete guide to deploy Synapse Client SDK documentation on GitHub Pages using Jekyll.

## Table of Contents

- [Quick Setup](#quick-setup)
- [Method 1: Direct HTML (Recommended)](#method-1-direct-html-recommended)
- [Method 2: Jekyll Integration](#method-2-jekyll-integration)
- [Custom Domain](#custom-domain)
- [Automation with GitHub Actions](#automation-with-github-actions)

---

## Quick Setup

### Prerequisites

- Documentation built: `pnpm build:docs`
- GitHub repository with docs in `dist/docs/`
- GitHub Pages enabled in repository settings

---

## Method 1: Direct HTML (Recommended)

The simplest approach - serve TypeDoc HTML directly without Jekyll.

### Step 1: Add `.nojekyll` file

Create a file to bypass Jekyll processing:

```bash
# In packages/synapse-client-sdk directory
touch dist/docs/.nojekyll
```

Or add to your build script:

```json
{
  "scripts": {
    "build:docs": "typedoc && touch dist/docs/.nojekyll"
  }
}
```

### Step 2: Configure GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select:
   - Branch: `main` (or your docs branch)
   - Folder: `/packages/synapse-client-sdk/dist/docs`
3. Click **Save**

### Step 3: Access Documentation

Your docs will be available at:
```
https://<username>.github.io/<repo-name>/
```

Example:
```
https://cryptofamilynft.github.io/synapse/
```

---

## Method 2: Jekyll Integration

Use Jekyll for custom styling and navigation.

### Step 1: Create Jekyll Configuration

Create `_config.yml` in `dist/docs/`:

```yaml
# _config.yml
title: Synapse Client SDK Documentation
description: Enterprise-grade Solana SDK with DeFi, NFT, and AI capabilities
baseurl: /synapse
url: https://cryptofamilynft.github.io

# Theme
theme: jekyll-theme-cayman
# Or use: jekyll-theme-minimal, jekyll-theme-slate, etc.

# Exclude TypeDoc internals from Jekyll processing
exclude:
  - assets/
  - modules/
  - classes/
  - interfaces/
  - functions/

# Markdown processor
markdown: kramdown
kramdown:
  input: GFM
  syntax_highlighter: rouge

# Plugins
plugins:
  - jekyll-feed
  - jekyll-seo-tag
```

### Step 2: Create Custom Landing Page

Create `index.md` in `dist/docs/`:

```markdown
---
layout: default
title: Synapse Client SDK
---

# Synapse Client SDK Documentation

Enterprise-grade TypeScript/JavaScript SDK for Solana blockchain.

## Features

- **DeFi Integration**: Jupiter, Raydium, Orca with production-ready swap engine
- **NFT Module**: Tensor and Magic Eden marketplace integration
- **AI Capabilities**: Smart PDA management and Merkle tree operations
- **Advanced Features**: Circuit breaker, load balancing, smart caching
- **WebSocket Support**: Real-time blockchain data streaming

## Quick Links

- [API Reference](./modules.html) - Complete API documentation
- [Getting Started](#getting-started)
- [Examples](#examples)
- [GitHub Repository](https://github.com/CryptoFamilyNFT/synapse)

## Getting Started

### Installation

\`\`\`bash
npm install @synapse/client-sdk
# or
pnpm add @synapse/client-sdk
\`\`\`

### Basic Usage

\`\`\`typescript
import { SynapseClient } from '@synapse/client-sdk';

const client = new SynapseClient({
  endpoint: 'https://api.synapse.example.com',
  apiKey: process.env.SYNAPSE_API_KEY,
});

// DeFi operations
const quote = await client.defi.jupiter.getQuote({
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount: 1000000000,
});

// NFT operations
const stats = await client.nft.analytics.getStats('collection_address');
console.log('Floor price:', stats.floorPrice, 'SOL');
\`\`\`

## Browse Documentation

- [Core Client](./classes/SynapseClient.html)
- [DeFi Module](./modules/defi.html)
- [NFT Module](./modules/nft.html)
- [AI Module](./modules/ai.html)
- [WebSocket](./modules/websocket.html)

---

**Version:** 1.0.0 | **License:** MIT
```

### Step 3: Add Custom Styling (Optional)

Create `assets/css/style.scss`:

```scss
---
---

@import "{{ site.theme }}";

// Custom styling
.main-content {
  h1 {
    color: #6366f1; // Indigo
    border-bottom: 2px solid #6366f1;
  }

  code {
    background-color: #f3f4f6;
    padding: 2px 6px;
    border-radius: 3px;
  }

  pre {
    background-color: #1f2937;
    border-radius: 8px;
    padding: 1rem;
  }
}

// TypeDoc integration
.tsd-navigation {
  font-size: 0.9rem;
}

.tsd-signature {
  font-family: 'Monaco', 'Courier New', monospace;
}
```

### Step 4: Update Build Script

Update `package.json`:

```json
{
  "scripts": {
    "build:docs": "typedoc && npm run docs:jekyll",
    "docs:jekyll": "cp .github/docs/_config.yml dist/docs/ && cp .github/docs/index.md dist/docs/"
  }
}
```

---

## Custom Domain

### Step 1: Add CNAME File

Create `dist/docs/CNAME`:

```
docs.synapse.example.com
```

### Step 2: Configure DNS

Add DNS records at your domain provider:

| Type  | Host | Value |
|-------|------|-------|
| CNAME | docs | `cryptofamilynft.github.io` |

Or for apex domain:

| Type | Host | Value |
|------|------|-------|
| A    | @    | 185.199.108.153 |
| A    | @    | 185.199.109.153 |
| A    | @    | 185.199.110.153 |
| A    | @    | 185.199.111.153 |

### Step 3: Update GitHub Settings

1. Go to repository **Settings** → **Pages**
2. Under **Custom domain**, enter: `docs.synapse.example.com`
3. Check **Enforce HTTPS**

---

## Automation with GitHub Actions

Automatically rebuild and deploy docs on every push.

### Create `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches:
      - main
    paths:
      - 'packages/synapse-client-sdk/src/**'
      - 'packages/synapse-client-sdk/package.json'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: |
          cd packages/synapse-client-sdk
          pnpm install

      - name: Build documentation
        run: |
          cd packages/synapse-client-sdk
          pnpm build:docs

      - name: Add .nojekyll
        run: touch packages/synapse-client-sdk/dist/docs/.nojekyll

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./packages/synapse-client-sdk/dist/docs
          publish_branch: gh-pages
          cname: docs.synapse.example.com  # Optional: your custom domain
```

### Configure GitHub Pages for Actions

1. Go to **Settings** → **Pages**
2. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: `gh-pages`
   - Folder: `/ (root)`

---

## Advanced: Multi-Version Documentation

Support multiple SDK versions.

### Directory Structure:

```
dist/docs/
├── index.html          # Latest version redirector
├── latest/             # Symlink to current version
├── v1.0.0/            # Version 1.0.0 docs
├── v1.1.0/            # Version 1.1.0 docs
└── v2.0.0/            # Version 2.0.0 docs (latest)
```

### Version Switcher Script:

```javascript
// scripts/version-docs.js
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const version = packageJson.version;
const docsDir = path.join(__dirname, '../dist/docs');
const versionDir = path.join(docsDir, `v${version}`);

// Move current docs to versioned directory
if (fs.existsSync(docsDir)) {
  fs.renameSync(docsDir, versionDir);
}

// Create index.html redirector
const indexHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=./v${version}/index.html">
  <title>Redirecting to latest documentation</title>
</head>
<body>
  <p>Redirecting to <a href="./v${version}/index.html">version ${version}</a>...</p>
</body>
</html>
`;

fs.writeFileSync(path.join(docsDir, 'index.html'), indexHtml);
```

---

## Troubleshooting

### Issue: 404 Page Not Found

**Solution:** Ensure `.nojekyll` file exists in docs root

```bash
touch dist/docs/.nojekyll
git add dist/docs/.nojekyll
git commit -m "Add .nojekyll for GitHub Pages"
git push
```

### Issue: CSS/JS Not Loading

**Cause:** Incorrect `baseurl` in Jekyll config

**Solution:** Update `_config.yml`:

```yaml
baseurl: /synapse  # Must match repository name
```

### Issue: Documentation Not Updating

**Solution:** Clear GitHub Pages cache

1. Make a dummy commit
2. Wait 1-2 minutes for GitHub to rebuild
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: Custom Domain Not Working

**Solution:** Check DNS propagation

```bash
# Check DNS resolution
nslookup docs.synapse.example.com

# Should return GitHub Pages IPs
dig docs.synapse.example.com
```

---

## Best Practices

### 1. Automated Deployment

Use GitHub Actions to automatically deploy docs on every release:

```yaml
on:
  release:
    types: [published]
```

### 2. Version Documentation

Tag docs with git tags:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push --tags
```

### 3. Documentation Quality

- Keep TypeDoc comments up to date
- Add code examples in JSDoc comments
- Include usage notes and warnings
- Link related functions and types

### 4. Performance

- Minimize external dependencies
- Use image optimization
- Enable GitHub Pages CDN
- Consider documentation size

---

## Recommended Themes

### GitHub Supported Themes

```yaml
theme: jekyll-theme-cayman      # Modern, clean
theme: jekyll-theme-minimal     # Simple, lightweight
theme: jekyll-theme-slate       # Dark theme
theme: jekyll-theme-architect   # Technical look
theme: jekyll-theme-modernist   # Contemporary design
```

### Custom Themes

Install via Gemfile:

```ruby
# Gemfile
source 'https://rubygems.org'
gem 'jekyll'
gem 'just-the-docs'  # Popular documentation theme
```

---

## Summary

**Recommended Setup:**

1. ✅ Use **Method 1 (Direct HTML)** for simplicity
2. ✅ Add `.nojekyll` file to bypass Jekyll
3. ✅ Automate with GitHub Actions
4. ✅ Use custom domain for professional look
5. ✅ Keep documentation updated with each release

**URLs:**
- Default: `https://<username>.github.io/<repo>/`
- Custom: `https://docs.synapse.example.com/`

**Documentation lives at:**
```
https://cryptofamilynft.github.io/synapse/
```

---

**Need Help?** Check [GitHub Pages Documentation](https://docs.github.com/en/pages)
