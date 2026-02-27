/**
 * @module ai/tools/protocols/raydium-onchain
 * @description Raydium On-Chain — barrel export for Raydium local RPC tools.
 *
 * These tools query Raydium protocol state directly from the blockchain
 * using the SDK's native RPC transport, complementing the REST-based
 * Raydium tools that call api-v3.raydium.io.
 *
 * @since 1.1.0
 */
export { raydiumOnchainMethods, raydiumOnchainMethodNames } from './schemas';
export {
  createRaydiumOnchainTools,
  RAYDIUM_PROGRAM_IDS,
  type RaydiumOnchainToolsConfig,
} from './tools';
