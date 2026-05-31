/**
 * @module ai/plugins/earnfi/client
 * @description Thin wrapper around `@earn-fi/agent-client` for the Synapse EarnFi plugin.
 * @since 2.0.6
 */

export {
  EarnFiAgentClient as EarnFiHttpClient,
  EARNFI_DEFAULT_API_BASE,
  type AgentClientOptions as EarnFiHttpClientConfig,
  type WalletLike as EarnFiWalletLike,
} from '@earn-fi/agent-client';
