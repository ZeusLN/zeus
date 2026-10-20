jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: 'SafeAreaView'
}));
jest.mock('../NavigationService', () => ({
    getRouteStack: () => []
}));
jest.mock('../utils/DonationUtils', () => ({ loadDonationLnurl: jest.fn() }));
jest.mock('./LnurlPay/Success', () => 'LnurlPaySuccess');
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../components/PaymentErrorView', () => 'PaymentErrorView');
jest.mock('../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../components/SendingLoadingView', () => 'SendingLoadingView');
jest.mock('../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../components/sendingStyles', () => ({
    sendingStyles: { content: {}, buttons: {} }
}));
jest.mock('../stores/BalanceStore', () => ({}));
jest.mock('../stores/ChannelsStore', () => ({}));
jest.mock('../stores/ContactStore', () => ({}));
jest.mock('../stores/LnurlPayStore', () => ({}));
jest.mock('../stores/PaymentsStore', () => ({}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('../stores/NodeInfoStore', () => ({}));
jest.mock('../utils/Base64Utils', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLocalWallet: () => false,
        supportsChannelManagement: () => false
    }
}));
jest.mock('../utils/ContactUtils', () => ({
    __esModule: true,
    default: { findContactByLightningAddress: () => undefined }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../storage', () => ({}));
jest.mock('../assets/images/SVG/Clock.svg', () => 'Clock');
jest.mock('../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../utils/AmountUtils', () => ({ getFeePercentage: jest.fn() }));

import * as React from 'react';
import { BackHandler } from 'react-native';
import {
    fireEvent,
    render,
    screen,
    waitFor
} from '@testing-library/react-native';
import { loadDonationLnurl } from '../utils/DonationUtils';
import SendingLightning from './SendingLightning';

const TRY_AGAIN = 'views.SendingLightning.tryAgain';
const GO_TO_WALLET = 'views.SendingLightning.goToWallet';

const renderView = async (
    transactionsState: Record<string, any>,
    LnurlPayStore: Record<string, any> = {}
) => {
    const TransactionsStore = {
        loading: false,
        error: false,
        error_msg: null,
        payment_hash: null,
        payment_preimage: null,
        payment_fee: null,
        payment_error: null,
        noteKey: null,
        paymentDuration: null,
        status: null,
        ...transactionsState
    };
    const navigation = {
        goBack: jest.fn(),
        popTo: jest.fn(),
        addListener: jest.fn(() => jest.fn())
    };
    await render(
        <SendingLightning
            {...({
                navigation,
                route: { key: 'SendingLightning', name: 'SendingLightning' },
                TransactionsStore,
                ContactStore: { contacts: [] },
                LnurlPayStore,
                NodeInfoStore: { nodeInfo: {} }
            } as any)}
        />
    );
    return navigation;
};

describe('SendingLightning retry', () => {
    it('does not offer Try Again while the payment is in transit', async () => {
        // what TransactionsStore holds after LdkNode reports a keysend or
        // BOLT 12 payment still pending at its timeout
        const navigation = await renderView({ status: 'IN_FLIGHT' });

        expect(
            screen.queryByRole('button', { name: TRY_AGAIN })
        ).not.toBeOnTheScreen();
        expect(
            screen.getByText('views.SendingLightning.inTransit')
        ).toBeOnTheScreen();

        await fireEvent.press(
            screen.getByRole('button', { name: GO_TO_WALLET })
        );

        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('offers Try Again, going back to the previous screen, after a failure', async () => {
        const navigation = await renderView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        await fireEvent.press(screen.getByRole('button', { name: TRY_AGAIN }));

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('disables Try Again while the node is still being checked for the payment', async () => {
        // a dispatch error is shown, but tracking still holds the send
        // guard, which would silently ignore the retry
        const navigation = await renderView({
            error: true,
            error_msg: 'connection closed',
            paymentInFlight: true
        });

        expect(
            screen.queryByRole('button', { name: TRY_AGAIN })
        ).not.toBeOnTheScreen();
        const checking = screen.getByRole('button', {
            name: 'views.SendingLightning.checkingPayment'
        });
        expect(checking).toBeDisabled();

        await fireEvent.press(checking);
        expect(navigation.goBack).not.toHaveBeenCalled();
    });
});

describe('SendingLightning tracking stopped', () => {
    const TRACKING_STOPPED = 'views.SendingLightning.trackingStopped';

    it('says tracking stopped when the outcome could not be verified', async () => {
        // what TransactionsStore holds after the tracker gives up on a
        // payment it last saw in transit
        await renderView({
            status: 'IN_FLIGHT',
            paymentOutcomeUnverified: true
        });

        expect(screen.getByText(TRACKING_STOPPED)).toBeOnTheScreen();
        expect(
            screen.queryByRole('button', { name: TRY_AGAIN })
        ).not.toBeOnTheScreen();
    });

    it('does not say so while the payment is still tracked', async () => {
        await renderView({
            status: 'IN_FLIGHT',
            paymentOutcomeUnverified: false
        });

        expect(screen.queryByText(TRACKING_STOPPED)).not.toBeOnTheScreen();
    });
});

describe('SendingLightning hardware back', () => {
    let onBack: () => boolean;

    beforeEach(() => {
        jest.spyOn(BackHandler, 'addEventListener').mockImplementation(
            (_event: any, listener: any) => {
                onBack = listener;
                return { remove: jest.fn() } as any;
            }
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it('returns to the wallet while the payment is in transit', async () => {
        const navigation = await renderView({ status: 'IN_FLIGHT' });

        expect(onBack()).toBe(true);

        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('stays on the screen while the payment is still being sent', async () => {
        // otherwise back falls through to Send, which pops to the payment
        // screen and lets the user pay again before this payment resolves
        const navigation = await renderView({ loading: true });

        expect(onBack()).toBe(true);

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('leaves a failed payment to the default back behavior', async () => {
        const navigation = await renderView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        expect(onBack()).toBe(false);

        expect(navigation.popTo).not.toHaveBeenCalled();
    });
});

describe('SendingLightning recipient', () => {
    // a Lightning address looked up earlier for another invoice
    const lnurlPay = {
        paymentHash: '5e'.repeat(32),
        lightningAddress: 'alice@friends.example'
    };
    const sent = (payment_hash: string) => ({
        status: 'SUCCEEDED',
        payment_hash,
        payment_preimage: 'ab'.repeat(32)
    });
    const recipient = () =>
        screen.container.queryAll((n) => n.type === 'PaymentDetailsSheet')[0]
            .props.lightningAddress;

    it('shows the Lightning address for the invoice it was looked up for', async () => {
        await renderView(sent(lnurlPay.paymentHash), lnurlPay);

        expect(recipient()).toBe('alice@friends.example');
    });

    it('does not show the Lightning address for a different payment', async () => {
        await renderView(sent('cd'.repeat(32)), lnurlPay);

        expect(recipient()).toBeUndefined();
    });
});

describe('SendingLightning donation', () => {
    beforeEach(() => jest.clearAllMocks());

    const params = { enableDonations: true, donationAmount: '25' };

    const donationView = (TransactionsStore: any) => (
        <SendingLightning
            {...({
                navigation: {
                    goBack: jest.fn(),
                    popTo: jest.fn(),
                    addListener: jest.fn(() => jest.fn())
                },
                route: {
                    key: 'SendingLightning',
                    name: 'SendingLightning',
                    params
                },
                TransactionsStore,
                BalanceStore: { getCombinedBalance: jest.fn() },
                ChannelsStore: { getChannels: jest.fn() },
                PaymentsStore: { getPayments: jest.fn().mockResolvedValue([]) },
                ContactStore: { contacts: [] },
                LnurlPayStore: {},
                NodeInfoStore: { nodeInfo: { isMainNet: true } }
            } as any)}
        />
    );

    it('tries the donation once when it fails', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const TransactionsStore: any = {
            loading: false,
            error: false,
            status: null,
            sendPaymentSilently: jest
                .fn()
                .mockResolvedValue({ status: 'FAILED' })
        };

        const { rerender } = await render(donationView(TransactionsStore));
        TransactionsStore.status = 'SUCCEEDED';
        await rerender(donationView(TransactionsStore));
        await waitFor(() =>
            expect(TransactionsStore.sendPaymentSilently).toHaveBeenCalled()
        );
        for (let i = 0; i < 5; i++) {
            await new Promise((r) => setImmediate(r));
        }

        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(1);
    });

    // The screen stays mounted under anything pushed on top of it, and the
    // payment status lives in the shared TransactionsStore, so a later
    // payment resets it and then sets it to SUCCEEDED again
    it('does not send the donation again on a later payment after it failed', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue(null);
        const TransactionsStore: any = {
            loading: false,
            error: false,
            status: null,
            sendPaymentSilently: jest.fn()
        };

        const { rerender } = await render(donationView(TransactionsStore));
        TransactionsStore.status = 'SUCCEEDED';
        await rerender(donationView(TransactionsStore));
        await waitFor(() => expect(loadDonationLnurl).toHaveBeenCalledTimes(1));

        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        TransactionsStore.status = null;
        await rerender(donationView(TransactionsStore));
        TransactionsStore.status = 'SUCCEEDED';
        await rerender(donationView(TransactionsStore));
        await new Promise((r) => setImmediate(r));

        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
    });
});
