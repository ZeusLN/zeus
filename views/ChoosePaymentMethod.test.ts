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
jest.mock('../utils/Bolt11Utils', () => ({}));
jest.mock('../models/Invoice', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../components/Header', () => 'Header');
jest.mock(
    '../components/LayerBalances/PaymentMethodList',
    () => 'PaymentMethodList'
);
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/SyncingStatus', () => 'SyncingStatus');
jest.mock('../components/RecoveryStatus', () => 'RecoveryStatus');
jest.mock('../components/RescanStatus', () => 'RescanStatus');
jest.mock('../components/FeeEstimate', () => 'FeeEstimate');

import * as React from 'react';
import ChoosePaymentMethod from './ChoosePaymentMethod';
import PaymentMethodList from '../components/LayerBalances/PaymentMethodList';
import BackendUtils from '../utils/BackendUtils';

function expectLightningBalance(
    view: ChoosePaymentMethod,
    balance: number,
    usesCapacity: boolean
) {
    expect(view.lightningPaymentBalance).toBe(balance);
    expect(view.usesSendingCapacity).toBe(usesCapacity);
    const list = React.Children.toArray(view.render().props.children).find(
        (child) =>
            React.isValidElement(child) && child.type === PaymentMethodList
    ) as React.ReactElement<React.ComponentProps<typeof PaymentMethodList>>;
    expect(list).toBeDefined();
    expect(list.props.lightningBalance).toBe(balance);
    expect(list.props.lightningBalanceLabel).toBe(
        usesCapacity ? 'views.ChoosePaymentMethod.availableToSend' : undefined
    );
}

describe('ChoosePaymentMethod sending capacity', () => {
    let view: ChoosePaymentMethod;
    let balances: { lightningBalance: number; totalBlockchainBalance: number };
    let channels: {
        hasChannelData: boolean;
        totalOutbound: number;
        totalOutboundOffline: number;
    };

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
        view = new ChoosePaymentMethod({
            navigation: {},
            route: { params: {} },
            BalanceStore: balances,
            ChannelsStore: channels,
            CashuStore: { totalBalanceSats: 0 },
            UTXOsStore: { accounts: [] }
        } as unknown as React.ComponentProps<typeof ChoosePaymentMethod>);
        // Set state directly without mounting or triggering fee/network requests.
        view.state = {
            ...view.state,
            lightning: 'invoice',
            satAmount: '12000'
        };
    });

    it.each([
        { amount: 12000, capacity: 11243, insufficient: true },
        { amount: 11243, capacity: 11243, insufficient: false },
        { amount: 11000, capacity: 11243, insufficient: false },
        { amount: 1, capacity: 0, insufficient: true }
    ])(
        'uses capacity $capacity for payment $amount (insufficient: $insufficient)',
        ({ amount, capacity, insufficient }) => {
            channels.totalOutbound = capacity;
            view.state.satAmount = String(amount);

            expect(view.hasInsufficientFunds()).toBe(insufficient);
            expectLightningBalance(view, capacity, true);
        }
    );

    it.each(['unavailable', 'missing', 'unsupported'])(
        'falls back to the balance when channel data is %s',
        (scenario) => {
            if (scenario === 'unavailable') channels.hasChannelData = false;
            if (scenario === 'missing') {
                const state = view.state;
                view = new ChoosePaymentMethod({
                    ...view.props,
                    ChannelsStore: undefined
                });
                view.state = state;
            }
            if (scenario === 'unsupported') {
                jest.mocked(
                    BackendUtils.supportsChannelManagement
                ).mockReturnValue(false);
            }

            expect(view.hasInsufficientFunds()).toBe(false);
            expectLightningBalance(view, 12291, false);
            view.state.satAmount = '12292';
            expect(view.hasInsufficientFunds()).toBe(true);
        }
    );

    describe('with channels whose peer is offline', () => {
        // A disconnected peer is routine for the first seconds after
        // foregrounding. That capacity is unreachable right now but the
        // wallet is not out of money, so it must not read as
        // "not enough funds".
        it('does not report insufficient funds when offline capacity covers the payment', () => {
            channels.totalOutbound = 0;
            channels.totalOutboundOffline = 11243;
            view.state.satAmount = '11000';

            expect(view.hasInsufficientFunds()).toBe(false);
            expect(view.hasOfflineCapacityGap).toBe(true);
        });

        it('still reports insufficient funds when even the offline capacity falls short', () => {
            channels.totalOutbound = 0;
            channels.totalOutboundOffline = 11243;
            view.state.satAmount = '12000';

            expect(view.hasInsufficientFunds()).toBe(true);
        });

        it('flags the gap when the payment exceeds only the active capacity', () => {
            channels.totalOutbound = 5000;
            channels.totalOutboundOffline = 7000;
            view.state.satAmount = '11000';

            expect(view.hasInsufficientFunds()).toBe(false);
            expect(view.hasOfflineCapacityGap).toBe(true);
            // the row still shows what is actually spendable right now
            expectLightningBalance(view, 5000, true);
            expect(view.lightningSpendableBalance).toBe(12000);
        });

        it('does not flag a gap when the active capacity already covers it', () => {
            channels.totalOutbound = 11243;
            channels.totalOutboundOffline = 7000;
            view.state.satAmount = '11000';

            expect(view.hasInsufficientFunds()).toBe(false);
            expect(view.hasOfflineCapacityGap).toBe(false);
        });

        it('passes the offline-inclusive figure to the list for eligibility only', () => {
            channels.totalOutbound = 0;
            channels.totalOutboundOffline = 11243;
            view.state.satAmount = '11000';

            const list = React.Children.toArray(
                view.render().props.children
            ).find(
                (child) =>
                    React.isValidElement(child) &&
                    child.type === PaymentMethodList
            ) as React.ReactElement<
                React.ComponentProps<typeof PaymentMethodList>
            >;
            expect(list.props.lightningBalance).toBe(0);
            expect(list.props.lightningEligibilityBalance).toBe(11243);
        });
    });

    it.each([12291, 0])(
        'keeps the original balance %i and never reports insufficient funds for LNURL withdraw',
        (balance) => {
            balances.lightningBalance = balance;
            view.state = {
                ...view.state,
                satAmount: '20000',
                lnurlParams: {
                    tag: 'withdrawRequest',
                    domain: 'example.com',
                    callback: 'https://example.com/withdraw',
                    k1: 'challenge',
                    defaultDescription: 'withdraw',
                    minWithdrawable: 20000000,
                    maxWithdrawable: 20000000
                }
            };

            expect(view.hasInsufficientFunds()).toBe(false);
            expectLightningBalance(view, balance, false);
        }
    );
});
