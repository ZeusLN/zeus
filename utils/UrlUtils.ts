import { Linking } from 'react-native';
import { modalStore, nodeInfoStore, settingsStore } from '../stores/Stores';
import { DEFAULT_MEMPOOL_INSTANCE } from '../stores/SettingsStore';

/**
 * Bare hosts are treated as https. Zeus has accepted scheme-less hosts
 * ('mempool.space', '192.168.1.1:8999') in custom server settings since
 * before those fields required a scheme, so every consumer of a stored host
 * must apply this same assumption. Keep it in one place.
 */
const withScheme = (host: string): string =>
    host && !host.includes('://')
        ? `https://${host.replace(/^\/+/, '')}`
        : host;

/**
 * Get the Esplora-compatible API base URL for the current network.
 * Used for transaction broadcasting and other API calls.
 */
const getMempoolApiUrl = (nodeInfo: {
    isMutinynet: boolean;
    isTestNet: boolean;
}): string => {
    const privacy = settingsStore?.settings?.privacy;
    // No stored selection resolves to DEFAULT_MEMPOOL_INSTANCE. This
    // intentionally covers installs that predate the setting: on upgrade they
    // move off the previously hardcoded mempool.space onto the ZEUS-operated
    // instance, without a migration writing anything to settings.
    const instance = privacy?.mempoolInstance || DEFAULT_MEMPOOL_INSTANCE;

    // Custom instance is used verbatim on every network. '/api' is appended
    // here, so drop it from the stored URL if the user pasted the full API
    // base (e.g. 'https://mempool.example.com/api') instead of the site root.
    if (instance === 'Custom' && privacy?.customMempoolInstance) {
        const host = withScheme(
            privacy.customMempoolInstance
                .trim()
                .replace(/\/+$/, '')
                .replace(/\/api$/i, '')
        );
        return `${host}/api`;
    }
    if (nodeInfo.isMutinynet) return 'https://mutinynet.com/api';
    // electrs.zeusln.com is mainnet-only; testnet3 lives at mempool.space/testnet
    if (nodeInfo.isTestNet) return 'https://mempool.space/testnet/api';
    return `https://${
        instance === 'mempool.space'
            ? 'mempool.space'
            : DEFAULT_MEMPOOL_INSTANCE
    }/api`;
};

/**
 * Hostname of the effective mempool instance, for display purposes.
 */
const getMempoolInstanceHost = (nodeInfo: {
    isMutinynet: boolean;
    isTestNet: boolean;
}): string => {
    try {
        return new URL(getMempoolApiUrl(nodeInfo)).host;
    } catch {
        return DEFAULT_MEMPOOL_INSTANCE;
    }
};

const goToBlockExplorer = (
    type: string,
    value: string | number,
    testnet?: boolean
) => {
    const { settings } = settingsStore;
    const { privacy } = settings;
    const custom = privacy && privacy.defaultBlockExplorer === 'Custom';
    const { isMutinynet } = nodeInfoStore.nodeInfo;
    const host =
        custom && privacy.customBlockExplorer
            ? privacy.customBlockExplorer
            : isMutinynet
            ? 'mutinynet.com'
            : (privacy && privacy.defaultBlockExplorer) || 'mempool.space';
    const network =
        !isMutinynet && (nodeInfoStore.nodeInfo.isTestNet || testnet)
            ? 'testnet/'
            : '';

    // Read the convention hint off the raw host, before it is stripped below.
    // Currently '...#mempool.space' is the only meaningful hint: it tells us
    // the explorer uses mempool.space's path scheme.
    let path: string = type;
    if (type === 'block-height') {
        path = host.endsWith('mempool.space') ? 'block' : 'block-height';
    }

    // Host may be <scheme>://<ip|host_name>:<port>[#convention_hint]
    const base = withScheme(host).split('#')[0];

    goToUrl(`${base}/${network}${path}/${value}`);
};

const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const trimmedUrl = url.trim();

    // Must start with http:// or https://
    if (
        !trimmedUrl.startsWith('http://') &&
        !trimmedUrl.startsWith('https://')
    ) {
        return false;
    }

    try {
        const parsed = new URL(trimmedUrl);
        // Must have a valid hostname
        if (!parsed.hostname || parsed.hostname.length === 0) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
};

// Returns true when an explicit http:// scheme would carry traffic across
// the network in cleartext. Onion services are authenticated and encrypted
// at the Tor layer and loopback never leaves the device, so neither counts.
// Parses with URL so hosts hidden behind userinfo (http://127.0.0.1@evil.com),
// fragments (http://evil.com#foo.onion), or spoofed prefixes
// (http://127.0.0.1.evil.com) are not mistaken for exempt hosts.
const isCleartextHttpTransport = (urlString?: string): boolean => {
    if (!urlString) return false;
    const trimmed = urlString.trim();
    if (!trimmed.toLowerCase().startsWith('http://')) return false;

    let hostname: string;
    try {
        hostname = new URL(trimmed).hostname;
    } catch {
        // Unparseable http:// input: fail closed and warn.
        return true;
    }

    if (hostname.endsWith('.onion')) return false;

    // Loopback: localhost, ::1 (URL serializes IPv6 hosts in brackets), or
    // an IPv4 address in 127.0.0.0/8. The URL parser canonicalizes IPv4
    // shorthand (127.1, 0x7f.1) to dotted-quad form before this check.
    if (hostname === 'localhost' || hostname === '[::1]') return false;
    const octets = hostname.split('.');
    if (
        octets.length === 4 &&
        octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255) &&
        octets[0] === '127'
    ) {
        return false;
    }

    return true;
};

const goToBlockExplorerTXID = (txid: string, testnet?: boolean) =>
    goToBlockExplorer('tx', txid, testnet);
const goToBlockExplorerAddress = (address: string, testnet?: boolean) =>
    goToBlockExplorer('address', address, testnet);
const goToBlockExplorerBlockHeight = (
    height: string | number,
    testnet?: boolean
) => goToBlockExplorer('block-height', height, testnet);
const goToBlockExplorerBlockHash = (hash: string, testnet?: boolean) =>
    goToBlockExplorer('block', hash, testnet);
const goToBlockExplorerChannelId = (channelId: string, testnet?: boolean) =>
    goToBlockExplorer('lightning/channel', channelId, testnet);
const goToBlockExplorerPubkey = (pubKey: string, testnet?: boolean) =>
    goToBlockExplorer('lightning/node', pubKey, testnet);

const goToUrl = (url: string) => {
    modalStore.setUrl(url);
    modalStore.setClipboardValue(url);
    modalStore.setIsEmail(false);
    modalStore.toggleExternalLinkModal(true);
    modalStore.setAction(() => leaveZeus(url));
};

const goToEmailAddress = (email: string) => {
    modalStore.setUrl(email);
    modalStore.setClipboardValue(email);
    modalStore.setIsEmail(true);
    modalStore.toggleExternalLinkModal(true);
    modalStore.setAction(() => leaveZeus(`mailto:${email}`));
};

const leaveZeus = (url: string) => {
    Linking.canOpenURL(url).then((supported: boolean) => {
        if (supported) {
            Linking.openURL(url);
        } else {
            console.log("Don't know how to open URI: " + url);
        }
    });
};

export default {
    isValidUrl,
    withScheme,
    isCleartextHttpTransport,
    getMempoolApiUrl,
    getMempoolInstanceHost,
    goToBlockExplorerTXID,
    goToBlockExplorerAddress,
    goToBlockExplorerBlockHeight,
    goToBlockExplorerBlockHash,
    goToBlockExplorerChannelId,
    goToBlockExplorerPubkey,
    goToUrl,
    goToEmailAddress
};
