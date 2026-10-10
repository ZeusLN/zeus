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

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

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

    it('does not show the success screen for a pending LDK keysend with a route', async () => {
        // TransactionsStore after an LdkNode keysend still pending at its
        // timeout, from a build that returned payment_route with the result
        await renderView({
            status: 'IN_FLIGHT',
            payment_route: {},
            payment_preimage: ''
        });

        expect(hosts('PaymentSuccessView')).toHaveLength(0);
        expect(
            screen.getByText('views.SendingLightning.inTransit')
        ).toBeOnTheScreen();
    });

    it('shows the success screen for a completed payment', async () => {
        await renderView({
            status: 'SUCCEEDED',
            payment_route: {},
            payment_preimage: 'aa'.repeat(32)
        });

        expect(hosts('PaymentSuccessView')).toHaveLength(1);
        expect(
            screen.queryByText('views.SendingLightning.inTransit')
        ).not.toBeOnTheScreen();
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

describe('SendingLightning payment lookup after success', () => {
    const failedPayment = { payment_preimage: '', getAmount: 3333 };
    const settledPayment = {
        payment_preimage: 'aa'.repeat(32),
        getAmount: 1000
    };

    // Opens the screen while the payment is sending, then lets it succeed
    // with `payment_preimage`, which makes the screen look the payment up
    const amountShownFor = async (payment_preimage: string) => {
        const TransactionsStore: any = {
            loading: true,
            error: false,
            status: null
        };
        const props: any = {
            navigation: {
                goBack: jest.fn(),
                popTo: jest.fn(),
                addListener: jest.fn(() => jest.fn())
            },
            route: { key: 'SendingLightning', name: 'SendingLightning' },
            TransactionsStore,
            ContactStore: { contacts: [] },
            LnurlPayStore: {},
            NodeInfoStore: { nodeInfo: {} },
            BalanceStore: { getCombinedBalance: jest.fn() },
            PaymentsStore: {
                getPayments: jest.fn(async () => [
                    failedPayment,
                    settledPayment
                ])
            }
        };
        const { rerender } = await render(<SendingLightning {...props} />);

        Object.assign(TransactionsStore, {
            loading: false,
            status: 'SUCCEEDED',
            payment_preimage
        });
        await rerender(<SendingLightning {...props} />);
        await act(async () => {
            await new Promise((resolve) => setImmediate(resolve));
        });

        return hosts('PaymentSuccessView')[0].props.paymentAmount;
    };

    it('matches the sent payment by preimage', async () => {
        expect(await amountShownFor('aa'.repeat(32))).toBe(1000);
    });

    it('does not match an unsettled payment on an empty preimage', async () => {
        expect(await amountShownFor('')).toBeUndefined();
    });
});
