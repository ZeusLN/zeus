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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Swaps from './index';
import { reverseClaimMinerFee } from '../../utils/FeeUtils';

// A reverse swap with a 0.5% service fee, a 400 sat lockup fee and a 300
// sat claim quote. At 1 sat/vB the quote is kept, at 25 sat/vB the claim
// fee is raised to 25 x 152 = 3800 sats.
const renderView = async (mempoolFees: Promise<any>, claimQuote = 300) => {
    const swapStore: any = {
        loading: false,
        apiError: '',
        subInfo: {
            fees: { percentage: 0.1, minerFees: 200 },
            limits: { minimal: 1000, maximal: 1000000 }
        },
        reverseInfo: {
            fees: {
                percentage: 0.5,
                minerFees: { claim: claimQuote, lockup: 400 }
            },
            limits: { minimal: 1000, maximal: 1000000 }
        },
        clearError: jest.fn(),
        getSwapFees: jest.fn(),
        getServiceProvider: 'Test host',
        createReverseSwap: jest.fn(),
        createSubmarineSwap: jest.fn()
    };
    swapStore.getReverseClaimMinerFee = (rate: unknown) =>
        reverseClaimMinerFee(swapStore.reverseInfo.fees.minerFees.claim, rate);

    await render(
        <Swaps
            {...({
                navigation: { addListener: jest.fn(() => jest.fn()) },
                route: { params: { initialReverse: true } },
                SwapStore: swapStore,
                UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
                InvoicesStore: {},
                FiatStore: { fiatRates: [] },
                SettingsStore: {
                    settings: {},
                    getSettings: jest.fn().mockResolvedValue({})
                },
                FeeStore: {
                    getOnchainFeesviaMempool: jest.fn(() => mempoolFees)
                },
                NodeInfoStore: {
                    testnet: false,
                    flowLspNotConfigured: () => ({
                        flowLspNotConfigured: true
                    })
                },
                LSPStore: { resetFee: jest.fn() }
            } as any)}
        />
    );
    return swapStore;
};

const byType = (type: string): any[] =>
    screen.container.queryAll((n: any) => n.type === type);

const amountInputs = () => byType('AmountInput');
const sendInput = () => amountInputs()[0];
const receiveInput = () => amountInputs()[1];
const initiate = () =>
    byType('Button').find(
        (b: any) => b.props.title === 'views.Swaps.initiate'
    )!;

const setFeeRate = async (rate: string) => {
    const toggle = byType('KeyValue').find(
        (k: any) => k.props.keyValue === 'views.Swaps.setClaimFeeRate'
    )!;
    if (byType('OnchainFeeInput').length === 0) {
        await act(async () => fireEvent.press(toggle));
    }
    await act(async () => byType('OnchainFeeInput')[0].props.onChangeFee(rate));
};

const enter = async (field: any, sats: string) => {
    await act(async () => field.props.onAmountChange(sats, sats));
};

const enterAddress = async () => {
    await act(async () =>
        byType('AddressInput')[0].props.onChangeText('bc1qdestination')
    );
};

const mempool = (fastestFee: number) =>
    Promise.resolve({
        fastestFee,
        halfHourFee: fastestFee,
        hourFee: fastestFee,
        economyFee: fastestFee,
        minimumFee: fastestFee
    });

describe('Swaps reverse amounts and the claim fee rate', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('recalculates the receive amount when the rate changes after the send amount', async () => {
        const store = await renderView(mempool(1));
        await enterAddress();
        await enter(sendInput(), '100000');
        // 100000 - 500 - 400 - 300
        expect(receiveInput().props.amount).toBe('98800');

        await setFeeRate('25');

        // 100000 - 500 - 400 - 3800
        expect(sendInput().props.amount).toBe('100000');
        expect(receiveInput().props.amount).toBe('95300');

        await act(async () => initiate().props.onPress());
        expect(store.createReverseSwap).toHaveBeenCalledWith(
            'bc1qdestination',
            100000,
            '25',
            expect.anything()
        );
    });

    it('keeps the receive amount the user entered and raises the send amount', async () => {
        await renderView(mempool(1));
        await enter(receiveInput(), '98800');
        expect(sendInput().props.amount).toBe('100000');

        await setFeeRate('25');

        // (98800 + 400 + 3800) / 0.995, rounded up
        expect(receiveInput().props.amount).toBe('98800');
        expect(sendInput().props.amount).toBe('103518');
    });

    it('recalculates when the mempool rate arrives after the amount', async () => {
        let resolveFees: (fees: any) => void = () => {};
        await renderView(new Promise((resolve) => (resolveFees = resolve)));
        await enterAddress();
        // no rate yet: the host's quote is shown
        await enter(sendInput(), '100000');
        expect(receiveInput().props.amount).toBe('98800');

        await act(async () =>
            resolveFees({
                fastestFee: 25,
                halfHourFee: 25,
                hourFee: 25,
                economyFee: 25,
                minimumFee: 25
            })
        );

        expect(receiveInput().props.amount).toBe('95300');
        expect(initiate().props.disabled).toBe(false);
    });

    it('disables Initiate when the claim fee leaves nothing to receive', async () => {
        await renderView(mempool(1));
        await enterAddress();
        await enter(sendInput(), '5000');
        // 5000 - 25 - 400 - 300
        expect(receiveInput().props.amount).toBe('4275');
        expect(initiate().props.disabled).toBe(false);

        // 50 x 152 = 7600 sats
        await setFeeRate('50');

        expect(receiveInput().props.amount).toBe('');
        expect(initiate().props.disabled).toBe(true);
    });
});

describe('Swaps reverse claim fee errors', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    const errorsShown = () =>
        byType('ErrorMessage').map((e: any) => e.props.message);

    it('does not ask for a rate while the mempool rate is on its way', async () => {
        await renderView(new Promise(() => {}));

        expect(errorsShown()).not.toContain(
            'views.Swaps.reverseClaimFeeRateRequired'
        );
    });

    it('asks for a rate once the mempool lookup fails', async () => {
        const offline = Promise.reject(new Error('offline'));
        // handled by the screen once it asks; not an unhandled rejection
        offline.catch(() => {});
        await renderView(offline);

        expect(errorsShown()).toContain(
            'views.Swaps.reverseClaimFeeRateRequired'
        );
    });

    it('asks for a rate when the user enters an unusable one', async () => {
        await renderView(new Promise(() => {}));

        await setFeeRate('0');

        expect(errorsShown()).toContain(
            'views.Swaps.reverseClaimFeeRateRequired'
        );
    });

    it('says why Initiate is disabled when the claim quote is above the maximum', async () => {
        // more than 2000 sat/vB on the largest claim
        await renderView(mempool(5), 2000 * 152 + 1);
        await enterAddress();
        await enter(sendInput(), '1000000');

        expect(initiate().props.disabled).toBe(true);
        expect(errorsShown()).toEqual([
            'views.Swaps.invalidReverseSwapResponse'
        ]);
    });

    it('shows no error for a usable rate and quote', async () => {
        await renderView(mempool(5));

        expect(errorsShown()).toEqual([]);
    });
});
