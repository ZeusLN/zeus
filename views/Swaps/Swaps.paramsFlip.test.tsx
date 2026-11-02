jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    unitsStore: { resetUnits: jest.fn() }
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn().mockResolvedValue('rescue words') }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsFlowLSP: () => false,
    supportsOnchainSends: () => true
}));
jest.mock('../../utils/AddressUtils', () => ({
    isValidBitcoinAddressForNode: () => true,
    isValidLightningPaymentRequest: () => true
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/AddressInput', () => 'AddressInput');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/ModalBox', () => 'ModalBox');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../assets/images/SVG/Arrow_down.svg', () => 'ArrowDown');
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock(
    '../../assets/images/SVG/ExchangeBitcoin.svg',
    () => 'ExchangeBitcoin'
);
jest.mock('../../assets/images/SVG/ExchangeFiat.svg', () => 'ExchangeFiat');
jest.mock('../../assets/images/SVG/History.svg', () => 'History');
jest.mock('../../assets/images/SVG/Key.svg', () => 'KeyIcon');

import * as React from 'react';
import BigNumber from 'bignumber.js';
import { act, render, screen } from '@testing-library/react-native';
import Swaps from './index';
import { reverseClaimMinerFee } from '../../utils/FeeUtils';

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

// Submarine swaps are quoted at 0%, reverse swaps at 5% with a 300 sat
// claim and a 400 sat lockup fee, so amounts worked out with one quote
// are far off for the other direction.
const swapStore = () => {
    const store: any = {
        loading: false,
        apiError: '',
        subInfo: {
            fees: { percentage: 0, minerFees: 0 },
            limits: { minimal: 25000, maximal: 25000000 }
        },
        reverseInfo: {
            fees: {
                percentage: 5,
                minerFees: { claim: 300, lockup: 400 }
            },
            limits: { minimal: 25000, maximal: 25000000 }
        },
        clearError: jest.fn(),
        getSwapFees: jest.fn(),
        getServiceProvider: 'Test host',
        createReverseSwap: jest.fn(),
        createSubmarineSwap: jest.fn()
    };
    store.getReverseClaimMinerFee = (rate: unknown) =>
        reverseClaimMinerFee(store.reverseInfo.fees.minerFees.claim, rate);
    return store;
};

const props = (store: any, params: any) =>
    ({
        navigation: { addListener: jest.fn(() => jest.fn()) },
        route: { params },
        SwapStore: store,
        UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
        InvoicesStore: {},
        FiatStore: { fiatRates: [] },
        SettingsStore: {
            settings: {},
            getSettings: jest.fn().mockResolvedValue({})
        },
        FeeStore: {
            // the mempool rate fetched when the screen turns to reverse
            getOnchainFeesviaMempool: jest
                .fn()
                .mockResolvedValue({ fastestFee: 5 })
        },
        NodeInfoStore: {
            testnet: false,
            flowLspNotConfigured: () => ({ flowLspNotConfigured: true })
        },
        LSPStore: { resetFee: jest.fn() }
    } as any);

const byType = (type: string): any[] =>
    screen.container.queryAll((n: any) => n.type === type);

const sendInput = () => byType('AmountInput')[0];
const receiveInput = () => byType('AmountInput')[1];
// the Amount rows: network fee, service fee, then the limits
const serviceFeeShown = () =>
    new BigNumber(byType('Amount')[1].props.sats).toNumber();
const initiate = () =>
    byType('Button').find(
        (b: any) => b.props.title === 'views.Swaps.initiate'
    )!;

// Opens Swaps in its default on-chain to Lightning direction, types a
// 10,000,000 sat send amount, then delivers `params` as a scan does.
const enterAmountThenScan = async (params: any) => {
    const store = swapStore();
    const view = await render(<Swaps {...props(store, {})} />);
    await act(async () =>
        sendInput().props.onAmountChange('10000000', '10000000')
    );
    await view.rerender(<Swaps {...props(store, params)} />);
    // the params are applied on the update after the rerender
    await act(async () => {});
    return store;
};

describe('Swaps route params that change the direction', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('shows the submarine amounts before the scan', async () => {
        const store = swapStore();
        await render(<Swaps {...props(store, {})} />);
        await act(async () =>
            sendInput().props.onAmountChange('10000000', '10000000')
        );

        expect(receiveInput().props.amount).toBe('10000000');
        expect(serviceFeeShown()).toBe(0);
    });

    it('works out the receive amount and fee of a scanned address with the reverse quote', async () => {
        const store = await enterAmountThenScan({
            initialInvoice: ADDRESS,
            initialReverse: true
        });

        // 10,000,000 - 5% - 760 - 400: the 300 sat claim quote is below
        // the 5 sat/vB x 152 vB floor
        expect(sendInput().props.amount).toBe('10000000');
        expect(receiveInput().props.amount).toBe('9498840');
        expect(serviceFeeShown()).toBe(500000);

        await act(async () => initiate().props.onPress());
        expect(store.createReverseSwap).toHaveBeenCalledWith(
            ADDRESS,
            10000000,
            expect.anything(),
            expect.anything()
        );
    });

    it('does the same when the params carry only the direction', async () => {
        await enterAmountThenScan({ initialReverse: true });

        expect(receiveInput().props.amount).toBe('9498840');
        expect(serviceFeeShown()).toBe(500000);
    });

    it('keeps the amounts when the params keep the direction', async () => {
        await enterAmountThenScan({
            initialInvoice: 'lnbc1invoice',
            initialReverse: false
        });

        expect(sendInput().props.amount).toBe('10000000');
        expect(receiveInput().props.amount).toBe('10000000');
        expect(serviceFeeShown()).toBe(0);
    });

    it('works out the send amount of a QR code with an amount with the reverse formula', async () => {
        const store = swapStore();
        const view = await render(<Swaps {...props(store, {})} />);
        await view.rerender(
            <Swaps
                {...props(store, {
                    initialInvoice: ADDRESS,
                    initialAmountSats: 10000000,
                    initialReverse: true
                })}
            />
        );
        await act(async () => {});

        // (10,000,000 + 760 + 400) / 0.95, rounded up: the swap pays out the
        // amount the QR code asks for
        const send = Number(sendInput().props.amount);
        expect(receiveInput().props.amount).toBe('10000000');
        expect(send - Math.ceil(send * 0.05) - 1160).toBeGreaterThanOrEqual(
            10000000
        );
        expect(send).toBe(10527537);
    });
});
