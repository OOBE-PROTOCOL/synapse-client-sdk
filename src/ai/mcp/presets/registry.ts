/**
 * @module ai/mcp/presets/registry
 * @description Public registry of well-known MCP server presets.
 *
 * ## Adding a new preset (Partner PR guide)
 *
 * 1. Add a new entry to the `PRESETS` array below.
 * 2. Follow the `McpPreset` contract (enforced by Zod at import time).
 * 3. **Never** embed real API keys, tokens, or passwords — use placeholder
 *    strings of the form `${MY_ENV_VAR}` or `YOUR_API_KEY`.
 * 4. Choose a stable `id` in kebab-case (e.g. `'my-service'`). Once
 *    published, the `id` must never change.
 * 5. `toolPrefix` must be unique across the registry and end with `_`.
 * 6. Run `pnpm test && pnpm run typecheck` before opening the PR.
 *
 * @since 2.0.0
 */
import { McpPresetSchema, type McpPreset } from './types';

/* ═══════════════════════════════════════════════════════════════
 *  Registry
 * ═══════════════════════════════════════════════════════════════ */

const RAW_PRESETS = [
  // ── GitHub ──────────────────────────────────────────────────
  {
    id: 'github',
    name: 'GitHub',
    description: 'Create issues, PRs, search code, manage repos via the GitHub MCP server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    toolPrefix: 'github_',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    npmPackage: '@modelcontextprotocol/server-github',
    timeout: 30_000,
  },

  // ── PostgreSQL ───────────────────────────────────────────────
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Run read-only SQL queries against a PostgreSQL database.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    toolPrefix: 'pg_',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    npmPackage: '@modelcontextprotocol/server-postgres',
    timeout: 30_000,
  },

  // ── Filesystem ───────────────────────────────────────────────
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and list files within a sandboxed directory.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${FS_ALLOWED_DIR}'],
    toolPrefix: 'fs_',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    npmPackage: '@modelcontextprotocol/server-filesystem',
    timeout: 15_000,
  },

  // ── Slack ────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages, list channels, and search Slack via the official MCP server.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: {
      SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}',
      SLACK_TEAM_ID: '${SLACK_TEAM_ID}',
    },
    toolPrefix: 'slack_',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    npmPackage: '@modelcontextprotocol/server-slack',
    timeout: 20_000,
  },

  // ── Brave Search ─────────────────────────────────────────────
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web and local search powered by the Brave Search API.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
    toolPrefix: 'brave_',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    npmPackage: '@modelcontextprotocol/server-brave-search',
    timeout: 15_000,
  },

  // ── Orbis API Marketplace ────────────────────────────────────
  {
    id: 'orbis',
    name: 'Orbis API Marketplace',
    description:
      'Search and call 12,000+ APIs (finance, AI, blockchain, data enrichment, and more) ' +
      'on the Orbis marketplace. Agents pay per call in USDC on Base via x402 — ' +
      'no account or API key required. Pass an optional x-orbis-key header for key-based auth.',
    transport: 'sse',
    url: 'https://orbisapi.com/api/mcp/sse',
    toolPrefix: 'orbis_',
    docsUrl: 'https://orbisapi.com',
    timeout: 30_000,
  },
] as const satisfies McpPreset[];

/* ═══════════════════════════════════════════════════════════════
 *  Validated registry (fails loudly at import time if a preset is malformed)
 * ═══════════════════════════════════════════════════════════════ */

export const PRESET_REGISTRY: ReadonlyMap<string, McpPreset> = (() => {
  const map = new Map<string, McpPreset>();
  for (const raw of RAW_PRESETS) {
    const result = McpPresetSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `[McpPresets] Invalid preset "${(raw as { id?: string }).id ?? '?'}": ${result.error.message}`,
      );
    }
    const preset = result.data;
    if (map.has(preset.id)) {
      throw new Error(`[McpPresets] Duplicate preset id: "${preset.id}"`);
    }
    map.set(preset.id, preset);
  }
  return Object.freeze(map);
})();

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

/** Return all registered presets as an array. */
export function listPresets(): McpPreset[] {
  return [...PRESET_REGISTRY.values()];
}

/** Lookup a single preset by id. Returns `undefined` if not found. */
export function getPreset(id: string): McpPreset | undefined {
  return PRESET_REGISTRY.get(id);
}
