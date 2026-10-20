jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/SwipeButton', () => 'SwipeButton');
jest.mock('../../components/Conversion', () => 'Conversion');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../utils/BackendUtils', () => ({}));
jest.mock('../../utils/UnitsUtils', () => ({ numberWithCommas: String }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/DonationUtils', () => ({
    getDonationToSend: jest.requireActual('../../utils/DonationUtils')
        .getDonationToSend,
    prefetchDonationInvoice: jest.fn()
}));

import { Platform } from 'react-native';
import { observable, runInAction } from 'mobx';
import CashuPaymentRequest from './CashuPaymentRequest';
import { prefetchDonationInvoice } from '../../utils/DonationUtils';

const REVIEWED = 'lnbc1reviewed';

// triggerPayment runs when the slide-to-pay gesture completes; it is
// driven directly so the test does not depend on the gesture handling
const reviewScreen = (
    multiMint: boolean,
    { pinned = REVIEWED, loaded = REVIEWED } = {}
) => {
    const navigation = { navigate: jest.fn() };
    const screen = new CashuPaymentRequest({
        navigation,
        CashuStore: {
            paymentRequest: loaded,
            payReq: { getRequestAmount: 100, isExpiredNow: () => false },
            multiMintSelectedUrls: multiMint
                ? ['https://mint.one', 'https://mint.two']
                : ['https://mint.one']
        },
        SettingsStore: { settings: { payments: {} } }
    } as any);
    screen.state = {
        ...screen.state,
        multiMintEnabled: multiMint,
        reviewedPaymentRequest: pinned
    };
    // the instance is not rendered, so apply state updates directly
    screen.setState = (update: any) => {
        screen.state = {
            ...screen.state,
            ...(typeof update === 'function' ? update(screen.state) : update)
        };
    };
    return { screen, navigation };
};

describe('CashuPaymentRequest triggerPayment', () => {
    const platform = Platform.OS;
    beforeAll(() => {
        Platform.OS = 'android';
    });
    afterAll(() => {
        Platform.OS = platform;
    });

    it('hands the reviewed invoice to the single-mint payment screen', () => {
        const { screen, navigation } = reviewScreen(false);

        screen.triggerPayment();

        expect(navigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            expect.objectContaining({
                paymentAmount: '100',
                paymentRequest: REVIEWED
            })
        );
    });

    it('hands the reviewed invoice to the multi-mint payment screen', () => {
        const { screen, navigation } = reviewScreen(true);

        screen.triggerPayment();

        expect(navigation.navigate).toHaveBeenCalledWith(
            'MultimintPayment',
            expect.objectContaining({
                paymentAmount: '100',
                paymentRequest: REVIEWED
            })
        );
    });

    it.each([false, true])(
        'pays nothing when no invoice was pinned (multi-mint: %p)',
        (multiMint) => {
            const { screen, navigation } = reviewScreen(multiMint, {
                pinned: ''
            });

            screen.triggerPayment();

            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it.each([false, true])(
        'pays nothing when the store holds another invoice than the pinned one (multi-mint: %p)',
        (multiMint) => {
            const { screen, navigation } = reviewScreen(multiMint, {
                loaded: 'lnbc1other'
            });

            screen.triggerPayment();

            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );
});

describe('CashuPaymentRequest invoice pin', () => {
    // Nothing is loaded when the screen mounts, as when it opens before
    // getPayReq has started
    const mountEmpty = async () => {
        const navigation = {
            navigate: jest.fn(),
            addListener: jest.fn(() => jest.fn())
        };
        const CashuStore = observable({
            paymentRequest: undefined as string | undefined,
            payReq: undefined as any,
            multiMintSelectedUrls: ['https://mint.one'],
            getPayReq: jest.fn()
        });
        const settings = { payments: {}, ecash: {} };
        const screen = new CashuPaymentRequest({
            navigation,
            CashuStore,
            SettingsStore: {
                settings,
                getSettings: jest.fn().mockResolvedValue(settings)
            }
        } as any);
        screen.setState = (update: any) => {
            screen.state = {
                ...screen.state,
                ...(typeof update === 'function'
                    ? update(screen.state)
                    : update)
            };
        };
        await screen.componentDidMount();
        const load = (invoice: string) =>
            runInAction(() => {
                CashuStore.paymentRequest = invoice;
                CashuStore.payReq = {
                    getRequestAmount: 100,
                    isExpiredNow: () => false
                };
            });
        return { screen, navigation, load };
    };

    it('pins the first invoice loaded after mount and pays it', async () => {
        const { screen, navigation, load } = await mountEmpty();
        expect(screen.state.reviewedPaymentRequest).toBe('');

        load(REVIEWED);
        screen.triggerPayment();

        expect(screen.state.reviewedPaymentRequest).toBe(REVIEWED);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            expect.objectContaining({ paymentRequest: REVIEWED })
        );
        screen.componentWillUnmount();
    });

    it('keeps the first pin when another invoice is loaded', async () => {
        const { screen, navigation, load } = await mountEmpty();

        load(REVIEWED);
        load('lnbc1other');
        screen.triggerPayment();

        expect(screen.state.reviewedPaymentRequest).toBe(REVIEWED);
        expect(navigation.navigate).not.toHaveBeenCalled();
        screen.componentWillUnmount();
    });
});

describe('CashuPaymentRequest donation quote at pay time', () => {
    const DONATION_INVOICE = 'lnbc1donation';
    const prefetch = prefetchDonationInvoice as jest.Mock;
    const platform = Platform.OS;
    beforeAll(() => {
        Platform.OS = 'android';
    });
    afterAll(() => {
        Platform.OS = platform;
    });
    beforeEach(() => {
        prefetch.mockReset().mockResolvedValue(DONATION_INVOICE);
    });

    // A mounted pay screen with a 20 sat donation on mainnet
    const donationScreen = (
        multiMint: boolean,
        canPay: (store: any) => Promise<boolean | undefined>
    ) => {
        const navigation = { navigate: jest.fn() };
        const meltQuote = { quote: 'q1', amount: 100, fee_reserve: 2 };
        const CashuStore: any = {
            paymentRequest: REVIEWED,
            payReq: { getRequestAmount: 100, isExpiredNow: () => false },
            multiMintSelectedUrls: multiMint
                ? ['https://mint.one', 'https://mint.two']
                : ['https://mint.one'],
            meltQuote: multiMint ? undefined : meltQuote,
            meltQuotes: multiMint
                ? [{ mintUrl: 'https://mint.one', meltQuote }]
                : []
        };
        CashuStore.canPayDonationAfterPayReq = jest.fn(() =>
            canPay(CashuStore)
        );
        const screen = new CashuPaymentRequest({
            navigation,
            CashuStore,
            SettingsStore: {
                settings: { payments: { enableDonations: true } }
            },
            NodeInfoStore: { nodeInfo: { isMainNet: true } }
        } as any);
        screen.isComponentMounted = true;
        screen.state = {
            ...screen.state,
            multiMintEnabled: multiMint,
            reviewedPaymentRequest: REVIEWED,
            donationAmount: 20
        };
        screen.setState = (update: any) => {
            screen.state = {
                ...screen.state,
                ...(typeof update === 'function'
                    ? update(screen.state)
                    : update)
            };
        };
        return { screen, navigation, CashuStore };
    };

    it.each([
        [false, 'CashuSendingLightning'],
        [true, 'MultimintPayment']
    ])(
        'quotes the donation and pays when the mints cover it (multi-mint: %p)',
        async (multiMint, route) => {
            const { screen, navigation, CashuStore } = donationScreen(
                multiMint,
                async () => true
            );

            await screen.triggerPayment();

            expect(prefetch).toHaveBeenCalledWith('20');
            expect(CashuStore.canPayDonationAfterPayReq).toHaveBeenCalledWith(
                DONATION_INVOICE
            );
            expect(navigation.navigate).toHaveBeenCalledWith(
                route,
                expect.objectContaining({
                    paymentRequest: REVIEWED,
                    donationAmount: '20'
                })
            );
            expect(screen.state.checkingDonation).toBe(false);
        }
    );

    it.each([false, true])(
        'warns instead of paying on the first tap when the mints may not cover the donation (multi-mint: %p)',
        async (multiMint) => {
            const { screen, navigation, CashuStore } = donationScreen(
                multiMint,
                async () => false
            );
            const swipeButtonKey = screen.state.swipeButtonKey;

            await screen.triggerPayment();

            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(screen.state.donationShortfall).toEqual({
                amount: 20,
                paymentQuotes: CashuStore.meltQuote || CashuStore.meltQuotes
            });
            expect(screen.state.swipeButtonKey).toBe(swipeButtonKey + 1);
        }
    );

    it.each([
        [false, 'CashuSendingLightning'],
        [true, 'MultimintPayment']
    ])(
        'pays on the second tap after the warning, without quoting again (multi-mint: %p)',
        async (multiMint, route) => {
            const { screen, navigation, CashuStore } = donationScreen(
                multiMint,
                async () => false
            );

            await screen.triggerPayment();
            expect(navigation.navigate).not.toHaveBeenCalled();
            await screen.triggerPayment();

            expect(CashuStore.canPayDonationAfterPayReq).toHaveBeenCalledTimes(
                1
            );
            expect(navigation.navigate).toHaveBeenCalledWith(
                route,
                expect.objectContaining({ donationAmount: '20' })
            );
        }
    );

    it('quotes again after the warning when the donation changes', async () => {
        const { screen, navigation, CashuStore } = donationScreen(
            false,
            async () => false
        );

        await screen.triggerPayment();
        screen.state = { ...screen.state, donationAmount: 10 };
        await screen.triggerPayment();

        expect(prefetch).toHaveBeenLastCalledWith('10');
        expect(CashuStore.canPayDonationAfterPayReq).toHaveBeenCalledTimes(2);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('quotes again after the warning when the payment is quoted again', async () => {
        const { screen, navigation, CashuStore } = donationScreen(
            false,
            async () => false
        );

        await screen.triggerPayment();
        CashuStore.meltQuote = { quote: 'q2', amount: 100, fee_reserve: 2 };
        await screen.triggerPayment();

        expect(CashuStore.canPayDonationAfterPayReq).toHaveBeenCalledTimes(2);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('pays on the check in render alone when the donation invoice cannot be fetched', async () => {
        prefetch.mockResolvedValue(null);
        const { screen, navigation, CashuStore } = donationScreen(
            false,
            async () => true
        );

        await screen.triggerPayment();

        expect(CashuStore.canPayDonationAfterPayReq).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            expect.objectContaining({ donationAmount: '20' })
        );
    });

    it('pays on the check in render alone when the donation quote fails', async () => {
        const { screen, navigation } = donationScreen(false, async () => {
            throw new Error('mint offline');
        });

        await screen.triggerPayment();

        expect(navigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            expect.objectContaining({ donationAmount: '20' })
        );
    });

    it('pays nothing when the payment is quoted again during the check', async () => {
        const { screen, navigation } = donationScreen(false, async (store) => {
            store.meltQuote = { quote: 'q2', amount: 100, fee_reserve: 2 };
            return true;
        });

        await screen.triggerPayment();

        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(screen.state.donationShortfall).toBeUndefined();
    });

    it('pays nothing when the donation changes during the check', async () => {
        const { screen, navigation } = donationScreen(false, async () => {
            screen.state = { ...screen.state, donationAmount: 5 };
            return true;
        });

        await screen.triggerPayment();

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('quotes once when pay is pressed again during the check', async () => {
        let resolve: (covered: boolean) => void = () => {};
        const { screen, navigation, CashuStore } = donationScreen(
            false,
            () => new Promise((r) => (resolve = r))
        );

        const first = screen.triggerPayment();
        await new Promise((r) => setImmediate(r));
        await screen.triggerPayment();
        resolve(true);
        await first;

        expect(CashuStore.canPayDonationAfterPayReq).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('does not quote when no donation is sent', async () => {
        const { screen, navigation } = donationScreen(false, async () => true);
        screen.state = { ...screen.state, donationAmount: 0 };

        await screen.triggerPayment();

        expect(prefetch).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            expect.not.objectContaining({ donationAmount: expect.anything() })
        );
    });
});
