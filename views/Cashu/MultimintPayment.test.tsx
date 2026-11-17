jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({
    Icon: 'Icon',
    ListItem: Object.assign(() => null, {
        Content: 'ListItem.Content',
        Title: 'ListItem.Title',
        Subtitle: 'ListItem.Subtitle'
    })
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/sendingStyles', () => ({
    sendingStyles: { content: {} }
}));
jest.mock('../../cashu-cdk', () => ({}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../utils/DonationUtils', () => ({
    ...jest.requireActual('../../utils/DonationUtils'),
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => key
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../storage', () => ({}));
jest.mock('../../assets/images/SVG/ErrorIcon.svg', () => 'ErrorIcon');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { loadDonationLnurl } from '../../utils/DonationUtils';
import MultimintPayment from './MultimintPayment';
import { MultinutPaymentStep } from '../../utils/CashuUtils';

const reviewed = { getRequestAmount: 6000, payment_hash: 'a'.repeat(64) };
const other = { getRequestAmount: 1, payment_hash: 'b'.repeat(64) };

const renderScreen = async (CashuStore: any) => {
    let view: MultimintPayment | null = null;
    await act(async () => {
        render(
            <MultimintPayment
                ref={(r: MultimintPayment | null) => {
                    view = r;
                }}
                navigation={{ addListener: () => () => {} } as any}
                route={{ params: { paymentAmount: '6000' } } as any}
                CashuStore={CashuStore}
            />
        );
    });
    const propsOf = (type: string) =>
        screen.container.queryAll((n) => n.type === type)[0]?.props;
    return { state: view!.state, propsOf };
};

const cashuStore = (payLnInvoiceFromEcash: () => Promise<any>) => ({
    payReq: reviewed,
    feeEstimate: 0,
    mintInfos: {},
    multiMintSelectedUrls: [],
    paymentError: false,
    paymentErrorMsg: '',
    getMultimintInfo: () => [
        { mintUrl: 'https://mint.example', balance: 10000 }
    ],
    payLnInvoiceFromEcash
});

const REVIEWED = 'lnbc1reviewed';

// The payment and donation handlers are driven directly on an instance;
// setState is replaced because the instance is never mounted
const paymentScreen = () => {
    const cashuStore = {
        multiMintSelectedUrls: ['https://mint.one', 'https://mint.two'],
        getMultimintInfo: () => [],
        getPayReq: jest.fn().mockResolvedValue(undefined),
        payLnInvoiceFromEcash: jest.fn().mockResolvedValue(undefined),
        paymentError: false
    };
    const screen = new MultimintPayment({
        navigation: { addListener: jest.fn() },
        route: {
            params: {
                paymentAmount: '100',
                paymentRequest: REVIEWED
            }
        },
        CashuStore: cashuStore,
        NodeInfoStore: { nodeInfo: { isMainNet: true } }
    } as any);
    screen.setState = jest.fn();
    return { screen, cashuStore };
};

describe('MultimintPayment', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pays only the invoice reviewed on the previous screen', async () => {
        const { screen, cashuStore } = paymentScreen();

        await screen.executePayment();

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: '100',
                paymentRequest: REVIEWED
            })
        );
    });

    it('pays the donation only for the donation invoice it loaded', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const { screen, cashuStore } = paymentScreen();

        await screen.handleDonationPayment('5');

        expect(cashuStore.getPayReq).toHaveBeenCalledWith(
            'lnbc1donation',
            true
        );
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '5',
            paymentRequest: 'lnbc1donation',
            isDonationPayment: true
        });
    });

    it('shows a paid invoice as sent when another payment left an error on the store', async () => {
        const CashuStore: any = cashuStore(async () => {
            // another payment that failed while this melt was awaited
            CashuStore.paymentError = true;
            CashuStore.paymentErrorMsg = 'error of another payment';
            return {};
        });

        const { state, propsOf } = await renderScreen(CashuStore);

        expect(state.step).toBe(MultinutPaymentStep.COMPLETE);
        expect(state.error).toBeUndefined();
        expect(propsOf('PaymentSuccessView')).toBeDefined();
    });

    it('shows a failed payment as failed', async () => {
        const CashuStore: any = cashuStore(async () => {
            CashuStore.paymentError = true;
            CashuStore.paymentErrorMsg = 'mint unreachable';
            return undefined;
        });

        const { state } = await renderScreen(CashuStore);

        expect(state.step).toBe(MultinutPaymentStep.FAILED);
        expect(state.error).toBe('mint unreachable');
    });

    it('reports the reviewed invoice when another one is decoded in flight', async () => {
        const CashuStore: any = cashuStore(async () => {
            // what getPayReq does for a deep link, an NWC request or
            // the donation while the melt is awaited
            CashuStore.payReq = other;
            return {};
        });

        const { propsOf } = await renderScreen(CashuStore);

        expect(propsOf('PaymentSuccessView').paymentAmount).toBe(
            reviewed.getRequestAmount
        );
        expect(propsOf('PaymentDetailsSheet')).toMatchObject({
            paymentAmount: reviewed.getRequestAmount,
            paymentHash: reviewed.payment_hash
        });
    });
});

const MINT_1 = 'https://mint.one';
const MINT_2 = 'https://mint.two';

// Two selected mints. The invoice is 75 sats with a 2 sat fee reserve, so
// the planner stops after the first mint and only it is in meltQuotes:
// getMultimintInfo() lists just that mint. The screen is constructed but
// never mounted, so no payment starts.
const fundsCheckScreen = ({
    donationAmount,
    plannedBalance = 89,
    payReqMintBalance = 139
}: {
    donationAmount?: string;
    plannedBalance?: number;
    payReqMintBalance?: number;
}) =>
    new MultimintPayment({
        navigation: { addListener: jest.fn() },
        route: { params: { paymentAmount: '75', donationAmount } },
        CashuStore: {
            multiMintSelectedUrls: [MINT_1, MINT_2],
            getMultimintInfo: () => [
                { mintUrl: MINT_1, balance: plannedBalance }
            ],
            payReq: { getRequestAmount: 75 },
            feeEstimate: 2,
            payReqMintBalance,
            multiMintPlannerSkips: []
        }
    } as any);

describe('MultimintPayment funds check', () => {
    it('starts when both selected mints cover the invoice and the donation', () => {
        // 75 + 2 + 20 = 97: more than the planned mint has, less than both
        const { state } = fundsCheckScreen({ donationAmount: '20' });

        expect(state.step).toBe(MultinutPaymentStep.PROCESSING);
        expect(state.error).toBeUndefined();
        // the progress list still shows only the planned mint
        expect(state.mints.map(({ mintUrl }) => mintUrl)).toEqual([MINT_1]);
    });

    it('refuses to start when the donation leaves both mints short', () => {
        // 75 + 2 + 75 = 152 > 139
        const { state } = fundsCheckScreen({ donationAmount: '75' });

        expect(state.step).toBe(MultinutPaymentStep.FAILED);
        expect(state.error).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('checks the planned mints when getPayReq did not count a balance', () => {
        // 75 + 2 = 77 > 70
        const { state } = fundsCheckScreen({
            plannedBalance: 70,
            payReqMintBalance: 0
        });

        expect(state.step).toBe(MultinutPaymentStep.FAILED);
        expect(state.error).toBe('stores.CashuStore.notEnoughFunds');
    });
});
