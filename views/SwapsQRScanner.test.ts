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
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { decodePaymentRequest: jest.fn() }
}));
jest.mock('../models/Invoice', () =>
    jest.fn().mockImplementation((decoded: any) => ({
        getRequestAmount: decoded.num_satoshis
    }))
);

import SwapsQRScanner from './SwapsQRScanner';
import BackendUtils from '../utils/BackendUtils';
import { nodeInfoStore } from '../stores/Stores';

const MAINNET = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TESTNET = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
const REGTEST = 'bcrt1qqgdrlt97x4847rf85utak8gre5q7k83uwh3ajj';
const BOLT11 =
    'lnbc10u1p3pj257pp5yztkwjcz5ftl5laxkav23zmzekaw37zk6kmv80pk4xaev5qhtz7qdpdwd3xger9wd5kwm36yprx7u3qd36kucmgyp282etnv3shjcqzpgxqyz5vqsp5usyc4lk9chsfp53kvcnvq456ganh60d89reykdngsmtj6yw3nhvq9qyyssqjcewm5cjwz4a6rfjx77c490yced6pemk0upkxhy89cmm7sct66k8gneanwykzgdrwrfje69h9u5u0w57rrcsysas7gadwmzxc8c6t0spjazup6';

const scan = (nodeInfo: any, data: string) => {
    (nodeInfoStore as any).nodeInfo = nodeInfo;
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const scanner = new SwapsQRScanner({ navigation } as any);
    return {
        navigation,
        result: (scanner as any).processQRData(data) as Promise<void>
    };
};

describe('SwapsQRScanner', () => {
    describe('reverse swap address', () => {
        it('accepts a regtest address on a regtest node', async () => {
            const { navigation, result } = scan(
                { isRegTest: true },
                `bitcoin:${REGTEST}`
            );
            await result;
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
            const { navigation, result } = scan(
                { isTestNet: true },
                `bitcoin:${TESTNET}?amount=0.0005`
            );
            await result;
            const { params } = navigation.navigate.mock.calls[0][0];
            expect(params.initialInvoice).toBe(TESTNET);
            expect(params.initialAmountSats).toBe('50000');
        });

        it('accepts a signet address on a signet node', async () => {
            const { navigation, result } = scan({ isSigNet: true }, TESTNET);
            await result;
            expect(navigation.navigate.mock.calls[0][0].params).toMatchObject({
                initialInvoice: TESTNET,
                initialReverse: true
            });
        });

        it('accepts a mainnet address on a mainnet node', async () => {
            const { navigation, result } = scan({}, MAINNET);
            await result;
            expect(navigation.navigate.mock.calls[0][0].params).toMatchObject({
                initialInvoice: MAINNET,
                initialReverse: true
            });
        });

        it('rejects a mainnet address on a regtest node', async () => {
            const { navigation, result } = scan({ isRegTest: true }, MAINNET);
            await expect(result).rejects.toThrow(
                'components.QRCodeScanner.notRecognized'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('rejects a testnet address on a mainnet node', async () => {
            const { result } = scan({}, TESTNET);
            await expect(result).rejects.toThrow(
                'components.QRCodeScanner.notRecognized'
            );
        });
    });

    describe('submarine swap invoice', () => {
        it('navigates with the decoded invoice amount', async () => {
            (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
                num_satoshis: '1000'
            });
            const { navigation, result } = scan({}, `lightning:${BOLT11}`);
            await result;
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
            const { navigation, result } = scan({}, BOLT11);
            await expect(result).rejects.toThrow(
                'views.Invoice.couldNotDecode'
            );
            expect(navigation.navigate).not.toHaveBeenCalled();
        });
    });

    it('rejects input that is neither an address nor an invoice', async () => {
        const { result } = scan({}, 'not a swap destination');
        await expect(result).rejects.toThrow(
            'components.QRCodeScanner.notRecognized'
        );
    });
});
