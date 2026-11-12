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

describe('Swaps: reverse fee lookup', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const makeView = (
        getOnchainFeesviaMempool: jest.Mock,
        preferredMempoolRate?: string,
        stateOverrides: Record<string, any> = {}
    ) => {
        const routeParams = {};
        const view = new Swap({
            navigation: { navigate: jest.fn() },
            route: { params: routeParams },
            NodeInfoStore: {},
            SwapStore: {
                clearError: jest.fn(),
                subInfo: {},
                reverseInfo: {},
                getReverseClaimMinerFee: () => undefined,
                loading: true
            },
            UnitsStore: { units: 'sats', getNextUnit: () => 'BTC' },
            FiatStore: { fiatRates: [] },
            SettingsStore: {
                settings: {
                    enableLSP: true,
                    payments: preferredMempoolRate
                        ? { preferredMempoolRate }
                        : {}
                }
            },
            FeeStore: { getOnchainFeesviaMempool },
            InvoicesStore: {
                createUnifiedInvoice: jest.fn(),
                onChainAddress: 'bc1...'
            },
            LSPStore: {}
        } as any);

        // Merge state instead of no-op so tests can observe what the
        // component actually applied. Calls are still recorded on the spy.
        const setStateSpy = jest
            .spyOn(view, 'setState')
            .mockImplementation((updater: any) => {
                const patch =
                    typeof updater === 'function'
                        ? updater(view.state)
                        : updater;
                view.state = { ...view.state, ...patch };
            });

        // Stub out the side-effect methods componentDidUpdate calls, so the
        // fee tests only assert on fee state.
        view.networkFeeSats = jest.fn(() => 0);
        view.recalculateAmounts = jest.fn();
        view.checkIsValid = jest.fn();

        view.state = { ...view.state, reverse: true, ...stateOverrides };

        const prevProps = {
            navigation: { navigate: jest.fn() },
            route: { params: routeParams }
        };
        const prevState = { ...view.state, reverse: false };

        return { view, prevProps, prevState, setStateSpy };
    };

    it('does not log an error when the fee fetch resolves undefined', async () => {
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const getOnchainFeesviaMempool = jest.fn().mockResolvedValue(undefined);
        const { view, prevProps, prevState, setStateSpy } = makeView(
            getOnchainFeesviaMempool
        );

        await view.componentDidUpdate(prevProps as any, prevState as any);

        expect(getOnchainFeesviaMempool).toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();

        // Assert the finally block ran, but the fee was NOT set
        expect(setStateSpy).toHaveBeenCalledWith({ feeRateLookupDone: true });
        expect(
            setStateSpy.mock.calls.some(([s]) => 'fee' in (s as object))
        ).toBe(false);
    });

    it('sets the fee when the fetch resolves a valid rate', async () => {
        const getOnchainFeesviaMempool = jest
            .fn()
            .mockResolvedValue({ fastestFee: 9 });
        const { view, prevProps, prevState, setStateSpy } = makeView(
            getOnchainFeesviaMempool
        );

        await view.componentDidUpdate(prevProps as any, prevState as any);

        expect(getOnchainFeesviaMempool).toHaveBeenCalled();
        expect(setStateSpy).toHaveBeenCalledWith({ fee: '9' });
        expect(setStateSpy).toHaveBeenCalledWith({ feeRateLookupDone: true });
    });

    it('uses the preferred mempool rate when available', async () => {
        const getOnchainFeesviaMempool = jest
            .fn()
            .mockResolvedValue({ fastestFee: 9, hourFee: 4 });
        const { view, prevProps, prevState, setStateSpy } = makeView(
            getOnchainFeesviaMempool,
            'hourFee'
        );

        await view.componentDidUpdate(prevProps as any, prevState as any);

        expect(setStateSpy).toHaveBeenCalledWith({ fee: '4' });
    });

    it('falls back to fastestFee when the preferred rate is missing', async () => {
        const getOnchainFeesviaMempool = jest
            .fn()
            .mockResolvedValue({ fastestFee: 9 });
        const { view, prevProps, prevState, setStateSpy } = makeView(
            getOnchainFeesviaMempool,
            'economyFee'
        );

        await view.componentDidUpdate(prevProps as any, prevState as any);

        expect(setStateSpy).toHaveBeenCalledWith({ fee: '9' });
    });

    it('does not overwrite a fee the user typed while the lookup is in flight', async () => {
        let resolveFee: (v: any) => void = () => {};
        const getOnchainFeesviaMempool = jest.fn(
            () =>
                new Promise((res) => {
                    resolveFee = res;
                })
        );
        const { view, prevProps, prevState } = makeView(
            getOnchainFeesviaMempool,
            undefined,
            { fee: '2', feeRateLookupDone: false }
        );

        const update = view.componentDidUpdate(
            prevProps as any,
            prevState as any
        );

        // User types a fee while the fetch is still in flight.
        view.setState({ fee: '5' });

        // The lookup resolves with a different rate.
        resolveFee({ fastestFee: 20 });
        await update;

        // The user's value survives; the fetched rate is ignored.
        expect(view.state.fee).toBe('5');
    });

    it('applies the fetched rate when the fee has not changed', async () => {
        let resolveFee: (v: any) => void = () => {};
        const getOnchainFeesviaMempool = jest.fn(
            () =>
                new Promise((res) => {
                    resolveFee = res;
                })
        );
        const { view, prevProps, prevState } = makeView(
            getOnchainFeesviaMempool,
            undefined,
            { fee: '2', feeRateLookupDone: false }
        );

        const update = view.componentDidUpdate(
            prevProps as any,
            prevState as any
        );

        // No user edit.
        resolveFee({ fastestFee: 20 });
        await update;

        // The fetched rate is applied.
        expect(view.state.fee).toBe('20');
    });

    it('resets feeRateLookupDone when reverse is toggled off and on', async () => {
        let resolveFee: (v: any) => void = () => {};
        const getOnchainFeesviaMempool = jest.fn(
            () =>
                new Promise((res) => {
                    resolveFee = res;
                })
        );
        // Previous lookup already finished, so the flag starts true.
        const { view, prevProps, prevState } = makeView(
            getOnchainFeesviaMempool,
            undefined,
            { fee: '2', feeRateLookupDone: true }
        );

        const update = view.componentDidUpdate(
            prevProps as any,
            prevState as any
        );

        // Reset happens synchronously, before the await.
        expect(view.state.feeRateLookupDone).toBe(false);

        resolveFee({ fastestFee: 20 });
        await update;

        // Set to true again on completion.
        expect(view.state.feeRateLookupDone).toBe(true);
    });

    it('does not let an older overlapping lookup block a newer lookup result', async () => {
        let resolveFirst: (v: any) => void = () => {};
        let resolveSecond: (v: any) => void = () => {};
        const getOnchainFeesviaMempool = jest
            .fn()
            .mockReturnValueOnce(
                new Promise((res) => {
                    resolveFirst = res;
                })
            )
            .mockReturnValueOnce(
                new Promise((res) => {
                    resolveSecond = res;
                })
            );

        const { view, prevProps } = makeView(
            getOnchainFeesviaMempool,
            undefined,
            { fee: '2', feeRateLookupDone: false }
        );

        // Lookup 1 starts (prevState.reverse=false, this.state.reverse=true).
        const update1 = view.componentDidUpdate(
            prevProps as any,
            { ...view.state, reverse: false } as any
        );

        // Toggle reverse off, then on again — lookup 2 starts.
        view.setState({ reverse: false });
        view.setState({ reverse: true });
        const update2 = view.componentDidUpdate(
            prevProps as any,
            { ...view.state, reverse: false } as any
        );

        // The older lookup finishes first with rate 15.
        resolveFirst({ fastestFee: 15 });
        await update1;

        // It must NOT apply 15; a newer lookup is still pending.
        expect(view.state.fee).toBe('2');
        expect(view.state.feeRateLookupDone).toBe(false);

        // The newer lookup finishes with rate 20.
        resolveSecond({ fastestFee: 20 });
        await update2;

        // The newer rate wins.
        expect(view.state.fee).toBe('20');
        expect(view.state.feeRateLookupDone).toBe(true);
    });
});
