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
    runWhenIdle: jest.fn(() => jest.fn())
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
jest.mock('../../storage', () => ({}));
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
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
