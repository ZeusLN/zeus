// The capabilities the activity filters depend on, as each backend reports
// them (backends/*.ts). Tests use them so a filter is checked against what a
// real node returns. Keep them in step with the backends.
export type BackendCapabilities = Record<string, boolean>;

const LND_BASED = {
    isLNDBased: true,
    supportsOnchainSends: true,
    supportsOnchainReceiving: true,
    supportsKeysend: true,
    supportsAMP: true,
    supportsCircularRebalancing: true,
    supportsLSPScustomMessage: true,
    supportsLightningAddress: true
};

export const BACKEND_CAPABILITIES: Record<string, BackendCapabilities> = {
    lnd: { ...LND_BASED, supportsLSPS1rest: true },
    // ecash is available on the embedded node, not over REST
    'embedded-lnd': { ...LND_BASED, supportsCashuWallet: true },
    'lightning-node-connect': { ...LND_BASED, supportsLSPS1rest: true },
    // an LNC session that may only receive: no on-chain sends
    'lightning-node-connect-receive-only': {
        ...LND_BASED,
        supportsLSPS1rest: true,
        supportsOnchainSends: false
    },
    'cln-rest': {
        supportsOnchainSends: true,
        supportsOnchainReceiving: true,
        supportsKeysend: true,
        supportsCircularRebalancing: true,
        supportsLSPS1rest: true
    },
    'ldk-node': {
        supportsOnchainSends: true,
        supportsOnchainReceiving: true,
        supportsKeysend: true,
        supportsLSPS1rest: true,
        supportsLSPS7native: true,
        supportsCashuWallet: true,
        supportsLightningAddress: true
    },
    lndhub: { supportsOnchainReceiving: true },
    'nostr-wallet-connect': {}
};
