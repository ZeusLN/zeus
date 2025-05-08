import { Linking } from 'react-native';
import { modalStore, nodeInfoStore, settingsStore } from '../stores/Stores';

const goToBlockExplorer = (
    type: string,
    value: string | number,
    testnet?: boolean
) => {
    const { settings } = settingsStore;
    const { privacy } = settings;
    const custom = privacy && privacy.defaultBlockExplorer === 'Custom';
    const host =
        custom && privacy.customBlockExplorer
            ? privacy.customBlockExplorer
            : (privacy && privacy.defaultBlockExplorer) || 'mempool.space';
    const network =
        nodeInfoStore.nodeInfo.isTestNet || testnet ? 'testnet/' : '';

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
    modalStore.toggleExternalLinkModal(true);
    modalStore.setAction(() => leaveZeus(url));
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
    goToBlockExplorerTXID,
    goToBlockExplorerAddress,
    goToBlockExplorerBlockHeight,
    goToBlockExplorerBlockHash,
    goToBlockExplorerChannelId,
    goToBlockExplorerPubkey,
    goToUrl
};
