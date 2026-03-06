/**
 * @module ai/plugins/nft
 * @description NFT Plugin — Metaplex management, 3.Land marketplace, and DAS queries.
 *
 * ```ts
 * import { NFTPlugin } from '@oobe-protocol-labs/synapse-client-sdk/ai/plugins/nft';
 *
 * const kit = new SynapseAgentKit({ rpcUrl: '...' })
 *   .use(NFTPlugin);
 * ```
 *
 * Tools included:
 *  - **metaplex-nft** (9): deployCollection, mintNFT, updateMetadata, verifyCreator,
 *    verifyCollection, setAndVerifyCollection, delegateAuthority, revokeAuthority, configureRoyalties
 *  - **3land** (5): createCollection, mintAndList, listForSale, cancelListing, buyNFT
 *  - **das** (5): getAsset, getAssetsByOwner, getAssetsByCreator, getAssetsByCollection, searchAssets
 *
 * @since 2.0.0
 */
import type { SynapsePlugin, PluginContext } from '../types';
import type { ProtocolMethod } from '../../tools/protocols/shared';
import { metaplexNftMethods, threeLandMethods, dasMethods } from './schemas';

export { metaplexNftMethods, threeLandMethods, dasMethods, allNftMethods } from './schemas';

export const NFTPlugin: SynapsePlugin = {
  meta: {
    id: 'nft',
    name: 'NFT Plugin',
    description: 'NFT operations: Metaplex management, 3.Land marketplace, and DAS queries',
    version: '2.0.0',
    tags: ['nft', 'metaplex', '3land', 'das', 'collection', 'compressed'],
    mcpResources: [
      'solana://nft/{mint}',
      'solana://collection/{mint}',
      'solana://nfts/owner/{wallet}',
    ],
  },

  protocols: [
    {
      id: 'metaplex-nft',
      name: 'Metaplex NFT Management',
      methods: metaplexNftMethods,
      requiresClient: true,
    },
    {
      id: '3land',
      name: '3.Land Marketplace',
      methods: threeLandMethods,
      baseUrl: 'https://api.3.land',
      requiresClient: true,
    },
    {
      id: 'das',
      name: 'Digital Asset Standard',
      methods: dasMethods,
      requiresClient: true,
    },
  ],

  install(context: PluginContext) {
    const transport = context.client.transport;

    return {
      executor: async (method: ProtocolMethod, input: Record<string, unknown>) => {
        switch (method.protocol) {
          case 'das': {
            // DAS methods are RPC calls on the same endpoint
            return transport.request(method.name, [input]);
          }
          case 'metaplex-nft':
          case '3land':
            return {
              status: 'instruction_ready',
              method: method.name,
              protocol: method.protocol,
              params: input,
              message: `${method.name} instruction prepared. Sign and submit the transaction.`,
            };
          default:
            throw new Error(`Unknown NFT protocol: ${method.protocol}`);
        }
      },
    };
  },
};

export default NFTPlugin;
