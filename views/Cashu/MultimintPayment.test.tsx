jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon', ListItem: 'ListItem' }));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/DonationUtils', () => ({
    loadDonationLnurl: jest.fn()
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../storage', () => ({}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/DonationGiftIcon', () => 'DonationGiftIcon');
jest.mock('../../components/DonationInfoModal', () => 'DonationInfoModal');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/MintAvatar', () => 'MintAvatar');
jest.mock('../../components/PaymentDetailsSheet', () => 'PaymentDetailsSheet');
jest.mock('../../components/PaymentSuccessView', () => 'PaymentSuccessView');
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../assets/images/SVG/ErrorIcon.svg', () => 'ErrorIcon');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import { loadDonationLnurl } from '../../utils/DonationUtils';
import MultimintPayment from './MultimintPayment';

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
});
