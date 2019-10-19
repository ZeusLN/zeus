import { Linking } from 'react-native';

const goToBlockExplorer = (
    type: string,
    value: string | number,
    testnet: boolean
) => {
    const url = `https://blockstream.info/${
        testnet ? 'testnet/' : ''
    }${type}/${value}`;
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
