jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../utils/handleAnything', () => jest.fn());
jest.mock('../utils/BackendUtils', () => {
    const mocked: any = {
        supportsOnchainReceiving: () => true,
        supportsAddressTypeSelection: () => false,
        watchInvoicePaid: jest.fn(() => jest.fn()),
        watchOnchainReceived: jest.fn(() => jest.fn())
    };
    // render() asks for many supports*() flags; unlisted ones are off
    return new Proxy(mocked, {
        get: (target, key) =>
            key in target
                ? target[key]
                : key === '__esModule'
                ? false
                : () => false
    });
});
jest.mock('../stores/SettingsStore', () => ({
    TIME_PERIOD_KEYS: [],
    DefaultInvoiceType: { Unified: 'unified', Lightning: 'lightning' }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/LndUtils', () => ({
    toWalletrpcAddressTypeName: jest.fn()
}));
jest.mock('../utils/NFCUtils', () => ({
    isNfcWithdraw: jest.requireActual('../utils/NFCUtils').isNfcWithdraw,
    scanNfcTag: jest.fn()
}));
jest.mock('../utils/UnitsUtils', () => ({
    SATS_PER_BTC: 100000000,
    numberWithCommas: (x: string | number) => `${x}`
}));
jest.mock('../utils/AmountUtils', () => ({ getAmountFromSats: jest.fn() }));
jest.mock('../utils/ExpiryUtils', () => ({
    ExpirationPreset: {},
    TimePeriod: {},
    expirationIndexFromSeconds: jest.fn(),
    expirySecondsFromInput: jest.fn(),
    localizedExpiryDuration: jest.fn()
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/AmountInput', () => ({
    __esModule: true,
    default: 'AmountInput',
    getSatAmount: jest.fn()
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/HopPicker', () => 'HopPicker');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/PaidIndicator', () => 'PaidIndicator');
jest.mock('../components/ModalBox', () => 'ModalBox');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/SuccessAnimation', () => 'SuccessAnimation');
jest.mock('../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/Text', () => 'Text');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/layout/Spacer', () => ({ Spacer: 'Spacer' }));
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/SVG/UnifiedSvg', () => 'UnifiedSvg');
jest.mock('../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../components/SVG/OnChainSvg', () => 'OnChainSvg');
jest.mock('../components/SVG/AddressSvg', () => 'AddressSvg');
jest.mock('../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../assets/images/SVG/Lock.svg', () => 'LockIcon');
jest.mock('../assets/images/SVG/Gear.svg', () => 'Gear');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');

import * as React from 'react';
import { Alert } from 'react-native';
import Receive from './Receive';
import BackendUtils from '../utils/BackendUtils';
import handleAnything from '../utils/handleAnything';
import { scanNfcTag } from '../utils/NFCUtils';
import { getSatAmount } from '../components/AmountInput';

// value is in the display unit (here fiat), satAmount in sats, as set by
// AmountInput's onAmountChange
const makeView = (state: { value: string; satAmount: string | number }) => {
    const view = new Receive({
        navigation: { navigate: jest.fn() },
        route: { params: {} },
        SettingsStore: { settings: {} },
        NodeInfoStore: { nodeInfo: { block_height: 900000 } }
    } as unknown as React.ComponentProps<typeof Receive>);
    view.state = { ...view.state, ...state };
    return view;
};

describe('Receive.subscribeInvoice', () => {
    beforeEach(() => jest.clearAllMocks());

    it('watches on-chain for the sat amount, not the fiat display amount', () => {
        // 10,000 KRW is roughly 7,100 sats: a 7,100 sat output must
        // satisfy the watcher
        const view = makeView({ value: '10000', satAmount: '7100' });

        view.subscribeInvoice('rhash', 'bc1qwatched');

        expect(BackendUtils.watchOnchainReceived).toHaveBeenCalledWith(
            expect.objectContaining({
                address: 'bc1qwatched',
                expectedAmountSat: '7100',
                blockHeight: 900000
            }),
            expect.any(Function)
        );
    });

    it('watches the invoice by hash alone', () => {
        // with the Flow LSP the node invoice is for the Receive amount
        // minus the LSP fee, so no amount can be passed to compare against
        const view = makeView({ value: '0.00007100', satAmount: 7100 });

        view.subscribeInvoice('rhash');

        expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledWith(
            { rHash: 'rhash' },
            expect.any(Function)
        );
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });
});

describe('Receive.updateIndex', () => {
    beforeEach(() => jest.clearAllMocks());

    const NEW_ADDRESS = 'bc1qnewaddress';

    // a Lightning-only invoice is on screen and no on-chain address has
    // been generated for it yet
    const makeTabView = (InvoicesStore: any) => {
        const view = new Receive({
            navigation: { navigate: jest.fn() },
            route: { params: {} },
            InvoicesStore: {
                payment_request: 'lnbc100u1example',
                onChainAddress: '',
                getNewAddress: jest.fn(async () => NEW_ADDRESS),
                ...InvoicesStore
            },
            SettingsStore: { settings: {} },
            NodeInfoStore: { nodeInfo: { block_height: 900000 } }
        } as unknown as React.ComponentProps<typeof Receive>);
        // the view is never mounted, so apply state updates directly
        jest.spyOn(view, 'setState').mockImplementation((update: any) => {
            view.state = { ...view.state, ...update };
        });
        return view;
    };

    it.each([
        ['unified', 0],
        ['on-chain', 2]
    ])(
        'watches the address generated when switching to the %s tab',
        async (_tab, selectedIndex) => {
            const view = makeTabView({});
            view.subscribeInvoice('rhash');

            await view.updateIndex(selectedIndex);

            expect(BackendUtils.watchOnchainReceived).toHaveBeenCalledWith(
                expect.objectContaining({ address: NEW_ADDRESS }),
                expect.any(Function)
            );
            // the invoice stays watched
            expect(BackendUtils.watchInvoicePaid).toHaveBeenCalledTimes(1);
            expect(view.unsubscribeInvoiceWatch).toBeDefined();
        }
    );

    it('does not watch anything when the node returns no address', async () => {
        const view = makeTabView({ getNewAddress: jest.fn(async () => {}) });

        await view.updateIndex(2);

        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });

    it('does not generate an address when switching to the Lightning tab', async () => {
        const view = makeTabView({});

        await view.updateIndex(1);

        expect(view.props.InvoicesStore.getNewAddress).not.toHaveBeenCalled();
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });

    it('does not watch the address when the screen unmounts before it resolves', async () => {
        let resolveAddress: (address: string) => void = () => {};
        const view = makeTabView({
            getNewAddress: jest.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolveAddress = resolve;
                    })
            ),
            reset: jest.fn()
        });
        Object.assign(view.props, { LSPStore: { reset: jest.fn() } });

        const pending = view.updateIndex(2);
        view.componentWillUnmount();
        resolveAddress(NEW_ADDRESS);
        await pending;

        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
        expect(view.unsubscribeOnchainWatch).toBeNull();
    });

    it('does not watch the address when the invoice is paid before it resolves', async () => {
        let resolveAddress: (address: string) => void = () => {};
        const view = makeTabView({
            watchedInvoicePaid: false,
            getNewAddress: jest.fn(
                () =>
                    new Promise<string>((resolve) => {
                        resolveAddress = resolve;
                    })
            )
        });

        const pending = view.updateIndex(2);
        view.props.InvoicesStore!.watchedInvoicePaid = true;
        resolveAddress(NEW_ADDRESS);
        await pending;

        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });
});

describe('Receive LNURL-withdraw LSP fee', () => {
    beforeEach(() => jest.clearAllMocks());

    const pressAlertButton = (text: string) => {
        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        buttons.find((b: any) => b.text === text).onPress();
    };

    it('shows the fee and the amount left, and resolves with the choice', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const view = makeView({ value: '50000', satAmount: '50000' });

        const declined = view.confirmLspFee(2000, '50000');
        expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
            'views.Receive.lspFeeConfirmWithdrawal'
        );
        pressAlertButton('general.cancel');
        await expect(declined).resolves.toBe(false);

        (Alert.alert as jest.Mock).mockClear();
        const accepted = view.confirmLspFee(2000, '50000');
        pressAlertButton('general.confirm');
        await expect(accepted).resolves.toBe(true);
    });

    it('explains a fee the withdrawal amount does not cover as added on top', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const view = makeView({ value: '1000', satAmount: '1000' });

        const answer = view.confirmLspFee(3000, '1000');
        expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(
            'views.Receive.lspFeeOnTopConfirmWithdrawal'
        );
        pressAlertButton('general.confirm');
        await expect(answer).resolves.toBe(true);
    });

    it('passes the confirmation to the store on an NFC withdraw with a keyed-in amount', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(50000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            {
                lnurlParams: {
                    tag: 'withdrawRequest',
                    defaultDescription: { memo: '' }
                }
            }
        ]);
        const createUnifiedInvoice = jest.fn(() => new Promise(() => {}));
        const view = new Receive({
            navigation: { navigate: jest.fn() },
            route: { params: { amount: '50000' } },
            SettingsStore: { settings: {} },
            NodeInfoStore: { nodeInfo: {} },
            InvoicesStore: { createUnifiedInvoice }
        } as unknown as React.ComponentProps<typeof Receive>);
        // the sats the route amount was converted to when Receive opened
        view.state = { ...view.state, lspIsActive: true, satAmount: 50000 };

        view.validateAddress('lnurl1withdraw');
        await new Promise(process.nextTick);

        expect(createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                useLsp: true,
                confirmLspFee: view.confirmLspFee
            })
        );
    });
});

const withdrawParams = {
    tag: 'withdrawRequest',
    callback: 'https://card.example/withdraw',
    k1: 'k1',
    minWithdrawable: 1000,
    maxWithdrawable: 1000000,
    defaultDescription: 'card'
};
const WITHDRAW_RESPONSE = ['Receive', { lnurlParams: withdrawParams }];
const CASHU_RESPONSE = ['CashuToken', { token: 'cashuBtoken', decoded: {} }];

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Receive opened from the POS keypad with `amount` in the display unit of
// that moment, already converted to `satAmount`
const makeNfcView = (
    amount: string,
    satAmount: number,
    createFails = false
) => {
    const navigate = jest.fn();
    const InvoicesStore = {
        createUnifiedInvoice: jest.fn(() =>
            createFails ? Promise.reject(new Error()) : Promise.resolve({})
        ),
        setWatchedInvoicePaid: jest.fn(),
        reset: jest.fn()
    };
    const PosStore = { recordPayment: jest.fn(), clearOrderInvoice: jest.fn() };
    const view = new Receive({
        navigation: { navigate },
        route: { params: { amount } },
        BalanceStore: { getCombinedBalance: jest.fn() },
        InvoicesStore,
        LSPStore: { reset: jest.fn() },
        ModalStore: {},
        NodeInfoStore: { nodeInfo: { block_height: 900000 } },
        PosStore,
        SettingsStore: { posStatus: 'active', settings: {} }
    } as unknown as React.ComponentProps<typeof Receive>);
    view.state = { ...view.state, value: amount, satAmount, orderId: 'order' };
    return { view, navigate, InvoicesStore, PosStore };
};

describe('Receive NFC scan', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // the amount under the QR code was tapped, so converting the route
        // param again reads '25.00' as 25 sats
        (getSatAmount as jest.Mock).mockImplementation((amount) =>
            Number(amount || 0)
        );
        (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
        (handleAnything as unknown as jest.Mock).mockResolvedValue(
            WITHDRAW_RESPONSE
        );
    });

    it('withdraws the sats of the invoice on screen, not the route param', async () => {
        const { view, navigate, InvoicesStore } = makeNfcView('25.00', 25000);

        await view.scanNfc();
        await flush();

        expect(handleAnything).toHaveBeenCalledWith('tag text', '25000');
        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ value: '25000', lnurl: withdrawParams })
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it('hands the sats on screen on when creating the invoice fails', async () => {
        const { view, navigate } = makeNfcView('25.00', 25000, true);

        await view.scanNfc();
        await flush();

        expect(navigate).toHaveBeenCalledWith('Receive', {
            satAmount: 25000,
            lnurlParams: withdrawParams
        });
    });

    it('opens the receive screen when no amount was entered', async () => {
        const { view, navigate, InvoicesStore } = makeNfcView('', 0);

        await view.scanNfc();
        await flush();

        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('Receive', {
            lnurlParams: withdrawParams
        });
    });

    // #5524: an ecash token on a tag did nothing, or showed the error
    it('opens a tapped ecash token outside POS mode', async () => {
        const { view, navigate, InvoicesStore } = makeNfcView('1000', 1000);
        view.props.SettingsStore.posStatus = 'inactive';
        (handleAnything as unknown as jest.Mock).mockResolvedValue(
            CASHU_RESPONSE
        );
        const setState = jest
            .spyOn(view, 'setState')
            .mockImplementation(() => {});

        await view.scanNfc();
        await flush();

        expect(navigate).toHaveBeenCalledWith('CashuToken', CASHU_RESPONSE[1]);
        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(setState).not.toHaveBeenCalledWith({ nfcError: true });
    });

    it('shows the NFC error for an ecash token in POS mode', async () => {
        // the token is not tied to the order on screen
        const { view, navigate, InvoicesStore } = makeNfcView('1000', 1000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue(
            CASHU_RESPONSE
        );
        const setState = jest
            .spyOn(view, 'setState')
            .mockImplementation(() => {});

        await view.scanNfc();
        await flush();

        expect(navigate).not.toHaveBeenCalled();
        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(setState).toHaveBeenCalledWith({ nfcError: true });
    });
});

// InvoicesStore is shared with whatever Receive view is shown next, so work
// of a view that was left must not land in it
describe('Receive after the view was left', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSatAmount as jest.Mock).mockImplementation((amount) =>
            Number(amount || 0)
        );
    });

    it.each([
        ['an amount', '1000', 1000],
        ['no amount', '', 0]
    ])(
        'ignores an LNURL server that answers late, with %s',
        async (_, amount, satAmount) => {
            const { view, navigate, InvoicesStore } = makeNfcView(
                amount,
                satAmount
            );
            let answer: (response: any) => void = () => {};
            (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
            (handleAnything as unknown as jest.Mock).mockReturnValue(
                new Promise((resolve) => (answer = resolve))
            );

            await view.scanNfc();
            view.componentWillUnmount();
            answer(WITHDRAW_RESPONSE);
            await flush();

            expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
        }
    );

    it('ignores a tag that is read late', async () => {
        const { view } = makeNfcView('1000', 1000);
        let read: (text: string) => void = () => {};
        (scanNfcTag as jest.Mock).mockReturnValue(
            new Promise((resolve) => (read = resolve))
        );

        const scan = view.scanNfc();
        view.componentWillUnmount();
        read('tag text');
        await scan;
        await flush();

        expect(handleAnything).not.toHaveBeenCalled();
    });

    it('starts watchers only while mounted', () => {
        const { view } = makeNfcView('1000', 1000);
        view.componentWillUnmount();

        view.subscribeInvoice('rhash', 'bc1qexample');

        expect(BackendUtils.watchInvoicePaid).not.toHaveBeenCalled();
        expect(BackendUtils.watchOnchainReceived).not.toHaveBeenCalled();
    });

    it('records a late payment for its order without showing it as paid', () => {
        const { view, InvoicesStore, PosStore } = makeNfcView('1000', 1000);
        view.componentWillUnmount();

        view.handlePaymentReceived(1000, { type: 'onchain', tx: 'txid' });

        expect(InvoicesStore.setWatchedInvoicePaid).not.toHaveBeenCalled();
        expect(PosStore.recordPayment).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order', tx: 'txid' })
        );
    });
});

describe('Receive.validateAddress (Pay via NFC)', () => {
    const makeScanView = (amount: string) => {
        const navigation = { navigate: jest.fn() };
        const createUnifiedInvoice = jest.fn(() =>
            Promise.resolve({ rHash: 'rhash' })
        );
        const view = new Receive({
            navigation,
            route: { params: { amount } },
            SettingsStore: { settings: {} },
            InvoicesStore: { createUnifiedInvoice },
            NodeInfoStore: { nodeInfo: { block_height: 900000 } }
        } as unknown as React.ComponentProps<typeof Receive>);
        view.state = { ...view.state, satAmount: Number(amount) };
        view.subscribeInvoice = jest.fn();
        view.setState = jest.fn();
        return { view, navigation, createUnifiedInvoice };
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it.each([
        [
            'an LNURL-pay request',
            'LnurlPay',
            {
                tag: 'payRequest',
                callback: 'https://x.example/cb',
                defaultDescription: 'x'
            }
        ],
        [
            'a Lightning address whose server answers withdrawRequest',
            'LnurlPay',
            {
                tag: 'withdrawRequest',
                callback: 'https://x.example/cb',
                defaultDescription: 'x'
            }
        ],
        [
            'an LNURL-channel request',
            'LnurlChannel',
            { tag: 'channelRequest', defaultDescription: 'x' }
        ],
        [
            'an LNURL-auth request',
            'LnurlAuth',
            { tag: 'login', defaultDescription: 'x' }
        ]
    ])(
        'opens no screen for %s on a zero amount',
        async (_, route, lnurlParams) => {
            (getSatAmount as jest.Mock).mockReturnValue(0);
            (handleAnything as unknown as jest.Mock).mockResolvedValue([
                route,
                { lnurlParams }
            ]);
            const { view, navigation, createUnifiedInvoice } =
                makeScanView('0');

            view.validateAddress('https://x.example/lnurlp/tag');
            await flush();

            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(createUnifiedInvoice).not.toHaveBeenCalled();
            expect(view.setState).toHaveBeenCalledWith({ nfcError: true });
        }
    );

    it('shows the NFC error when the tag cannot be read as a payment code', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(0);
        (handleAnything as unknown as jest.Mock).mockRejectedValue(
            new Error('unsupported')
        );
        const { view, navigation } = makeScanView('0');

        view.validateAddress('hello');
        await flush();

        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(view.setState).toHaveBeenCalledWith({ nfcError: true });
    });

    it('opens no screen for an LNURL-pay request when invoice creation fails', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(5000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'LnurlPay',
            {
                lnurlParams: {
                    tag: 'payRequest',
                    callback: 'https://x.example/cb',
                    defaultDescription: 'x'
                }
            }
        ]);
        const { view, navigation, createUnifiedInvoice } = makeScanView('5000');
        createUnifiedInvoice.mockImplementation(() =>
            Promise.reject(new Error('offline'))
        );

        view.validateAddress('https://x.example/lnurlp/tag');
        await flush();

        expect(createUnifiedInvoice).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('opens the withdraw form for an LNURL-withdraw card on a zero amount', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(0);
        const props = { lnurlParams: withdrawParams };
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            props
        ]);
        const { view, navigation } = makeScanView('0');

        view.validateAddress('lnurlw://card.example/w');
        await flush();

        expect(navigation.navigate).toHaveBeenCalledWith('Receive', props);
        expect(view.setState).not.toHaveBeenCalledWith({ nfcError: true });
    });

    it('creates an invoice for the card to pay when an amount is set', async () => {
        (getSatAmount as jest.Mock).mockReturnValue(5000);
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'Receive',
            { lnurlParams: withdrawParams }
        ]);
        const { view, navigation, createUnifiedInvoice } = makeScanView('5000');

        view.validateAddress('lnurlw://card.example/w');
        await flush();

        expect(createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '5000',
                lnurl: withdrawParams
            })
        );
        expect(view.subscribeInvoice).toHaveBeenCalledWith('rhash', undefined);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});

// InvoicesStore only shows the invoice of its latest request, so when a
// new amount, NFC tap or Create press starts another one, the older
// request's answer must not be watched, recorded or handed on
describe('Receive invoice requests that were superseded', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        let reject: (error: any) => void = () => {};
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getSatAmount as jest.Mock).mockImplementation((amount) =>
            Number(amount || 0)
        );
    });

    const makeAutoView = (requests: Array<Promise<any>>) => {
        const createUnifiedInvoice = jest.fn();
        requests.forEach((request) =>
            createUnifiedInvoice.mockReturnValueOnce(request)
        );
        const PosStore = {
            getOrderInvoiceById: jest.fn(async (): Promise<any> => undefined),
            canReuseInvoice: jest.fn(() => false),
            recordInvoice: jest.fn()
        };
        const InvoicesStore: any = {
            createUnifiedInvoice,
            // what the store shows: the newer request's invoice
            payment_request: 'lnbc-new',
            reset: jest.fn()
        };
        const view = new Receive({
            navigation: { navigate: jest.fn() },
            route: { params: {} },
            InvoicesStore,
            LSPStore: { reset: jest.fn() },
            PosStore,
            SettingsStore: { settings: {} },
            NodeInfoStore: { nodeInfo: { block_height: 900000 } }
        } as unknown as React.ComponentProps<typeof Receive>);
        view.state = { ...view.state, orderId: 'order' };
        view.subscribeInvoice = jest.fn();
        return { view, PosStore, InvoicesStore };
    };

    it('watches and records only the newer invoice when an older one finishes last', async () => {
        const older = deferred();
        const newer = deferred();
        const { view, PosStore } = makeAutoView([older.promise, newer.promise]);

        view.autoGenerateInvoice('1000');
        await flush();
        view.autoGenerateInvoice('2000');
        await flush();
        newer.resolve({
            rHash: 'hash-new',
            paymentRequest: 'lnbc-new',
            lspFeeSats: 10000
        });
        await flush();
        older.resolve({
            rHash: 'hash-old',
            paymentRequest: 'lnbc-old',
            lspFeeSats: 2000
        });
        await flush();

        expect(view.subscribeInvoice).toHaveBeenCalledTimes(1);
        expect(view.subscribeInvoice).toHaveBeenCalledWith(
            'hash-new',
            undefined
        );
        expect(PosStore.recordInvoice).toHaveBeenCalledTimes(1);
        expect(PosStore.recordInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_request: 'lnbc-new',
                rHash: 'hash-new',
                amount: '2000',
                // the fee comes with the invoice, so a reopened order
                // shows it again
                lspFeeSats: 10000
            })
        );
    });

    it('records nothing for an invoice that arrives after the view was left', async () => {
        const request = deferred();
        const { view, PosStore } = makeAutoView([request.promise]);

        view.autoGenerateInvoice('1000');
        await flush();
        view.componentWillUnmount();
        // the next sale's invoice is on screen by now
        request.resolve({ rHash: 'hash-old', paymentRequest: 'lnbc-old' });
        await flush();

        expect(PosStore.recordInvoice).not.toHaveBeenCalled();
        expect(view.subscribeInvoice).not.toHaveBeenCalled();
    });

    it('does not create an invoice when the order lookup returns after a newer request', async () => {
        const lookup = deferred();
        const { view, PosStore, InvoicesStore } = makeAutoView([
            new Promise(() => {})
        ]);
        PosStore.getOrderInvoiceById.mockReturnValueOnce(lookup.promise);

        view.autoGenerateInvoice('1000');
        view.autoGenerateInvoice('2000');
        lookup.resolve(undefined);
        await flush();

        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledTimes(1);
        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ value: '2000' })
        );
    });

    it('does not show a reusable order invoice found after a newer request', async () => {
        const lookup = deferred();
        const { view, PosStore, InvoicesStore } = makeAutoView([
            new Promise(() => {})
        ]);
        PosStore.getOrderInvoiceById.mockReturnValueOnce(lookup.promise);
        PosStore.canReuseInvoice.mockReturnValue(true);

        view.autoGenerateInvoice('1000');
        PosStore.getOrderInvoiceById.mockReturnValueOnce(new Promise(() => {}));
        view.autoGenerateInvoice('2000');
        lookup.resolve({ payment_request: 'lnbc-order', rHash: 'hash-order' });
        await flush();

        expect(InvoicesStore.payment_request).toBe('lnbc-new');
        expect(view.subscribeInvoice).not.toHaveBeenCalled();
    });

    describe('Pay via NFC', () => {
        const makeTapView = (requests: Array<Promise<any>>) => {
            const { view, navigate, InvoicesStore } = makeNfcView('1000', 1000);
            requests.forEach((request) =>
                (
                    InvoicesStore.createUnifiedInvoice as jest.Mock
                ).mockReturnValueOnce(request)
            );
            view.subscribeInvoice = jest.fn();
            (handleAnything as unknown as jest.Mock).mockResolvedValue(
                WITHDRAW_RESPONSE
            );
            return { view, navigate };
        };

        it('watches only the invoice of the latest tap', async () => {
            const first = deferred();
            const second = deferred();
            const { view } = makeTapView([first.promise, second.promise]);

            view.validateAddress('tag one');
            await flush();
            view.validateAddress('tag two');
            await flush();
            second.resolve({ rHash: 'hash-two', paymentRequest: 'lnbc-two' });
            await flush();
            first.resolve({ rHash: 'hash-one', paymentRequest: 'lnbc-one' });
            await flush();

            expect(view.subscribeInvoice).toHaveBeenCalledTimes(1);
            expect(view.subscribeInvoice).toHaveBeenCalledWith(
                'hash-two',
                undefined
            );
        });

        it('does not open the withdraw screen when a superseded tap fails', async () => {
            const first = deferred();
            const { view, navigate } = makeTapView([
                first.promise,
                new Promise(() => {})
            ]);

            view.validateAddress('tag one');
            await flush();
            view.validateAddress('tag two');
            await flush();
            first.reject(new Error('superseded'));
            await flush();

            expect(navigate).not.toHaveBeenCalled();
        });
    });
});

// The tag's LNURL server answers whenever it does: by then the staff may
// have read another card, created another invoice or tapped Cancel
describe('Receive NFC lookups that were superseded', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        let reject: (error: any) => void = () => {};
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getSatAmount as jest.Mock).mockImplementation((amount) =>
            Number(amount || 0)
        );
    });

    const setup = () => {
        const nfc = makeNfcView('1000', 1000);
        Object.assign(nfc.PosStore, { recordInvoice: jest.fn() });
        nfc.view.subscribeInvoice = jest.fn();
        nfc.view.setState = jest.fn();
        return nfc;
    };

    it('creates one invoice when an older card answers after a newer one', async () => {
        const { view, InvoicesStore } = setup();
        const cardA = deferred();
        (handleAnything as unknown as jest.Mock)
            .mockReturnValueOnce(cardA.promise)
            .mockResolvedValueOnce(WITHDRAW_RESPONSE);

        view.validateAddress('card A');
        view.validateAddress('card B');
        await flush();
        cardA.resolve(WITHDRAW_RESPONSE);
        await flush();

        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledTimes(1);
    });

    it('does not withdraw for a card that answers after a newer invoice was requested', async () => {
        const { view, InvoicesStore } = setup();
        const cardA = deferred();
        (handleAnything as unknown as jest.Mock).mockReturnValueOnce(
            cardA.promise
        );

        view.validateAddress('card A');
        view.autoGenerateInvoice('2000');
        await flush();
        cardA.resolve(WITHDRAW_RESPONSE);
        await flush();

        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledTimes(1);
        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalledWith(
            expect.objectContaining({ lnurl: withdrawParams })
        );
    });

    it.each([
        ['a withdraw card', () => Promise.resolve(WITHDRAW_RESPONSE)],
        [
            'another payment code',
            () =>
                Promise.resolve([
                    'LnurlPay',
                    { lnurlParams: { tag: 'payRequest' } }
                ])
        ],
        ['an unreadable tag', () => Promise.reject(new Error('unsupported'))]
    ])('does nothing with %s answered after Cancel', async (_, answer) => {
        const { view, navigate, InvoicesStore } = setup();
        const lookup = deferred();
        (handleAnything as unknown as jest.Mock).mockReturnValueOnce(
            lookup.promise
        );

        view.validateAddress('card A');
        view.cleanup();
        answer().then(lookup.resolve, lookup.reject);
        await flush();

        expect(InvoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(view.setState).not.toHaveBeenCalled();
    });

    it.each([
        ['is created', (request: any) => request.resolve({ rHash: 'hash-a' })],
        ['fails', (request: any) => request.reject(new Error('offline'))]
    ])(
        'starts no watcher and opens nothing when a cancelled invoice %s',
        async (_, settle) => {
            const { view, navigate, InvoicesStore } = setup();
            const request = deferred();
            InvoicesStore.createUnifiedInvoice.mockReturnValueOnce(
                request.promise as Promise<any>
            );
            (handleAnything as unknown as jest.Mock).mockResolvedValueOnce(
                WITHDRAW_RESPONSE
            );

            view.validateAddress('card A');
            await flush();
            expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalled();
            view.cleanup();
            settle(request);
            await flush();

            expect(view.subscribeInvoice).not.toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
        }
    );

    it('still watches the invoice on screen after a tap that is not a withdraw', async () => {
        const { view, InvoicesStore } = setup();
        const shown = deferred();
        InvoicesStore.createUnifiedInvoice.mockReturnValueOnce(
            shown.promise as Promise<any>
        );
        (handleAnything as unknown as jest.Mock).mockResolvedValueOnce([
            'LnurlPay',
            { lnurlParams: { tag: 'payRequest' } }
        ]);

        view.autoGenerateInvoice('1000');
        await flush();
        view.validateAddress('not a card');
        await flush();
        expect(InvoicesStore.createUnifiedInvoice).toHaveBeenCalledTimes(1);
        shown.resolve({ rHash: 'hash-shown', paymentRequest: 'lnbc-shown' });
        await flush();

        expect(view.setState).toHaveBeenCalledWith({ nfcError: true });
        expect(view.subscribeInvoice).toHaveBeenCalledWith(
            'hash-shown',
            undefined
        );
    });
});

// What the payer and the user see next to an LSP-wrapped invoice: the fee
// row and the amount under the QR. Both have to come from the quote the
// shown invoice was priced with.
describe('Receive LSP fee shown with the invoice', () => {
    beforeEach(() => jest.clearAllMocks());

    const collect = (node: any, out: any[] = []): any[] => {
        if (Array.isArray(node)) {
            node.forEach((n) => collect(n, out));
        } else if (node && typeof node === 'object' && node.props) {
            out.push(node);
            collect(node.props.children, out);
        }
        return out;
    };

    const makeShownView = ({
        invoicesStore,
        lspStore,
        posStore,
        satAmount
    }: {
        invoicesStore: any;
        lspStore: any;
        posStore?: any;
        satAmount: string;
    }) => {
        const view = new Receive({
            navigation: { navigate: jest.fn(), addListener: jest.fn() },
            route: { params: {} },
            SettingsStore: { settings: {}, implementation: 'embedded-lnd' },
            NodeInfoStore: { nodeInfo: {}, testnet: false },
            // the same object, so the test sees what the view writes to it
            InvoicesStore: Object.assign(invoicesStore, {
                onChainAddress: null,
                creatingInvoice: false,
                creatingInvoiceError: false,
                ...invoicesStore
            }),
            LSPStore: { flow_error_msg: '', ...lspStore },
            PosStore: posStore,
            UnitsStore: {},
            LightningAddressStore: {},
            ChannelsStore: {},
            ModalStore: {}
        } as unknown as React.ComponentProps<typeof Receive>);
        view.state = {
            ...view.state,
            selectedIndex: 1,
            satAmount,
            value: satAmount,
            initialLoad: false
        };
        return view;
    };

    const shown = (view: any) => {
        const elements = collect(view.render());
        const feeRow = elements.find(
            (e) => e.type === 'Amount' && e.props.fixedUnits === 'sats'
        );
        const qr = elements.find((e) => e.type === 'CollapsedQR');
        return {
            fee: feeRow?.props.sats,
            qrAmount: qr?.props.satAmount?.toString()
        };
    };

    it('shows the fee the invoice was priced with after a later quote replaces the shared one', () => {
        // invoice for 1,000 sats wrapped with a 10,000 sat fee on top; a
        // later fee request (e.g. a Swaps preview) left 2,000 in LSPStore
        const view = makeShownView({
            invoicesStore: {
                payment_request: 'lnbc-wrapped',
                payment_request_amt: '1000',
                payment_request_lsp_fee: 10000
            },
            lspStore: { zeroConfFee: 2000 },
            satAmount: '1000'
        });

        expect(shown(view)).toEqual({ fee: 10000, qrAmount: '11000' });
    });

    it('shows the recorded fee for a reused POS invoice, not the last quote', async () => {
        // order A (1,000 sats, 10,000 fee on top) is reopened after order B
        // (50,000 sats, 2,000 fee) left its quote and amount in the stores
        const invoicesStore: any = {
            payment_request: null,
            payment_request_amt: '50000',
            payment_request_lsp_fee: 2000,
            createUnifiedInvoice: jest.fn(),
            showStoredInvoice: jest.fn(
                ({ paymentRequest, amount, lspFeeSats }: any) => {
                    invoicesStore.payment_request = paymentRequest;
                    invoicesStore.payment_request_amt = amount;
                    invoicesStore.payment_request_lsp_fee = lspFeeSats;
                }
            )
        };
        const posStore = {
            getOrderInvoiceById: jest.fn(() =>
                Promise.resolve({
                    orderId: 'A',
                    payment_request: 'lnbc-wrapped-a',
                    lspFeeSats: 10000,
                    rHash: 'hash-a',
                    exchangeRate: '',
                    amount: '1000',
                    tip: '',
                    createdAt: 0,
                    expirySeconds: '3600'
                })
            ),
            canReuseInvoice: jest.fn(() => true)
        };
        const view = makeShownView({
            invoicesStore,
            lspStore: { zeroConfFee: 2000 },
            posStore,
            satAmount: '1000'
        });
        view.state = { ...view.state, orderId: 'A' };

        view.autoGenerateInvoice('1000');
        await new Promise(process.nextTick);

        expect(invoicesStore.createUnifiedInvoice).not.toHaveBeenCalled();
        expect(invoicesStore.showStoredInvoice).toHaveBeenCalledWith({
            paymentRequest: 'lnbc-wrapped-a',
            amount: '1000',
            lspFeeSats: 10000
        });
        expect(invoicesStore.payment_request).toBe('lnbc-wrapped-a');
        expect(shown(view)).toEqual({ fee: 10000, qrAmount: '11000' });
    });

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

    const texts = (view: any) =>
        collect(view.render())
            .filter((e) => e.type === 'Text')
            .flatMap((e) => [].concat(e.props.children));

    it('shows the wrapped-invoice note for a fee of 0, with no bare text outside Text', () => {
        const view = makeShownView({
            invoicesStore: {
                payment_request: 'lnbc-wrapped',
                payment_request_amt: '1000',
                payment_request_lsp_fee: 0
            },
            lspStore: {},
            satAmount: '1000'
        });

        expect(bareText(view.render())).toEqual([]);
        expect(texts(view)).toContain(
            'views.Receive.lspExplainerZeroFeeWrapper'
        );
        expect(shown(view)).toEqual({ fee: undefined, qrAmount: '1000' });
    });

    it('renders no bare text outside Text for a fee on top', () => {
        const view = makeShownView({
            invoicesStore: {
                payment_request: 'lnbc-wrapped',
                payment_request_amt: '1000',
                payment_request_lsp_fee: 10000
            },
            lspStore: {},
            satAmount: '1000'
        });

        expect(bareText(view.render())).toEqual([]);
    });
});
