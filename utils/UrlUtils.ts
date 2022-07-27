import { Linking } from 'react-native';
import stores from '../stores/Stores';

const goToBlockExplorer = (
    type: string,
    value: string | number,
    testnet: boolean
) => {
    const { settings } = stores.settingsStore;
    const { privacy } = settings;
    const host =
        privacy && privacy.defaultBlockExplorer === 'Custom'
            ? privacy.customBlockExplorer
            : (privacy && privacy.defaultBlockExplorer) || 'mempool.space';

    let path: string = type;
    if (type === 'block-height') {
        // this logic fails, when running own mempool.space instance!
        path = host === 'mempool.space' ? 'block' : 'block-height';
    }

    let url: string = `https://${host}/${testnet ? 'testnet/' : ''}${path}/${value}`;
    if (host.indexOf('://') !== -1)
    {
        url = `${host}/${testnet ? 'testnet/' : ''}${path}/${value}`;
    }
    goToUrl(url);
};

const goToBlockExplorerTXID = (txid: string, testnet: boolean) =>
    goToBlockExplorer('tx', txid, testnet);
const goToBlockExplorerAddress = (address: string, testnet: boolean) =>
    goToBlockExplorer('address', address, testnet);
const goToBlockExplorerBlockHeight = (
    height: string | number,
    testnet: boolean
) => goToBlockExplorer('block-height', height, testnet);
const goToBlockExplorerBlockHash = (hash: string, testnet: boolean) =>
    goToBlockExplorer('block', hash, testnet);

const goToUrl = (url: string) => {
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
    goToUrl
};
