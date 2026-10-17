jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Chip: 'Chip', Icon: 'Icon' }));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('react-native-nfc-manager', () => ({ isSupported: jest.fn() }));
// Send validates its destination on mount; resolving to nothing keeps it
// on this screen
jest.mock('../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn(() => Promise.resolve(undefined)),
    isClipboardValue: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsOnchainSends: () => true,
    supportsOnchainSendMax: () => true,
    supportsOnchainSendFeeRate: () => false,
    supportsOnchainBatching: () => false,
    supportsCoinControl: () => false,
    supportsKeysend: () => false,
    supportsAMP: () => false,
    supportsOffersDirectPay: jest.fn(() => false),
    decodeOffer: jest.fn(),
    fetchInvoiceFromOffer: jest.fn()
}));
jest.mock('../utils/AddressUtils', () => ({
    extractBolt12Offer: (value: string) =>
        value.startsWith('lno1') ? value : undefined
}));
jest.mock('../utils/NFCUtils', () => ({ scanNfcTag: jest.fn() }));
jest.mock('../utils/AmountUtils', () => ({ getRawAmountFromSats: jest.fn() }));
jest.mock('../utils/GraphSyncUtils', () => ({
    clearPendingPaymentData: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../components/AmountInput', () => 'AmountInput');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/FeeLimit', () => 'FeeLimit');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage',
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/OnchainFeeInput', () => 'OnchainFeeInput');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Switch', () => 'Switch');
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/UTXOPicker', () => 'UTXOPicker');
jest.mock('../assets/images/SVG/NFC-alt.svg', () => 'NFC');
jest.mock('../assets/images/SVG/PeersContact.svg', () => 'ContactIcon');
jest.mock('../assets/images/SVG/Scan.svg', () => 'Scan');
jest.mock('../models/Contact', () => class Contact {});
jest.mock('../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_SLIDE_TO_PAY_THRESHOLD: 10000
}));

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import Send from './Send';
import BackendUtils from '../utils/BackendUtils';
import { getRawAmountFromSats } from '../utils/AmountUtils';

const BALANCE = 500000;

const renderView = async ({
    params = {
        destination: 'bcrt1qexample',
        transactionType: 'On-chain',
        isValid: true
    },
    TransactionsStore = {},
    InvoicesStore = {},
    settings = {}
}: {
    params?: any;
    TransactionsStore?: any;
    InvoicesStore?: any;
    settings?: any;
} = {}) => {
    const navigation = {
        navigate: jest.fn(),
        addListener: jest.fn(() => jest.fn())
    };
    const BalanceStore = {
        confirmedBlockchainBalance: BALANCE,
        totalBlockchainBalanceAccounts: BALANCE,
        lightningBalance: 0,
        getLightningBalance: jest.fn()
    };
    await render(
        <Send
            {...({
                navigation,
                route: { params },
                BalanceStore,
                ContactStore: { contacts: [] },
                InvoicesStore,
                ModalStore: {},
                NodeInfoStore: { supportsOffers: true },
                SettingsStore: {
                    implementation: 'lnd',
                    settings: {},
                    getSettings: jest.fn(async () => settings)
                },
                TransactionsStore,
                UTXOsStore: {}
            } as any)}
        />
    );
    return { navigation, BalanceStore };
};

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

const button = (title: string) =>
    hosts('Button').find((n) => n.props.title === title)!;

const amountInput = () => hosts('AmountInput')[0];

const enterAmount = (amount: string, sats: number) =>
    fireEvent(amountInput(), 'amountChange', amount, sats);

// the Switch in the row labelled `text`
const switchNextTo = (text: string) => {
    let node: TestInstance | null = screen.getByText(text);
    while (node && !node.queryAll((n) => n.type === 'Switch').length) {
        node = node.parent;
    }
    return node!.queryAll((n) => n.type === 'Switch')[0];
};

const toggleSendMax = () =>
    fireEvent(switchNextTo('views.OpenChannel.fundMax'), 'valueChange');

// AmountInput reports the balance once when send max turns on (forceUnit
// changes to sats) and stays silent when it turns off
const turnSendMaxOn = async () => {
    await toggleSendMax();
    await enterAmount(String(BALANCE), BALANCE);
};

const isProceedDisabled = () => button('general.proceed').props.disabled;

describe('Send send max toggle', () => {
    it('restores the entered amount when send max is turned off', async () => {
        await renderView();
        await enterAmount('50000', 50000);

        await turnSendMaxOn();
        expect(amountInput().props.locked).toBe(true);
        await toggleSendMax();

        expect(amountInput().props.amount).toBe('50000');
        expect(amountInput().props.locked).toBe(false);
        expect(isProceedDisabled()).toBe(false);
    });

    it('keeps a cleared amount empty when send max is turned off again', async () => {
        await renderView();
        await enterAmount('50000', 50000);
        await turnSendMaxOn();
        await toggleSendMax();

        await enterAmount('', 0);
        await turnSendMaxOn();
        await toggleSendMax();

        expect(amountInput().props.amount).toBe('');
        expect(isProceedDisabled()).toBe(true);
    });

    it('passes the restored amount on when Proceed is pressed', async () => {
        const { navigation } = await renderView();
        await enterAmount('50000', 50000);
        await turnSendMaxOn();
        await toggleSendMax();

        await fireEvent.press(button('general.proceed'));

        expect(navigation.navigate).toHaveBeenCalledWith(
            'VerifyOnChain',
            expect.objectContaining({
                destination: 'bcrt1qexample',
                amount: '50000',
                satAmount: 50000,
                fundMax: false
            })
        );
    });
});

describe('Send request arriving on the open screen', () => {
    // what navigate('Send', params) does to a Send that is already mounted:
    // the same instance gets new route params
    const renderOpenView = async () => {
        const ref = React.createRef<any>();
        const { navigation, BalanceStore } = await renderView();
        const props = {
            navigation,
            BalanceStore,
            ContactStore: { contacts: [] },
            InvoicesStore: {},
            ModalStore: {},
            NodeInfoStore: { supportsOffers: true },
            SettingsStore: {
                implementation: 'lnd',
                settings: {},
                getSettings: jest.fn(async () => ({}))
            },
            TransactionsStore: {},
            UTXOsStore: {}
        };
        const show = (params: any) =>
            screen.rerender(
                <Send {...({ ...props, route: { params } } as any)} ref={ref} />
            );
        await show({
            destination: 'bcrt1qexample',
            transactionType: 'On-chain',
            isValid: true
        });
        return { navigation, ref, receiveParams: show };
    };

    beforeEach(() => {
        (getRawAmountFromSats as jest.Mock).mockImplementation((sats) => ({
            amount: String(sats)
        }));
    });

    const proceedParams = async (navigation: any) => {
        await fireEvent.press(button('general.proceed'));
        return navigation.navigate.mock.calls.find(
            ([route]: [string]) => route === 'VerifyOnChain'
        )[1];
    };

    it('turns send max off when another request replaces the one under review', async () => {
        const { navigation, receiveParams } = await renderOpenView();
        await turnSendMaxOn();

        await receiveParams({
            destination: 'bcrt1qother',
            satAmount: '50000',
            transactionType: 'On-chain',
            isValid: true
        });

        expect(amountInput().props.amount).toBe('50000');
        expect(await proceedParams(navigation)).toMatchObject({
            destination: 'bcrt1qother',
            satAmount: '50000',
            fundMax: false
        });
    });

    it('turns send max off when the same destination comes back with an amount', async () => {
        const { navigation, receiveParams } = await renderOpenView();
        await turnSendMaxOn();

        await receiveParams({
            destination: 'bcrt1qexample',
            satAmount: '50000',
            transactionType: 'On-chain',
            isValid: true
        });

        expect(await proceedParams(navigation)).toMatchObject({
            satAmount: '50000',
            fundMax: false
        });
    });

    it('starts over when a request for another destination names no amount', async () => {
        const { ref, receiveParams } = await renderOpenView();
        await enterAmount('250000', 250000);
        await act(async () =>
            ref.current.setState({
                message: 'for the first destination',
                additionalOutputs: [
                    { address: 'bcrt1qsecond', amount: '1000', satAmount: 1000 }
                ]
            })
        );
        const { swipeButtonKey } = ref.current.state;

        await receiveParams({
            destination: '03'.padEnd(66, 'b'),
            transactionType: 'Keysend',
            isValid: true
        });

        expect(ref.current.state.amount).toBe('');
        expect(ref.current.state.satAmount).toBe('0');
        expect(ref.current.state.message).toBe('');
        expect(ref.current.state.additionalOutputs).toEqual([]);
        expect(ref.current.state.swipeButtonKey).not.toBe(swipeButtonKey);
    });

    it('keeps what was entered when the request under review is validated again', async () => {
        const { ref, receiveParams } = await renderOpenView();
        await enterAmount('250000', 250000);

        await receiveParams({
            destination: 'bcrt1qexample',
            transactionType: 'On-chain'
        });

        expect(ref.current.state.amount).toBe('250000');
        expect(ref.current.state.satAmount).toBe(250000);
    });

    it('keeps an amount handed in before any destination', async () => {
        const { ref, receiveParams } = await renderOpenView();
        await act(async () =>
            ref.current.setState({
                destination: '',
                transactionType: undefined,
                amount: '250000',
                satAmount: '250000'
            })
        );

        await receiveParams({
            destination: '03'.padEnd(66, 'b'),
            transactionType: 'Keysend',
            isValid: true
        });

        expect(ref.current.state.amount).toBe('250000');
        expect(ref.current.state.satAmount).toBe('250000');
    });
});

describe('Send BOLT 12 Proceed', () => {
    const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';
    const decodedOffer = { description: 'coffee', isExpired: false };

    const supportsOffersDirectPay =
        BackendUtils.supportsOffersDirectPay as jest.Mock;
    const decodeOffer = BackendUtils.decodeOffer as jest.Mock;
    const fetchInvoiceFromOffer =
        BackendUtils.fetchInvoiceFromOffer as jest.Mock;

    // Opens Send on an offer the way handleAnything routes one, with a
    // 45 s payment timeout in settings, then enters the amount and a 25 sat
    // fee limit where the backend shows the fee limit
    const renderOffer = async ({
        bolt12 = offer,
        satAmount = 2500,
        paymentInFlight = false
    }: {
        bolt12?: string;
        satAmount?: number | string;
        paymentInFlight?: boolean;
    } = {}) => {
        const TransactionsStore = { paymentInFlight, sendPayment: jest.fn() };
        const InvoicesStore = { getPayReq: jest.fn() };
        const { navigation } = await renderView({
            params: {
                destination: offer,
                bolt12,
                transactionType: 'BOLT 12',
                isValid: true
            },
            TransactionsStore,
            InvoicesStore,
            settings: { payments: { timeoutSeconds: '45' } }
        });
        await enterAmount(String(satAmount), satAmount as number);
        const [feeLimit] = hosts('FeeLimit');
        if (feeLimit) await fireEvent(feeLimit, 'feeLimitSatChange', '25');
        return { navigation, TransactionsStore, InvoicesStore };
    };

    // Proceed is mocked as a plain host, so a press reaches payBolt12 even
    // when the button renders disabled, which exercises its own guards
    const proceed = () => fireEvent.press(button('general.proceed'));

    const errorShown = () =>
        hosts('ErrorMessage').map((n) => n.props.message)[0];

    beforeEach(() => {
        supportsOffersDirectPay.mockReset();
        decodeOffer.mockReset();
        fetchInvoiceFromOffer.mockReset();
    });

    it('only decodes the offer and opens the review screen on a direct-pay backend', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        decodeOffer.mockResolvedValue(decodedOffer);
        const { navigation, TransactionsStore } = await renderOffer();

        await proceed();

        expect(decodeOffer).toHaveBeenCalledWith({ offer });
        expect(fetchInvoiceFromOffer).not.toHaveBeenCalled();
        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('Bolt12OfferReview', {
            offer,
            decodedOffer,
            satAmount: '2500',
            timeoutSeconds: '45',
            feeLimitSat: '25'
        });
        expect(button('general.proceed').props.disabled).toBe(false);
    });

    it('shows the decode error and stays on Send when the offer cannot be decoded', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        // a PascalCase code, so the assertion below shows the message went
        // through errorToUserFriendly rather than being shown raw
        decodeOffer.mockRejectedValue(new Error('InvalidBech32'));
        const { navigation, TransactionsStore } = await renderOffer();

        await proceed();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(button('general.proceed').props.disabled).toBe(false);
        expect(errorShown()).toBe('Invalid bech32');
    });

    it('does nothing while another payment is in flight', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const { navigation } = await renderOffer({ paymentInFlight: true });
        expect(button('general.proceed').props.disabled).toBe(true);

        await proceed();

        expect(decodeOffer).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    // The review screen only re-checks offer blockers, so this guard is
    // what keeps a zero amount from reaching an amountless offer (#4972)
    describe.each([true, false])(
        'with supportsOffersDirectPay %s',
        (directPay) => {
            it.each(['0', '', 0])(
                'rejects amount %p before decoding or fetching',
                async (satAmount) => {
                    supportsOffersDirectPay.mockReturnValue(directPay);
                    const { navigation, TransactionsStore, InvoicesStore } =
                        await renderOffer({ satAmount });

                    await proceed();

                    expect(errorShown()).toBe(
                        'views.Send.payBolt12.specifyAmount'
                    );
                    expect(button('general.proceed').props.disabled).toBe(
                        false
                    );
                    expect(decodeOffer).not.toHaveBeenCalled();
                    expect(fetchInvoiceFromOffer).not.toHaveBeenCalled();
                    expect(InvoicesStore.getPayReq).not.toHaveBeenCalled();
                    expect(
                        TransactionsStore.sendPayment
                    ).not.toHaveBeenCalled();
                    expect(navigation.navigate).not.toHaveBeenCalled();
                }
            );
        }
    );

    it('rejects an amount never entered, before decoding', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const TransactionsStore = { paymentInFlight: false };
        const { navigation } = await renderView({
            params: {
                destination: offer,
                bolt12: offer,
                transactionType: 'BOLT 12',
                isValid: true
            },
            TransactionsStore
        });

        await proceed();

        expect(errorShown()).toBe('views.Send.payBolt12.specifyAmount');
        expect(decodeOffer).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('reports a missing offer before checking the amount', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const { navigation } = await renderOffer({
            bolt12: '',
            satAmount: '0'
        });

        await proceed();

        expect(errorShown()).toBe('views.Send.payBolt12.offerFetchFailure');
        expect(decodeOffer).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('rejects input that is not an offer without calling the backend', async () => {
        supportsOffersDirectPay.mockReturnValue(true);
        const { navigation } = await renderOffer({
            bolt12: 'bitcoin:?sp=sp1qabc'
        });

        await proceed();

        expect(errorShown()).toBe('views.Send.payBolt12.invalidOffer');
        expect(button('general.proceed').props.disabled).toBe(false);
        expect(decodeOffer).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('fetches an invoice for PaymentRequest on a backend without direct offer pay', async () => {
        supportsOffersDirectPay.mockReturnValue(false);
        fetchInvoiceFromOffer.mockResolvedValue({ invoice: 'lnbcrt1...' });
        const { navigation, TransactionsStore, InvoicesStore } =
            await renderOffer();

        // the fee limit is set on PaymentRequest on this backend
        expect(hosts('FeeLimit')).toHaveLength(0);
        await proceed();

        expect(decodeOffer).not.toHaveBeenCalled();
        expect(fetchInvoiceFromOffer).toHaveBeenCalledWith(
            offer,
            2500,
            '45',
            '100'
        );
        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith('lnbcrt1...');
        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest');
        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it.each([
        [
            'resolves without an invoice',
            () => fetchInvoiceFromOffer.mockResolvedValue({}),
            'views.Send.payBolt12.invoiceFetchFailure'
        ],
        [
            // a PascalCase code, so the assertion shows the message went
            // through errorToUserFriendly rather than being shown raw
            'rejects',
            () =>
                fetchInvoiceFromOffer.mockRejectedValue(
                    new Error('InvalidBech32')
                ),
            'Invalid bech32'
        ]
    ])(
        'shows an error and stays on Send when the invoice fetch %s',
        async (_case, mockFetch, message) => {
            supportsOffersDirectPay.mockReturnValue(false);
            mockFetch();
            const { navigation, TransactionsStore, InvoicesStore } =
                await renderOffer();

            await proceed();

            expect(fetchInvoiceFromOffer).toHaveBeenCalledTimes(1);
            expect(errorShown()).toBe(message);
            expect(button('general.proceed').props.disabled).toBe(false);
            expect(InvoicesStore.getPayReq).not.toHaveBeenCalled();
            expect(navigation.navigate).not.toHaveBeenCalled();
            expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        }
    );
});

describe('Send mount', () => {
    it('refreshes the lightning balance on mount without awaiting settings', async () => {
        const navigation = {
            navigate: jest.fn(),
            addListener: jest.fn(() => jest.fn())
        };
        const getLightningBalance = jest.fn();
        // never resolves: the refresh must be kicked off before settings load
        await render(
            <Send
                {...({
                    navigation,
                    route: { params: {} },
                    BalanceStore: {
                        lightningBalance: 0,
                        getLightningBalance
                    },
                    ContactStore: { contacts: [] },
                    InvoicesStore: {},
                    ModalStore: {},
                    NodeInfoStore: {},
                    SettingsStore: {
                        implementation: 'lnd',
                        settings: {},
                        getSettings: jest.fn(() => new Promise(() => {}))
                    },
                    TransactionsStore: {},
                    UTXOsStore: {}
                } as any)}
            />
        );

        expect(getLightningBalance).toHaveBeenCalledWith(true);
    });
});
