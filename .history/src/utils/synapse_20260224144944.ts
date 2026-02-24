enum CountryEndpoint {
    US = 'US',
    EU = 'EU',
}

export type SynapseEndpointsService = <T>() => SynapseEndpoints<T>;

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
    },
    [CountryEndpoint.EU]: {
        region: CountryEndpoint.EU,
        rpc_url: 'https://staging.oobeprotocol.ai',
    },
}