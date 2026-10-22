jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('bitcoinjs-lib', () => ({ initEccLib: jest.fn() }));
jest.mock('ecpair', () => ({ ECPairFactory: jest.fn() }));
jest.mock('@bitcoinerlab/secp256k1', () => ({}));
jest.mock('../../storage', () => ({ getItem: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));
jest.mock('../../utils/AddressUtils', () => ({
    isValidBitcoinAddressForNode: (value: string) => value.startsWith('bc1'),
    isValidLightningPaymentRequest: (value: string) => value.startsWith('lnbc')
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsFlowLSP: () => true,
    supportsOnchainSends: () => true
}));
jest.mock('../../utils/FontUtils', () => ({ font: () => 'font' }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../utils/UnitsUtils', () => ({ SATS_PER_BTC: 100000000 }));
// the real SwapUtils touches the filesystem and save dialog for the rescue
// key export; neither is exercised here
jest.mock('react-native-fs', () => ({}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/AddressInput', () => 'AddressInput');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/ModalBox', () => 'ModalBox');
jest.mock('../../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    SuccessMessage: 'SuccessMessage'
}));
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../assets/images/SVG/Arrow_down.svg', () => 'ArrowDown');
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock(
    '../../assets/images/SVG/ExchangeBitcoin.svg',
    () => 'ExchangeBitcoinSVG'
);
jest.mock('../../assets/images/SVG/ExchangeFiat.svg', () => 'ExchangeFiatSVG');
jest.mock('../../assets/images/SVG/History.svg', () => 'History');
jest.mock('../../assets/images/SVG/Key.svg', () => 'KeyIcon');

import React from 'react';

import Swap from './index';

const ADDRESS = 'bc1qaddress';

// on-chain -> Lightning, 100,000 sats to receive
const SUBMARINE_AMOUNTS = {
    inputSats: 100400,
    outputSats: 100000,
    inputDisplay: '100400',
    outputDisplay: '100000',
    serviceFeeSats: 100
};

// Brings the screen up in `state` and presses the button titled `title`;
// returns what InvoicesStore was asked for.
const generate = async (state: any, title: string) => {
    const createUnifiedInvoice = jest.fn(async (_: any) => ({
        paymentRequest: 'lnbc1'
    }));
    const view = new Swap({
        navigation: { navigate: jest.fn() },
        route: { params: {} },
        NodeInfoStore: {},
        SwapStore: {
            clearError: jest.fn(),
            subInfo: {},
            reverseInfo: {},
            getReverseClaimMinerFee: () => undefined
        },
        UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
        FiatStore: { fiatRates: [] },
        // the global setting stays on throughout
        SettingsStore: { settings: { enableLSP: true } },
        InvoicesStore: { createUnifiedInvoice, onChainAddress: ADDRESS },
        LSPStore: {}
    } as any);
    jest.spyOn(view, 'setState').mockImplementation(() => {});
    view.state = { ...view.state, ...SUBMARINE_AMOUNTS, ...state };

    const find = (node: any): any =>
        node?.props?.title === title
            ? node
            : React.Children.toArray(node?.props?.children)
                  .map(find)
                  .find(Boolean);
    await find(view.render()).props.onPress();
    return createUnifiedInvoice.mock.calls[0][0];
};

describe('Swaps: Generate invoice LSP decision', () => {
    const lsp = (lspIsActive: boolean) => ({ useLsp: lspIsActive });

    it('uses the Flow LSP when the LSP switch is shown and on', async () => {
        expect(
            await generate(
                { enableLSP: true, flowLspNotConfigured: false },
                'views.Swaps.generateInvoice'
            )
        ).toMatchObject(lsp(true));
    });

    it('skips the LSP when the LSP switch has been turned off', async () => {
        expect(
            await generate(
                { enableLSP: false, flowLspNotConfigured: false },
                'views.Swaps.generateInvoice'
            )
        ).toMatchObject(lsp(false));
    });

    it('skips the LSP on a wallet where the LSP switch and fee are not shown', async () => {
        expect(
            await generate(
                { enableLSP: true, flowLspNotConfigured: true },
                'views.Swaps.generateInvoice'
            )
        ).toMatchObject(lsp(false));
    });

    it('skips the LSP when only the on-chain address is used', async () => {
        expect(
            await generate(
                { enableLSP: true, flowLspNotConfigured: false, reverse: true },
                'views.Swaps.generateOnchainAddress'
            )
        ).toMatchObject(lsp(false));
    });
});
