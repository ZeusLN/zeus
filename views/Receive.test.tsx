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
jest.mock('../utils/BackendUtils', () => ({
    watchInvoicePaid: jest.fn(() => jest.fn()),
    watchOnchainReceived: jest.fn(() => jest.fn())
}));
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
jest.mock('../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../utils/UnitsUtils', () => ({ SATS_PER_BTC: 100000000 }));
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

const withdrawParams = {
    tag: 'withdrawRequest',
    callback: 'https://card.example/withdraw',
    k1: 'k1',
    minWithdrawable: 1000,
    maxWithdrawable: 1000000,
    defaultDescription: 'card'
};
const WITHDRAW_RESPONSE = ['Receive', { lnurlParams: withdrawParams }];

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
