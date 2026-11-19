jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const Wrapper = ({ children }: any) => <View>{children}</View>;
    const Label = ({ children }: any) => <Text>{children}</Text>;
    return {
        Icon: 'Icon',
        ListItem: Object.assign(Wrapper, {
            Content: Wrapper,
            Title: Label,
            Subtitle: Label
        })
    };
});
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/DonationUtils', () => ({
    ...jest.requireActual('../../utils/DonationUtils'),
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../storage', () => ({
    getItem: jest.fn().mockResolvedValue('')
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../assets/images/SVG/ErrorIcon.svg', () => 'ErrorIcon');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { BackHandler } from 'react-native';
import { act, render } from '@testing-library/react-native';
import MultimintPayment from './MultimintPayment';

// Mounts the screen with a payment whose result is settled by the test,
// and captures the screen's hardwareBackPress listener
const renderPayment = async () => {
    let onBack: (() => boolean) | undefined;
    const remove = jest.fn();
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(
        (_event: any, listener: any) => {
            onBack = listener;
            return { remove } as any;
        }
    );

    let settle: (payment: any) => void = () => {};
    const CashuStore = {
        multiMintSelectedUrls: ['https://mint.one', 'https://mint.two'],
        getMultimintInfo: () => [
            { mintUrl: 'https://mint.one', balance: 10000 },
            { mintUrl: 'https://mint.two', balance: 10000 }
        ],
        payReq: { getRequestAmount: 6000, payment_hash: 'hash' },
        payReqMintBalance: 20000,
        paymentError: false,
        payLnInvoiceFromEcash: jest.fn(
            () => new Promise((resolve) => (settle = resolve))
        )
    };
    const navigation = {
        addListener: jest.fn(() => jest.fn()),
        popTo: jest.fn(),
        goBack: jest.fn(),
        navigate: jest.fn()
    };

    const view = await render(
        <MultimintPayment
            navigation={navigation as any}
            route={
                {
                    params: {
                        paymentAmount: '6000',
                        paymentRequest: 'lnbc1invoice'
                    }
                } as any
            }
            CashuStore={CashuStore as any}
        />
    );

    return {
        navigation,
        remove,
        unmount: view.unmount,
        pressBack: () => onBack?.(),
        settle: async (payment: any) => {
            await act(async () => settle(payment));
        }
    };
};

describe('MultimintPayment Android back button', () => {
    afterEach(() => jest.restoreAllMocks());

    it('stays on the screen while the payment is in flight', async () => {
        const { navigation, pressBack } = await renderPayment();

        expect(pressBack()).toBe(true);
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('goes to the wallet after the payment succeeded', async () => {
        const { navigation, pressBack, settle } = await renderPayment();
        await settle({ amount: 6000 });

        expect(pressBack()).toBe(true);
        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
    });

    it('lets a failed payment go back to the review', async () => {
        const { navigation, pressBack, settle } = await renderPayment();
        await settle(undefined);

        expect(pressBack()).toBe(false);
        expect(navigation.popTo).not.toHaveBeenCalled();
    });

    it('removes the listener on unmount', async () => {
        const { remove, unmount } = await renderPayment();

        await unmount();

        expect(remove).toHaveBeenCalledTimes(1);
    });
});
