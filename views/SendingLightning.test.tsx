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
        isLNDBased: () => false,
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

const TRY_AGAIN = 'views.SendingLightning.tryAgain';
const GO_TO_WALLET = 'views.SendingLightning.goToWallet';

const renderView = async (transactionsState: Record<string, any>) => {
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
                LnurlPayStore: {},
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

    it('leaves a failed payment to the default back behavior', async () => {
        const navigation = await renderView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        expect(onBack()).toBe(false);

        expect(navigation.popTo).not.toHaveBeenCalled();
    });
});

describe('SendingLightning donation', () => {
    const { loadDonationLnurl } = jest.requireMock('../utils/DonationUtils');
    // stops a runaway retry loop so a failing test still finishes
    const MAX_LOOKUPS = 3;

    // The lookup answers `invoice` (or rejects with it) for the first few
    // calls, then never settles, so a retry loop shows up as extra calls
    // instead of hanging the test
    const lookupReturns = (invoice: any, rejects = false) => {
        let calls = 0;
        loadDonationLnurl.mockReset().mockImplementation(() => {
            if (++calls > MAX_LOOKUPS) return new Promise(() => {});
            return rejects ? Promise.reject(invoice) : Promise.resolve(invoice);
        });
    };

    // Opens the sending screen with a 21 sat donation selected, then lets
    // the payment succeed, which is when the screen sends the donation
    const donate = async (sendPaymentSilently: jest.Mock) => {
        const TransactionsStore: any = {
            loading: true,
            error: false,
            status: null,
            donationIsPaid: false,
            sendPaymentSilently
        };
        const props: any = {
            navigation: {
                goBack: jest.fn(),
                popTo: jest.fn(),
                addListener: jest.fn(() => jest.fn())
            },
            route: {
                key: 'SendingLightning',
                name: 'SendingLightning',
                params: { donationAmount: '21', enableDonations: true }
            },
            TransactionsStore,
            BalanceStore: { getCombinedBalance: jest.fn() },
            ChannelsStore: { getChannels: jest.fn() },
            NodeInfoStore: { nodeInfo: { isMainNet: true } },
            PaymentsStore: { getPayments: jest.fn().mockResolvedValue([]) },
            ContactStore: { contacts: [] },
            LnurlPayStore: {}
        };
        const { rerender } = await render(<SendingLightning {...props} />);

        Object.assign(TransactionsStore, {
            loading: false,
            status: 'SUCCEEDED'
        });
        await rerender(<SendingLightning {...props} />);
        await act(async () => {
            await new Promise((resolve) => setImmediate(resolve));
        });

        return TransactionsStore;
    };

    const hostProps = (type: string) =>
        screen.container.queryAll((n) => n.type === type)[0]?.props;
    const gift = () => hostProps('DonationGiftIcon');
    const infoModal = () => hostProps('DonationInfoModal');

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('pays the donation once after a successful payment', async () => {
        lookupReturns('lnbc1donation');
        const sendPaymentSilently = jest
            .fn()
            .mockResolvedValue({ status: 'SUCCEEDED', num_satoshis: 21 });

        const TransactionsStore = await donate(sendPaymentSilently);

        expect(sendPaymentSilently).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.donationIsPaid).toBe(true);
        expect(gift().donationHandled).toBe(true);
        expect(infoModal().amountDonated).toBe(21);
    });

    it('does not retry when the donation LNURL returns no invoice', async () => {
        lookupReturns(undefined);
        const sendPaymentSilently = jest.fn();

        await donate(sendPaymentSilently);

        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
        expect(sendPaymentSilently).not.toHaveBeenCalled();
        expect(gift().payingDonation).toBe(false);
        expect(infoModal().amountDonated).toBe(21);
    });

    it.each([
        ['resolves FAILED', { status: 'FAILED' }],
        ['resolves with a payment error', { payment_error: 'no route' }]
    ])(
        'does not retry when the donation payment %s',
        async (_label, result) => {
            lookupReturns('lnbc1donation');
            const sendPaymentSilently = jest.fn().mockResolvedValue(result);

            const TransactionsStore = await donate(sendPaymentSilently);

            expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
            expect(sendPaymentSilently).toHaveBeenCalledTimes(1);
            expect(TransactionsStore.donationIsPaid).toBe(false);
            expect(gift().payingDonation).toBe(false);
            expect(infoModal().amountDonated).toBe(21);
            // the gift icon and info modal still show the donation as not made
            expect(gift().donationHandled).toBe(false);
        }
    );

    it('does not retry when sending the donation throws', async () => {
        lookupReturns('lnbc1donation');
        const sendPaymentSilently = jest
            .fn()
            .mockRejectedValue(new Error('timeout'));

        await donate(sendPaymentSilently);

        expect(sendPaymentSilently).toHaveBeenCalledTimes(1);
        expect(gift().payingDonation).toBe(false);
        expect(infoModal().amountDonated).toBe(21);
    });

    it('does not retry when fetching the donation invoice throws', async () => {
        lookupReturns(new Error('offline'), true);
        const sendPaymentSilently = jest.fn();

        await donate(sendPaymentSilently);

        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
        expect(sendPaymentSilently).not.toHaveBeenCalled();
        expect(gift().payingDonation).toBe(false);
    });
});
