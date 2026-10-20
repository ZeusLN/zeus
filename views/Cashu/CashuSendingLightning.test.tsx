jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: 'SafeAreaView'
}));
jest.mock('../../utils/DonationUtils', () => ({
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/SchedulingUtils', () => ({
    runWhenIdle: (task: () => void) => {
        task();
        return () => {};
    }
}));
jest.mock('../LnurlPay/Success', () => 'LnurlPaySuccess');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../../components/PaymentErrorView', () => 'PaymentErrorView');
jest.mock('../../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../../components/SendingLoadingView', () => 'SendingLoadingView');
jest.mock('../../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../../components/sendingStyles', () => ({
    sendingStyles: { content: {}, buttons: {} }
}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/ContactStore', () => ({}));
jest.mock('../../stores/LnurlPayStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../utils/ContactUtils', () => ({
    __esModule: true,
    default: { findContactByLightningAddress: () => undefined }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/UrlUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../../storage', () => ({
    getItem: jest.fn().mockResolvedValue('')
}));
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { loadDonationLnurl } from '../../utils/DonationUtils';
import CashuSendingLightning from './CashuSendingLightning';

const renderView = async (paymentHash: string, LnurlPayStore: any) => {
    const CashuStore = {
        loading: false,
        paymentSuccess: true,
        paymentError: false,
        payReq: { payment_hash: paymentHash, getRequestAmount: 21 },
        paymentPreimage: 'ab'.repeat(32),
        resetPaymentState: jest.fn(),
        payLnInvoiceFromEcash: jest.fn()
    };
    await render(
        <CashuSendingLightning
            {...({
                navigation: { addListener: jest.fn(() => jest.fn()) },
                route: { params: {} },
                CashuStore,
                ContactStore: { contacts: [] },
                LnurlPayStore,
                NodeInfoStore: { nodeInfo: {} }
            } as any)}
        />
    );
};

const recipient = () =>
    screen.container.queryAll((n) => n.type === 'PaymentDetailsSheet')[0].props
        .lightningAddress;

describe('CashuSendingLightning recipient', () => {
    // a Lightning address looked up earlier for another invoice
    const lnurlPay = {
        paymentHash: '5e'.repeat(32),
        lightningAddress: 'alice@friends.example'
    };

    it('shows the Lightning address for the invoice it was looked up for', async () => {
        await renderView(lnurlPay.paymentHash, lnurlPay);

        expect(recipient()).toBe('alice@friends.example');
    });

    it('does not show the Lightning address for a different payment', async () => {
        await renderView('cd'.repeat(32), lnurlPay);

        expect(recipient()).toBeUndefined();
    });
});

const navigation = {
    addListener: jest.fn(() => () => {}),
    navigate: jest.fn(),
    popTo: jest.fn()
} as any;

const buildCashuStore = () => ({
    resetPaymentState: jest.fn(),
    getPayReq: jest.fn().mockResolvedValue(undefined),
    payLnInvoiceFromEcash: jest.fn().mockResolvedValue(undefined),
    paymentSuccess: false,
    paymentError: false,
    loading: false
});

const view = (cashuStore: any, params: any) => (
    <CashuSendingLightning
        navigation={navigation}
        route={{ params } as any}
        CashuStore={cashuStore}
        ContactStore={{ contacts: [] } as any}
        LnurlPayStore={{} as any}
    />
);

describe('CashuSendingLightning', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pays only the invoice reviewed on the previous screen', async () => {
        const cashuStore = buildCashuStore();

        await render(
            view(cashuStore, {
                paymentAmount: '100',
                paymentRequest: 'lnbc1reviewed',
                enableDonations: false
            })
        );

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '100',
            paymentRequest: 'lnbc1reviewed'
        });
    });

    it('pays the donation only for the donation invoice it loaded', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const cashuStore = buildCashuStore();
        const params = {
            paymentAmount: '100',
            paymentRequest: 'lnbc1reviewed',
            enableDonations: true,
            donationAmount: '5'
        };

        const { rerender } = await render(view(cashuStore, params));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, params));

        await waitFor(() =>
            expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(2)
        );
        expect(cashuStore.getPayReq).toHaveBeenCalledWith(
            'lnbc1donation',
            true
        );
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenLastCalledWith({
            amount: '5',
            paymentRequest: 'lnbc1donation',
            isDonationPayment: true
        });
    });

    // The screen stays mounted under anything pushed on top of it (Add a
    // note, then a payment opened from a link). paymentSuccess is shared by
    // every payment, so a later one flips it back to false and then true.
    const laterPaymentSucceeds = async (
        cashuStore: any,
        rerender: (el: React.ReactElement) => Promise<void> | void,
        params: any
    ) => {
        cashuStore.paymentSuccess = false;
        await rerender(view(cashuStore, params));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, params));
    };

    const donationParams = {
        paymentAmount: '100',
        paymentRequest: 'lnbc1reviewed',
        donationAmount: '25'
    };

    it('does not send the donation again on a later payment when its invoice could not be fetched', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue(null);
        const cashuStore = buildCashuStore();

        const { rerender } = await render(view(cashuStore, donationParams));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, donationParams));
        await waitFor(() => expect(loadDonationLnurl).toHaveBeenCalledTimes(1));

        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        await laterPaymentSucceeds(cashuStore, rerender, donationParams);
        await new Promise((r) => setImmediate(r));

        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
    });

    it('does not send the donation again on a later payment when it was not paid', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const cashuStore = buildCashuStore();

        const { rerender } = await render(view(cashuStore, donationParams));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, donationParams));
        await waitFor(() =>
            expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(2)
        );

        await laterPaymentSucceeds(cashuStore, rerender, donationParams);
        await new Promise((r) => setImmediate(r));

        // the payment and one donation attempt
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(2);
        expect(loadDonationLnurl).toHaveBeenCalledTimes(1);
    });
});
