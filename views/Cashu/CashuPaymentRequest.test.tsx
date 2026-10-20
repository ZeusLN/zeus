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
        .getDonationToSend
}));

import { Platform } from 'react-native';
import { observable, runInAction } from 'mobx';
import CashuPaymentRequest from './CashuPaymentRequest';

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
