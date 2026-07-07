import { CUSTODIAL_LNDHUBS } from './AddressUtils';

// Pure, dependency-light redaction logic for the diagnostics export. Kept in
// its own module (no store / native imports) so it can be unit-tested in
// isolation. See utils/DiagnosticsUtils.ts for the collectors that use it.

export const REDACTED = '[REDACTED]';
export const REDACTED_HOST = '[REDACTED_HOST]';

// Secret fields that must never leave the device. Matched case-insensitively
// against every key at any depth of the settings blob. Includes the three
// node fields (username, password, lndhubUrl) that are persisted but NOT
// declared on the `Node` interface in stores/SettingsStore.ts — do not rely on
// that interface alone. Note: lndhubUrl is intentionally NOT in this list; it
// is handled by the host policy (kept for known custodial hosts).
export const SENSITIVE_KEYS: string[] = [
    'macaroonHex',
    'adminMacaroon',
    'rune',
    'accessKey',
    'password',
    'username',
    'pairingPhrase',
    'nostrWalletConnectUrl',
    'seedPhrase',
    'walletPassword',
    'ldkMnemonic',
    'ldkPassphrase',
    // top-level secrets
    'passphrase',
    'duressPassphrase',
    'pin',
    'duressPin',
    'lspAccessKey',
    'lsps1Token',
    'squareAccessToken'
].map((k) => k.toLowerCase());

// Connection endpoint fields. Redacted for remote nodes; dropped for local
// (embedded) nodes. lndhubUrl is special-cased (kept only for known custodial
// LNDHub hosts).
const HOST_KEYS: string[] = [
    'host',
    'port',
    'url',
    'lndhubUrl',
    'mailboxServer',
    'customMailboxServer',
    'ldkEsploraServer',
    'ldkRgsServer',
    'ldkScorerUrl',
    'ldkVssServer'
].map((k) => k.toLowerCase());

const isSensitiveKey = (key: string): boolean =>
    SENSITIVE_KEYS.includes(key.toLowerCase());

// Recursively replace any sensitive value with a redaction marker.
const redactSecrets = (obj: any): void => {
    if (Array.isArray(obj)) {
        obj.forEach(redactSecrets);
        return;
    }
    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            if (isSensitiveKey(key)) {
                obj[key] = REDACTED;
            } else {
                redactSecrets(obj[key]);
            }
        }
    }
};

// Apply the connection-host policy to a single node object (mutates in place):
//  - embedded-lnd / ldk-node: local node, drop host/port/url entirely.
//  - lndhub: keep lndhubUrl only if it is a commonly-used custodial host.
//  - everything else (remote lnd / cln-rest / LNC / NWC): mask endpoints.
const redactNodeHosts = (node: any): void => {
    if (!node || typeof node !== 'object') return;

    const implementation = node.implementation;
    const isLocal =
        implementation === 'embedded-lnd' || implementation === 'ldk-node';

    Object.keys(node).forEach((key) => {
        const lower = key.toLowerCase();
        if (!HOST_KEYS.includes(lower)) return;

        // LNDHub host: keep only known custodial hosts.
        if (lower === 'lndhuburl') {
            if (!node[key] || !CUSTODIAL_LNDHUBS.includes(node[key])) {
                node[key] = REDACTED_HOST;
            }
            return;
        }

        // Local nodes have no meaningful remote endpoint — drop it.
        if (isLocal && ['host', 'port', 'url'].includes(lower)) {
            delete node[key];
            return;
        }

        if (node[key]) node[key] = REDACTED_HOST;
    });
};

/**
 * Produce a privacy-safe copy of the settings blob: secrets removed and
 * connection hosts masked/dropped per the host policy. Pure — takes a settings
 * object and returns a new redacted object without touching the original.
 */
export const redactSettings = (settings: any): any => {
    const clone = JSON.parse(JSON.stringify(settings ?? {}));

    redactSecrets(clone);

    if (Array.isArray(clone.nodes)) {
        clone.nodes.forEach(redactNodeHosts);
    }

    return clone;
};
