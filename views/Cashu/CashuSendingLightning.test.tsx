jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/SchedulingUtils', () => ({
    runWhenIdle: (task: () => void) => {
        task();
        return () => {};
    }
}));
jest.mock('../../utils/DonationUtils', () => ({
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/ContactUtils', () => ({
    findContactByLightningAddress: () => undefined
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../storage', () => ({
    getItem: jest.fn().mockResolvedValue('')
}));
jest.mock('../LnurlPay/Success', () => 'LnurlPaySuccess');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/layout/Row', () => {
    const { View } = require('react-native');
    return { Row: ({ children }: any) => <View>{children}</View> };
});
jest.mock('../../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../../components/PaymentErrorView', () => 'PaymentErrorView');
jest.mock('../../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../../components/SendingLoadingView', () => 'SendingLoadingView');
jest.mock('../../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { loadDonationLnurl } from '../../utils/DonationUtils';
import CashuSendingLightning from './CashuSendingLightning';

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
        NodeInfoStore={{ nodeInfo: { isMainNet: true } } as any}
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
});
