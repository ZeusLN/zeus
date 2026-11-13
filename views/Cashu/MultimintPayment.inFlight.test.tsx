import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Subtitle = ({ children }: any) => <Text>{children}</Text>;
    return { Icon: () => null, ListItem };
});
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/DonationUtils', () => ({
    ...jest.requireActual('../../utils/DonationUtils'),
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../storage', () => ({}));
jest.mock('../../components/Amount', () => () => null);
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/DonationGiftIcon', () => () => null);
jest.mock('../../components/DonationInfoModal', () => () => null);
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/MintAvatar', () => () => null);
jest.mock('../../components/PaymentDetailsSheet', () => () => null);
jest.mock('../../components/PaymentSuccessView', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../assets/images/SVG/ErrorIcon.svg', () => () => null);
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => () => null);

import { MintPaymentStatus, MultinutPaymentStep } from '../../utils/CashuUtils';
import MultimintPayment from './MultimintPayment';

const MINT_1 = 'https://mint.one';
const MINT_2 = 'https://mint.two';

// Mounts the screen with a store whose payment ends with the given per-mint
// statuses and no paid part, as payLnInvoiceFromEcash reports it
const renderAfterPayment = async (
    statuses: MintPaymentStatus[],
    paymentErrorMsg: string
) => {
    const cashuStore: any = {
        multiMintSelectedUrls: [MINT_1, MINT_2],
        getMultimintInfo: () => [
            { mintUrl: MINT_1, mintName: 'Mint One', balance: 600 },
            { mintUrl: MINT_2, mintName: 'Mint Two', balance: 500 }
        ],
        payReq: { getRequestAmount: 1000 },
        feeEstimate: 2,
        payReqMintBalance: 1100,
        multiMintPlannerSkips: [],
        mintInfos: {},
        paymentError: false
    };
    cashuStore.payLnInvoiceFromEcash = jest.fn(async ({ onProgress }: any) => {
        onProgress({
            step: MultinutPaymentStep.FAILED,
            mints: [MINT_1, MINT_2].map((mintUrl, i) => ({
                mintUrl,
                status: statuses[i]
            })),
            totalSelectedBalance: 1100,
            isProcessing: false
        });
        cashuStore.paymentError = true;
        cashuStore.paymentErrorMsg = paymentErrorMsg;
        return undefined;
    });

    await render(
        <MultimintPayment
            navigation={
                {
                    addListener: jest.fn(() => jest.fn()),
                    goBack: jest.fn(),
                    popTo: jest.fn()
                } as any
            }
            route={
                {
                    params: { paymentAmount: '1000', paymentRequest: 'lnbc1' }
                } as any
            }
            CashuStore={cashuStore}
        />
    );
    await screen.findByText(paymentErrorMsg);
};

const tryAgain = () =>
    screen.queryByRole('button', { name: 'views.SendingLightning.tryAgain' });

describe('MultimintPayment with a part that may still settle', () => {
    it('does not offer to pay again while a part is in flight', async () => {
        await renderAfterPayment(
            [MintPaymentStatus.IN_FLIGHT, MintPaymentStatus.FAILED],
            'stores.CashuStore.paymentInFlight'
        );

        expect(tryAgain()).toBeNull();
        expect(
            screen.getByText(
                `views.Cashu.MultimintPayment.inFlight | ${MINT_1}`
            )
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'views.SendingLightning.goToWallet'
            })
        ).toBeTruthy();
    });

    it('still offers to pay again when every part failed', async () => {
        await renderAfterPayment(
            [MintPaymentStatus.FAILED, MintPaymentStatus.FAILED],
            'refused'
        );

        expect(tryAgain()).not.toBeNull();
    });
});
