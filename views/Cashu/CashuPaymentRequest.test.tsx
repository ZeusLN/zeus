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
jest.mock('../../utils/DonationUtils', () => ({}));

import { Platform } from 'react-native';
import CashuPaymentRequest from './CashuPaymentRequest';

const REVIEWED = 'lnbc1reviewed';

// triggerPayment runs when the slide-to-pay gesture completes; it is
// driven directly so the test does not depend on the gesture handling
const reviewScreen = (multiMint: boolean) => {
    const navigation = { navigate: jest.fn() };
    const screen = new CashuPaymentRequest({
        navigation,
        CashuStore: {
            paymentRequest: REVIEWED,
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
        reviewedPaymentRequest: REVIEWED
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
});
