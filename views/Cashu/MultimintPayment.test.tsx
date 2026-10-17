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
jest.mock('../../utils/DonationUtils', () => ({}));
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
                NodeInfoStore={{ nodeInfo: {} } as any}
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

describe('MultimintPayment', () => {
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
