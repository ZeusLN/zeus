jest.mock('react-native-blob-util', () => ({}));
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
jest.mock('../../utils/NFCUtils', () => ({
    isNfcWithdraw: jest.requireActual('../../utils/NFCUtils').isNfcWithdraw,
    scanNfcTag: jest.fn()
}));
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
import { Alert } from 'react-native';
import {
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react-native';
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
const WITHDRAW_RESPONSE = [
    'ChoosePaymentMethod',
    { lnurlParams: withdrawParams }
];

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

        expect(navigate).toHaveBeenCalledWith('ChoosePaymentMethod', {
            satAmount: 25000,
            lnurlParams: withdrawParams
        });
    });

    it('opens the next screen when no amount was entered', async () => {
        const { view, navigate, CashuStore } = makeView('', 0);

        await view.scanNfc();
        await flush();

        expect(CashuStore.createInvoice).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('ChoosePaymentMethod', {
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

describe('ReceiveEcash Cancel', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.useRealTimers());

    it('stops checking the invoice it clears', () => {
        jest.useFakeTimers();
        const { view, CashuStore, subscribeInvoice } = makeView('1000', 1000);

        subscribeInvoice();
        view.cancelInvoice();
        jest.advanceTimersByTime(9000);

        expect(CashuStore.clearInvoice).toHaveBeenCalled();
        expect(CashuStore.checkInvoicePaid).not.toHaveBeenCalled();
    });

    it('does not show a payment to the cancelled invoice as paid', async () => {
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
        // the check is in flight when Cancel is tapped
        view.cancelInvoice();
        answer({ isPaid: true, amtSat: 1000, paymentRequest: 'lnbc1' });
        await flush();

        expect(CashuStore.setWatchedInvoicePaid).not.toHaveBeenCalled();
        // the payment still counts for the order
        expect(PosStore.recordPayment).toHaveBeenCalledWith(
            expect.objectContaining({ orderId: 'order', tx: 'lnbc1' })
        );
    });

    it('keeps checking the newer invoice when a check of the replaced one answers', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        const answers: Array<(response: any) => void> = [];
        const checkInvoicePaid = jest.fn(
            () => new Promise((resolve) => answers.push(resolve))
        );
        const { view, CashuStore, subscribeInvoice } = makeView('1000', 1000, {
            checkInvoicePaid
        });

        subscribeInvoice();
        jest.advanceTimersByTime(3000);
        subscribeInvoice();
        answers[0]({ isPaid: true, amtSat: 1000, paymentRequest: 'lnbc1' });
        await flush();
        jest.advanceTimersByTime(3000);

        expect(CashuStore.setWatchedInvoicePaid).not.toHaveBeenCalled();
        expect(checkInvoicePaid).toHaveBeenCalledTimes(2);
        view.componentWillUnmount();
    });
});

// what Pay via NFC does once the tag resolves to `response`
const scanTag = async (
    response: any,
    amount: string,
    createFails = false,
    readFails: boolean | Error = false
) => {
    const navigate = jest.fn();
    const createInvoice = jest.fn(() =>
        createFails ? Promise.reject(new Error('offline')) : Promise.resolve()
    );
    const view = new ReceiveEcash({
        navigation: { navigate },
        route: { params: { amount } },
        CashuStore: { createInvoice },
        LightningAddressStore: {},
        ModalStore: {},
        NodeInfoStore: {},
        SettingsStore: { posStatus: 'active', settings: {} }
    } as unknown as React.ComponentProps<typeof ReceiveEcash>);
    view.state = { ...view.state, satAmount: Number(amount) };
    view.subscribeInvoice = jest.fn();
    view.setState = jest.fn();
    (scanNfcTag as jest.Mock).mockResolvedValue('tag text');
    if (readFails) {
        (handleAnything as jest.Mock).mockRejectedValue(
            readFails instanceof Error ? readFails : new Error('unsupported')
        );
    } else {
        (handleAnything as jest.Mock).mockResolvedValue(response);
    }

    await view.scanNfc();
    await new Promise((resolve) => setImmediate(resolve));
    return { navigate, createInvoice, setState: view.setState as jest.Mock };
};

describe('ReceiveEcash.validateAddress (Pay via NFC)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('creates an invoice for an LNURL-withdraw card when an amount is set', async () => {
        const { navigate, createInvoice } = await scanTag(
            ['ChoosePaymentMethod', { lnurlParams: withdrawParams }],
            '1000'
        );

        expect(createInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ value: '1000', lnurl: withdrawParams })
        );
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens the receive method choice for an LNURL-withdraw card on a zero amount', async () => {
        const props = { lnurlParams: withdrawParams };
        const { navigate } = await scanTag(['ChoosePaymentMethod', props], '0');

        expect(navigate).toHaveBeenCalledWith('ChoosePaymentMethod', props);
    });

    it('clears the NFC error on a new read and keeps it off for a withdraw card', async () => {
        const { setState } = await scanTag(
            ['ChoosePaymentMethod', { lnurlParams: withdrawParams }],
            '0'
        );

        expect(setState).toHaveBeenCalledWith({ nfcError: false });
        expect(setState).not.toHaveBeenCalledWith({ nfcError: true });
    });

    it('shows the NFC error when the tag cannot be read as a payment code', async () => {
        const { navigate, setState } = await scanTag(
            undefined,
            '0',
            false,
            true
        );

        expect(navigate).not.toHaveBeenCalled();
        expect(setState).toHaveBeenLastCalledWith({ nfcError: true });
    });

    it('shows the host policy refusal instead of the NFC error', async () => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const refusal = Object.assign(new Error('unsafe address'), {
            name: 'UnsafeLnurlError'
        });
        const { navigate, setState } = await scanTag(
            undefined,
            '0',
            false,
            refusal
        );

        expect(navigate).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
            'general.error',
            'unsafe address'
        );
        expect(setState).not.toHaveBeenCalledWith({ nfcError: true });
    });

    it.each([
        ['LnurlPay', { tag: 'payRequest', defaultDescription: 'x' }],
        // Lightning address: the server picks the tag
        ['LnurlPay', { tag: 'withdrawRequest', defaultDescription: 'x' }],
        ['LnurlChannel', { tag: 'channelRequest', defaultDescription: 'x' }],
        ['LnurlAuth', { tag: 'login', defaultDescription: 'x' }]
    ])('opens no screen for a %s result (%j)', async (route, lnurlParams) => {
        const zero = await scanTag([route, { lnurlParams }], '0');
        expect(zero.navigate).not.toHaveBeenCalled();
        expect(zero.setState).toHaveBeenLastCalledWith({ nfcError: true });

        const failed = await scanTag([route, { lnurlParams }], '1000', true);
        expect(failed.createInvoice).not.toHaveBeenCalled();
        expect(failed.navigate).not.toHaveBeenCalled();
    });
});

// The tag's LNURL server answers whenever it does: by then the staff may
// have read another card, created another invoice or tapped Cancel
describe('ReceiveEcash NFC lookups that were superseded', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        let reject: (error: any) => void = () => {};
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    beforeEach(() => jest.clearAllMocks());

    const setup = () => {
        const made = makeView('1000', 1000);
        made.view.setState = jest.fn();
        return made;
    };

    it('creates one invoice when an older card answers after a newer one', async () => {
        const { view, CashuStore } = setup();
        const cardA = deferred();
        (handleAnything as jest.Mock)
            .mockReturnValueOnce(cardA.promise)
            .mockResolvedValueOnce(WITHDRAW_RESPONSE);

        view.validateAddress('card A');
        view.validateAddress('card B');
        await flush();
        cardA.resolve(WITHDRAW_RESPONSE);
        await flush();

        expect(CashuStore.createInvoice).toHaveBeenCalledTimes(1);
    });

    it('does not withdraw for a card that answers after a newer invoice was requested', async () => {
        const { view, CashuStore } = setup();
        const cardA = deferred();
        (handleAnything as jest.Mock).mockReturnValueOnce(cardA.promise);

        view.validateAddress('card A');
        view.autoGenerateInvoice('2000');
        await flush();
        cardA.resolve(WITHDRAW_RESPONSE);
        await flush();

        expect(CashuStore.createInvoice).toHaveBeenCalledTimes(1);
        expect(CashuStore.createInvoice).not.toHaveBeenCalledWith(
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
        const { view, navigate, CashuStore } = setup();
        const lookup = deferred();
        (handleAnything as jest.Mock).mockReturnValueOnce(lookup.promise);

        view.validateAddress('card A');
        view.cancelInvoice();
        answer().then(lookup.resolve, lookup.reject);
        await flush();

        expect(CashuStore.createInvoice).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(view.setState).not.toHaveBeenCalled();
    });

    it.each([
        ['is created', (request: any) => request.resolve(undefined)],
        ['fails', (request: any) => request.reject(new Error('offline'))]
    ])(
        'checks nothing and opens nothing when a cancelled invoice %s',
        async (_, settle) => {
            const { view, navigate, CashuStore } = setup();
            const request = deferred();
            CashuStore.createInvoice.mockReturnValueOnce(request.promise);
            (handleAnything as jest.Mock).mockResolvedValueOnce(
                WITHDRAW_RESPONSE
            );

            view.validateAddress('card A');
            await flush();
            expect(CashuStore.createInvoice).toHaveBeenCalled();
            view.cancelInvoice();
            settle(request);
            await flush();

            expect(view.subscribeInvoice).not.toHaveBeenCalled();
            expect(navigate).not.toHaveBeenCalled();
        }
    );

    it('checks nothing for an invoice created after Cancel', async () => {
        const { view, CashuStore } = setup();
        const request = deferred();
        CashuStore.createInvoice.mockReturnValueOnce(request.promise);

        view.autoGenerateInvoice('1000');
        view.cancelInvoice();
        request.resolve(undefined);
        await flush();

        expect(view.subscribeInvoice).not.toHaveBeenCalled();
    });

    it('still checks the invoice on screen after a tap that is not a withdraw', async () => {
        const { view, CashuStore } = setup();
        const shown = deferred();
        CashuStore.createInvoice.mockReturnValueOnce(shown.promise);
        (handleAnything as jest.Mock).mockResolvedValueOnce([
            'LnurlPay',
            { lnurlParams: { tag: 'payRequest' } }
        ]);

        view.autoGenerateInvoice('1000');
        view.validateAddress('not a card');
        await flush();
        shown.resolve(undefined);
        await flush();

        expect(view.setState).toHaveBeenCalledWith({ nfcError: true });
        expect(view.subscribeInvoice).toHaveBeenCalledTimes(1);
    });
});

describe('ReceiveEcash Lightning address tab', () => {
    // An invoice on screen, the Lightning address tab selected and no
    // ZEUS Pay address yet
    const renderTab = async () => {
        const navigate = jest.fn();
        await render(
            <ReceiveEcash
                {...({
                    navigation: { navigate },
                    route: { params: { selectedIndex: 1 } },
                    CashuStore: {
                        invoice: 'lnbc1invoice',
                        clearInvoice: jest.fn()
                    },
                    LightningAddressStore: { lightningAddress: '' },
                    ModalStore: {},
                    NodeInfoStore: {},
                    PosStore: {},
                    SettingsStore: {
                        settings: {},
                        getSettings: jest.fn(() => Promise.resolve({}))
                    },
                    UnitsStore: {}
                } as any)}
            />
        );
        return navigate;
    };

    const createButton = () =>
        screen.root!.queryAll(
            (node: any) =>
                node.props.title === 'views.Receive.createLightningAddress'
        )[0];

    it('opens the Create Lightning address screen', async () => {
        const navigate = await renderTab();
        await waitFor(() => expect(createButton()).toBeTruthy());

        await fireEvent.press(createButton());

        expect(navigate).toHaveBeenCalledWith('CreateCashuLightningAddress');
    });
});
