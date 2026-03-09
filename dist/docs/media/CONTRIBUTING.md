# Contributing to Synapse Client SDK

Thank you for your interest in contributing to `@oobe-protocol-labs/synapse-client-sdk`! 🎉

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

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
