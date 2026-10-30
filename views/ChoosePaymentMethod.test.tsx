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
    supportsCashuWallet: () => false
}));
// invoice -> amount in sats; anything else fails to decode
const mockInvoiceSats: Record<string, number> = {};
jest.mock('../utils/Bolt11Utils', () => ({
    decode: (pr: string) => {
        if (!(pr in mockInvoiceSats)) throw new Error('cannot decode');
        return { num_satoshis: mockInvoiceSats[pr] };
    }
}));
jest.mock(
    '../models/Invoice',
    () =>
        function (this: any, decoded: any) {
            this.getRequestAmount = Number(decoded.num_satoshis);
        }
);
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
import { render, screen } from '@testing-library/react-native';
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

// Opens the payment method picker for an invoice of `satAmount` sats
const renderView = async (params: any = {}) => {
    const InvoicesStore = {
        getPayReq: jest.fn().mockResolvedValue(undefined)
    };
    await render(
        <ChoosePaymentMethod
            {...({
                navigation: { addListener: jest.fn(() => jest.fn()) },
                route: {
                    params: {
                        lightning: 'invoice',
                        satAmount: '12000',
                        ...params
                    }
                },
                BalanceStore: balances,
                ChannelsStore: channels,
                CashuStore: { totalBalanceSats: 0 },
                UTXOsStore: { accounts: [] },
                InvoicesStore
            } as any)}
        />
    );
    return InvoicesStore;
};

const list = () =>
    screen.container.queryAll((n) => n.type === 'PaymentMethodList')[0].props;

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

describe('ChoosePaymentMethod BIP 21 amount check', () => {
    const MISMATCH = 'views.ChoosePaymentMethod.amountMismatch';
    const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

    beforeEach(() => {
        jest.mocked(BackendUtils.supportsChannelManagement).mockReturnValue(
            false
        );
        balances = { lightningBalance: 100000, totalBlockchainBalance: 0 };
        channels = undefined;
        mockInvoiceSats.lnbc15k = 15000;
        mockInvoiceSats.lnbc12k = 12000;
        mockInvoiceSats.lnbc0 = 0;
    });

    it('warns when the amount differs from the lightning invoice amount', async () => {
        await renderView({
            value: ADDRESS,
            satAmount: '12000',
            lightning: 'lnbc15k'
        });

        expect(screen.queryByText(MISMATCH)).not.toBeNull();
        // the URI amount is still the one shown and checked
        expect(list().satAmount).toBe('12000');
    });

    it('does not warn when the amounts match', async () => {
        await renderView({
            value: ADDRESS,
            satAmount: '12000',
            lightning: 'lnbc12k'
        });

        expect(screen.queryByText(MISMATCH)).toBeNull();
    });

    it('does not warn for an invoice without an amount', async () => {
        await renderView({
            value: ADDRESS,
            satAmount: '12000',
            lightning: 'lnbc0'
        });

        expect(screen.queryByText(MISMATCH)).toBeNull();
    });

    it('uses the invoice amount without warning when the URI has none', async () => {
        await renderView({
            value: ADDRESS,
            satAmount: undefined,
            lightning: 'lnbc15k'
        });

        expect(screen.queryByText(MISMATCH)).toBeNull();
        expect(list().satAmount).toBe('15000');
    });
});
