jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Content = ListItem;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    ListItem.Subtitle = ListItem.Title;
    return { Icon: 'Icon', ListItem };
});
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../utils/DonationUtils', () => ({
    ...jest.requireActual('../../utils/DonationUtils'),
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
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../assets/images/SVG/ErrorIcon.svg', () => 'ErrorIcon');
jest.mock('../../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MintPaymentStatus } from '../../utils/CashuUtils';
import { loadDonationLnurl } from '../../utils/DonationUtils';
import MultimintPayment from './MultimintPayment';

const REVIEWED = 'lnbc1reviewed';
const MINT_1 = 'https://mint.one';
const MINT_2 = 'https://mint.two';

// The invoice is 75 sats with a 2 sat fee reserve. Both mints are selected,
// but the planner stopped after the first one, so only it is in meltQuotes.
// mintBalance counts both mints: 89 + 50.
const makePlan = (overrides: object = {}): any => ({
    paymentRequest: REVIEWED,
    payReq: { getRequestAmount: 75, payment_hash: 'ab'.repeat(32) },
    meltQuotes: [
        { mintUrl: MINT_1, quote: 'quote-1', amount: 75, fee_reserve: 2 }
    ],
    feeEstimate: 2,
    plannerSkips: [],
    mintBalance: 139,
    amount: 75,
    ...overrides
});

// what the store held before getPayReq stopped keeping its result: none
// of it may reach the screen or the payment
const decoys = {
    paymentRequest: 'lnbc1decoy',
    payReq: { getRequestAmount: 999, payment_hash: 'de'.repeat(32) },
    meltQuote: { quote: 'decoy-quote' },
    meltQuotes: [{ mintUrl: MINT_2, quote: 'decoy-quote' }],
    feeEstimate: 4242,
    payReqMintBalance: 1,
    payReqAmount: 999,
    multiMintPlannerSkips: [{ mintUrl: MINT_1, reason: 'selfSend' }]
};

const buildCashuStore = (fields: object = {}): any => {
    const store: any = {
        ...decoys,
        multiMintSelectedUrls: [MINT_1, MINT_2],
        mintBalances: { [MINT_1]: 89, [MINT_2]: 50 },
        mintInfos: {},
        getMintName: (mintUrl: string) => `name of ${mintUrl}`,
        // as CashuStore lists them: the mints of the quotes it is given,
        // or the selected mints without quotes
        getMultimintInfo: jest.fn((meltQuotes: { mintUrl: string }[] = []) =>
            (meltQuotes.length > 0
                ? meltQuotes.map(({ mintUrl }) => mintUrl)
                : store.multiMintSelectedUrls
            ).map((mintUrl: string) => ({
                mintUrl,
                mintName: store.getMintName(mintUrl),
                balance: store.mintBalances[mintUrl] || 0,
                selected: true,
                status: MintPaymentStatus.IDLE,
                allocatedAmount: 0
            }))
        ),
        getPayReq: jest.fn(async (paymentRequest: string) =>
            makePlan({ paymentRequest })
        ),
        payLnInvoiceFromEcash: jest.fn().mockResolvedValue(undefined),
        paymentError: false,
        ...fields
    };
    return store;
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const renderView = async ({
    params = { paymentAmount: '75', paymentPlan: makePlan() },
    cashuStore = buildCashuStore()
}: { params?: object; cashuStore?: any } = {}) => {
    await render(
        <MultimintPayment
            {...({
                navigation: {
                    addListener: jest.fn(() => jest.fn()),
                    navigate: jest.fn(),
                    popTo: jest.fn()
                },
                route: { params },
                CashuStore: cashuStore
            } as any)}
        />
    );
    return { cashuStore, params: params as any };
};

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);
const shownAmount = () =>
    hosts('Amount').find((n) => n.props.jumboText)!.props.sats;
const paid = {
    meltResponse: { state: 'PAID' },
    payment_preimage: 'cd'.repeat(32)
};

describe('MultimintPayment pays the plan it was handed', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pays the plan reviewed on the previous screen', async () => {
        const { cashuStore, params } = await renderView();

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '75',
            plan: params.paymentPlan,
            onProgress: expect.any(Function)
        });
        expect(cashuStore.payLnInvoiceFromEcash.mock.calls[0][0].plan).toBe(
            params.paymentPlan
        );
        // the screen pays what it was handed and quotes nothing itself
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
    });

    it('hands the store no plan when it was opened without one', async () => {
        const { cashuStore } = await renderView({
            params: { paymentAmount: '75' }
        });

        // payLnInvoiceFromEcash pays nothing without a plan
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({
            amount: '75',
            plan: undefined,
            onProgress: expect.any(Function)
        });
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
        await flush();
        expect(
            screen.getByText('stores.CashuStore.errorPayingInvoice')
        ).toBeOnTheScreen();
    });

    // a payment still in flight, so the progress view stays up
    const processing = () => {
        const cashuStore = buildCashuStore();
        cashuStore.payLnInvoiceFromEcash.mockReturnValue(new Promise(() => {}));
        return cashuStore;
    };

    it('lists the mints of the plan quotes, with their balance', async () => {
        const { cashuStore, params } = await renderView({
            cashuStore: processing()
        });

        expect(cashuStore.getMultimintInfo).toHaveBeenCalledTimes(1);
        expect(cashuStore.getMultimintInfo.mock.calls[0][0]).toBe(
            params.paymentPlan.meltQuotes
        );
        expect(screen.getByText(`name of ${MINT_1}`)).toBeOnTheScreen();
        expect(screen.queryByText(`name of ${MINT_2}`)).not.toBeOnTheScreen();
        // totalAvailable shows what the listed mints hold
        expect(
            hosts('Amount').find((n) => n.props.color === 'secondaryText')!
                .props.sats
        ).toBe(89);
    });

    it('shows the amount of the plan', async () => {
        await renderView({
            cashuStore: processing(),
            params: { paymentPlan: makePlan() }
        });

        expect(shownAmount()).toBe(75);
    });

    it('shows the payment hash of the plan once paid', async () => {
        const cashuStore = buildCashuStore();
        cashuStore.payLnInvoiceFromEcash.mockResolvedValue(paid);
        await renderView({ cashuStore });
        await flush();

        expect(hosts('PaymentDetailsSheet')[0].props).toMatchObject({
            paymentAmount: 75,
            paymentHash: 'ab'.repeat(32)
        });
    });

    it('shows a paid invoice as sent when another payment left an error on the store', async () => {
        const cashuStore = buildCashuStore();
        cashuStore.payLnInvoiceFromEcash.mockImplementation(async () => {
            // another payment that failed while this melt was awaited
            cashuStore.paymentError = true;
            cashuStore.paymentErrorMsg = 'error of another payment';
            return paid;
        });
        await renderView({ cashuStore });
        await flush();

        expect(hosts('PaymentSuccessView')).toHaveLength(1);
        expect(
            screen.queryByText('error of another payment')
        ).not.toBeOnTheScreen();
    });

    it('shows a failed payment as failed', async () => {
        const cashuStore = buildCashuStore();
        cashuStore.payLnInvoiceFromEcash.mockImplementation(async () => {
            cashuStore.paymentError = true;
            cashuStore.paymentErrorMsg = 'mint unreachable';
            return undefined;
        });
        await renderView({ cashuStore });
        await flush();

        expect(hosts('PaymentSuccessView')).toHaveLength(0);
        expect(screen.getByText('mint unreachable')).toBeOnTheScreen();
    });
});

describe('MultimintPayment donation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('quotes the donation invoice it loaded and pays that plan as a donation', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const cashuStore = buildCashuStore();
        cashuStore.payLnInvoiceFromEcash.mockResolvedValue(paid);
        const { params } = await renderView({
            cashuStore,
            params: {
                paymentAmount: '75',
                paymentPlan: makePlan(),
                donationAmount: '5'
            }
        });
        await flush();
        await flush();

        expect(loadDonationLnurl).toHaveBeenCalledWith('5');
        expect(cashuStore.getPayReq.mock.calls).toEqual([['lnbc1donation']]);
        const donationPlan = await cashuStore.getPayReq.mock.results[0].value;
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(2);
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenLastCalledWith({
            amount: '5',
            plan: donationPlan,
            isDonationPayment: true
        });
        const { plan } = cashuStore.payLnInvoiceFromEcash.mock.calls[1][0];
        expect(plan).toBe(donationPlan);
        expect(plan).not.toBe(params.paymentPlan);
    });

    it('sends no donation when the payment fails', async () => {
        (loadDonationLnurl as jest.Mock).mockResolvedValue('lnbc1donation');
        const { cashuStore } = await renderView({
            params: {
                paymentAmount: '75',
                paymentPlan: makePlan(),
                donationAmount: '5'
            }
        });
        await flush();

        expect(loadDonationLnurl).not.toHaveBeenCalled();
        expect(cashuStore.getPayReq).not.toHaveBeenCalled();
        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
    });
});

// The fee and the balance are those of the plan; CashuStore holds decoy
// values that would refuse every payment here if they were read
describe('MultimintPayment funds check', () => {
    beforeEach(() => jest.clearAllMocks());

    const check = (plan: object, donationAmount?: string, fields?: object) =>
        renderView({
            cashuStore: buildCashuStore(fields),
            params: {
                paymentAmount: '75',
                paymentPlan: makePlan(plan),
                donationAmount
            }
        });

    it('starts when both selected mints cover the invoice and the donation', async () => {
        // 75 + 2 + 20 = 97: more than the planned mint has, less than both
        const { cashuStore } = await check({}, '20');

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByText('stores.CashuStore.notEnoughFunds')
        ).not.toBeOnTheScreen();
        // the progress list still shows only the planned mint
        expect(screen.queryByText(`name of ${MINT_2}`)).not.toBeOnTheScreen();
    });

    it('refuses to start when the donation leaves both mints short', async () => {
        // 75 + 2 + 75 = 152 > 139
        const { cashuStore } = await check({}, '75');

        expect(cashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(
            screen.getByText('stores.CashuStore.notEnoughFunds')
        ).toBeOnTheScreen();
    });

    it('refuses to start when the fee of the plan leaves both mints short', async () => {
        // 75 + 65 = 140 > 139
        const { cashuStore } = await check({ feeEstimate: 65 });

        expect(cashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(
            screen.getByText('stores.CashuStore.notEnoughFunds')
        ).toBeOnTheScreen();
    });

    it('checks the planned mints when getPayReq did not count a balance', async () => {
        // 75 + 2 = 77 > 70
        const { cashuStore } = await check({ mintBalance: 0 }, undefined, {
            mintBalances: { [MINT_1]: 70, [MINT_2]: 50 }
        });

        expect(cashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(
            screen.getByText('stores.CashuStore.notEnoughFunds')
        ).toBeOnTheScreen();
    });

    it('names the self-send skip when the planner left out the receiving mint', async () => {
        await check(
            { plannerSkips: [{ mintUrl: MINT_2, reason: 'selfSend' }] },
            '75'
        );

        expect(
            screen.getByText('stores.CashuStore.notEnoughFundsSelfSend')
        ).toBeOnTheScreen();
    });
});
