jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/EcashMintPicker', () => 'EcashMintPicker');
jest.mock('../../components/SwipeButton', () => 'SwipeButton');
jest.mock('../../components/Conversion', () => 'Conversion');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage',
    WarningMessage: 'WarningMessage'
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLightningSends: () => true
}));
jest.mock('../../utils/UnitsUtils', () => ({ numberWithCommas: String }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlPayUtils', () => ({}));
jest.mock('../../assets/images/SVG/Caret Down.svg', () => 'CaretDown');
jest.mock('../../assets/images/SVG/Caret Right.svg', () => 'CaretRight');
jest.mock('../../assets/images/SVG/QR.svg', () => 'QR');

import * as React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CashuPaymentRequest, {
    CashuPaymentRequestView
} from './CashuPaymentRequest';

const PAY = 'views.PaymentRequest.payInvoice';
const NO_PAY_REQ = 'views.PaymentRequest.noPayReq';

const PAYMENT_REQUEST = 'lnbc10u1example';
const OTHER_REQUEST = 'lnbc200u1other';

const MINT_1 = 'https://mint.one';
const MINT_2 = 'https://mint.two';

// a decoded 1,000 sat invoice that never expires during a test
const payReq = {
    getRequestAmount: 1000,
    determineFormattedOriginalTimeUntilExpiry: jest.fn(),
    isExpiredNow: () => false,
    formattedOriginalTimeUntilExpiry: '1 hour',
    payment_hash: 'ab'.repeat(32),
    destination: '02' + 'cd'.repeat(32)
};

// what CashuStore.getPayReq answers for one invoice
const makePlan = (
    paymentRequest: string,
    {
        payReqOverrides = {},
        ...overrides
    }: { payReqOverrides?: object; [key: string]: any } = {}
): any => ({
    paymentRequest,
    payReq: { ...payReq, ...payReqOverrides },
    meltQuote: {
        quote: `quote-${paymentRequest}`,
        amount: 1000,
        fee_reserve: 3,
        state: 'UNPAID',
        expiry: 0
    },
    meltQuotes: [],
    plannerSkips: [],
    feeEstimate: 3,
    mintBalance: 50000,
    amount: 1000,
    ...overrides
});

const supportsBolt11 = {
    nuts: { 15: { methods: [{ method: 'bolt11', unit: 'sat' }] } }
};

// CashuStore as the screen uses it: getPayReq quotes what it is asked to
// and keeps nothing
const makeCashuStore = ({
    plan = {},
    multiMintSelectedUrls = [MINT_1],
    ...fields
}: {
    plan?: Parameters<typeof makePlan>[1];
    multiMintSelectedUrls?: string[];
    [key: string]: any;
} = {}) => {
    const store: any = {
        totalBalanceSats: 50000,
        multiMintSelectedUrls,
        selectedMintUrls: [MINT_1],
        selectedMintUrl: MINT_1,
        mintUrls: [MINT_1, MINT_2],
        mintInfos: { [MINT_1]: supportsBolt11, [MINT_2]: supportsBolt11 },
        getPayReq: jest.fn(
            async (paymentRequest: string): Promise<any> =>
                makePlan(paymentRequest, plan)
        ),
        setMultiMintSelectedUrls: jest.fn(async (urls: string[]) => {
            store.multiMintSelectedUrls = urls;
        }),
        ...fields
    };
    return store;
};

const flush = () =>
    act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
    });

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const makeProps = ({
    routeParams = { paymentRequest: PAYMENT_REQUEST },
    payments = {},
    ecash = {},
    getSettings,
    isMainNet = true,
    CashuStore = makeCashuStore()
}: {
    routeParams?: object | null;
    payments?: object;
    ecash?: object;
    getSettings?: jest.Mock;
    isMainNet?: boolean;
    CashuStore?: any;
} = {}) => {
    const settings = { locale: 'en', payments, ecash };
    const listeners: { [event: string]: Array<() => void> } = {};
    const navigation = {
        addListener: jest.fn((event: string, callback: () => void) => {
            (listeners[event] = listeners[event] || []).push(callback);
            return jest.fn();
        }),
        navigate: jest.fn()
    };
    // what react-navigation does when the route is focused
    const emit = (event: string) =>
        (listeners[event] || []).forEach((callback) => callback());
    const props: any = {
        navigation,
        // null stands for a route without params
        route: { params: routeParams ?? undefined },
        CashuStore,
        SettingsStore: {
            settings,
            settingsUpdateInProgress: false,
            getSettings: getSettings ?? jest.fn(async () => settings)
        },
        NodeInfoStore: { nodeInfo: { isMainNet } },
        BalanceStore: {},
        TransactionsStore: {},
        UnitsStore: {}
    };
    return { props, CashuStore, navigation, emit };
};

// mounts one review and lets its quote and settings land
const renderView = async ({
    ref,
    ...options
}: Parameters<typeof makeProps>[0] & { ref?: React.Ref<any> } = {}) => {
    const made = makeProps(options);
    const result = await render(
        <CashuPaymentRequestView ref={ref} {...made.props} />
    );
    await flush();
    return { ...made, ...result };
};

// the plan the nth getPayReq call answered with
const planOf = (CashuStore: any, call: number) =>
    CashuStore.getPayReq.mock.results[call].value;

const payButton = () => screen.getByRole('button', { name: PAY });
const queryPayButton = () => screen.queryByRole('button', { name: PAY });
const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);
const keyValue = (key: string) =>
    hosts('KeyValue').find((n) => n.props.keyValue === key);
const shownAmount = () =>
    hosts('Amount').find((n) => n.props.jumboText)!.props.sats;
const feeShown = () =>
    keyValue('views.PaymentRequest.feeEstimate')!.props.value.props.sats;
const swipeButton = () => hosts('SwipeButton')[0];
const navigatedTo = (navigation: any) => navigation.navigate.mock.calls;

// the donation row opens the percentage buttons; index 2 is 20%
const pickDonation = async (index: number) => {
    if (hosts('ButtonGroup').length === 0) {
        await fireEvent.press(keyValue('views.PaymentRequest.donateToZEUS')!);
    }
    await act(async () => hosts('ButtonGroup')[0].props.onPress(index));
};

const platform = Platform.OS;
const onAndroid = () => {
    beforeAll(() => {
        Platform.OS = 'android';
    });
    afterAll(() => {
        Platform.OS = platform;
    });
};

describe('CashuPaymentRequest quote', () => {
    it('quotes the payment request it was opened with', async () => {
        const { CashuStore } = await renderView();

        expect(CashuStore.getPayReq.mock.calls).toEqual([[PAYMENT_REQUEST]]);
        expect(payButton()).toBeEnabled();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
    });

    it('starts the quote before the settings are loaded', async () => {
        const { CashuStore } = await renderView({
            getSettings: jest.fn(() => new Promise(() => {}))
        });

        expect(CashuStore.getPayReq).toHaveBeenCalledWith(PAYMENT_REQUEST);
        // the plan waits for the settings its donation is derived from
        expect(queryPayButton()).not.toBeOnTheScreen();
    });

    it('shows a spinner and no pay controls while the quote is in flight', async () => {
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockReturnValue(new Promise(() => {}));
        await renderView({ CashuStore });

        expect(hosts('LoadingIndicator')).toHaveLength(1);
        expect(queryPayButton()).not.toBeOnTheScreen();
        expect(hosts('SwipeButton')).toHaveLength(0);
        expect(hosts('EcashMintPicker')).toHaveLength(0);
        expect(hosts('Amount')).toHaveLength(0);
    });

    it('shows the amount, fee and payment hash of the plan', async () => {
        await renderView({
            CashuStore: makeCashuStore({
                plan: {
                    feeEstimate: 7,
                    payReqOverrides: {
                        getRequestAmount: 2100,
                        payment_hash: 'ef'.repeat(32)
                    }
                }
            })
        });

        expect(shownAmount()).toBe(2100);
        expect(feeShown()).toBe(7);
        expect(keyValue('views.PaymentRequest.paymentHash')!.props.value).toBe(
            'ef'.repeat(32)
        );
        expect(hosts('WarningMessage')).toHaveLength(0);
    });

    it('shows a 0 sat fee, and no fee row without an estimate', async () => {
        const first = await renderView({
            CashuStore: makeCashuStore({ plan: { feeEstimate: 0 } })
        });

        expect(feeShown()).toBe(0);

        await first.unmount();
        await renderView({
            CashuStore: makeCashuStore({ plan: { feeEstimate: undefined } })
        });

        expect(keyValue('views.PaymentRequest.feeEstimate')).toBeUndefined();
    });

    it('shows the plan error as a warning and disables Pay', async () => {
        await renderView({
            CashuStore: makeCashuStore({ plan: { error: 'mint is offline' } })
        });

        expect(hosts('WarningMessage')[0].props.message).toBe(
            'mint is offline'
        );
        expect(payButton()).toBeDisabled();
    });

    it('shows the plan error and nothing to pay when the invoice was not decoded', async () => {
        await renderView({
            CashuStore: makeCashuStore({
                plan: { payReq: undefined, error: 'decode failed' }
            })
        });

        expect(
            screen.getByText('views.PaymentRequest.error: decode failed')
        ).toBeOnTheScreen();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(queryPayButton()).not.toBeOnTheScreen();
    });

    describe('with a donation', () => {
        onAndroid();
        const payments = {
            enableDonations: true,
            defaultDonationPercentage: 10
        };

        it('warns and disables Pay when the mint cannot cover the donation too', async () => {
            // 1000 + 3 fee + 100 donation = 1103 > 1050
            await renderView({
                payments,
                CashuStore: makeCashuStore({ plan: { mintBalance: 1050 } })
            });

            expect(hosts('WarningMessage')[0].props.message).toBe(
                'stores.CashuStore.notEnoughFunds'
            );
            expect(payButton()).toBeDisabled();
        });

        it('does not warn when the mint covers the invoice and the donation', async () => {
            await renderView({
                payments,
                CashuStore: makeCashuStore({ plan: { mintBalance: 1103 } })
            });

            expect(hosts('WarningMessage')).toHaveLength(0);
            expect(payButton()).toBeEnabled();
        });
    });
});

// Any entry point that forgets the param must fail where the user sees it
describe('CashuPaymentRequest without a payment request', () => {
    it.each([
        ['no params', null],
        ['empty params', {}],
        ['an empty request', { paymentRequest: '' }]
    ])('shows an error and quotes nothing with %s', async (_, routeParams) => {
        const { CashuStore } = await renderView({ routeParams });

        const [error] = hosts('ErrorMessage');
        expect(error.props.message).toBe(NO_PAY_REQ);
        expect(CashuStore.getPayReq).not.toHaveBeenCalled();
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(queryPayButton()).not.toBeOnTheScreen();
        // no QR of a request that isn't there
        expect(hosts('Header')[0].props.rightComponent).toBeUndefined();
    });

    it('shows no such error for a request that is loading or quoted', async () => {
        await renderView();

        expect(hosts('ErrorMessage')).toHaveLength(0);
        expect(hosts('Header')[0].props.rightComponent).toBeDefined();
    });

    it('quotes nothing on focus either', async () => {
        const { CashuStore, emit } = await renderView({ routeParams: {} });

        await act(async () => emit('focus'));

        expect(CashuStore.getPayReq).not.toHaveBeenCalled();
    });

    it('refuses to pay from triggerPayment', async () => {
        const ref = React.createRef<any>();
        const { navigation } = await renderView({ routeParams: {}, ref });

        await act(async () => ref.current.triggerPayment());

        expect(navigation.navigate).not.toHaveBeenCalled();
    });
});

// "Review invoice A, pay invoice B": the sending screens are handed the
// plan this screen quoted and shows, so a quote made anywhere else can't
// come between them
describe('CashuPaymentRequest pays the plan it shows', () => {
    it('opens CashuSendingLightning with the plan it shows', async () => {
        const { CashuStore, navigation } = await renderView();

        await fireEvent.press(payButton());

        const plan = await planOf(CashuStore, 0);
        expect(navigatedTo(navigation)).toStrictEqual([
            [
                'CashuSendingLightning',
                { paymentAmount: '1000', paymentPlan: plan }
            ]
        ]);
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(plan);
    });

    it('opens MultimintPayment when multi-mint is on with more than one mint selected', async () => {
        const { CashuStore, navigation } = await renderView({
            ecash: { enableMultiMint: true },
            CashuStore: makeCashuStore({
                multiMintSelectedUrls: [MINT_1, MINT_2]
            })
        });

        await fireEvent.press(payButton());

        const plan = await planOf(CashuStore, 0);
        expect(navigatedTo(navigation)).toStrictEqual([
            ['MultimintPayment', { paymentAmount: '1000', paymentPlan: plan }]
        ]);
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(plan);
    });

    it('opens CashuSendingLightning when multi-mint is on with one mint selected', async () => {
        const { navigation } = await renderView({
            ecash: { enableMultiMint: true }
        });

        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('CashuSendingLightning');
    });

    it('opens CashuSendingLightning when the selection drops to one mint after multi-mint was turned on', async () => {
        const CashuStore = makeCashuStore({
            multiMintSelectedUrls: [MINT_1, MINT_2]
        });
        const { navigation } = await renderView({
            ecash: { enableMultiMint: true },
            CashuStore
        });
        expect(hosts('Switch')[0].props.value).toBe(true);

        // changed elsewhere while this screen stays focused
        CashuStore.multiMintSelectedUrls = [MINT_1];
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('CashuSendingLightning');
    });

    it('opens CashuSendingLightning when several mints are selected but multi-mint is off', async () => {
        const { navigation } = await renderView({
            CashuStore: makeCashuStore({
                multiMintSelectedUrls: [MINT_1, MINT_2]
            })
        });

        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('CashuSendingLightning');
    });

    it('ignores pay request fields left on CashuStore', async () => {
        // what the store held before getPayReq stopped keeping its result
        const CashuStore = makeCashuStore({
            paymentRequest: 'lnbc-other',
            payReq: { ...payReq, getRequestAmount: 999999 },
            getPayReqError: 'other error',
            feeEstimate: 4242,
            meltQuote: { quote: 'other-quote' },
            meltQuotes: [{ mintUrl: MINT_2, quote: 'other-quote' }],
            payReqMintBalance: 1,
            payReqAmount: 999999,
            loading: true
        });
        const { navigation } = await renderView({ CashuStore });

        expect(shownAmount()).toBe(1000);
        expect(feeShown()).toBe(3);
        expect(hosts('LoadingIndicator')).toHaveLength(0);
        expect(hosts('WarningMessage')).toHaveLength(0);
        expect(screen.queryByText(/other error/)).not.toBeOnTheScreen();

        await fireEvent.press(payButton());

        const { paymentPlan } = navigatedTo(navigation)[0][1];
        expect(paymentPlan).toBe(await planOf(CashuStore, 0));
        expect(paymentPlan.paymentRequest).toBe(PAYMENT_REQUEST);
        expect(paymentPlan.meltQuote.quote).toBe(`quote-${PAYMENT_REQUEST}`);
    });

    it('keeps its plan when CashuStore quotes another invoice while it is open', async () => {
        const { CashuStore, navigation } = await renderView();

        await act(async () => {
            await CashuStore.getPayReq(OTHER_REQUEST);
        });
        await fireEvent.press(payButton());

        const { paymentPlan } = navigatedTo(navigation)[0][1];
        expect(paymentPlan).toBe(await planOf(CashuStore, 0));
        expect(paymentPlan.paymentRequest).toBe(PAYMENT_REQUEST);
    });

    it('refuses to pay from triggerPayment before the quote is in', async () => {
        const ref = React.createRef<any>();
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockReturnValue(new Promise(() => {}));
        const { navigation } = await renderView({ CashuStore, ref });

        await act(async () => ref.current.triggerPayment());

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('refuses to pay from triggerPayment while a new quote is loading', async () => {
        const ref = React.createRef<any>();
        const { CashuStore, navigation, emit } = await renderView({ ref });
        CashuStore.getPayReq.mockReturnValue(new Promise(() => {}));

        await act(async () => emit('focus'));

        expect(hosts('LoadingIndicator')).toHaveLength(1);
        expect(queryPayButton()).not.toBeOnTheScreen();

        await act(async () => ref.current.triggerPayment());

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('refuses to pay from triggerPayment once the screen is unmounted', async () => {
        const ref = React.createRef<any>();
        const { navigation, unmount } = await renderView({ ref });
        const view = ref.current;

        await unmount();
        view.triggerPayment();

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('refuses to pay an invoice that expired while it was on screen', async () => {
        let expired = false;
        const { navigation } = await renderView({
            CashuStore: makeCashuStore({
                plan: { payReqOverrides: { isExpiredNow: () => expired } }
            })
        });
        expired = true;

        await fireEvent.press(payButton());

        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(queryPayButton()).not.toBeOnTheScreen();
        expect(hosts('ErrorMessage')[0].props.message).toBe(
            'views.PaymentRequest.invoiceExpired'
        );
    });
});

describe('CashuPaymentRequest donation', () => {
    onAndroid();

    it('passes the donation it resolved to the payment screen', async () => {
        const { CashuStore, navigation } = await renderView({
            payments: { enableDonations: true, defaultDonationPercentage: 10 }
        });

        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)).toStrictEqual([
            [
                'CashuSendingLightning',
                {
                    paymentAmount: '1000',
                    paymentPlan: await planOf(CashuStore, 0),
                    donationAmount: '100'
                }
            ]
        ]);
    });

    it.each([
        [
            'off mainnet',
            { isMainNet: false, defaultDonationPercentage: 10 },
            true
        ],
        [
            'with a 0% donation',
            { isMainNet: true, defaultDonationPercentage: 0 },
            true
        ],
        [
            'with donations disabled',
            { isMainNet: true, defaultDonationPercentage: 10 },
            false
        ]
    ])(
        'passes no donation %s',
        async (
            _,
            { isMainNet, defaultDonationPercentage },
            enableDonations
        ) => {
            const { navigation } = await renderView({
                isMainNet,
                payments: { enableDonations, defaultDonationPercentage }
            });

            await fireEvent.press(payButton());

            expect(navigatedTo(navigation)[0][1]).not.toHaveProperty(
                'donationAmount'
            );
        }
    );

    it('keeps a donation the user picked when the invoice is quoted again', async () => {
        const { CashuStore, navigation, emit } = await renderView({
            payments: { enableDonations: true, defaultDonationPercentage: 10 }
        });
        await pickDonation(2);

        await act(async () => emit('focus'));
        await flush();

        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(2);
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][1]).toMatchObject({
            paymentPlan: await planOf(CashuStore, 1),
            donationAmount: '200'
        });
    });

    it('derives the default donation once, from the first quote', async () => {
        const CashuStore = makeCashuStore();
        const { navigation, emit } = await renderView({
            payments: { enableDonations: true, defaultDonationPercentage: 10 },
            CashuStore
        });
        // the same invoice quoted again for a larger amount
        CashuStore.getPayReq.mockImplementation(
            async (paymentRequest: string) =>
                makePlan(paymentRequest, {
                    payReqOverrides: { getRequestAmount: 5000 }
                })
        );

        await act(async () => emit('focus'));
        await flush();
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][1].donationAmount).toBe('100');
    });

    it('derives the default donation from the first quote that decoded the invoice', async () => {
        const CashuStore = makeCashuStore({
            plan: { payReq: undefined, error: 'mint is offline' }
        });
        const { navigation, emit } = await renderView({
            payments: { enableDonations: true, defaultDonationPercentage: 10 },
            CashuStore
        });
        CashuStore.getPayReq.mockImplementation(
            async (paymentRequest: string) => makePlan(paymentRequest)
        );

        await act(async () => emit('focus'));
        await flush();
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][1].donationAmount).toBe('100');
    });
});

describe('CashuPaymentRequest quotes again', () => {
    it('quotes the invoice again when the screen is focused and pays the new plan', async () => {
        const { CashuStore, navigation, emit } = await renderView();

        await act(async () => emit('focus'));
        await flush();

        expect(CashuStore.getPayReq.mock.calls).toEqual([
            [PAYMENT_REQUEST],
            [PAYMENT_REQUEST]
        ]);
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(
            await planOf(CashuStore, 1)
        );
    });

    it('resets the slider when the screen is focused again', async () => {
        const { emit } = await renderView({
            payments: { slideToPayThreshold: 10000 },
            CashuStore: makeCashuStore({
                plan: { payReqOverrides: { getRequestAmount: 20000 } }
            })
        });
        const slider = swipeButton();

        await act(async () => emit('focus'));
        await flush();

        // a new key mounts a new SwipeButton
        expect(swipeButton()).not.toBe(slider);
    });

    it('quotes again after multi-mint is turned on and pays the new plan with MultimintPayment', async () => {
        const { CashuStore, navigation } = await renderView({
            ecash: { enableMultiMint: true }
        });
        expect(hosts('Switch')[0].props.value).toBe(false);

        await act(async () => hosts('Switch')[0].props.onValueChange(true));
        await flush();

        expect(CashuStore.setMultiMintSelectedUrls).toHaveBeenCalledWith([
            MINT_1,
            MINT_2
        ]);
        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(2);
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('MultimintPayment');
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(
            await planOf(CashuStore, 1)
        );
    });

    it('quotes again after multi-mint is turned off and pays the new plan with CashuSendingLightning', async () => {
        const { CashuStore, navigation } = await renderView({
            ecash: { enableMultiMint: true },
            CashuStore: makeCashuStore({
                multiMintSelectedUrls: [MINT_1, MINT_2]
            })
        });
        expect(hosts('Switch')[0].props.value).toBe(true);

        await act(async () => hosts('Switch')[0].props.onValueChange(false));
        await flush();

        expect(CashuStore.setMultiMintSelectedUrls).toHaveBeenCalledWith([
            MINT_1
        ]);
        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(2);
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('CashuSendingLightning');
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(
            await planOf(CashuStore, 1)
        );
    });

    it('shows and pays the latest quote when an older one lands last', async () => {
        const { CashuStore, navigation, emit } = await renderView({
            ecash: { enableMultiMint: true }
        });
        // the switch is hidden while a quote loads
        const toggle = hosts('Switch')[0].props.onValueChange;
        const onFocus = deferred<any>();
        const afterToggle = deferred<any>();
        CashuStore.getPayReq
            .mockReturnValueOnce(onFocus.promise)
            .mockReturnValueOnce(afterToggle.promise);

        await act(async () => emit('focus'));
        await act(async () => {
            void toggle(true);
        });
        await flush();
        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(3);

        const latest = makePlan(PAYMENT_REQUEST, { feeEstimate: 7 });
        afterToggle.resolve(latest);
        await flush();
        onFocus.resolve(makePlan(PAYMENT_REQUEST, { feeEstimate: 9 }));
        await flush();

        expect(feeShown()).toBe(7);
        await fireEvent.press(payButton());

        expect(navigatedTo(navigation)[0][0]).toBe('MultimintPayment');
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(latest);
    });
});

// navigate() and popTo() to an open CashuPaymentRequest only swap its route
// params (deep link, NFC tap or scan of a second invoice)
describe('CashuPaymentRequest opened with another request', () => {
    onAndroid();

    // PAYMENT_REQUEST and OTHER_REQUEST quote to 20,000 and 30,000 sats,
    // both over the slide to pay threshold
    const setup = async (options: Parameters<typeof makeProps>[0] = {}) => {
        const CashuStore = makeCashuStore();
        CashuStore.getPayReq.mockImplementation(
            async (paymentRequest: string) =>
                makePlan(paymentRequest, {
                    payReqOverrides: {
                        getRequestAmount:
                            paymentRequest === OTHER_REQUEST ? 30000 : 20000
                    }
                })
        );
        const made = makeProps({
            payments: {
                slideToPayThreshold: 10000,
                enableDonations: true,
                defaultDonationPercentage: 0
            },
            CashuStore,
            ...options
        });
        const result = await render(<CashuPaymentRequest {...made.props} />);
        await flush();
        const open = async (params: object) => {
            await result.rerender(
                <CashuPaymentRequest
                    {...made.props}
                    route={{ params } as any}
                />
            );
            await flush();
        };
        return { ...made, ...result, open };
    };

    it('quotes, shows and pays the new request', async () => {
        const { CashuStore, navigation, open } = await setup();
        expect(shownAmount()).toBe(20000);

        await open({ paymentRequest: OTHER_REQUEST });

        expect(CashuStore.getPayReq.mock.calls).toEqual([
            [PAYMENT_REQUEST],
            [OTHER_REQUEST]
        ]);
        expect(shownAmount()).toBe(30000);

        await act(async () => swipeButton().props.onSwipeSuccess());

        const plan = await planOf(CashuStore, 1);
        expect(navigatedTo(navigation)).toStrictEqual([
            [
                'CashuSendingLightning',
                { paymentAmount: '30000', paymentPlan: plan }
            ]
        ]);
        expect(navigatedTo(navigation)[0][1].paymentPlan).toBe(plan);
    });

    it('does not let a slide begun on the old request pay either request', async () => {
        const { navigation, open } = await setup();
        // the gesture in progress on the first request
        const oldSwipe = swipeButton().props.onSwipeSuccess;

        await open({ paymentRequest: OTHER_REQUEST });
        expect(swipeButton().props.onSwipeSuccess).not.toBe(oldSwipe);
        await act(async () => oldSwipe());

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('does not carry the donation picked for the old request over', async () => {
        const { navigation, open } = await setup();
        await pickDonation(2);

        await open({ paymentRequest: OTHER_REQUEST });
        await act(async () => swipeButton().props.onSwipeSuccess());

        expect(navigatedTo(navigation)[0][1].paymentPlan.paymentRequest).toBe(
            OTHER_REQUEST
        );
        expect(navigatedTo(navigation)[0][1]).not.toHaveProperty(
            'donationAmount'
        );
    });

    it('drops a quote of the old request that lands after the new one', async () => {
        const oldQuote = deferred<any>();
        const { CashuStore, navigation, open } = await setup();
        const quote = CashuStore.getPayReq.getMockImplementation();
        CashuStore.getPayReq.mockImplementation((paymentRequest: string) =>
            paymentRequest === 'lnbc-slow'
                ? oldQuote.promise
                : quote(paymentRequest)
        );
        // a third request, so the first screen instance is not reused
        await open({ paymentRequest: 'lnbc-slow' });

        await open({ paymentRequest: OTHER_REQUEST });
        oldQuote.resolve(
            makePlan('lnbc-slow', {
                payReqOverrides: { getRequestAmount: 999999 }
            })
        );
        await flush();

        expect(shownAmount()).toBe(30000);
        await act(async () => swipeButton().props.onSwipeSuccess());

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigatedTo(navigation)[0][1].paymentPlan.paymentRequest).toBe(
            OTHER_REQUEST
        );
    });

    it('keeps the review when the same request is opened again', async () => {
        const { CashuStore, navigation, open } = await setup();
        await pickDonation(2);

        await open({ paymentRequest: PAYMENT_REQUEST });

        expect(CashuStore.getPayReq).toHaveBeenCalledTimes(1);
        await act(async () => swipeButton().props.onSwipeSuccess());
        expect(navigatedTo(navigation)[0][1]).toStrictEqual({
            paymentAmount: '20000',
            paymentPlan: await planOf(CashuStore, 0),
            donationAmount: '4000'
        });
    });

    it('shows the missing request error when the params lose the request', async () => {
        const { open } = await setup();

        await open({});

        expect(hosts('ErrorMessage')[0].props.message).toBe(NO_PAY_REQ);
        expect(hosts('SwipeButton')).toHaveLength(0);
        expect(queryPayButton()).not.toBeOnTheScreen();
    });
});
