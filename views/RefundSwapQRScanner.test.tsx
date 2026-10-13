jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Header: 'Header' }));
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/QRCodeScanner', () => 'QRCodeScanner');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../utils/LocaleUtils');
jest.mock('../stores/Stores');

import * as React from 'react';
import { Alert } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import RefundSwapQRScanner from './RefundSwapQRScanner';
import { nodeInfoStore } from '../stores/Stores';

const MAINNET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const REGTEST = 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj';

// Mounts the scanner and hands `data` to the camera's scan callback, as
// QRCodeScanner does. A rejected scan shows an alert and goes back.
const scan = async (nodeInfo: any, data: string) => {
    (nodeInfoStore as any).nodeInfo = nodeInfo;
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    await render(<RefundSwapQRScanner navigation={navigation as any} />);
    const [camera] = screen.container.queryAll(
        (n) => n.type === 'QRCodeScanner'
    );
    await act(async () => camera.props.handleQRScanned(data));
    return navigation;
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('RefundSwapQRScanner', () => {
    it.each([
        ['mainnet', {}, MAINNET],
        ['testnet', { isTestNet: true }, TESTNET],
        ['signet', { isSigNet: true }, TESTNET],
        ['regtest', { isRegTest: true }, REGTEST]
    ])(
        'accepts a refund address on a %s node',
        async (_network, nodeInfo, address) => {
            const navigation = await scan(nodeInfo, `bitcoin:${address}`);
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
            const navigation = await scan(nodeInfo, address);
            expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
                'components.QRCodeScanner.notRecognized'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(navigation.goBack).toHaveBeenCalledTimes(1);
        }
    );
});
