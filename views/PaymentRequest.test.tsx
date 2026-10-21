jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../stores/Stores');
jest.mock('../utils/LocaleUtils');
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    supportsLightningSends: () => true,
    supportsMPP: () => false,
    supportsAMP: () => false,
    supportsCustomFeeLimit: () => false,
    supportsHopPicking: () => false
}));
jest.mock('../utils/DonationUtils', () => ({
    calculateDonationAmount: () => 0,
    findDonationPercentageIndex: () => 0
}));
jest.mock('../utils/LinkingUtils', () => ({}));
jest.mock('../utils/GraphSyncUtils', () => ({
    clearPendingPaymentData: jest.fn()
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
import PaymentRequest from './PaymentRequest';

const PAY = 'views.PaymentRequest.payInvoice';
const GETTING_READY = 'views.PaymentRequest.lndGettingReady';
const ENTER_AMOUNT = 'views.PaymentRequest.enterAmount';

// a decoded 1,000 sat invoice that never expires during a test
const payReq = {
    getRequestAmount: 1000,
    determineFormattedOriginalTimeUntilExpiry: jest.fn(),
    isExpiredNow: () => false,
    formattedOriginalTimeUntilExpiry: '1 hour',
    payment_hash: 'ab'.repeat(32),
    destination: '02' + 'cd'.repeat(32)
};

const renderView = async ({
    implementation = 'embedded-lnd',
    lightningBalance = 50000,
    isLightningReadyToSend = jest.fn().mockResolvedValue(true),
    getSettings = jest.fn(async () => ({ payments: {} })),
    payReqOverrides = {},
    TransactionsStore = { paymentInFlight: false },
    ref
}: {
    payReqOverrides?: object;
    TransactionsStore?: object;
    ref?: React.Ref<any>;
    implementation?: string;
    lightningBalance?: number;
    isLightningReadyToSend?: jest.Mock;
    getSettings?: jest.Mock;
} = {}) => {
    const BalanceStore = {
        lightningBalance,
        getLightningBalance: jest.fn()
    };
    const InvoicesStore = {
        pay_req: { ...payReq, ...payReqOverrides },
        paymentRequest: 'lnbc10u1example',
        clearPayReq: jest.fn()
    };
    const listeners: { [event: string]: Array<() => void> } = {};
    const navigation = {
        addListener: jest.fn((event: string, callback: () => void) => {
            (listeners[event] = listeners[event] || []).push(callback);
            return jest.fn();
        }),
        navigate: jest.fn()
    };
    // what react-navigation does when the route is removed or focused
    const emit = (event: string) =>
        (listeners[event] || []).forEach((callback) => callback());
    const result = await render(
        <PaymentRequest
            ref={ref}
            {...({
                navigation,
                route: { params: {} },
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
            } as any)}
        />
    );
    return { BalanceStore, InvoicesStore, navigation, emit, ...result };
};

const payButton = () => screen.getByRole('button', { name: PAY });
const flush = () =>
    act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
    });

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
});

// header Back, Android hardware back, the iOS swipe and popTo after a payment
// all remove the route, so the decode is cleared on beforeRemove rather
// than only from the header's onBack
describe('PaymentRequest leaving the screen', () => {
    it('clears the decode when the route is removed', async () => {
        const { InvoicesStore, emit } = await renderView({
            implementation: 'lnd'
        });
        expect(InvoicesStore.clearPayReq).not.toHaveBeenCalled();

        emit('beforeRemove');

        expect(InvoicesStore.clearPayReq).toHaveBeenCalledTimes(1);
    });

    it('clears the decode when the route is removed before settings load', async () => {
        const { InvoicesStore, emit } = await renderView({
            getSettings: jest.fn(() => new Promise(() => {}))
        });

        emit('beforeRemove');

        expect(InvoicesStore.clearPayReq).toHaveBeenCalledTimes(1);
    });

    it('stops listening for removal on unmount', async () => {
        const { navigation, unmount } = await renderView({
            implementation: 'lnd'
        });
        const index = navigation.addListener.mock.calls.findIndex(
            ([event]) => event === 'beforeRemove'
        );
        const unsubscribe = navigation.addListener.mock.results[index].value;

        await unmount();

        expect(unsubscribe).toHaveBeenCalled();
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
    const pay = async (feeLimitSat: string) => {
        const TransactionsStore = {
            paymentInFlight: false,
            sendPayment: jest.fn()
        };
        await renderView({
            implementation: 'lnd',
            payReqOverrides: { getRequestAmount: 45 },
            TransactionsStore
        });
        await flush();

        const [feeLimit] = screen.container.queryAll(
            (n) => n.type === 'FeeLimit'
        );
        await act(async () => feeLimit.props.onFeeLimitSatChange(feeLimitSat));
        await fireEvent.press(payButton());

        expect(TransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        return TransactionsStore.sendPayment.mock.calls[0][0];
    };

    it('pays with the default limit when the fee limit is empty', async () => {
        // the default for amounts up to 1000 sats is the whole amount
        expect(await pay('')).toMatchObject({ fee_limit_sat: '45' });
    });

    it('keeps an explicit 0 sat limit', async () => {
        expect(await pay('0')).toMatchObject({ fee_limit_sat: '0' });
    });

    it('pays with the limit FeeLimit reports', async () => {
        expect(await pay('3')).toMatchObject({ fee_limit_sat: '3' });
    });
});
