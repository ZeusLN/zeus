jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon', ListItem: 'ListItem' }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
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

import { MultinutPaymentStep } from '../../utils/CashuUtils';
import MultimintPayment from './MultimintPayment';

const MINT_1 = 'https://mint.one';
const MINT_2 = 'https://mint.two';

// Two selected mints. The invoice is 75 sats with a 2 sat fee reserve, so
// the planner stops after the first mint and only it is in meltQuotes:
// getMultimintInfo() lists just that mint. The screen is constructed but
// never mounted, so no payment starts.
const paymentScreen = ({
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
        const { state } = paymentScreen({ donationAmount: '20' });

        expect(state.step).toBe(MultinutPaymentStep.PROCESSING);
        expect(state.error).toBeUndefined();
        // the progress list still shows only the planned mint
        expect(state.mints.map(({ mintUrl }) => mintUrl)).toEqual([MINT_1]);
    });

    it('refuses to start when the donation leaves both mints short', () => {
        // 75 + 2 + 75 = 152 > 139
        const { state } = paymentScreen({ donationAmount: '75' });

        expect(state.step).toBe(MultinutPaymentStep.FAILED);
        expect(state.error).toBe('stores.CashuStore.notEnoughFunds');
    });

    it('checks the planned mints when getPayReq did not count a balance', () => {
        // 75 + 2 = 77 > 70
        const { state } = paymentScreen({
            plannedBalance: 70,
            payReqMintBalance: 0
        });

        expect(state.step).toBe(MultinutPaymentStep.FAILED);
        expect(state.error).toBe('stores.CashuStore.notEnoughFunds');
    });
});
