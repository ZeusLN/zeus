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

const REVIEWED = 'lnbc1reviewed';

// the plan CashuPaymentRequest quoted for the invoice it showed
const makePlan = (paymentRequest: string, payReq: object = {}): any => ({
    paymentRequest,
    payReq: {
        payment_hash: 'ab'.repeat(32),
        getRequestAmount: 21,
        getMemo: 'coffee',
        ...payReq
    },
    meltQuote: { quote: `quote-${paymentRequest}` },
    meltQuotes: [],
    plannerSkips: [],
    feeEstimate: 1,
    mintBalance: 5000,
    amount: 21
});

// what the store held before getPayReq stopped keeping its result: none
// of it may reach the screen or the payment
const decoys = {
    paymentRequest: 'lnbc1decoy',
    payReq: {
        payment_hash: 'de'.repeat(32),
        getRequestAmount: 999,
        getMemo: 'decoy memo'
    },
    meltQuote: { quote: 'decoy-quote' },
    meltQuotes: [{ mintUrl: 'https://decoy.mint', quote: 'decoy-quote' }],
    feeEstimate: 4242,
    payReqMintBalance: 1,
    payReqAmount: 999
};

const navigation = {
    addListener: jest.fn(() => () => {}),
    navigate: jest.fn(),
    popTo: jest.fn()
} as any;

const buildCashuStore = (fields: object = {}): any => ({
    ...decoys,
    resetPaymentState: jest.fn(),
    getPayReq: jest.fn(async (paymentRequest: string) =>
        makePlan(paymentRequest)
    ),
    payLnInvoiceFromEcash: jest.fn().mockResolvedValue(undefined),
    paymentSuccess: false,
    paymentError: false,
    loading: false,
    ...fields
});

const view = (cashuStore: any, params: any, LnurlPayStore: any = {}) => (
    <CashuSendingLightning
        navigation={navigation}
        route={{ params } as any}
        CashuStore={cashuStore}
        ContactStore={{ contacts: [] } as any}
        LnurlPayStore={LnurlPayStore}
    />
);

const hostProps = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0]?.props;

describe('CashuSendingLightning recipient', () => {
    // a Lightning address looked up earlier for another invoice
    const lnurlPay = {
        paymentHash: '5e'.repeat(32),
        lightningAddress: 'alice@friends.example'
    };

    const renderPaid = (planHash: string, storeHash: string) =>
        render(
            view(
                buildCashuStore({
                    paymentSuccess: true,
                    paymentPreimage: 'ab'.repeat(32),
                    payReq: { ...decoys.payReq, payment_hash: storeHash }
                }),
                {
                    paymentPlan: makePlan(REVIEWED, {
                        payment_hash: planHash
                    })
                },
                lnurlPay
            )
        );

    it('shows the Lightning address for the invoice it was looked up for', async () => {
        await renderPaid(lnurlPay.paymentHash, 'cd'.repeat(32));

        expect(hostProps('PaymentDetailsSheet').lightningAddress).toBe(
            'alice@friends.example'
        );
    });

    it('does not show the Lightning address for a different payment', async () => {
        // the store still holds the invoice the address was looked up for
        await renderPaid('cd'.repeat(32), lnurlPay.paymentHash);

        expect(
            hostProps('PaymentDetailsSheet').lightningAddress
        ).toBeUndefined();
    });
});

describe('CashuSendingLightning shows the plan it was handed', () => {
    const renderPaid = (params: object) =>
        render(
            view(
                buildCashuStore({
                    paymentSuccess: true,
                    paymentPreimage: 'ab'.repeat(32)
                }),
                params
            )
        );

    it('shows the amount, memo and payment hash of the plan', async () => {
        await renderPaid({ paymentPlan: makePlan(REVIEWED) });

        expect(hostProps('PaymentSuccessView').paymentAmount).toBe(21);
        expect(hostProps('PaymentDetailsSheet')).toMatchObject({
            paymentAmount: 21,
            memo: 'coffee',
            paymentHash: 'ab'.repeat(32)
        });
    });

    it('shows the amount from the route params over the plan amount', async () => {
        await renderPaid({
            paymentAmount: '100',
            paymentPlan: makePlan(REVIEWED)
        });

        expect(hostProps('PaymentSuccessView').paymentAmount).toBe(100);
    });

    it('shows no invoice details without a plan', async () => {
        await renderPaid({ paymentAmount: '100' });

        expect(hostProps('PaymentDetailsSheet')).toMatchObject({
            paymentAmount: 100,
            memo: undefined,
            paymentHash: undefined
        });
    });
});

describe('CashuSendingLightning', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pays the plan reviewed on the previous screen', async () => {
        const cashuStore = buildCashuStore();
        const paymentPlan = makePlan(REVIEWED);

        await render(view(cashuStore, { paymentAmount: '100', paymentPlan }));

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '100',
            plan: paymentPlan
        });
        expect(cashuStore.payLnInvoiceFromEcash.mock.calls[0][0].plan).toBe(
            paymentPlan
        );
        // the screen pays what it was handed and quotes nothing itself
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
    });

    it('hands the store no plan when it was opened without one', async () => {
        const cashuStore = buildCashuStore();

        await render(view(cashuStore, { paymentAmount: '100' }));

        // payLnInvoiceFromEcash pays nothing without a plan
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '100',
            plan: undefined
        });
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
    });

    it('quotes the donation invoice it loaded and pays that plan as a donation', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const cashuStore = buildCashuStore();
        const params = {
            paymentAmount: '100',
            paymentPlan: makePlan(REVIEWED),
            donationAmount: '5'
        };

        const { rerender } = await render(view(cashuStore, params));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, params));

        await waitFor(() =>
            expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(2)
        );
        expect(cashuStore.getPayReq.mock.calls).toEqual([['lnbc1donation']]);
        const donationPlan = await cashuStore.getPayReq.mock.results[0].value;
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenLastCalledWith({
            amount: '5',
            plan: donationPlan,
            isDonationPayment: true
        });
        const { plan } = cashuStore.payLnInvoiceFromEcash.mock.calls[1][0];
        expect(plan).toBe(donationPlan);
        expect(plan).not.toBe(params.paymentPlan);
    });

    it('sends no donation without a donation amount', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const cashuStore = buildCashuStore();
        const params = {
            paymentAmount: '100',
            paymentPlan: makePlan(REVIEWED)
        };

        const { rerender } = await render(view(cashuStore, params));
        cashuStore.paymentSuccess = true;
        await rerender(view(cashuStore, params));
        await new Promise((r) => setImmediate(r));

        expect(loadDonationLnurl).not.toHaveBeenCalled();
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
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
        paymentPlan: makePlan(REVIEWED),
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
