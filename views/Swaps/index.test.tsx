jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('bitcoinjs-lib', () => ({ initEccLib: jest.fn() }));
jest.mock('ecpair', () => ({ ECPairFactory: jest.fn() }));
jest.mock('@bitcoinerlab/secp256k1', () => ({}));
jest.mock('../../storage', () => ({ getItem: jest.fn() }));
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

// The LSP fee row next to the invoice field. It has to show the fee the
// invoice in the field was priced with, not LSPStore.zeroConfFee, which
// holds the latest preview for the amount entered.
describe('Swaps: LSP fee shown with the invoice', () => {
    const collect = (node: any, out: any[] = []): any[] => {
        if (Array.isArray(node)) {
            node.forEach((n) => collect(n, out));
        } else if (node && typeof node === 'object' && node.props) {
            out.push(node);
            collect(node.props.children, out);
        }
        return out;
    };

    // React Native throws when a string or number is a direct child of
    // anything but Text; the test renderer does not, so collect them.
    // React drops empty strings before they reach the host, so '' is fine.
    const bareText = (
        node: any,
        insideText = false,
        out: any[] = []
    ): any[] => {
        if (Array.isArray(node)) {
            node.forEach((n) => bareText(n, insideText, out));
        } else if (
            (typeof node === 'string' && node !== '') ||
            typeof node === 'number'
        ) {
            if (!insideText) out.push(node);
        } else if (node && typeof node === 'object' && node.props) {
            bareText(
                node.props.children,
                insideText || node.type === 'Text',
                out
            );
        }
        return out;
    };

    // A submarine swap screen on a wallet with the Flow LSP set up, with
    // setState applied synchronously. `created` is what the next
    // createUnifiedInvoice call returns; `previewDuringRequest` is a
    // preview fee that lands after its quote, before it returns.
    const makeView = (created: any, previewDuringRequest?: number) => {
        const navigate = jest.fn();
        const lspStore: any = {
            getZeroConfFee: jest.fn(() => Promise.resolve()),
            resetFee: jest.fn()
        };
        const invoicesStore: any = {
            onChainAddress: ADDRESS,
            payment_request: null,
            createUnifiedInvoice: jest.fn(async () => {
                invoicesStore.payment_request = created.paymentRequest;
                // the invoice request asks for its own quote, which is
                // also the preview until a newer one arrives
                lspStore.zeroConfFee = created.lspFeeSats ?? undefined;
                if (previewDuringRequest !== undefined)
                    lspStore.zeroConfFee = previewDuringRequest;
                return created;
            })
        };
        const swapStore: any = {
            clearError: jest.fn(),
            subInfo: { fees: { percentage: 0.1, minerFees: 300 } },
            reverseInfo: {},
            getReverseClaimMinerFee: () => undefined
        };
        const view = new Swap({
            navigation: { navigate },
            route: { params: {} },
            NodeInfoStore: {},
            SwapStore: swapStore,
            UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
            FiatStore: { fiatRates: [] },
            SettingsStore: {
                settings: { enableLSP: true },
                updateSettings: jest.fn()
            },
            InvoicesStore: invoicesStore,
            LSPStore: lspStore
        } as any);
        jest.spyOn(view, 'checkIsValid').mockImplementation(() => {});
        jest.spyOn(view, 'setState').mockImplementation(
            (update: any, callback?: () => void) => {
                const prevState = view.state;
                view.state = {
                    ...prevState,
                    ...(typeof update === 'function'
                        ? update(prevState)
                        : update)
                };
                view.componentDidUpdate(view.props, prevState);
                callback?.();
            }
        );
        view.state = {
            ...view.state,
            ...SUBMARINE_AMOUNTS,
            lastEditedAmount: 'input',
            enableLSP: true,
            flowLspNotConfigured: false
        };
        return { view, navigate, lspStore, swapStore };
    };

    const find = (view: any, test: (e: any) => boolean) =>
        collect(view.render()).find(test);

    const pressGenerate = async (view: any) => {
        await find(
            view,
            (e) => e.props.title === 'views.Swaps.generateInvoice'
        ).props.onPress();
    };

    const paste = (view: any, text: string) =>
        find(view, (e) => e.type === 'AddressInput').props.onChangeText(text);

    // the fee row: its amount and where tapping it leads
    const feeRow = (view: any, navigate: jest.Mock) => {
        const elements = collect(view.render());
        const amount = elements.find(
            (e) => e.type === 'Amount' && e.props.fixedUnits === 'sats'
        );
        if (!amount) return undefined;
        navigate.mockClear();
        elements
            .find(
                (e) =>
                    typeof e.props.onPress === 'function' &&
                    collect(e.props.children).includes(amount)
            )
            .props.onPress();
        return {
            fee: amount.props.sats,
            explanation: navigate.mock.calls[0][0]
        };
    };

    it('keeps the fee the generated invoice was priced with after a later preview', async () => {
        const { view, navigate, lspStore } = makeView({
            rHash: 'hash',
            paymentRequest: 'lnbc-wrapped',
            lspFeeSats: 10000
        });

        await pressGenerate(view);
        expect(view.state.invoice).toBe('lnbc-wrapped');
        expect(feeRow(view, navigate)).toEqual({
            fee: 10000,
            explanation: 'LspExplanationFees'
        });

        // a newer preview replaces the shared fee
        lspStore.zeroConfFee = 500;

        expect(feeRow(view, navigate)).toEqual({
            fee: 10000,
            explanation: 'LspExplanationFees'
        });
    });

    it('keeps the fee the invoice was priced with when a preview lands while it is being made', async () => {
        const { view, navigate } = makeView(
            {
                rHash: 'hash',
                paymentRequest: 'lnbc-wrapped',
                lspFeeSats: 10000
            },
            500
        );

        await pressGenerate(view);
        expect(view.state.invoice).toBe('lnbc-wrapped');
        expect(feeRow(view, navigate)).toEqual({
            fee: 10000,
            explanation: 'LspExplanationFees'
        });
    });

    it('keeps the invoice and its own fee when the amount is worked out again, and drops both when the amount is edited', async () => {
        const { view, navigate, lspStore, swapStore } = makeView({
            rHash: 'hash',
            paymentRequest: 'lnbc-wrapped',
            lspFeeSats: 10000
        });
        await pressGenerate(view);

        // the host's network fee changes: the amount received is worked
        // out again and a new preview is asked for it
        swapStore.subInfo.fees.minerFees = 500;
        view.recalculateAmounts();
        expect(view.state.outputSats).not.toEqual(SUBMARINE_AMOUNTS.outputSats);
        expect(lspStore.getZeroConfFee).toHaveBeenCalledWith(
            Number(view.state.outputSats) * 1000
        );
        lspStore.zeroConfFee = 500;

        expect(view.state.invoice).toBe('lnbc-wrapped');
        expect(feeRow(view, navigate)).toEqual({
            fee: 10000,
            explanation: 'LspExplanationFees'
        });

        // the user edits the amount: the invoice goes, and its fee with it
        find(view, (e) => e.type === 'AmountInput').props.onAmountChange(
            '90000',
            '90000'
        );
        expect(view.state.invoice).toBe('');
        expect(feeRow(view, navigate)).toBeUndefined();
    });

    it('shows no fee for a pasted invoice', async () => {
        const { view, navigate, lspStore } = makeView({
            rHash: 'hash',
            paymentRequest: 'lnbc-wrapped',
            lspFeeSats: 10000
        });
        lspStore.zeroConfFee = 10000;

        paste(view, 'lnbc-pasted');
        expect(feeRow(view, navigate)).toBeUndefined();

        // also when it replaces a generated one
        paste(view, '');
        await pressGenerate(view);
        expect(feeRow(view, navigate)?.fee).toBe(10000);
        paste(view, 'lnbc-pasted');
        expect(feeRow(view, navigate)).toBeUndefined();
    });

    it('shows no fee for a generated invoice that is not LSP-wrapped', async () => {
        const { view, navigate, lspStore } = makeView({
            rHash: 'hash',
            paymentRequest: 'lnbc-plain',
            lspFeeSats: null
        });

        await pressGenerate(view);
        // a preview for the amount is still around
        lspStore.zeroConfFee = 10000;

        expect(view.state.invoice).toBe('lnbc-plain');
        expect(feeRow(view, navigate)).toBeUndefined();
    });

    it('shows a fee of 0 for a wrapped invoice, with no bare text outside Text', async () => {
        const { view, navigate, lspStore } = makeView({
            rHash: 'hash',
            paymentRequest: 'lnbc-wrapped',
            lspFeeSats: 0
        });

        await pressGenerate(view);
        // the shared fee was reset after the invoice was made
        lspStore.zeroConfFee = undefined;

        expect(feeRow(view, navigate)).toEqual({
            fee: 0,
            explanation: 'LspExplanationRouting'
        });
        expect(bareText(view.render())).toEqual([]);
    });
});
