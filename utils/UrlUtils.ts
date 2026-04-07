import { Linking } from 'react-native';
import { modalStore, nodeInfoStore, settingsStore } from '../stores/Stores';

/**
 * Get the Esplora-compatible API base URL for the current network.
 * Used for transaction broadcasting and other API calls.
 */
const getMempoolApiUrl = (nodeInfo: {
    isMutinynet: boolean;
    isTestNet: boolean;
}): string => {
    if (nodeInfo.isMutinynet) return 'https://mutinynet.com/api';
    const prefix = nodeInfo.isTestNet ? 'testnet/' : '';
    return `https://mempool.space/${prefix}api`;
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

    let path: string = type;
    if (type === 'block-height') {
        path = host.endsWith('mempool.space') ? 'block' : 'block-height';
    }

    let url = `https://${host}/${network}${path}/${value}`;

    // Handle url <scheme>://<ip|host_name>:<port>[#convention_hint] in host
    // Currently '...#mempool.space' is the only meaningful convention hint
    if (custom && host.indexOf('://') !== -1) {
        const hostUrl = host.split('#')[0]; // Strip optional url convention hints
        url = `${hostUrl}/${network}${path}/${value}`;
    }
    goToUrl(url);
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
    getMempoolApiUrl,
    goToBlockExplorerTXID,
    goToBlockExplorerAddress,
    goToBlockExplorerBlockHeight,
    goToBlockExplorerBlockHash,
    goToBlockExplorerChannelId,
    goToBlockExplorerPubkey,
    goToUrl,
    goToEmailAddress
};
