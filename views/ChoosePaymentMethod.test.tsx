jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../stores/Stores', () => ({
    feeStore: {},
    settingsStore: {}
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsChannelManagement: jest.fn(),
    supportsOnchainReceiving: () => false,
    supportsCashuWallet: jest.fn(() => false)
}));
jest.mock('../utils/Bolt11Utils', () => ({}));
jest.mock('../models/Invoice', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../components/Header', () => 'Header');
jest.mock(
    '../components/LayerBalances/PaymentMethodList',
    () => 'PaymentMethodList'
);
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../components/SyncingStatus', () => 'SyncingStatus');
jest.mock('../components/RecoveryStatus', () => 'RecoveryStatus');
jest.mock('../components/RescanStatus', () => 'RescanStatus');
jest.mock('../components/FeeEstimate', () => 'FeeEstimate');

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import ChoosePaymentMethod from './ChoosePaymentMethod';
import BackendUtils from '../utils/BackendUtils';

const NOT_ENOUGH = 'stores.CashuStore.notEnoughFunds';
const OFFLINE = 'views.ChoosePaymentMethod.channelsOffline';
const AVAILABLE = 'views.ChoosePaymentMethod.availableToSend';

const LNURL_WITHDRAW = {
    tag: 'withdrawRequest',
    domain: 'example.com',
    callback: 'https://example.com/withdraw',
    k1: 'challenge',
    defaultDescription: 'withdraw',
    minWithdrawable: 20000000,
    maxWithdrawable: 20000000
};

let balances: { lightningBalance: number; totalBlockchainBalance: number };
let channels:
    | {
          hasChannelData: boolean;
          totalOutbound: number;
          totalOutboundOffline: number;
      }
    | undefined;

const DECODED = { destination: 'node', getRequestAmount: 12000 };

// InvoicesStore as the screen uses it: it decodes what it is asked to and
// keeps nothing
const makeInvoicesStore = () => ({
    getPayReq: jest.fn(async (): Promise<any> => DECODED),
    getRouteEstimate: jest.fn(
        async (): Promise<any> => ({
            feeEstimate: null,
            successProbability: null
        })
    )
});

// Opens the payment method picker for an invoice of `satAmount` sats
const renderView = async (
    params: any = {},
    InvoicesStore = makeInvoicesStore(),
    navigation: any = { addListener: jest.fn(() => jest.fn()) },
    CashuStore: any = { totalBalanceSats: 0 }
) => {
    await render(
        <ChoosePaymentMethod
            {...({
                navigation,
                route: {
                    params: {
                        lightning: 'invoice',
                        satAmount: '12000',
                        ...params
                    }
                },
                BalanceStore: balances,
                ChannelsStore: channels,
                CashuStore,
                UTXOsStore: { accounts: [] },
                InvoicesStore
            } as any)}
        />
    );
    return InvoicesStore;
};

const list = () =>
    screen.container.queryAll((n) => n.type === 'PaymentMethodList')[0].props;

const feeEstimate = () =>
    screen.container.queryAll((n) => n.type === 'FeeEstimate')[0].props;

const flush = () =>
    act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
    });

type Deferred = {
    resolve: (value: any) => void;
    reject: (e: Error) => void;
};
const deferred = () => {
    const d = {} as Deferred & { promise: Promise<any> };
    d.promise = new Promise((resolve, reject) => {
        d.resolve = resolve;
        d.reject = reject;
    });
    return d;
};

// a navigation whose focus and blur events the test can fire
const makeNavigation = () => {
    const listeners: { [event: string]: () => void } = {};
    return {
        addListener: jest.fn((event: string, callback: () => void) => {
            listeners[event] = callback;
            return jest.fn();
        }),
        emit: (event: string) => act(async () => listeners[event]())
    };
};

const notEnoughShown = () => !!screen.queryByText(NOT_ENOUGH);

function expectLightningBalance(balance: number, usesCapacity: boolean) {
    expect(list().lightningBalance).toBe(balance);
    expect(list().lightningBalanceLabel).toBe(
        usesCapacity ? AVAILABLE : undefined
    );
}

describe('ChoosePaymentMethod sending capacity', () => {
    beforeEach(() => {
        jest.mocked(BackendUtils.supportsChannelManagement).mockReturnValue(
            true
        );
        balances = { lightningBalance: 12291, totalBlockchainBalance: 0 };
        channels = {
            hasChannelData: true,
            totalOutbound: 11243,
            totalOutboundOffline: 0
        };
    });

    it.each([
        { amount: 12000, capacity: 11243, insufficient: true },
        { amount: 11243, capacity: 11243, insufficient: false },
        { amount: 11000, capacity: 11243, insufficient: false },
        { amount: 1, capacity: 0, insufficient: true }
    ])(
        'uses capacity $capacity for payment $amount (insufficient: $insufficient)',
        async ({ amount, capacity, insufficient }) => {
            channels!.totalOutbound = capacity;

            await renderView({ satAmount: String(amount) });

            expect(notEnoughShown()).toBe(insufficient);
            expectLightningBalance(capacity, true);
        }
    );

    it.each(['unavailable', 'missing', 'unsupported'])(
        'falls back to the balance when channel data is %s',
        async (scenario) => {
            if (scenario === 'unavailable') channels!.hasChannelData = false;
            if (scenario === 'missing') channels = undefined;
            if (scenario === 'unsupported') {
                jest.mocked(
                    BackendUtils.supportsChannelManagement
                ).mockReturnValue(false);
            }

            await renderView({ satAmount: '12291' });
            expect(notEnoughShown()).toBe(false);
            expectLightningBalance(12291, false);

            await renderView({ satAmount: '12292' });
            expect(notEnoughShown()).toBe(true);
        }
    );

    describe('with channels whose peer is offline', () => {
        // A disconnected peer is routine for the first seconds after
        // foregrounding. That capacity is unreachable right now but the
        // wallet is not out of money, so it must not read as
        // "not enough funds".
        it('says the channels are offline, not that funds are short, when offline capacity covers the payment', async () => {
            channels!.totalOutbound = 0;
            channels!.totalOutboundOffline = 11243;

            await renderView({ satAmount: '11000' });

            expect(notEnoughShown()).toBe(false);
            expect(screen.getByText(OFFLINE)).toBeOnTheScreen();
        });

        it('still reports insufficient funds when even the offline capacity falls short', async () => {
            channels!.totalOutbound = 0;
            channels!.totalOutboundOffline = 11243;

            await renderView({ satAmount: '12000' });

            expect(notEnoughShown()).toBe(true);
            expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
        });

        it('flags the gap when the payment exceeds only the active capacity', async () => {
            channels!.totalOutbound = 5000;
            channels!.totalOutboundOffline = 7000;

            await renderView({ satAmount: '11000' });

            expect(notEnoughShown()).toBe(false);
            expect(screen.getByText(OFFLINE)).toBeOnTheScreen();
            // the row still shows what is actually spendable right now
            expectLightningBalance(5000, true);
            expect(list().lightningEligibilityBalance).toBe(12000);
        });

        it('does not flag a gap when the active capacity already covers it', async () => {
            channels!.totalOutbound = 11243;
            channels!.totalOutboundOffline = 7000;

            await renderView({ satAmount: '11000' });

            expect(notEnoughShown()).toBe(false);
            expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
        });

        it('passes the offline-inclusive figure to the list for eligibility only', async () => {
            channels!.totalOutbound = 0;
            channels!.totalOutboundOffline = 11243;

            await renderView({ satAmount: '11000' });

            expect(list().lightningBalance).toBe(0);
            expect(list().lightningEligibilityBalance).toBe(11243);
        });
    });

    it.each([12291, 0])(
        'keeps the original balance %i and never reports insufficient funds for LNURL withdraw',
        async (balance) => {
            balances.lightningBalance = balance;

            await renderView({
                satAmount: '20000',
                lnurlParams: LNURL_WITHDRAW
            });

            expect(notEnoughShown()).toBe(false);
            expectLightningBalance(balance, false);
        }
    );

    it('decodes the invoice on mount to estimate fees', async () => {
        const InvoicesStore = await renderView();

        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith('invoice');
    });

    it('does not decode the LNURL of a withdraw as an invoice', async () => {
        const InvoicesStore = await renderView({
            lightning: 'lnurl1withdraw',
            satAmount: '20000',
            lnurlParams: LNURL_WITHDRAW
        });

        expect(InvoicesStore.getPayReq).not.toHaveBeenCalled();
    });
});

// The screen decodes the invoice for its own fee row. Nothing is shared
// through InvoicesStore, so a PaymentRequest open lower in the stack keeps
// the invoice it is reviewing
describe('ChoosePaymentMethod Lightning fee estimate', () => {
    beforeEach(() => {
        jest.mocked(BackendUtils.supportsChannelManagement).mockReturnValue(
            false
        );
        balances = { lightningBalance: 50000, totalBlockchainBalance: 0 };
        channels = undefined;
    });

    it('queries the route of the invoice it decoded and passes the fee on', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate.mockResolvedValue({
            feeEstimate: 7,
            successProbability: 90
        });

        await renderView({}, InvoicesStore);
        await flush();

        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith('invoice');
        expect(InvoicesStore.getRouteEstimate).toHaveBeenCalledWith(DECODED);
        expect(feeEstimate()).toMatchObject({
            lightningFee: 7,
            lightningFeeLoading: false
        });
    });

    it('passes a 0 sat fee on as a fee', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate.mockResolvedValue({
            feeEstimate: 0,
            successProbability: 0
        });

        await renderView({}, InvoicesStore);
        await flush();

        expect(feeEstimate().lightningFee).toBe(0);
    });

    it('shows the fee as loading until the decode and the route query are in', async () => {
        const decode = deferred();
        const route = deferred();
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockReturnValue(decode.promise);
        InvoicesStore.getRouteEstimate.mockReturnValue(route.promise);

        await renderView({}, InvoicesStore);
        await flush();
        expect(feeEstimate()).toMatchObject({
            lightningFee: undefined,
            lightningFeeLoading: true
        });

        decode.resolve(DECODED);
        await flush();
        expect(feeEstimate().lightningFeeLoading).toBe(true);

        route.resolve({ feeEstimate: 3, successProbability: 50 });
        await flush();
        expect(feeEstimate()).toMatchObject({
            lightningFee: 3,
            lightningFeeLoading: false
        });
    });

    it('passes no fee when the backend has no estimate', async () => {
        await renderView();
        await flush();

        expect(feeEstimate()).toMatchObject({
            lightningFee: undefined,
            lightningFeeLoading: false
        });
    });

    it('passes no fee and queries no route when the invoice cannot be decoded', async () => {
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getPayReq.mockRejectedValue(new Error('decode failed'));

        await renderView({}, InvoicesStore);
        await flush();

        expect(InvoicesStore.getRouteEstimate).not.toHaveBeenCalled();
        expect(feeEstimate()).toMatchObject({
            lightningFee: undefined,
            lightningFeeLoading: false
        });
    });

    it('does not load a fee for an LNURL withdraw', async () => {
        const InvoicesStore = makeInvoicesStore();

        await renderView(
            {
                lightning: 'lnurl1withdraw',
                satAmount: '20000',
                lnurlParams: LNURL_WITHDRAW
            },
            InvoicesStore
        );
        await flush();

        expect(InvoicesStore.getRouteEstimate).not.toHaveBeenCalled();
        expect(feeEstimate().lightningFeeLoading).toBe(false);
    });

    it('estimates again when the screen regains focus', async () => {
        const InvoicesStore = makeInvoicesStore();
        const navigation = makeNavigation();
        await renderView({}, InvoicesStore, navigation);
        await flush();
        expect(InvoicesStore.getPayReq).toHaveBeenCalledTimes(1);

        // focus without a blur is the first focus of the screen
        await navigation.emit('focus');
        expect(InvoicesStore.getPayReq).toHaveBeenCalledTimes(1);

        await navigation.emit('blur');
        InvoicesStore.getRouteEstimate.mockResolvedValue({
            feeEstimate: 9,
            successProbability: 80
        });
        await navigation.emit('focus');
        await flush();

        expect(InvoicesStore.getPayReq).toHaveBeenCalledTimes(2);
        expect(feeEstimate().lightningFee).toBe(9);
    });

    it('keeps the newer estimate when an older one answers last', async () => {
        const first = deferred();
        const InvoicesStore = makeInvoicesStore();
        InvoicesStore.getRouteEstimate
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce({ feeEstimate: 9, successProbability: 80 });
        const navigation = makeNavigation();
        await renderView({}, InvoicesStore, navigation);
        await flush();

        await navigation.emit('blur');
        await navigation.emit('focus');
        await flush();
        expect(feeEstimate().lightningFee).toBe(9);

        first.resolve({ feeEstimate: 500, successProbability: 10 });
        await flush();

        expect(feeEstimate()).toMatchObject({
            lightningFee: 9,
            lightningFeeLoading: false
        });
    });
});

// The screen quotes the invoice for its own ecash fee row. Nothing is
// shared through CashuStore, so a CashuPaymentRequest open lower in the
// stack keeps the invoice and quotes it is reviewing
describe('ChoosePaymentMethod ecash fee estimate', () => {
    const planFor = (overrides: any = {}) => ({
        paymentRequest: 'invoice',
        payReq: DECODED,
        meltQuotes: [],
        feeEstimate: 2,
        mintBalance: 50000,
        amount: 12000,
        ...overrides
    });

    // CashuStore as the screen uses it: it quotes what it is asked to and
    // keeps nothing
    const makeCashuStore = () => ({
        totalBalanceSats: 50000,
        getPayReq: jest.fn(async (): Promise<any> => planFor())
    });

    beforeEach(() => {
        jest.mocked(BackendUtils.supportsChannelManagement).mockReturnValue(
            false
        );
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(true);
        balances = { lightningBalance: 50000, totalBlockchainBalance: 0 };
        channels = undefined;
    });

    afterEach(() => {
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(false);
    });

    it('quotes the invoice itself and passes the fee on', async () => {
        const CashuStore = makeCashuStore();

        await renderView({}, undefined, undefined, CashuStore);
        await flush();

        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(1);
        expect(CashuStore.getPayReq).toHaveBeenCalledWith('invoice');
        expect(feeEstimate()).toMatchObject({
            ecashFee: 2,
            ecashFeeLoading: false
        });
    });

    it('passes a 0 sat fee on as a fee', async () => {
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockResolvedValue(planFor({ feeEstimate: 0 }));

        await renderView({}, undefined, undefined, CashuStore);
        await flush();

        expect(feeEstimate()).toMatchObject({
            ecashFee: 0,
            ecashFeeLoading: false
        });
    });

    it('shows the fee as loading until the quote is in', async () => {
        const quote = deferred();
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockReturnValue(quote.promise);

        await renderView({}, undefined, undefined, CashuStore);
        await flush();
        expect(feeEstimate()).toMatchObject({
            ecashFee: undefined,
            ecashFeeLoading: true
        });

        quote.resolve(planFor({ feeEstimate: 3 }));
        await flush();
        expect(feeEstimate()).toMatchObject({
            ecashFee: 3,
            ecashFeeLoading: false
        });
    });

    it('passes no fee and stops loading when the plan has an error', async () => {
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockResolvedValue(
            planFor({ feeEstimate: undefined, error: 'mint is offline' })
        );

        await renderView({}, undefined, undefined, CashuStore);
        await flush();

        expect(feeEstimate()).toMatchObject({
            ecashFee: undefined,
            ecashFeeLoading: false
        });
    });

    it('does not quote when the backend has no Cashu wallet', async () => {
        jest.mocked(BackendUtils.supportsCashuWallet).mockReturnValue(false);
        const CashuStore = makeCashuStore();

        await renderView({}, undefined, undefined, CashuStore);
        await flush();

        expect(CashuStore.getPayReq).not.toHaveBeenCalled();
        expect(feeEstimate()).toMatchObject({
            ecashFee: undefined,
            ecashFeeLoading: false
        });
    });

    it('does not quote an LNURL withdraw', async () => {
        const CashuStore = makeCashuStore();

        await renderView(
            {
                lightning: 'lnurl1withdraw',
                satAmount: '20000',
                lnurlParams: LNURL_WITHDRAW
            },
            undefined,
            undefined,
            CashuStore
        );
        await flush();

        expect(CashuStore.getPayReq).not.toHaveBeenCalled();
        expect(feeEstimate().ecashFeeLoading).toBe(false);
    });

    it('quotes again when the screen regains focus', async () => {
        const CashuStore = makeCashuStore();
        const navigation = makeNavigation();
        await renderView({}, undefined, navigation, CashuStore);
        await flush();
        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(1);

        // focus without a blur is the first focus of the screen
        await navigation.emit('focus');
        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(1);

        await navigation.emit('blur');
        CashuStore.getPayReq.mockResolvedValue(planFor({ feeEstimate: 9 }));
        await navigation.emit('focus');
        await flush();

        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(2);
        expect(feeEstimate()).toMatchObject({
            ecashFee: 9,
            ecashFeeLoading: false
        });
    });

    it('keeps the newer quote when an older one answers last', async () => {
        const first = deferred();
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(planFor({ feeEstimate: 9 }));
        const navigation = makeNavigation();
        await renderView({}, undefined, navigation, CashuStore);
        await flush();

        await navigation.emit('blur');
        await navigation.emit('focus');
        await flush();
        expect(feeEstimate().ecashFee).toBe(9);

        first.resolve(planFor({ feeEstimate: 500 }));
        await flush();

        expect(feeEstimate()).toMatchObject({
            ecashFee: 9,
            ecashFeeLoading: false
        });
    });
});
