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
import { act, render, screen } from '@testing-library/react-native';
import Swaps from './index';
import { reverseClaimMinerFee } from '../../utils/FeeUtils';

const SCANNED = 'bc1qscannedfromqrcode';
const TYPED = 'bc1qtypedbytheuser';

// what SwapsQRScanner puts in the route params after a bitcoin: scan
const scanOf = (address: string) => ({
    initialInvoice: address,
    initialReverse: true
});

// Opens the Swaps form with a scan applied. The blur listener is kept so
// the tests can blur the screen as the navigator does.
const renderAfterScan = async () => {
    const listeners: { [event: string]: () => void } = {};
    const props: any = {
        navigation: {
            addListener: jest.fn((event: string, listener: () => void) => {
                listeners[event] = listener;
                return jest.fn();
            }),
            navigate: jest.fn()
        },
        SwapStore: {
            loading: false,
            apiError: '',
            subInfo: {
                fees: { percentage: 0.1, minerFees: 200 },
                limits: { minimal: 1000, maximal: 1000000 }
            },
            reverseInfo: {
                fees: {
                    percentage: 0.5,
                    minerFees: { claim: 300, lockup: 400 }
                },
                limits: { minimal: 1000, maximal: 1000000 }
            },
            claimMinerFee: 300,
            // decides the claim fee from the reverseInfo claim quote above
            getReverseClaimMinerFee: (rate: unknown) =>
                reverseClaimMinerFee(300, rate),
            clearError: jest.fn(),
            getSwapFees: jest.fn(),
            getServiceProvider: 'Test host'
        },
        UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
        InvoicesStore: {},
        FiatStore: { fiatRates: [] },
        SettingsStore: {
            settings: {},
            getSettings: jest.fn().mockResolvedValue({})
        },
        FeeStore: {
            getOnchainFeesviaMempool: jest
                .fn()
                .mockResolvedValue({ fastestFee: 1 })
        },
        NodeInfoStore: {
            testnet: false,
            flowLspNotConfigured: () => ({ flowLspNotConfigured: true })
        },
        LSPStore: { resetFee: jest.fn() }
    };
    const element = (params: any) => <Swaps {...props} route={{ params }} />;
    await render(element(scanOf(SCANNED)));

    const byType = (type: string): any[] =>
        screen.container.queryAll((n: any) => n.type === type);

    return {
        address: () => byType('AddressInput')[0].props.value,
        typeAddress: (text: string) =>
            act(async () => byType('AddressInput')[0].props.onChangeText(text)),
        // AmountInput tells the form, then the keypad screen blurs it
        openKeypad: (box: number) =>
            act(async () => {
                byType('AmountInput')[box].props.onNavigateAway?.();
                listeners.blur();
            }),
        leave: () => act(async () => listeners.blur()),
        scan: (address: string) =>
            act(async () => screen.rerender(element(scanOf(address))))
    };
};

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Swaps address after a QR scan', () => {
    it.each([
        ['send', 0],
        ['receive', 1]
    ])(
        'keeps the typed address while the %s amount is entered',
        async (_, box) => {
            const form = await renderAfterScan();
            expect(form.address()).toBe(SCANNED);

            await form.typeAddress(TYPED);
            await form.openKeypad(box as number);

            expect(form.address()).toBe(TYPED);
        }
    );

    it('does not put the scanned address back when the form is reset', async () => {
        const form = await renderAfterScan();

        await form.typeAddress(TYPED);
        await form.leave();

        expect(form.address()).toBe('');
    });

    it('applies a new scan after the form was reset', async () => {
        const form = await renderAfterScan();

        await form.leave();
        await form.scan(TYPED);

        expect(form.address()).toBe(TYPED);
    });
});
