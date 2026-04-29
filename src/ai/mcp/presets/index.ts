/**
 * @module ai/mcp/presets
 * @description Public API for the MCP server preset registry.
 * @since 2.0.0
 */
export type { McpPreset, McpPresetMeta, McpPresetOverrides, McpStdioPreset, McpSsePreset } from './types';
export { McpPresetSchema, McpStdioPresetSchema, McpSsePresetSchema } from './types';
export { PRESET_REGISTRY, listPresets, getPreset } from './registry';
