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
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SendingLightning from './SendingLightning';
import { loadDonationLnurl } from '../utils/DonationUtils';

const TRY_AGAIN = 'views.SendingLightning.tryAgain';
const GO_TO_WALLET = 'views.SendingLightning.goToWallet';

const renderView = async (
    transactionsState: Record<string, any>,
    params?: Record<string, any>
) => {
    const TransactionsStore: any = {
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
    const element = () => (
        <SendingLightning
            {...({
                navigation,
                route: {
                    key: 'SendingLightning',
                    name: 'SendingLightning',
                    params
                },
                TransactionsStore,
                ContactStore: { contacts: [] },
                LnurlPayStore: {},
                NodeInfoStore: { nodeInfo: { isMainNet: !!params } },
                PaymentsStore: { getPayments: jest.fn() },
                BalanceStore: { getCombinedBalance: jest.fn() }
            } as any)}
        />
    );
    const { rerender } = await render(element());
    return {
        navigation,
        TransactionsStore,
        rerender: () => rerender(element())
    };
};

describe('SendingLightning retry', () => {
    it('does not offer Try Again while the payment is in transit', async () => {
        // what TransactionsStore holds after LdkNode reports a keysend or
        // BOLT 12 payment still pending at its timeout
        const { navigation } = await renderView({ status: 'IN_FLIGHT' });

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
        const { navigation } = await renderView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        await fireEvent.press(screen.getByRole('button', { name: TRY_AGAIN }));

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
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
        const { navigation } = await renderView({ status: 'IN_FLIGHT' });

        expect(onBack()).toBe(true);

        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('leaves a failed payment to the default back behavior', async () => {
        const { navigation } = await renderView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        expect(onBack()).toBe(false);

        expect(navigation.popTo).not.toHaveBeenCalled();
    });
});

describe('SendingLightning donation', () => {
    // a settled payment followed by a 50 sat donation
    const paid = {
        payment_preimage: 'ab'.repeat(32),
        payment_hash: 'cd'.repeat(32),
        status: 'SUCCEEDED'
    };
    const params = {
        enableDonations: true,
        donationAmount: '50',
        donationFeeLimitSat: '5'
    };

    beforeEach(() =>
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc-donation')
    );

    const donate = async (result: any) => {
        // later attempts never settle, so a retry can't change the outcome
        const sendPaymentSilently = jest
            .fn()
            .mockResolvedValueOnce(result)
            .mockReturnValue(new Promise(() => {}));
        const { TransactionsStore, rerender } = await renderView(
            { loading: true, sendPaymentSilently, donationIsPaid: false },
            params
        );
        // the payment settles
        Object.assign(TransactionsStore, { ...paid, loading: false });
        await rerender();
        await act(async () => {
            await new Promise((resolve) => setImmediate(resolve));
        });
        return { TransactionsStore, sendPaymentSilently };
    };

    it('pays the donation with the fee limit of the payment', async () => {
        const { sendPaymentSilently } = await donate({ status: 'SUCCEEDED' });

        expect(sendPaymentSilently).toHaveBeenCalledWith({
            payment_request: 'lnbc-donation',
            fee_limit_sat: '5'
        });
    });

    it('does not mark a donation paid when embedded LND reports it failed', async () => {
        // lnrpc.Payment as decoded on embedded LND: numeric status, no
        // payment_error
        const { TransactionsStore, sendPaymentSilently } = await donate({
            status: 3,
            failure_reason: 2
        });

        expect(sendPaymentSilently).toHaveBeenCalled();
        expect(TransactionsStore.donationIsPaid).toBe(false);
    });

    it('marks a settled donation paid', async () => {
        const { TransactionsStore } = await donate({
            status: 2,
            value_sat: '50'
        });

        expect(TransactionsStore.donationIsPaid).toBe(true);
    });
});
