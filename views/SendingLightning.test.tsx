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

    // Opens the sending screen with a donation selected, then lets the
    // payment succeed, which is when the screen sends the donation
    const donate = async (result: any) => {
        // Only the first lookup answers. Without #5029 a failed donation
        // is tried again on every update, and a lookup that never settles
        // stops that retry from looping through the test.
        loadDonationLnurl
            .mockReset()
            .mockResolvedValueOnce('lnbc1donation')
            .mockReturnValue(new Promise(() => {}));
        const sendPaymentSilently = jest.fn().mockResolvedValue(result);
        const getPayments = jest.fn().mockResolvedValue([]);
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
                params: { donationAmount: '100', enableDonations: true }
            },
            TransactionsStore,
            ContactStore: { contacts: [] },
            LnurlPayStore: {},
            NodeInfoStore: { nodeInfo: { isMainNet: true } },
            PaymentsStore: { getPayments },
            BalanceStore: { getCombinedBalance: jest.fn() },
            ChannelsStore: { getChannels: jest.fn() }
        };
        const { rerender } = await render(<SendingLightning {...props} />);

        Object.assign(TransactionsStore, {
            loading: false,
            status: 'SUCCEEDED',
            payment_preimage: 'cd'.repeat(32)
        });
        await rerender(<SendingLightning {...props} />);
        await act(async () => {
            await new Promise((resolve) => setImmediate(resolve));
        });

        return { TransactionsStore, getPayments, sendPaymentSilently };
    };

    const hostProps = (type: string) =>
        screen.container.queryAll((n) => n.type === type)[0]?.props;

    // the donation lookup asks for the last payment only; the main
    // payment's lookup asks for five
    const donationLookups = (getPayments: jest.Mock) =>
        getPayments.mock.calls.filter(([args]) => args.maxPayments === 1);

    it('marks an in-flight donation paid so it is not sent again, without reporting it as donated', async () => {
        // what the NWC backend returns on a wallet reply timeout
        const { TransactionsStore, getPayments, sendPaymentSilently } =
            await donate({
                status: 'IN_FLIGHT',
                payment_hash: 'ab'.repeat(32)
            });

        expect(sendPaymentSilently).toHaveBeenCalledWith({
            payment_request: 'lnbc1donation'
        });
        expect(TransactionsStore.donationIsPaid).toBe(true);
        expect(hostProps('DonationGiftIcon')).toMatchObject({
            payingDonation: false,
            donationHandled: false
        });
        expect(hostProps('DonationInfoModal').donationPreimage).toBe('');
        expect(donationLookups(getPayments)).toHaveLength(0);
    });

    it('reports a failed donation as unpaid', async () => {
        const { TransactionsStore, sendPaymentSilently } = await donate({
            status: 'FAILED'
        });

        expect(sendPaymentSilently).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.donationIsPaid).toBe(false);
        expect(hostProps('DonationGiftIcon').donationHandled).toBe(false);
        // Currently the failure clears payingDonation, which re-runs the
        // donation check on the next update and starts another attempt
        // (held here at the lookup). #5029 stops that retry.
        expect(loadDonationLnurl).toHaveBeenCalledTimes(2);
        expect(hostProps('DonationGiftIcon').payingDonation).toBe(true);
    });
});
