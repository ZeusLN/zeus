jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    ButtonGroup: 'ButtonGroup',
    Icon: 'Icon'
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../../utils/AmountUtils', () => ({ getAmountFromSats: jest.fn() }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/AmountInput', () => ({
    __esModule: true,
    default: 'AmountInput',
    getSatAmount: (amount: string) => Number(amount || 0)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/CollapsedQR', () => 'CollapsedQR');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/HopPicker', () => 'HopPicker');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/PaidIndicator', () => 'PaidIndicator');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/SuccessAnimation', () => 'SuccessAnimation');
jest.mock('../../components/SuccessErrorMessage', () => ({
    SuccessMessage: 'SuccessMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/SVG/LightningSvg', () => 'LightningSvg');
jest.mock('../../components/SVG/AddressSvg', () => 'AddressSvg');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../../assets/images/SVG/NFC-alt.svg', () => 'NfcIcon');
jest.mock('../../models/CashuInvoice', () => class CashuInvoice {});
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/PosStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../stores/UnitsStore', () => ({}));

import * as React from 'react';
import ReceiveEcash from './ReceiveEcash';
import handleAnything from '../../utils/handleAnything';
import { scanNfcTag } from '../../utils/NFCUtils';

const withdrawParams = {
    tag: 'withdrawRequest',
    callback: 'https://card.example/withdraw',
    k1: 'k1',
    minWithdrawable: 1000,
    maxWithdrawable: 1000000,
    defaultDescription: 'card'
};
const WITHDRAW_RESPONSE = ['ReceiveEcash', { lnurlParams: withdrawParams }];

const flush = () => new Promise((resolve) => setImmediate(resolve));

// ReceiveEcash opened from the POS keypad with `amount` in the display unit
// of that moment, already converted to `satAmount`
const makeView = (amount: string, satAmount: number, cashuStore: any = {}) => {
    const navigate = jest.fn();
    const CashuStore = {
        createInvoice: jest.fn(() => Promise.resolve()),
        clearInvoice: jest.fn(),
        checkInvoicePaid: jest.fn(() => Promise.resolve({})),
        setWatchedInvoicePaid: jest.fn(),
        quoteId: 'quote',
        selectedMintUrl: 'https://mint.example',
        ...cashuStore
    };
    const PosStore = { recordPayment: jest.fn() };
    const view = new ReceiveEcash({
        navigation: { navigate },
        route: { params: { amount } },
        CashuStore,
        ModalStore: {},
        NodeInfoStore: {},
        PosStore,
        SettingsStore: { posStatus: 'active', settings: {} }
    } as unknown as React.ComponentProps<typeof ReceiveEcash>);
    view.state = { ...view.state, value: amount, satAmount, orderId: 'order' };
    // the interval tests below call the real one; a leaked interval would
    // otherwise keep Jest alive
    const subscribeInvoice = view.subscribeInvoice;
    view.subscribeInvoice = jest.fn();
    return { view, navigate, CashuStore, PosStore, subscribeInvoice };
};

describe('ReceiveEcash NFC scan', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
        (handleAnything as unknown as jest.Mock).mockResolvedValue(
            WITHDRAW_RESPONSE
        );
    });

    it('withdraws the sats of the invoice on screen, not the route param', async () => {
        // opened with 25.00 in fiat (25,000 sats); by the time the tag is
        // read the amount under the QR code was tapped and converting the
        // route param again reads '25.00' as 25 sats
        const { view, navigate, CashuStore } = makeView('25.00', 25000);

        await view.scanNfc();
        await flush();

        expect(handleAnything).toHaveBeenCalledWith('tag text', '25000');
        expect(CashuStore.createInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ value: '25000', lnurl: withdrawParams })
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it('hands the sats on screen on when creating the invoice fails', async () => {
        const { view, navigate } = makeView('25.00', 25000, {
            createInvoice: jest.fn(() => Promise.reject(new Error()))
        });

        await view.scanNfc();
        await flush();

        expect(navigate).toHaveBeenCalledWith('ReceiveEcash', {
            satAmount: 25000,
            lnurlParams: withdrawParams
        });
    });

    it('opens the next screen when no amount was entered', async () => {
        const { view, navigate, CashuStore } = makeView('', 0);

        await view.scanNfc();
        await flush();

        expect(CashuStore.createInvoice).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('ReceiveEcash', {
            lnurlParams: withdrawParams
        });
    });
});

// CashuStore is shared with whatever ReceiveEcash view is shown next, so
// work of a view that was left must not land in it
describe('ReceiveEcash after the view was left', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.useRealTimers());

    it.each([
        ['an amount', '1000', 1000],
        ['no amount', '', 0]
    ])(
        'ignores an LNURL server that answers late, with %s',
        async (_, amount, satAmount) => {
            const { view, navigate, CashuStore } = makeView(amount, satAmount);
            let answer: (response: any) => void = () => {};
            (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
            (handleAnything as unknown as jest.Mock).mockReturnValue(
                new Promise((resolve) => (answer = resolve))
            );

            await view.scanNfc();
            view.componentWillUnmount();
            answer(WITHDRAW_RESPONSE);
            await flush();

            expect(CashuStore.createInvoice).not.toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
        }
    );

    it('ignores a tag that is read late', async () => {
        const { view } = makeView('1000', 1000);
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

    it('checks the invoice only while mounted', () => {
        jest.useFakeTimers();
        const { view, CashuStore, subscribeInvoice } = makeView('1000', 1000);

        // the second invoice of a view replaces the first
        subscribeInvoice();
        subscribeInvoice();
        jest.advanceTimersByTime(3000);
        expect(CashuStore.checkInvoicePaid).toHaveBeenCalledTimes(1);

        view.componentWillUnmount();
        subscribeInvoice();
        jest.advanceTimersByTime(3000);
        expect(CashuStore.checkInvoicePaid).toHaveBeenCalledTimes(1);
    });

    it('records a late payment for its order without showing it as paid', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        let answer: (response: any) => void = () => {};
        const { view, CashuStore, PosStore, subscribeInvoice } = makeView(
            '1000',
            1000,
            {
                checkInvoicePaid: () =>
                    new Promise((resolve) => (answer = resolve))
            }
        );

        subscribeInvoice();
        jest.advanceTimersByTime(3000);
        view.componentWillUnmount();
        answer({ isPaid: true, amtSat: 1000, paymentRequest: 'lnbc1' });
        await flush();

        expect(CashuStore.setWatchedInvoicePaid).not.toHaveBeenCalled();
        expect(PosStore.recordPayment).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order', tx: 'lnbc1' })
        );
    });
});
