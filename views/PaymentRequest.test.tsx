jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// the pay screens render PaymentInFlightNotice, which reads screen focus
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../stores/Stores');
jest.mock('../utils/LocaleUtils');
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    supportsLightningSends: () => true,
    supportsMPP: () => false,
    supportsAMP: () => false,
    supportsCustomFeeLimit: jest.fn(() => false),
    supportsHopPicking: () => false
}));
jest.mock('../utils/DonationUtils', () => ({
    calculateDonationAmount: (amount: number, percentage: number) =>
        (amount * percentage) / 100,
    findDonationPercentageIndex: (percentage: number, options: number[]) =>
        options.indexOf(percentage)
}));
jest.mock('../utils/LinkingUtils', () => ({}));
jest.mock('../utils/GraphSyncUtils', () => ({
    clearPendingPaymentData: jest.fn(() => Promise.resolve())
}));
jest.mock('../components/AmountInput', () => {
    const { View } = require('react-native');
    // exposes onAmountChange so tests can enter an amount
    return (props: any) => <View testID="AmountInput" {...props} />;
});
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/Conversion', () => 'Conversion');
jest.mock('../components/FeeLimit', () => 'FeeLimit');
jest.mock('../components/Accordion', () => 'Accordion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/HopPicker', () => 'HopPicker');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/Text', () => {
    const { Text } = require('react-native');
    return ({ children }: any) => <Text>{children}</Text>;
});
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../utils/SleepUtils', () => ({
    // yield to the macrotask queue so the polling loop can't starve the test
    sleep: jest.fn(() => new Promise((resolve) => setImmediate(resolve)))
}));

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Invoice from '../models/Invoice';
import BackendUtils from '../utils/BackendUtils';
import { clearPendingPaymentData } from '../utils/GraphSyncUtils';
import PaymentRequest, { PaymentRequestView } from './PaymentRequest';

const PAY = 'views.PaymentRequest.payInvoice';
const GETTING_READY = 'views.PaymentRequest.lndGettingReady';
const ENTER_AMOUNT = 'views.PaymentRequest.enterAmount';
const NO_PAY_REQ = 'views.PaymentRequest.noPayReq';

const PAYMENT_REQUEST = 'lnbc10u1example';

// a decoded 1,000 sat invoice that never expires during a test
const payReq = {
    getRequestAmount: 1000,
    determineFormattedOriginalTimeUntilExpiry: jest.fn(),
    isExpiredNow: () => false,
    formattedOriginalTimeUntilExpiry: '1 hour',
    payment_hash: 'ab'.repeat(32),
    destination: '02' + 'cd'.repeat(32)
};

const NO_ESTIMATE = { feeEstimate: null, successProbability: null };

// InvoicesStore as the screen uses it: it decodes what it is asked to and
// keeps nothing
const makeInvoicesStore = (payReqOverrides: object = {}) => ({
    getPayReq: jest.fn(
        async (paymentRequest: string): Promise<any> => ({
            ...payReq,
            ...payReqOverrides,
            paymentRequest
        })
    ),
    getRouteEstimate: jest.fn(async (): Promise<any> => NO_ESTIMATE)
});

const flush = () =>
    act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
    });

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const makeProps = ({
    implementation = 'embedded-lnd',
    lightningBalance = 50000,
    isLightningReadyToSend = jest.fn().mockResolvedValue(true),
    getSettings = jest.fn(async () => ({ payments: {} })),
    payReqOverrides = {},
    routeParams = { paymentRequest: PAYMENT_REQUEST },
    InvoicesStore = makeInvoicesStore(payReqOverrides),
    TransactionsStore = { paymentInFlight: false }
}: {
    payReqOverrides?: object;
    routeParams?: object | null;
    TransactionsStore?: object;
    implementation?: string;
    lightningBalance?: number;
    isLightningReadyToSend?: jest.Mock;
    getSettings?: jest.Mock;
    InvoicesStore?: any;
} = {}) => {
    const BalanceStore = {
        lightningBalance,
        getLightningBalance: jest.fn()
    };
    const listeners: { [event: string]: Array<() => void> } = {};
    const navigation = {
        addListener: jest.fn((event: string, callback: () => void) => {
            (listeners[event] = listeners[event] || []).push(callback);
            return jest.fn();
        }),
        navigate: jest.fn()
    };
    // what react-navigation does when the route is focused
    const emit = (event: string) =>
        (listeners[event] || []).forEach((callback) => callback());
    const props: any = {
        navigation,
        // null stands for a route without params
        route: { params: routeParams ?? undefined },
        BalanceStore,
        SettingsStore: {
            implementation,
            settings: { payments: {} },
            getSettings
        },
        InvoicesStore,
        NodeInfoStore: { nodeInfo: {}, isLightningReadyToSend },
        TransactionsStore,
        LnurlPayStore: {},
        UnitsStore: {},
        ChannelsStore: {}
    };
    return { props, BalanceStore, InvoicesStore, navigation, emit };
};

// mounts one review and lets its decode, route estimate and settings land
const renderView = async ({
    ref,
    ...options
}: Parameters<typeof makeProps>[0] & { ref?: React.Ref<any> } = {}) => {
    const made = makeProps(options);
    const result = await render(
        <PaymentRequestView ref={ref} {...made.props} />
    );
    await flush();
    return { ...made, ...result };
};

const payButton = () => screen.getByRole('button', { name: PAY });
const queryPayButton = () => screen.queryByRole('button', { name: PAY });
const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);
const keyValue = (key: string) =>
    hosts('KeyValue').find((n) => n.props.keyValue === key);

describe('PaymentRequest mount', () => {
    it('refreshes the lightning balance on mount without awaiting settings', async () => {
        // never resolves: the refresh must start before settings load
        const { BalanceStore } = await renderView({
            getSettings: jest.fn(() => new Promise(() => {}))
        });

        expect(BalanceStore.getLightningBalance).toHaveBeenCalledWith(true);
    });

    it('is ready to pay at once on a remote node', async () => {
        const isLightningReadyToSend = jest.fn();
        await renderView({ implementation: 'lnd', isLightningReadyToSend });

        expect(payButton()).toBeEnabled();
        expect(screen.queryByText(GETTING_READY)).not.toBeOnTheScreen();
        expect(isLightningReadyToSend).not.toHaveBeenCalled();
    });

    it('clears the pending graph sync payment it was opened for', async () => {
        (clearPendingPaymentData as jest.Mock).mockClear();
        await renderView({
            implementation: 'lnd',
            routeParams: {
                paymentRequest: PAYMENT_REQUEST,
                fromGraphSync: true
            }
        });

        expect(clearPendingPaymentData).toHaveBeenCalledTimes(1);
    });

    it('leaves pending graph sync data alone otherwise', async () => {
        (clearPendingPaymentData as jest.Mock).mockClear();
        await renderView({ implementation: 'lnd' });

        expect(clearPendingPaymentData).not.toHaveBeenCalled();
    });
});

// The screen decodes the request in its route params and holds the result
// itself, instead of showing whatever decode sits in InvoicesStore
describe('PaymentRequest decode', () => {
    it('decodes the payment request it was opened with', async () => {
        const { InvoicesStore } = await renderView({ implementation: 'lnd' });

        expect(InvoicesStore.getPayReq).toHaveBeenCalledTimes(1);
        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith(PAYMENT_REQUEST);
        expect(payButton()).toBeEnabled();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
    });

    it('starts the decode before the settings are loaded', async () => {
        const { InvoicesStore } = await renderView({
            getSettings: jest.fn(() => new Promise(() => {}))
        });

        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith(PAYMENT_REQUEST);
        // the invoice waits for the settings its donation is derived from
        expect(queryPayButton()).not.toBeOnTheScreen();
    });

    it('shows a spinner and no invoice while the decode is in flight', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockReturnValue(new Promise(() => {}));
        await renderView({ implementation: 'lnd', InvoicesStore });

        expect(hosts('LoadingIndicator')).toHaveLength(1);
        expect(queryPayButton()).not.toBeOnTheScreen();
        expect(InvoicesStore.getRouteEstimate).not.toHaveBeenCalled();
    });

    it('shows the invoice once its route estimate is in, with the fee and success probability', async () => {
        const estimate = deferred<any>();
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate.mockReturnValue(estimate.promise);
        await renderView({ implementation: 'lnd', InvoicesStore });

        expect(InvoicesStore.getRouteEstimate).toHaveBeenCalledWith(
            expect.objectContaining({ paymentRequest: PAYMENT_REQUEST })
        );
        expect(hosts('LoadingIndicator')).toHaveLength(1);
        expect(queryPayButton()).not.toBeOnTheScreen();

        estimate.resolve({ feeEstimate: 7, successProbability: 90 });
        await flush();

        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(payButton()).toBeEnabled();
        expect(
            keyValue('views.PaymentRequest.successProbability')!.props.value
        ).toBe('90%');
        expect(
            keyValue('views.PaymentRequest.feeEstimate')!.props.value.props.sats
        ).toBe(7);
        // FeeLimit compares its limit with the estimate of this invoice
        expect(hosts('FeeLimit')[0].props.feeEstimate).toBe(7);
    });

    it('passes the fee estimate to the FeeLimit shown on a backend with a custom fee limit', async () => {
        jest.mocked(BackendUtils.supportsCustomFeeLimit).mockReturnValue(true);
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate.mockResolvedValue({
            feeEstimate: 7,
            successProbability: 90
        });
        await renderView({ implementation: 'lnd', InvoicesStore });
        jest.mocked(BackendUtils.supportsCustomFeeLimit).mockReturnValue(false);

        const feeLimits = hosts('FeeLimit');
        expect(feeLimits).toHaveLength(1);
        expect(feeLimits[0].props).toMatchObject({
            feeEstimate: 7,
            hide: false
        });
    });

    it('shows a 0 sat fee estimate, and no fee row without an estimate', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate.mockResolvedValue({
            feeEstimate: 0,
            successProbability: 0
        });
        const first = await renderView({
            implementation: 'lnd',
            InvoicesStore
        });

        expect(
            keyValue('views.PaymentRequest.feeEstimate')!.props.value.props.sats
        ).toBe(0);
        expect(
            keyValue('views.PaymentRequest.successProbability')
        ).toBeUndefined();

        await first.unmount();
        await renderView({ implementation: 'lnd' });

        expect(keyValue('views.PaymentRequest.feeEstimate')).toBeUndefined();
    });

    it('shows the decode error and nothing to pay when the decode fails', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockRejectedValue(new Error('decode failed'));
        await renderView({ implementation: 'lnd', InvoicesStore });

        expect(
            screen.getByText('views.PaymentRequest.error: decode failed')
        ).toBeOnTheScreen();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(queryPayButton()).not.toBeOnTheScreen();
        expect(InvoicesStore.getRouteEstimate).not.toHaveBeenCalled();
    });

    it('derives the fee mode and donation from the decoded invoice', async () => {
        const ref = React.createRef<any>();
        const getSettings = jest.fn(async () => ({
            payments: { defaultDonationPercentage: 10 }
        }));
        await renderView({
            implementation: 'lnd',
            getSettings,
            payReqOverrides: { getRequestAmount: 2000 },
            ref
        });

        expect(ref.current.state).toMatchObject({
            feeOption: 'percent',
            donationPercentage: 10,
            donationAmount: 200,
            selectedIndex: 1
        });
        // FeeLimit reads the fee mode once, when it mounts
        expect(hosts('FeeLimit')[0].props.feeOption).toBe('percent');
    });

    it('keeps the fixed fee mode and no donation for a small invoice without a default', async () => {
        const ref = React.createRef<any>();
        await renderView({ implementation: 'lnd', ref });

        expect(ref.current.state).toMatchObject({
            feeOption: 'fixed',
            donationPercentage: 0,
            donationAmount: 0
        });
    });

    it('starts no route query when the screen is left during the decode', async () => {
        const decode = deferred<any>();
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockReturnValue(decode.promise);
        const { unmount } = await renderView({
            implementation: 'lnd',
            InvoicesStore
        });

        await unmount();
        decode.resolve({ ...payReq, paymentRequest: PAYMENT_REQUEST });
        await flush();

        expect(InvoicesStore.getRouteEstimate).not.toHaveBeenCalled();
    });
});

// Any entry point that forgets the param must fail where the user sees it
describe('PaymentRequest without a payment request', () => {
    it.each([
        ['no params', null],
        ['empty params', {}],
        ['an empty request', { paymentRequest: '' }]
    ])('shows an error and decodes nothing with %s', async (_, routeParams) => {
        const { InvoicesStore } = await renderView({
            implementation: 'lnd',
            routeParams
        });

        const [error] = hosts('ErrorMessage');
        expect(error.props.message).toBe(NO_PAY_REQ);
        expect(InvoicesStore.getPayReq).not.toHaveBeenCalled();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(queryPayButton()).not.toBeOnTheScreen();
        // no QR of a request that isn't there
        expect(hosts('Header')[0].props.rightComponent).toBeUndefined();
    });

    it('shows no such error for a request that is loading or decoded', async () => {
        await renderView({ implementation: 'lnd' });

        expect(hosts('ErrorMessage')).toHaveLength(0);
        expect(hosts('Header')[0].props.rightComponent).toBeDefined();
    });

    it('refuses to pay from triggerPayment', async () => {
        const ref = React.createRef<any>();
        await renderView({ implementation: 'lnd', routeParams: {}, ref });
        const view = ref.current;
        view.sendPayment = jest.fn();
        // as if a decode had landed anyway
        await act(async () =>
            view.setState({ pay_req: { ...payReq }, satAmount: 500 })
        );

        await act(async () => view.triggerPayment());

        expect(view.sendPayment).not.toHaveBeenCalled();
    });
});

// "Review invoice A, pay invoice B": the invoice shown and the string paid
// both come from this screen's route param, so a decode made anywhere else
// can't come between them
describe('PaymentRequest pays the request it shows', () => {
    const setup = async (options: Parameters<typeof renderView>[0] = {}) => {
        const sendPayment = jest.fn();
        const view = await renderView({
            implementation: 'lnd',
            TransactionsStore: { paymentInFlight: false, sendPayment },
            ...options
        });
        return { sendPayment, ...view };
    };

    it('pays the request from its route params', async () => {
        const { sendPayment } = await setup();

        await fireEvent.press(payButton());

        expect(sendPayment).toHaveBeenCalledTimes(1);
        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: PAYMENT_REQUEST,
            amount: undefined
        });
    });

    it('ignores another invoice held by InvoicesStore', async () => {
        // what the store held after a deep link, NFC tap or
        // ChoosePaymentMethod decoded a second invoice
        const InvoicesStore = {
            ...makeInvoicesStore(),
            paymentRequest: 'lnbc-other',
            pay_req: { ...payReq, getRequestAmount: 999999 },
            getPayReqError: 'other error',
            loading: true,
            loadingFeeEstimate: true,
            feeEstimate: 4242,
            successProbability: 1
        };
        const { sendPayment } = await setup({ InvoicesStore });

        const [amount] = screen.container.queryAll(
            (n) => n.type === 'Amount' && n.props.jumboText
        );
        expect(amount.props.sats).toBe(1000);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(screen.queryByText(/other error/)).not.toBeOnTheScreen();
        expect(keyValue('views.PaymentRequest.feeEstimate')).toBeUndefined();

        await fireEvent.press(payButton());

        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: PAYMENT_REQUEST
        });
    });

    it('keeps its invoice when another request is decoded while it is open', async () => {
        const { InvoicesStore, sendPayment } = await setup();

        await act(async () => {
            await InvoicesStore.getPayReq('lnbc-other');
        });
        await fireEvent.press(payButton());

        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: PAYMENT_REQUEST
        });
    });

    it('refuses to pay from triggerPayment before the decode is in', async () => {
        const ref = React.createRef<any>();
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockReturnValue(new Promise(() => {}));
        await setup({ InvoicesStore, ref });
        const view = ref.current;
        view.sendPayment = jest.fn();
        // an amount alone must not make an undecoded request payable
        await act(async () => view.setState({ satAmount: 500 }));

        await act(async () => view.triggerPayment());

        expect(view.sendPayment).not.toHaveBeenCalled();
    });

    it('refuses to pay an invoice that expired while it was on screen', async () => {
        let expired = false;
        const { sendPayment } = await setup({
            payReqOverrides: { isExpiredNow: () => expired }
        });
        expired = true;

        await fireEvent.press(payButton());

        expect(sendPayment).not.toHaveBeenCalled();
        expect(queryPayButton()).not.toBeOnTheScreen();
        expect(hosts('ErrorMessage')[0].props.message).toBe(
            'views.PaymentRequest.invoiceExpired'
        );
    });
});

// navigate() and popTo() to an open PaymentRequest only swap its route
// params (deep link, NFC tap or scan of a second invoice)
describe('PaymentRequest opened with another request', () => {
    const OTHER_REQUEST = 'lnbc100n1tensats';
    const noAmount = { getRequestAmount: 0 };
    const tenSats = { getRequestAmount: 10 };
    const overThreshold = { getRequestAmount: 20000 };

    // PAYMENT_REQUEST and OTHER_REQUEST decode to the given invoices
    const setup = async (first: object, other: object) => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockImplementation(
            async (paymentRequest: string) => ({
                ...payReq,
                ...(paymentRequest === OTHER_REQUEST ? other : first),
                paymentRequest
            })
        );
        const sendPayment = jest.fn();
        const made = makeProps({
            implementation: 'lnd',
            getSettings: jest.fn(async () => ({
                payments: { slideToPayThreshold: 10000 }
            })),
            InvoicesStore,
            TransactionsStore: { paymentInFlight: false, sendPayment }
        });
        const result = await render(<PaymentRequest {...made.props} />);
        await flush();
        const open = async (params: object) => {
            await result.rerender(
                <PaymentRequest {...made.props} route={{ params } as any} />
            );
            await flush();
        };
        return { ...made, ...result, sendPayment, open };
    };

    const amountInputs = () => screen.queryAllByTestId('AmountInput');
    const typeAmount = (sats: string) =>
        act(async () => amountInputs()[0].props.onAmountChange(sats, sats));
    const swipeButton = () => hosts('SwipeButton')[0];

    it('sends the typed amount with a no-amount invoice', async () => {
        const { sendPayment } = await setup(noAmount, tenSats);
        await typeAmount('100000');

        await fireEvent.press(payButton());

        expect(sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_request: PAYMENT_REQUEST,
                amount: '100000'
            })
        );
    });

    it('decodes, shows and pays the new request', async () => {
        const { InvoicesStore, sendPayment, open } = await setup(
            tenSats,
            overThreshold
        );
        expect(payButton()).toBeEnabled();

        await open({ paymentRequest: OTHER_REQUEST });

        expect(InvoicesStore.getPayReq.mock.calls).toEqual([
            [PAYMENT_REQUEST],
            [OTHER_REQUEST]
        ]);
        const [amount] = screen.container.queryAll(
            (n) => n.type === 'Amount' && n.props.jumboText
        );
        expect(amount.props.sats).toBe(20000);

        await act(async () => swipeButton().props.onSwipeSuccess());

        expect(sendPayment).toHaveBeenCalledTimes(1);
        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: OTHER_REQUEST,
            amount: undefined
        });
    });

    it('does not send an amount typed for the request it replaced', async () => {
        const { sendPayment, open } = await setup(noAmount, tenSats);
        await typeAmount('100000');

        await open({ paymentRequest: OTHER_REQUEST });
        expect(amountInputs()).toHaveLength(0);
        await fireEvent.press(payButton());

        expect(sendPayment).toHaveBeenCalledTimes(1);
        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: OTHER_REQUEST,
            amount: undefined
        });
    });

    it('starts the new request with an empty amount when it has none either', async () => {
        const { sendPayment, open } = await setup(noAmount, noAmount);
        await typeAmount('100000');

        await open({ paymentRequest: OTHER_REQUEST });

        expect(amountInputs()[0].props.amount).toBe('');
        expect(payButton()).toBeDisabled();
        expect(sendPayment).not.toHaveBeenCalled();
    });

    it('does not let a slide begun on the old request pay either request', async () => {
        const { sendPayment, open } = await setup(overThreshold, overThreshold);
        // the gesture in progress on the first request
        const oldSwipe = swipeButton().props.onSwipeSuccess;

        await open({ paymentRequest: OTHER_REQUEST });
        expect(swipeButton().props.onSwipeSuccess).not.toBe(oldSwipe);
        await act(async () => oldSwipe());

        expect(sendPayment).not.toHaveBeenCalled();
    });

    it('drops a decode of the old request that lands after the new one', async () => {
        const oldDecode = deferred<any>();
        const { InvoicesStore, sendPayment, open } = await setup(
            tenSats,
            tenSats
        );
        InvoicesStore.getPayReq.mockImplementation(
            async (paymentRequest: string) =>
                paymentRequest === OTHER_REQUEST
                    ? { ...payReq, ...tenSats, paymentRequest }
                    : oldDecode.promise
        );
        // a third request, so the first screen instance is not reused
        await open({ paymentRequest: 'lnbc-slow' });
        InvoicesStore.getRouteEstimate.mockClear();

        await open({ paymentRequest: OTHER_REQUEST });
        oldDecode.resolve({
            ...payReq,
            getRequestAmount: 999999,
            paymentRequest: 'lnbc-slow'
        });
        await flush();

        const [amount] = screen.container.queryAll(
            (n) => n.type === 'Amount' && n.props.jumboText
        );
        expect(amount.props.sats).toBe(10);
        expect(InvoicesStore.getRouteEstimate).toHaveBeenCalledTimes(1);

        await fireEvent.press(payButton());

        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: OTHER_REQUEST
        });
    });

    it('keeps the review when the same request is opened again', async () => {
        const { InvoicesStore, sendPayment, open } = await setup(
            noAmount,
            tenSats
        );
        await typeAmount('100000');

        await open({ paymentRequest: PAYMENT_REQUEST });

        expect(InvoicesStore.getPayReq).toHaveBeenCalledTimes(1);
        await fireEvent.press(payButton());
        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: PAYMENT_REQUEST,
            amount: '100000'
        });
    });

    it('shows the missing request error when the params lose the request', async () => {
        const { open } = await setup(tenSats, tenSats);

        await open({});

        expect(hosts('ErrorMessage')[0].props.message).toBe(NO_PAY_REQ);
        expect(queryPayButton()).not.toBeOnTheScreen();
    });
});

describe('PaymentRequest embedded LND readiness', () => {
    afterEach(() => jest.restoreAllMocks());

    it('becomes ready once a stale zero balance is refreshed', async () => {
        const isReady = jest.fn().mockResolvedValue(true);
        const { BalanceStore } = await renderView({
            lightningBalance: 0,
            isLightningReadyToSend: isReady
        });
        await flush();

        // a zero balance disables Pay and the loop waits without RPCs
        expect(payButton()).toBeDisabled();
        expect(isReady).not.toHaveBeenCalled();

        // balance refresh lands after the loop started
        BalanceStore.lightningBalance = 50000;
        await flush();
        await flush();

        expect(isReady).toHaveBeenCalled();
        expect(screen.queryByText(GETTING_READY)).not.toBeOnTheScreen();
        expect(payButton()).toBeEnabled();
    });

    it('keeps polling when the readiness check rejects', async () => {
        const isReady = jest
            .fn()
            .mockRejectedValueOnce(new Error('LND still starting'))
            .mockResolvedValueOnce(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});

        await renderView({ isLightningReadyToSend: isReady });
        await flush();
        await flush();

        expect(isReady).toHaveBeenCalledTimes(2);
        expect(payButton()).toBeEnabled();
    });

    it('stops polling when the view unmounts', async () => {
        const isReady = jest.fn().mockResolvedValue(false);
        const { unmount } = await renderView({
            isLightningReadyToSend: isReady
        });
        await flush();
        expect(isReady).toHaveBeenCalled();
        expect(screen.getByText(GETTING_READY)).toBeOnTheScreen();
        expect(payButton()).toBeDisabled();

        await unmount();
        const callsAtUnmount = isReady.mock.calls.length;
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));

        expect(isReady).toHaveBeenCalledTimes(callsAtUnmount);
    });
});

describe('PaymentRequest slide to pay', () => {
    // at or above the slide-to-pay threshold the screen shows SwipeButton
    const getSettings = jest.fn(async () => ({
        payments: { slideToPayThreshold: 10000 }
    }));
    const swipeButton = () => hosts('SwipeButton')[0];

    it('disables slide to pay while Lightning is not ready to send', async () => {
        await renderView({
            getSettings,
            payReqOverrides: { getRequestAmount: 10000 },
            isLightningReadyToSend: jest.fn().mockResolvedValue(false)
        });
        await flush();

        expect(screen.getByText(GETTING_READY)).toBeOnTheScreen();
        expect(swipeButton().props.disabled).toBe(true);
    });

    it('enables slide to pay once Lightning is ready to send', async () => {
        await renderView({
            getSettings,
            payReqOverrides: { getRequestAmount: 10000 }
        });
        await flush();

        expect(screen.queryByText(GETTING_READY)).not.toBeOnTheScreen();
        expect(swipeButton().props.disabled).toBe(false);
    });

    it('resets the slider when the screen is focused again', async () => {
        const { emit } = await renderView({
            implementation: 'lnd',
            getSettings,
            payReqOverrides: { getRequestAmount: 10000 }
        });
        const slider = swipeButton();

        await act(async () => emit('focus'));

        // a new key mounts a new SwipeButton
        expect(swipeButton()).not.toBe(slider);
    });
});

describe('PaymentRequest no-amount invoice', () => {
    it('disables Pay until an amount is entered', async () => {
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: 0 }
        });

        expect(payButton()).toBeDisabled();
        expect(screen.getByText(ENTER_AMOUNT)).toBeOnTheScreen();

        const amountInput = screen.getByTestId('AmountInput');
        await act(async () => amountInput.props.onAmountChange('0', 0));
        expect(payButton()).toBeDisabled();

        await act(async () => amountInput.props.onAmountChange('500', 500));
        expect(payButton()).toBeEnabled();
        expect(screen.queryByText(ENTER_AMOUNT)).not.toBeOnTheScreen();
    });

    it('does not show the hint on an invoice with an amount', async () => {
        await renderView({ implementation: 'lnd' });

        expect(payButton()).toBeEnabled();
        expect(screen.queryByText(ENTER_AMOUNT)).not.toBeOnTheScreen();
    });

    it('refuses to pay from triggerPayment until an amount is entered', async () => {
        const ref = React.createRef<any>();
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: 0 },
            ref
        });
        // the Pay button is disabled here, so call the handler the button
        // and swipe would reach
        const view = ref.current;
        view.sendPayment = jest.fn();

        await act(async () => view.triggerPayment());
        expect(view.sendPayment).not.toHaveBeenCalled();

        const amountInput = screen.getByTestId('AmountInput');
        await act(async () => amountInput.props.onAmountChange('500', 500));
        await act(async () => view.triggerPayment());
        expect(view.sendPayment).toHaveBeenCalledTimes(1);
        expect(view.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '500' })
        );
    });
});

describe('PaymentRequest sub-sat invoice', () => {
    // LND decodes a 500 msat invoice with num_satoshis 0
    const subSatAmount = new Invoice({ num_satoshis: '0', num_msat: '500' })
        .getRequestAmount;

    it('enables Pay without asking for an amount', async () => {
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: subSatAmount }
        });

        expect(payButton()).toBeEnabled();
        expect(screen.queryByText(ENTER_AMOUNT)).not.toBeOnTheScreen();
        expect(screen.queryByTestId('AmountInput')).not.toBeOnTheScreen();
    });

    it('shows the exact amount even with msat display off', async () => {
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: subSatAmount }
        });

        const [amount] = screen.container.queryAll(
            (n) => n.type === 'Amount' && n.props.jumboText
        );
        expect(amount.props).toMatchObject({ sats: 0.5, forceMsats: true });
    });

    it('pays the invoice without sending an amount', async () => {
        const ref = React.createRef<any>();
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: subSatAmount },
            ref
        });
        const view = ref.current;
        view.sendPayment = jest.fn();

        await act(async () => view.triggerPayment());
        expect(view.sendPayment).toHaveBeenCalledTimes(1);
        expect(view.sendPayment.mock.calls[0][0].amount).toBeFalsy();
    });
});

describe('PaymentRequest payment in flight', () => {
    it('explains the disabled Pay button while an earlier payment is checked', async () => {
        await renderView({
            implementation: 'lnd',
            TransactionsStore: {
                paymentInFlight: true,
                paymentInFlightConfirmed: false
            }
        });

        expect(payButton()).toBeDisabled();
        expect(
            screen.getByText('components.PaymentInFlightNotice.checking')
        ).toBeOnTheScreen();
    });

    it('shows no notice when no payment is in flight', async () => {
        await renderView({ implementation: 'lnd' });

        expect(
            screen.queryByText('components.PaymentInFlightNotice.checking')
        ).not.toBeOnTheScreen();
    });
});

describe('PaymentRequest fee limit', () => {
    const pay = async (feeLimitSat: string, getRequestAmount: number = 45) => {
        const TransactionsStore = {
            paymentInFlight: false,
            sendPayment: jest.fn()
        };
        const { unmount } = await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount },
            TransactionsStore
        });
        await flush();

        const [feeLimit] = hosts('FeeLimit');
        await act(async () => feeLimit.props.onFeeLimitSatChange(feeLimitSat));
        await fireEvent.press(payButton());

        expect(TransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        await unmount();
        return TransactionsStore.sendPayment.mock.calls[0][0];
    };

    it('pays with the default limit when the fee limit is empty', async () => {
        // the default for amounts up to 1000 sats is the whole amount
        expect(await pay('')).toMatchObject({ fee_limit_sat: '45' });
    });

    it('rounds the default limit of a sub-sat amount up to whole sats', async () => {
        // LND rejects or truncates a fractional fee_limit_sat
        const amount = (num_satoshis: string, num_msat: string) =>
            new Invoice({ num_satoshis, num_msat }).getRequestAmount;
        expect(await pay('', amount('0', '500'))).toMatchObject({
            fee_limit_sat: '1'
        });
        expect(await pay('', amount('1', '1500'))).toMatchObject({
            fee_limit_sat: '2'
        });
    });

    it('keeps an explicit 0 sat limit', async () => {
        expect(await pay('0')).toMatchObject({ fee_limit_sat: '0' });
    });

    it('pays with the limit FeeLimit reports', async () => {
        expect(await pay('3')).toMatchObject({ fee_limit_sat: '3' });
    });
});

describe('PaymentRequest sending', () => {
    it('opens SendingLightning with the id sendPayment gave its payment', async () => {
        const ref = React.createRef<any>();
        const sendPayment = jest.fn(() => 7);
        const { navigation } = await renderView({
            implementation: 'lnd',
            TransactionsStore: { paymentInFlight: false, sendPayment },
            ref
        });

        await act(async () =>
            ref.current.sendPayment({ payment_request: 'lnbc1' })
        );

        expect(sendPayment).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            expect.objectContaining({ paymentSequence: 7 })
        );
    });

    it('opens SendingLightning without an id when the request was dropped', async () => {
        const ref = React.createRef<any>();
        const { navigation } = await renderView({
            implementation: 'lnd',
            TransactionsStore: {
                paymentInFlight: false,
                sendPayment: jest.fn(() => null)
            },
            ref
        });

        await act(async () =>
            ref.current.sendPayment({ payment_request: 'lnbc1' })
        );

        expect(navigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            expect.objectContaining({ paymentSequence: null })
        );
    });
});
