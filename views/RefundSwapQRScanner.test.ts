jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Header: 'Header' }));
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/QRCodeScanner', () => 'QRCodeScanner');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} }
}));

import RefundSwapQRScanner from './RefundSwapQRScanner';
import { nodeInfoStore } from '../stores/Stores';

const MAINNET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const REGTEST = 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj';

const scan = (nodeInfo: any, data: string) => {
    (nodeInfoStore as any).nodeInfo = nodeInfo;
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const scanner = new RefundSwapQRScanner({ navigation } as any);
    return {
        navigation,
        result: (scanner as any).processQRData(data) as Promise<void>
    };
};

describe('RefundSwapQRScanner', () => {
    it.each([
        ['mainnet', {}, MAINNET],
        ['testnet', { isTestNet: true }, TESTNET],
        ['signet', { isSigNet: true }, TESTNET],
        ['regtest', { isRegTest: true }, REGTEST]
    ])(
        'accepts a refund address on a %s node',
        async (_network, nodeInfo, address) => {
            const { navigation, result } = scan(nodeInfo, `bitcoin:${address}`);
            await result;
            expect(navigation.goBack).toHaveBeenCalled();
            expect(navigation.navigate).toHaveBeenCalledWith({
                name: 'RefundSwap',
                params: { scannedAddress: address },
                merge: true
            });
        }
    );

    it.each([
        ['mainnet', {}, TESTNET],
        ['testnet', { isTestNet: true }, MAINNET],
        ['regtest', { isRegTest: true }, MAINNET]
    ])(
        'rejects an address for another network on a %s node',
        async (_network, nodeInfo, address) => {
            const { navigation, result } = scan(nodeInfo, address);
            await expect(result).rejects.toThrow(
                'components.QRCodeScanner.notRecognized'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );
});
