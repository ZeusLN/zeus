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
    supportsOnchainBatching: jest.fn(() => false),
    supportsCoinControl: () => false,
    supportsKeysend: jest.fn(() => false),
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
jest.mock('../components/OnchainFeePicker', () => 'OnchainFeePicker');
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
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import Send from './Send';
import BackendUtils from '../utils/BackendUtils';

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

describe('Send on-chain amount card', () => {
    const supportsOnchainBatching =
        BackendUtils.supportsOnchainBatching as jest.Mock;

    beforeEach(() => supportsOnchainBatching.mockReturnValue(true));
    afterEach(() => supportsOnchainBatching.mockReturnValue(false));

    const addOutput = () =>
        fireEvent.press(
            screen.getByRole('button', { name: 'views.Send.addOutput' })
        );
    const removeButtons = () =>
        screen.queryAllByRole('button', { name: 'views.Send.removeOutput' });
    // the destination and amount inputs of each additional output, in order
    const outputInputs = () => ({
        addresses: hosts('TextInput').slice(1),
        amounts: hosts('AmountInput').slice(1)
    });
    const fillOutput = async (index: number, address: string, sats: number) => {
        await fireEvent.changeText(outputInputs().addresses[index], address);
        await fireEvent(
            outputInputs().amounts[index],
            'amountChange',
            String(sats),
            sats
        );
    };

    it('sets the amount input off from the card', async () => {
        await renderView();

        expect(amountInput().props.inputBackgroundColor).toBe('#000000');
    });

    it('adds numbered outputs after the main one', async () => {
        await renderView();
        expect(removeButtons()).toHaveLength(0);

        await addOutput();
        await addOutput();

        expect(screen.getByText('views.PSBT.output 2')).toBeOnTheScreen();
        expect(screen.getByText('views.PSBT.output 3')).toBeOnTheScreen();
        expect(removeButtons()).toHaveLength(2);
    });

    it('removes only the output whose button is pressed', async () => {
        await renderView();
        await addOutput();
        await addOutput();
        await fillOutput(0, 'bcrt1qfirst', 1000);
        await fillOutput(1, 'bcrt1qsecond', 2000);

        await fireEvent.press(removeButtons()[0]);

        expect(removeButtons()).toHaveLength(1);
        expect(outputInputs().addresses[0].props.value).toBe('bcrt1qsecond');
        expect(outputInputs().amounts[0].props.amount).toBe('2000');
    });

    it('passes the filled outputs on when Proceed is pressed', async () => {
        const { navigation } = await renderView();
        await enterAmount('50000', 50000);
        await addOutput();
        await fillOutput(0, 'bcrt1qsecond', 2000);

        await fireEvent.press(button('general.proceed'));

        expect(navigation.navigate).toHaveBeenCalledWith(
            'VerifyOnChain',
            expect.objectContaining({
                satAmount: 50000,
                additionalOutputs: [
                    {
                        address: 'bcrt1qsecond',
                        amount: '2000',
                        satAmount: 2000
                    }
                ]
            })
        );
    });

    it('blocks Proceed while an output has an address but no amount', async () => {
        await renderView();
        await enterAmount('50000', 50000);
        await addOutput();

        await fireEvent.changeText(outputInputs().addresses[0], 'bcrt1qsecond');

        expect(isProceedDisabled()).toBe(true);
    });

    it('hides Add output while send max is on', async () => {
        await renderView();

        await turnSendMaxOn();

        expect(
            screen.queryByRole('button', { name: 'views.Send.addOutput' })
        ).toBeNull();
    });

    it('offers no outputs when the backend cannot batch', async () => {
        supportsOnchainBatching.mockReturnValue(false);
        await renderView();

        expect(
            screen.queryByRole('button', { name: 'views.Send.addOutput' })
        ).toBeNull();
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

describe('Send payment in flight notice', () => {
    const CHECKING = 'components.PaymentInFlightNotice.checking';
    const supportsKeysend = BackendUtils.supportsKeysend as jest.Mock;

    afterEach(() => supportsKeysend.mockReturnValue(false));

    it('explains the disabled keysend control while an earlier payment is checked', async () => {
        supportsKeysend.mockReturnValue(true);
        await renderView({
            params: {
                destination: '02' + 'ab'.repeat(32),
                transactionType: 'Keysend',
                isValid: true
            },
            TransactionsStore: { paymentInFlight: true }
        });

        expect(screen.getByText(CHECKING)).toBeOnTheScreen();
    });

    it('explains the disabled BOLT 12 Proceed while an earlier payment is checked', async () => {
        await renderView({
            params: {
                destination:
                    'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq',
                transactionType: 'BOLT 12',
                isValid: true
            },
            TransactionsStore: { paymentInFlight: true }
        });

        expect(screen.getByText(CHECKING)).toBeOnTheScreen();
        expect(isProceedDisabled()).toBe(true);
    });

    it('shows no notice when no payment is in flight', async () => {
        await renderView({
            params: {
                destination:
                    'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq',
                transactionType: 'BOLT 12',
                isValid: true
            },
            TransactionsStore: { paymentInFlight: false }
        });

        expect(screen.queryByText(CHECKING)).not.toBeOnTheScreen();
    });
});
