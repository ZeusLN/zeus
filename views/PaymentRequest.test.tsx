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
jest.mock('../components/AmountInput', () => 'AmountInput');
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
import { observable, runInAction } from 'mobx';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import PaymentRequest from './PaymentRequest';

const PAY = 'views.PaymentRequest.payInvoice';
const GETTING_READY = 'views.PaymentRequest.lndGettingReady';

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
    InvoicesStore = {
        pay_req: payReq,
        paymentRequest: 'lnbc10u1example'
    },
    TransactionsStore = { paymentInFlight: false }
}: {
    implementation?: string;
    lightningBalance?: number;
    isLightningReadyToSend?: jest.Mock;
    getSettings?: jest.Mock;
    InvoicesStore?: { pay_req: any; paymentRequest: string };
    TransactionsStore?: any;
} = {}) => {
    const BalanceStore = {
        lightningBalance,
        getLightningBalance: jest.fn()
    };
    const result = await render(
        <PaymentRequest
            {...({
                navigation: {
                    addListener: jest.fn(() => jest.fn()),
                    navigate: jest.fn()
                },
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
    return { BalanceStore, ...result };
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

describe('PaymentRequest custom amount', () => {
    const noAmountPayReq = { ...payReq, getRequestAmount: 0 };
    const tenSatPayReq = { ...payReq, getRequestAmount: 10 };

    const setup = async (pay_req: any) => {
        const InvoicesStore = observable(
            { pay_req, paymentRequest: 'lnbc1noamount' },
            {},
            { deep: false }
        );
        const sendPayment = jest.fn();
        const view = await renderView({
            implementation: 'ldk-node',
            InvoicesStore,
            TransactionsStore: { paymentInFlight: false, sendPayment }
        });
        return { InvoicesStore, sendPayment, ...view };
    };

    const amountInputs = () =>
        screen.container.queryAll((n) => n.type === 'AmountInput');

    const typeAmount = (sats: string) =>
        fireEvent(amountInputs()[0], 'amountChange', sats, sats);

    it('sends the typed amount with a no-amount invoice', async () => {
        const { sendPayment } = await setup(noAmountPayReq);
        await typeAmount('100000');

        await fireEvent.press(payButton());

        expect(sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_request: 'lnbc1noamount',
                amount: '100000'
            })
        );
    });

    it('does not send a typed amount with a fixed-amount invoice swapped in after it was entered', async () => {
        const { InvoicesStore, sendPayment } = await setup(noAmountPayReq);
        await typeAmount('100000');

        // a 10 sat invoice replaces the no-amount one on the open screen
        await act(async () =>
            runInAction(() => {
                InvoicesStore.paymentRequest = 'lnbc100n1tensats';
                InvoicesStore.pay_req = tenSatPayReq;
            })
        );
        expect(amountInputs()).toHaveLength(0);
        await fireEvent.press(
            screen.getByRole('button', {
                name: 'views.PaymentRequest.reviewNewPayReq'
            })
        );

        await fireEvent.press(payButton());

        expect(sendPayment).toHaveBeenCalledTimes(1);
        expect(sendPayment.mock.calls[0][0]).toMatchObject({
            payment_request: 'lnbc100n1tensats',
            amount: undefined
        });
    });
});
