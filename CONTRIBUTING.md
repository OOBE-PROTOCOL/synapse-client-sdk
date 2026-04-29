# Contributing to Synapse Client SDK

Thank you for your interest in contributing to `@oobe-protocol-labs/synapse-client-sdk`! 

## Branch Strategy (Git Flow)

We follow a **Git Flow**-based branching model:

```
main ──────────────────────────────────── production (tagged releases)
  │
  └── develop ─────────────────────────── integration branch
        │
        ├── feature/my-feature ────────── new features
        ├── fix/bug-description ───────── bug fixes
        └── chore/task-description ────── maintenance tasks

  └── release/vX.Y.Z ─────────────────── release candidates
  └── hotfix/vX.Y.Z ──────────────────── urgent production fixes
```

### Branch Types

| Branch | Base | Merges Into | Purpose |
|--------|------|-------------|---------|
| `main` | — | — | Production-ready code. Every commit is a release. |
| `develop` | `main` | `main` (via release) | Integration branch for next release. |
| `feature/*` | `develop` | `develop` | New features and enhancements. |
| `fix/*` | `develop` | `develop` | Non-urgent bug fixes. |
| `chore/*` | `develop` | `develop` | Docs, refactoring, CI, tooling. |
| `release/vX.Y.Z` | `develop` | `main` + `develop` | Release candidates — version bumps, changelogs, final QA. |
| `hotfix/vX.Y.Z` | `main` | `main` + `develop` | Critical production fixes. |

### Workflow

1. **Create a feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Develop and commit** with [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add Jupiter swap integration"
   git commit -m "fix: correct token balance parsing"
   git commit -m "docs: add JSDoc to RPC methods"
   git commit -m "chore: update dependencies"
   ```

3. **Open a Pull Request** into `develop`.

4. **Release process**:
   ```bash
   git checkout develop
   git checkout -b release/v1.0.2
   # bump version, update CHANGELOG, final testing
   git checkout main
   git merge release/v1.0.2
   git tag -a v1.0.2 -m "Release v1.0.2"
   git push origin main --tags
   git checkout develop
   git merge release/v1.0.2
   ```

## Commit Convention

We use **Conventional Commits**:

| Prefix | Description |
|--------|-------------|
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `docs:` | Documentation only changes |
| `style:` | Formatting, missing semi-colons, etc. |
| `refactor:` | Code change that neither fixes nor adds a feature |
| `perf:` | Performance improvement |
| `test:` | Adding or fixing tests |
| `chore:` | Build process, CI, tooling |

## Development Setup

```bash
# Clone the repo
git clone https://github.com/oobe-protocol-labs/synapse-client-sdk.git
cd synapse-client-sdk

# Install dependencies
pnpm install

# Run tests
pnpm test

# Type-check
pnpm run typecheck

# Build
pnpm run build
```

## Code Quality

- **TypeScript strict mode** is enforced.
- **JSDoc** is required for all public exports (`@description`, `@param`, `@returns`, `@since`).
- **Tests** must pass before merging: `pnpm test` (vitest).
- No `any` types unless explicitly justified.

---

## Adding an MCP Server Preset

The registry at `src/ai/mcp/presets/registry.ts` lists publicly-shareable
connection templates for external MCP servers. Partners can add new presets
via PR without touching any SDK logic.

### Where to edit

| File | What to do |
|------|-----------|
| `src/ai/mcp/presets/registry.ts` | Add your entry to the `RAW_PRESETS` array |
| `docs_md/11_MCP.md` | Add a usage snippet to the "Preset Registry" section (recommended) |

### Field rules

| Field | Rule |
|-------|------|
| `id` | Kebab-case, globally unique, **never rename after publishing** (e.g. `'my-service'`) |
| `name` | Human-readable display name |
| `description` | One sentence, shown in `listMcpPresets()` |
| `transport` | `'stdio'` or `'sse'` |
| `toolPrefix` | Snake-case + trailing underscore, unique across registry (e.g. `'myservice_'`) |
| `command` / `args` | Required for `stdio`. Args may contain `${ENV_VAR}` placeholders for secrets |
| `url` | Required for `sse`. Must be a public endpoint URL — no auth in the URL |
| `env` / `headers` | **Placeholder values only** — see below |
| `docsUrl` | Link to the server's own documentation (recommended) |
| `npmPackage` | The npm package name if spawned via `npx` (recommended) |

### Secret handling — mandatory rule

**Never embed real credentials.** All secret values must be placeholders:

```ts
// ✅ Correct — placeholder form
env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' }
headers: { Authorization: 'Bearer ${ORBIS_API_KEY}' }

// ❌ Wrong — real secret
env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_realtoken123' }
```

Callers supply real values at runtime via `connectPreset(id, { env: { ... } })`.
The Zod schema in `src/ai/mcp/presets/types.ts` will **reject** any non-placeholder
value at import time.

### stdio vs SSE

| Use stdio when… | Use SSE when… |
|-----------------|---------------|
| The server is an npm package spawned by `npx` | The server runs as a public HTTPS endpoint |
| Credentials go in `env` or `args` | Credentials go in `headers` (e.g. `Authorization: Bearer …`) |

Both transport types are supported in the public registry.

### PR checklist

- [ ] Entry added to `RAW_PRESETS` in `src/ai/mcp/presets/registry.ts`
- [ ] `id` is unique in the registry (verified by the startup check)
- [ ] `toolPrefix` is unique in the registry
- [ ] No real secrets in `env`, `headers`, or `args` — only `${PLACEHOLDER}` strings
- [ ] `pnpm test` passes
- [ ] `pnpm run typecheck` passes
- [ ] (Recommended) Usage example added to `docs_md/11_MCP.md`

### Example entry

```ts
{
  id: 'my-service',
  name: 'My Service',
  description: 'Query My Service data from an AI agent.',
  transport: 'sse',
  url: 'https://mcp.my-service.com/sse',
  headers: { Authorization: 'Bearer ${MY_SERVICE_API_KEY}' },
  toolPrefix: 'myservice_',
  docsUrl: 'https://docs.my-service.com/mcp',
  timeout: 20_000,
},
```

Caller usage:

```ts
await bridge.connectPreset('my-service', {
  headers: { Authorization: `Bearer ${process.env.MY_SERVICE_API_KEY}` },
});
```

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
