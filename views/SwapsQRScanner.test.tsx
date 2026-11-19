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
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { decodePaymentRequest: jest.fn() }
}));
jest.mock('../models/Invoice', () =>
    jest.fn().mockImplementation((decoded: any) => ({
        getRequestAmount: decoded.num_satoshis
    }))
);

import * as React from 'react';
import { Alert } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import SwapsQRScanner from './SwapsQRScanner';
import BackendUtils from '../utils/BackendUtils';
import { nodeInfoStore } from '../stores/Stores';

const MAINNET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const REGTEST = 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj';
const BOLT11 =
    'lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9chsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzxc8c6t0spjazup6';

// Mounts the scanner and hands `data` to the camera's scan callback, as
// QRCodeScanner does. A rejected scan shows an alert and goes back.
const scan = async (nodeInfo: any, data: string) => {
    (nodeInfoStore as any).nodeInfo = nodeInfo;
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    await render(<SwapsQRScanner navigation={navigation as any} />);
    const [camera] = screen.container.queryAll(
        (n) => n.type === 'QRCodeScanner'
    );
    await act(async () => camera.props.handleQRScanned(data));
    return navigation;
};

const alertMessage = () => (Alert.alert as jest.Mock).mock.calls[0]?.[1];

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('SwapsQRScanner', () => {
    describe('reverse swap address', () => {
        it('accepts a regtest address on a regtest node', async () => {
            const navigation = await scan(
                { isRegTest: true },
                `bitcoin:${REGTEST}`
            );
            expect(navigation.goBack).toHaveBeenCalled();
            expect(navigation.navigate).toHaveBeenCalledWith({
                name: 'Swaps',
                params: {
                    initialInvoice: REGTEST,
                    initialAmountSats: undefined,
                    initialReverse: true
                },
                merge: true
            });
        });

        it('passes the BIP21 amount through', async () => {
            const navigation = await scan(
                { isTestNet: true },
                `bitcoin:${TESTNET}?amount=0.0005`
            );
            const { params } = navigation.navigate.mock.calls[0][0];
            expect(params.initialInvoice).toBe(TESTNET);
            expect(params.initialAmountSats).toBe('50000');
        });

        it('accepts a signet address on a signet node', async () => {
            const navigation = await scan({ isSigNet: true }, TESTNET);
            expect(navigation.navigate.mock.calls[0][0].params).toMatchObject({
                initialInvoice: TESTNET,
                initialReverse: true
            });
        });

        it('accepts a mainnet address on a mainnet node', async () => {
            const navigation = await scan({}, MAINNET);
            expect(navigation.navigate.mock.calls[0][0].params).toMatchObject({
                initialInvoice: MAINNET,
                initialReverse: true
            });
        });

        it('rejects a mainnet address on a regtest node', async () => {
            const navigation = await scan({ isRegTest: true }, MAINNET);
            expect(alertMessage()).toBe(
                'components.QRCodeScanner.notRecognized'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(navigation.goBack).toHaveBeenCalledTimes(1);
        });

        it('rejects a testnet address on a mainnet node', async () => {
            await scan({}, TESTNET);
            expect(alertMessage()).toBe(
                'components.QRCodeScanner.notRecognized'
            );
        });
    });

    describe('submarine swap invoice', () => {
        it('navigates with the decoded invoice amount', async () => {
            (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
                num_satoshis: '1000'
            });
            const navigation = await scan({}, `lightning:${BOLT11}`);
            expect(BackendUtils.decodePaymentRequest).toHaveBeenCalledWith([
                BOLT11
            ]);
            expect(navigation.navigate).toHaveBeenCalledWith({
                name: 'Swaps',
                params: {
                    initialInvoice: BOLT11,
                    initialAmountSats: '1000',
                    initialReverse: false
                },
                merge: true
            });
        });

        it('fails when the invoice cannot be decoded', async () => {
            (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
                false
            );
            const navigation = await scan({}, BOLT11);
            expect(alertMessage()).toBe('views.Invoice.couldNotDecode');
            expect(navigation.navigate).not.toHaveBeenCalled();
        });
    });

    it('rejects input that is neither an address nor an invoice', async () => {
        await scan({}, 'not a swap destination');
        expect(alertMessage()).toBe('components.QRCodeScanner.notRecognized');
    });

    it('shows a loading screen and ignores a second scan while the first is processed', async () => {
        (nodeInfoStore as any).nodeInfo = {};
        let decoded!: (value: any) => void;
        (BackendUtils.decodePaymentRequest as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
                decoded = resolve;
            })
        );
        const navigation = { goBack: jest.fn(), navigate: jest.fn() };
        await render(<SwapsQRScanner navigation={navigation as any} />);
        const [camera] = screen.container.queryAll(
            (n) => n.type === 'QRCodeScanner'
        );
        const { handleQRScanned } = camera.props;

        let first!: Promise<void>;
        await act(async () => {
            first = handleQRScanned(BOLT11);
        });
        // the camera is replaced by the loading header
        expect(
            screen.container.queryAll((n) => n.type === 'LoadingIndicator')
        ).toHaveLength(1);
        expect(
            screen.container.queryAll((n) => n.type === 'QRCodeScanner')
        ).toHaveLength(0);
        await act(async () => handleQRScanned(BOLT11));

        await act(async () => {
            decoded({ num_satoshis: '1000' });
            await first;
        });
        expect(BackendUtils.decodePaymentRequest).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });
});
