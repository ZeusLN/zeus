import { version as appVersion } from '../package.json';
import { Implementations } from '../stores/SettingsStore';

// Only backends that support LSP (Flow, LSPS1, or LSPS7)
const NODE_NAMES: Partial<Record<Implementations, string>> = {
    'ldk-node': 'LDK',
    'embedded-lnd': 'LND',
    lnd: 'LND',
    'lightning-node-connect': 'LND',
    'cln-rest': 'Core Lightning'
};

export interface ClientInfo {
    app: string;
    app_version: string;
    node?: string;
    node_version?: string;
}

/** Strips a leading 'v' or 'V' from a version string. */
export function stripVersionPrefix(version: string): string {
    return version.replace(/^[vV]/, '');
}

/**
 * Builds a client_info object for LSPS1, LSPS7, and Flow requests.
 */
export function getClientInfo(
    implementation?: Implementations,
    nodeVersion?: string
): ClientInfo {
    const info: ClientInfo = {
        app: 'ZEUS',
        app_version: stripVersionPrefix(appVersion)
    };

    if (implementation) {
        info.node = NODE_NAMES[implementation] || implementation;
        if (nodeVersion) {
            info.node_version = stripVersionPrefix(nodeVersion);
        }
    }

    return info;
}
