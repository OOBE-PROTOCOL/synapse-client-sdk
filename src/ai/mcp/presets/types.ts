/**
 * @module ai/mcp/presets/types
 * @description Typed schema for publicly-shareable MCP server presets.
 *
 * A preset is a _static_, _secret-free_ description of how to connect to an
 * external MCP server. Runtime credentials are always supplied by the caller
 * via `connectPreset(id, overrides)` — never hardcoded here.
 *
 * @since 2.0.0
 */
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
 *  Placeholder helpers
 * ═══════════════════════════════════════════════════════════════ */

/**
 * A string that looks like `${ENV_VAR_NAME}` or `YOUR_API_KEY`.
 * Used to signal to callers that they must supply the real value.
 */
const PlaceholderString = z
  .string()
  .refine(
    (v) => /^\$\{[A-Z0-9_]+\}$/.test(v) || /^YOUR_/.test(v) || v === '',
    { message: 'Value must be a placeholder like ${MY_VAR} or YOUR_API_KEY — never a real secret' },
  );

/* ═══════════════════════════════════════════════════════════════
 *  stdio preset
 * ═══════════════════════════════════════════════════════════════ */

export const McpStdioPresetSchema = z.object({
  /** Transport discriminant. */
  transport: z.literal('stdio'),

  /** Executable to spawn (e.g. `'npx'`, `'node'`). */
  command: z.string().min(1),

  /**
   * Arguments passed to `command`.
   * Args that are secrets must use placeholder form: `'${MY_SECRET}'`.
   */
  args: z.array(z.string()).default([]),

  /**
   * Environment variable keys pre-populated with placeholder values.
   * Real values are injected at runtime via `connectPreset` overrides.
   *
   * @example { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' }
   */
  env: z.record(z.string(), PlaceholderString).optional(),
});

export type McpStdioPreset = z.infer<typeof McpStdioPresetSchema>;

/* ═══════════════════════════════════════════════════════════════
 *  SSE preset
 * ═══════════════════════════════════════════════════════════════ */

export const McpSsePresetSchema = z.object({
  /** Transport discriminant. */
  transport: z.literal('sse'),

  /** Public SSE endpoint URL (no auth embedded). */
  url: z.string().url(),

  /**
   * HTTP headers with placeholder values.
   * Callers override with real credentials at runtime.
   *
   * @example { Authorization: 'Bearer ${ORBIS_API_KEY}' }
   */
  headers: z.record(z.string(), PlaceholderString).optional(),
});

export type McpSsePreset = z.infer<typeof McpSsePresetSchema>;

/* ═══════════════════════════════════════════════════════════════
 *  Union preset
 * ═══════════════════════════════════════════════════════════════ */

const McpPresetTransportSchema = z.discriminatedUnion('transport', [
  McpStdioPresetSchema,
  McpSsePresetSchema,
]);

/* ═══════════════════════════════════════════════════════════════
 *  Full preset record
 * ═══════════════════════════════════════════════════════════════ */

export const McpPresetSchema = z
  .object({
    /**
     * Stable, unique identifier in kebab-case.
     * Never rename a published `id` — callers depend on it.
     *
     * @example 'github', 'orbis', 'postgres'
     */
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be kebab-case'),

    /** Human-readable display name. */
    name: z.string().min(1),

    /** One-line description shown in `listMcpPresets()`. */
    description: z.string().min(1),

    /**
     * Tool name prefix appended to every imported tool.
     * Must end with an underscore.
     *
     * @example 'github_', 'pg_', 'orbis_'
     */
    toolPrefix: z
      .string()
      .regex(/^[a-z][a-z0-9]*_$/, 'toolPrefix must be snake_case and end with _'),

    /** Link to the server's own documentation. */
    docsUrl: z.string().url().optional(),

    /** npm package (if the server is spawned via npx). */
    npmPackage: z.string().optional(),

    /** Connection timeout in ms. Default: 30 000. */
    timeout: z.number().int().positive().optional(),
  })
  .and(McpPresetTransportSchema);

/** A fully-validated, secret-free MCP server preset. */
export type McpPreset = z.infer<typeof McpPresetSchema>;

/* ═══════════════════════════════════════════════════════════════
 *  Runtime overrides supplied by the caller
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Values the caller provides at `connectPreset()` time to fill in
 * the placeholders from a preset.
 */
export interface McpPresetOverrides {
  /** Override / supply real env-var values (stdio presets). */
  env?: Record<string, string>;
  /** Override / supply real header values (SSE presets). */
  headers?: Record<string, string>;
  /** Override the connection timeout. */
  timeout?: number;
}

/* ═══════════════════════════════════════════════════════════════
 *  Preset metadata (returned by listMcpPresets)
 * ═══════════════════════════════════════════════════════════════ */

export interface McpPresetMeta {
  id: string;
  name: string;
  description: string;
  transport: 'stdio' | 'sse';
  toolPrefix: string;
  docsUrl?: string;
  npmPackage?: string;
}
