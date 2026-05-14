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

  /* ─────────────────────────────────────────────────────────────
   *  AceDataCloud — hosted MCP fleet (transport: 'sse')
   * ─────────────────────────────────────────────────────────────
   *  Generative-AI and web-search services hosted at
   *  `https://*.mcp.acedata.cloud/sse`. All endpoints share the
   *  same auth shape — callers supply a full Bearer header at
   *  `connectPreset()` time, e.g.
   *
   *    bridge.connectPreset('acedata-suno', {
   *      headers: {
   *        Authorization: `Bearer ${process.env.ACEDATACLOUD_API_TOKEN}`,
   *      },
   *    });
   *
   *  Get an API token at https://platform.acedata.cloud.
   * ───────────────────────────────────────────────────────────── */

  // ── AceDataCloud Suno (AI music) ─────────────────────────────
  {
    id: 'acedata-suno',
    name: 'AceDataCloud Suno',
    description:
      'Generate music, lyrics, covers, remasters, and mashups via Suno AI hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://suno.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'suno_',
    docsUrl: 'https://docs.acedata.cloud/suno/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Midjourney (AI image) ───────────────────────
  {
    id: 'acedata-midjourney',
    name: 'AceDataCloud Midjourney',
    description:
      'Generate, edit, blend, upscale, describe, and animate images via Midjourney hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://midjourney.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'midjourney_',
    docsUrl: 'https://docs.acedata.cloud/midjourney/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud SERP (web search) ───────────────────────────
  {
    id: 'acedata-serp',
    name: 'AceDataCloud SERP',
    description:
      'Google search, images, news, videos, places, and maps via the AceDataCloud SERP API.',
    transport: 'sse',
    url: 'https://serp.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'serp_',
    docsUrl: 'https://docs.acedata.cloud/serp/overview',
    timeout: 15_000,
  },

  // ── AceDataCloud Flux (AI image) ─────────────────────────────
  {
    id: 'acedata-flux',
    name: 'AceDataCloud Flux',
    description: 'Generate and edit images via Flux models hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://flux.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'flux_',
    docsUrl: 'https://docs.acedata.cloud/flux/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Luma (AI video) ─────────────────────────────
  {
    id: 'acedata-luma',
    name: 'AceDataCloud Luma',
    description: 'Generate video clips via Luma Dream Machine hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://luma.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'luma_',
    docsUrl: 'https://docs.acedata.cloud/luma/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Sora (AI video) ─────────────────────────────
  {
    id: 'acedata-sora',
    name: 'AceDataCloud Sora',
    description: 'Generate video clips via OpenAI Sora hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://sora.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'sora_',
    docsUrl: 'https://docs.acedata.cloud/sora/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Veo (AI video) ──────────────────────────────
  {
    id: 'acedata-veo',
    name: 'AceDataCloud Veo',
    description: 'Generate video clips via Google Veo hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://veo.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'veo_',
    docsUrl: 'https://docs.acedata.cloud/veo/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Seedream (AI image) ─────────────────────────
  {
    id: 'acedata-seedream',
    name: 'AceDataCloud Seedream',
    description: 'Generate and edit images via ByteDance Seedream hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://seedream.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'seedream_',
    docsUrl: 'https://docs.acedata.cloud/seedream/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Seedance (AI video) ─────────────────────────
  {
    id: 'acedata-seedance',
    name: 'AceDataCloud Seedance',
    description: 'Generate video clips via ByteDance Seedance hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://seedance.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'seedance_',
    docsUrl: 'https://docs.acedata.cloud/seedance/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Nano-Banana (AI image) ──────────────────────
  {
    id: 'acedata-nano-banana',
    name: 'AceDataCloud Nano-Banana',
    description:
      'Generate and edit images via the Gemini-based Nano-Banana model hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://nano-banana.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'nanobanana_',
    docsUrl: 'https://docs.acedata.cloud/nano-banana/overview',
    timeout: 30_000,
  },

  // ── AceDataCloud Short URL ───────────────────────────────────
  {
    id: 'acedata-short-url',
    name: 'AceDataCloud Short URL',
    description: 'Create and resolve short URLs via the AceDataCloud Short URL service.',
    transport: 'sse',
    url: 'https://short-url.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'shorturl_',
    docsUrl: 'https://docs.acedata.cloud/short-url/overview',
    timeout: 15_000,
  },

  // ── AceDataCloud Wan (AI video) ──────────────────────────────
  {
    id: 'acedata-wan',
    name: 'AceDataCloud Wan',
    description: 'Generate video clips via Alibaba Wan hosted by AceDataCloud.',
    transport: 'sse',
    url: 'https://wan.mcp.acedata.cloud/sse',
    headers: { Authorization: '${ACEDATACLOUD_API_TOKEN}' },
    toolPrefix: 'wan_',
    docsUrl: 'https://docs.acedata.cloud/wan/overview',
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
