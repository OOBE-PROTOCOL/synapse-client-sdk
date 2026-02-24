/**
 * Synapse Endpoints
 * 
 * This module defines the available endpoints for the Synapse SDK, allowing users to select the appropriate region for their needs.
 * The endpoints are categorized by country, with options for both the United States and the European Union. Each endpoint includes the necessary URLs for RPC, WebSocket, and gRPC connections.
 * Usage:
 * 
 * import { SYNAPSE_ENDPOINTS } from './utils/synapse';
 * 
 * const usEndpoint = SYNAPSE_ENDPOINTS.US;
 * const euEndpoint = SYNAPSE_ENDPOINTS.EU;
 * 
 * This structure allows for easy expansion in the future, should additional regions or endpoints be added to the Synapse network.
 */
enum CountryEndpoint {
    US = 'US',
    EU = 'EU',
}

/**
 * SynapseEndpointsService is a type definition for a function that returns the available Synapse endpoints. It is designed to be flexible, allowing for different types of endpoint configurations in the future if needed.
 * Currently, it returns a SynapseEndpoints object that maps each CountryEndpoint to its corresponding endpoint configuration, including the RPC URL and optional WebSocket and gRPC URLs.
 * 
 * Example usage:
 * 
 * const getEndpoints: SynapseEndpointsService = () => SYNAPSE_ENDPOINTS;
 * const endpoints = getEndpoints();
 * console.log(endpoints.US.rpc_url); // Output: 'https://us-1-mainnet.oobeprotocol.ai'
 */
export type SynapseEndpointsService = <T>() => SynapseEndpoints<T>;

/**
 * SynapseEndpoints is an interface that defines the structure of the endpoint configurations for the Synapse SDK. It maps each CountryEndpoint to an object containing the region, RPC URL, and optional WebSocket and gRPC URLs.
 * This interface allows for a clear and organized way to manage the different endpoints available for the Synapse SDK, making it easy for users to select the appropriate endpoint based on their region and requirements.
 */
export interface SynapseEndpoints<T> {
    region: CountryEndpoint;
    rpc_url: string;
    wss_url?: string | null | undefined;
    grpc_url?: string | null | undefined;
}  

export const SYNAPSE_ENDPOINTS: SynapseEndpoints<CountryEndpoint> = {
    [CountryEndpoint.US]: {
        region: CountryEndpoint.US,
        rpc_url: 'https://us-1-mainnet.oobeprotocol.ai',
        wss_url: 'wss://us-1-mainnet.oobeprotocol.ai/ws',
        grpc_url: 'https://us-1-mainnet.oobeprotocol.ai/grpc',
    },
    [CountryEndpoint.EU]: {
        region: CountryEndpoint.EU,
        rpc_url: 'https://staging.oobeprotocol.ai',
        wss_url: 'wss://staging.oobeprotocol.ai/ws',
        grpc_url: 'https://staging.oobeprotocol.ai/grpc',
    },
}