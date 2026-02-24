enum CountryEndpoint {
    US = 'US',
    EU = 'EU',
}

export interface SynapseEndpoints {
    region: CountryEndpoint;
    url: string;
}  

export const SYNAPSE_ENDPOINTS = {
    [CountryEndpoint.US]: {
        region: CountryEndpoint.US,
        url: 'https://api.synapsefi.com/v3.1',
    },
    [CountryEndpoint.EU]: {
        region: CountryEndpoint.EU,
        url: 'https://eu-api.synapsefi.com/v3.1',
    },
}