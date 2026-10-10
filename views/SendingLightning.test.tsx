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
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Screen', () => 'Screen');
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
    default: { isLocalWallet: () => false }
}));
jest.mock('../utils/ContactUtils', () => ({
    __esModule: true,
    default: { findContactByLightningAddress: () => undefined }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../storage', () => ({}));
jest.mock('../assets/images/SVG/Clock.svg', () => 'Clock');
jest.mock('../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');
jest.mock('../utils/AmountUtils', () => ({ getFeePercentage: jest.fn() }));

import * as React from 'react';
import SendingLightning from './SendingLightning';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findAll = (node: any, predicate: (node: any) => boolean): any[] => {
    if (!React.isValidElement(node)) return [];
    const matches = predicate(node) ? [node] : [];
    return matches.concat(
        ...childrenOf(node).map((child) => findAll(child, predicate))
    );
};

const buttonTitles = (tree: any): string[] =>
    findAll(tree, (node) => node.type === 'Button').map(
        (button) => button.props.title
    );

const makeView = (transactionsState: Record<string, any>) => {
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
    const navigation = { goBack: jest.fn(), popTo: jest.fn() };
    const view = new SendingLightning({
        navigation,
        route: { key: 'SendingLightning', name: 'SendingLightning' },
        TransactionsStore,
        ContactStore: { contacts: [] },
        LnurlPayStore: {}
    } as unknown as React.ComponentProps<typeof SendingLightning>);
    return { view, navigation };
};

describe('SendingLightning retry', () => {
    it('does not offer Try Again while the payment is in transit', () => {
        // what TransactionsStore holds after LdkNode reports a keysend or
        // BOLT 12 payment still pending at its timeout
        const { view } = makeView({ status: 'IN_FLIGHT' });

        const tree = view.render();

        expect(buttonTitles(tree)).not.toContain(
            'views.SendingLightning.tryAgain'
        );
        expect(buttonTitles(tree)).toContain(
            'views.SendingLightning.goToWallet'
        );
        expect(
            findAll(
                tree,
                (node) =>
                    node.props?.children === 'views.SendingLightning.inTransit'
            )
        ).toHaveLength(1);
    });

    it('does not show the success screen for a pending LDK keysend with a route', () => {
        // TransactionsStore after an LdkNode keysend still pending at its
        // timeout, from a build that returned payment_route with the result
        const { view } = makeView({
            status: 'IN_FLIGHT',
            payment_route: {},
            payment_preimage: ''
        });

        const tree = view.render();

        expect(
            findAll(tree, (node) => node.type === 'PaymentSuccessView')
        ).toHaveLength(0);
        expect(
            findAll(
                tree,
                (node) =>
                    node.props?.children === 'views.SendingLightning.inTransit'
            )
        ).toHaveLength(1);
    });

    it('shows the success screen for a completed payment', () => {
        const { view } = makeView({
            status: 'SUCCEEDED',
            payment_route: {},
            payment_preimage: 'aa'.repeat(32)
        });

        const tree = view.render();

        expect(
            findAll(tree, (node) => node.type === 'PaymentSuccessView')
        ).toHaveLength(1);
        expect(
            findAll(
                tree,
                (node) =>
                    node.props?.children === 'views.SendingLightning.inTransit'
            )
        ).toHaveLength(0);
    });

    it('offers Try Again, going back to the previous screen, after a failure', () => {
        const { view, navigation } = makeView({
            error: true,
            error_msg: 'RouteNotFound'
        });

        const tryAgain = findAll(
            view.render(),
            (node) =>
                node.type === 'Button' &&
                node.props.title === 'views.SendingLightning.tryAgain'
        );

        expect(tryAgain).toHaveLength(1);
        tryAgain[0].props.onPress();
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});

describe('SendingLightning.fetchPayments', () => {
    const failedPayment = { payment_preimage: '', getAmount: 3333 };
    const settledPayment = {
        payment_preimage: 'aa'.repeat(32),
        getAmount: 1000
    };

    const currentPaymentFor = async (payment_preimage: string) => {
        const { view } = makeView({ payment_preimage });
        (view as any).props.PaymentsStore = {
            getPayments: jest.fn(async () => [failedPayment, settledPayment])
        };
        view.setState = jest.fn() as any;

        await view.fetchPayments();

        return (view.setState as jest.Mock).mock.calls[0][0].currentPayment;
    };

    it('matches the sent payment by preimage', async () => {
        expect(await currentPaymentFor('aa'.repeat(32))).toBe(settledPayment);
    });

    it('does not match an unsettled payment on an empty preimage', async () => {
        expect(await currentPaymentFor('')).toBeUndefined();
    });
});
