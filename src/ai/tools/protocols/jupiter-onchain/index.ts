/**
 * @module ai/tools/protocols/jupiter-onchain
 * @description Jupiter On-Chain — barrel export for Jupiter local RPC tools.
 *
 * These tools query Jupiter protocol state directly from the blockchain
 * using the SDK's native RPC transport, complementing the REST-based
 * Jupiter tools that call api.jup.ag.
 *
 * @since 1.1.0
 */
export { jupiterOnchainMethods, jupiterOnchainMethodNames } from './schemas';
export {
  createJupiterOnchainTools,
  JUPITER_PROGRAM_IDS,
  type JupiterOnchainToolsConfig,
} from './tools';
