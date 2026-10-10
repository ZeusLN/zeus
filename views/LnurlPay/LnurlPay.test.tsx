jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores', () => ({
    unitsStore: { units: 'sats' },
    settingsStore: {
        settings: {
            fiat: 'USD',
            display: {
                showAllDecimalPlaces: false,
                removeDecimalSpaces: false
            }
        }
    },
    fiatStore: {
        fiatRates: [{ code: 'USD', rate: 50000 }],
        getSymbol: () => ({
            symbol: '$',
            space: false,
            rtl: false,
            separatorSwap: false,
            decimalPlaces: 2
        }),
        symbolLookup: () => ({ decimalPlaces: 2 })
    }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/LnurlPayUtils', () => ({
    verifyLnurlPayInvoice: jest.fn(),
    isLnurlCallbackAllowed: jest.fn(() => ({ ok: true }))
}));
// the callback request never settles, so Confirm only shows what it sent
const mockNetworkFetch = jest.fn((..._args: any[]) => new Promise(() => {}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/NetworkUtils', () => ({
    networkFetch: (...args: any[]) => mockNetworkFetch(...args)
}));
jest.mock('react-native-gesture-handler', () => ({ ScrollView: 'ScrollView' }));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/AmountInput', () => 'AmountInput');
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('./Metadata', () => 'LnurlPayMetadata');
jest.mock('../../models/Contact', () => class Contact {});

import * as React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import LnurlPay from './LnurlPay';
import { settingsStore, unitsStore } from '../../stores/Stores';
import { verifyLnurlPayInvoice } from '../../utils/LnurlPayUtils';

const FIXED_SATS = 12618;
const CONFIRM = 'views.LnurlPay.LnurlPay.confirm';

const lnurlParams = (minSats: number, maxSats: number) => ({
    domain: 'example.com',
    callback: 'https://example.com/callback',
    minSendable: minSats * 1000,
    maxSendable: maxSats * 1000,
    metadata: JSON.stringify([['text/plain', 'test']]),
    commentAllowed: 0
});

const renderView = async (params: { [key: string]: any }) => {
    const listeners: { [event: string]: () => void } = {};
    const props = {
        navigation: {
            addListener: jest.fn((event: string, listener: () => void) => {
                listeners[event] = listener;
            }),
            removeListener: jest.fn(),
            navigate: jest.fn(),
            goBack: jest.fn()
        },
        route: { params },
        // resetUnits() is a no-op here, so the screen has to get the unit
        // right on its own
        UnitsStore: { resetUnits: jest.fn() },
        ContactStore: { contacts: [] },
        CashuStore: {},
        InvoicesStore: {},
        LnurlPayStore: {}
    };
    await render(<LnurlPay {...(props as any)} />);
    return { ...props, listeners };
};

const hostOfType = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0];

const amountInputProps = () => {
    const input = hostOfType('AmountInput');
    expect(input).toBeDefined();
    return input.props;
};

// Presses Confirm and returns the msat amount sent to the callback
const confirmedMsat = async () => {
    mockNetworkFetch.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: CONFIRM }));
    const [{ url }] = mockNetworkFetch.mock.calls[0];
    return new URL(url).searchParams.get('amount');
};

describe('LnurlPay fixed-amount prefill', () => {
    afterEach(() => {
        unitsStore.units = 'sats';
    });

    it('prefills a fixed request in sats while units are fiat', async () => {
        unitsStore.units = 'fiat';
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });

        expect(amountInputProps()).toMatchObject({
            amount: '12618',
            forceUnit: 'sats'
        });
        expect(await confirmedMsat()).toBe('12618000');
    });

    it('prefills a fixed request in sats while units are BTC', async () => {
        unitsStore.units = 'BTC';
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });

        expect(amountInputProps()).toMatchObject({
            amount: '12618',
            forceUnit: 'sats'
        });
        expect(await confirmedMsat()).toBe('12618000');
    });

    it('ignores a satAmount param on a fixed request', async () => {
        unitsStore.units = 'fiat';
        // Send forwards its own amount as a string (validateAddress in Send.tsx)
        await renderView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS),
            satAmount: '5000'
        });

        expect(amountInputProps()).toMatchObject({
            amount: '12618',
            forceUnit: 'sats',
            locked: true
        });
        expect(await confirmedMsat()).toBe('12618000');
    });

    it('ignores an amount param on a fixed request', async () => {
        unitsStore.units = 'fiat';
        await renderView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS),
            amount: '2.50'
        });

        expect(amountInputProps()).toMatchObject({
            amount: '12618',
            forceUnit: 'sats',
            locked: true
        });
        expect(await confirmedMsat()).toBe('12618000');
    });

    it('keeps the fixed amount when the screen regains focus after a switch to fiat', async () => {
        const { listeners } = await renderView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS)
        });
        expect(listeners.focus).toBeDefined();

        unitsStore.units = 'fiat';
        await act(async () => listeners.focus());

        expect(amountInputProps()).toMatchObject({
            amount: '12618',
            forceUnit: 'sats'
        });
        expect(await confirmedMsat()).toBe('12618000');
    });

    it('starts a variable request empty, with Confirm disabled', async () => {
        unitsStore.units = 'fiat';
        await renderView({ lnurlParams: lnurlParams(1, 100000) });

        expect(amountInputProps().amount).toBe('');
        expect(amountInputProps().forceUnit).toBeUndefined();
        expect(screen.getByRole('button', { name: CONFIRM })).toBeDisabled();
    });

    it('still prefills a variable request from a satAmount param in the current unit', async () => {
        unitsStore.units = 'fiat';
        await renderView({
            lnurlParams: lnurlParams(1, 100000),
            satAmount: '5000'
        });

        expect(amountInputProps().amount).toBe('2.50');
        expect(amountInputProps().forceUnit).toBeUndefined();
        expect(await confirmedMsat()).toBe('5000000');
    });

    it('prefills a variable request from an amount param', async () => {
        unitsStore.units = 'fiat';
        await renderView({
            lnurlParams: lnurlParams(1, 100000),
            amount: '2.50'
        });

        expect(amountInputProps()).toMatchObject({
            amount: '2.50',
            forceUnit: undefined,
            locked: false
        });
        expect(await confirmedMsat()).toBe('5000000');
    });

    it('sends the sat amount entered in the input, not the display amount', async () => {
        unitsStore.units = 'fiat';
        await renderView({ lnurlParams: lnurlParams(1, 100000) });

        await fireEvent(
            hostOfType('AmountInput'),
            'amountChange',
            '2.50',
            5000
        );

        expect(await confirmedMsat()).toBe('5000000');
    });
});

describe('LnurlPay fixed and variable requests', () => {
    it('resets units only for a fixed request', async () => {
        const fixed = await renderView({
            lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS)
        });
        expect(fixed.UnitsStore.resetUnits).toHaveBeenCalledTimes(1);

        const variable = await renderView({
            lnurlParams: lnurlParams(1, 100000)
        });
        expect(variable.UnitsStore.resetUnits).not.toHaveBeenCalled();
    });

    it('shows the min-max range only for a variable request', async () => {
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });
        expect(hostOfType('Amount')).toBeUndefined();

        await renderView({ lnurlParams: lnurlParams(1, 100000) });
        expect(hostOfType('Amount').props.sats).toBe(1);
    });

    it('labels only a fixed request as a fixed amount', async () => {
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });
        expect(
            screen.getByText('(views.ClinkPay.fixedAmount)', { exact: false })
        ).toBeOnTheScreen();

        await renderView({ lnurlParams: lnurlParams(1, 100000) });
        expect(
            screen.queryByText('views.ClinkPay.fixedAmount', { exact: false })
        ).not.toBeOnTheScreen();
    });
});

describe('LnurlPay with invalid lnurlParams', () => {
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
        alertSpy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation(() => undefined);
    });

    // Restored here, not in the test, so a failing assertion can't leak it
    afterEach(() => {
        alertSpy.mockRestore();
    });

    // The alert carries our message, not a TypeError, and the amount input
    // is never rendered
    const expectRejected = () => {
        expect(alertSpy).toHaveBeenCalledWith(
            'views.LnurlPay.LnurlPay.invalidParams',
            'views.LnurlPay.LnurlPay.errorInvalidRequest',
            expect.any(Array),
            { cancelable: false }
        );
        expect(hostOfType('AmountInput')).toBeUndefined();
    };

    it('rejects missing lnurlParams and keeps the units', async () => {
        const { UnitsStore } = await renderView({});

        expectRejected();
        expect(UnitsStore.resetUnits).not.toHaveBeenCalled();
    });

    it('rejects a request with only a callback', async () => {
        await renderView({
            lnurlParams: {
                callback: 'https://example.com/callback',
                tag: 'payRequest'
            }
        });
        expectRejected();
    });

    it('rejects a request whose minSendable is above maxSendable', async () => {
        await renderView({ lnurlParams: lnurlParams(2000, 1000) });
        expectRejected();
    });

    it.each([
        ['a request without a callback', { callback: undefined }],
        ['a string minSendable', { minSendable: '1000' }],
        ['a NaN maxSendable', { maxSendable: NaN }],
        ['an Infinity maxSendable', { maxSendable: Infinity }],
        ['a fixed request for 0 msat', { minSendable: 0, maxSendable: 0 }],
        ['a variable request with minSendable 0', { minSendable: 0 }],
        ['a negative minSendable', { minSendable: -1000 }],
        ['a minSendable of 0.5 msat', { minSendable: 0.5 }]
    ])('rejects %s', async (_name, change) => {
        await renderView({
            lnurlParams: { ...lnurlParams(1, 100000), ...change }
        });
        expectRejected();
    });

    it.each([
        ['a fixed request for 1 msat', { minSendable: 1, maxSendable: 1 }],
        ['a variable request with minSendable 1', { minSendable: 1 }]
    ])('accepts %s', async (_name, change) => {
        await renderView({
            lnurlParams: { ...lnurlParams(1, 100000), ...change }
        });

        expect(alertSpy).not.toHaveBeenCalled();
        expect(hostOfType('AmountInput')).toBeDefined();
    });

    it('renders only the header, with a way back', async () => {
        await renderView({});

        expect(hostOfType('Header').props.leftComponent).toBe('Back');
        expect(hostOfType('AmountInput')).toBeUndefined();
    });

    it('goes back when the alert is dismissed', async () => {
        const { navigation } = await renderView({});
        const [, , buttons] = alertSpy.mock.calls[0];

        buttons[0].onPress();

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});

describe('LnurlPay ecash payment', () => {
    // BOLT 11 spec vectors with different payment hashes
    const SERVICE_INVOICE =
        'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
    const OTHER_INVOICE =
        'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';
    const SERVICE_PAYMENT_HASH =
        '0001020304050607080900010203040506070809000102030405060708090102';

    beforeEach(() => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        (verifyLnurlPayInvoice as jest.Mock).mockReturnValue({ ok: true });
        mockNetworkFetch.mockReset();
        mockNetworkFetch.mockResolvedValue({
            json: () => ({ pr: SERVICE_INVOICE })
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockNetworkFetch.mockReset();
        mockNetworkFetch.mockImplementation(() => new Promise(() => {}));
    });

    // Confirms an ecash payment while another caller of the shared
    // CashuStore loads OTHER_INVOICE during the mint quote round trip
    const confirmWhileStoreIsReplaced = async () => {
        const CashuStore: any = {};
        CashuStore.getPayReq = jest.fn(async () => {
            CashuStore.paymentRequest = OTHER_INVOICE;
            CashuStore.payReq = { payment_hash: 'other-payment-hash' };
            CashuStore.getPayReqError = 'error of the other invoice';
        });
        const navigation = {
            addListener: jest.fn(),
            removeListener: jest.fn(),
            navigate: jest.fn(),
            goBack: jest.fn()
        };
        const LnurlPayStore = { keep: jest.fn() };
        await render(
            <LnurlPay
                {...({
                    navigation,
                    route: {
                        params: {
                            lnurlParams: lnurlParams(250000, 250000),
                            ecash: true
                        }
                    },
                    UnitsStore: { resetUnits: jest.fn() },
                    ContactStore: { contacts: [] },
                    CashuStore,
                    InvoicesStore: { getPayReq: jest.fn(async () => {}) },
                    LnurlPayStore
                } as any)}
            />
        );
        await fireEvent.press(screen.getByRole('button', { name: CONFIRM }));
        await act(async () => {
            await new Promise(setImmediate);
        });
        return { navigation, LnurlPayStore };
    };

    it('passes the invoice it checked to ChoosePaymentMethod', async () => {
        const { navigation } = await confirmWhileStoreIsReplaced();

        expect(navigation.navigate).toHaveBeenCalledWith(
            'ChoosePaymentMethod',
            { lightning: SERVICE_INVOICE, locked: true }
        );
    });

    it('records the payment under the checked invoice payment hash', async () => {
        const { LnurlPayStore } = await confirmWhileStoreIsReplaced();

        expect(LnurlPayStore.keep).toHaveBeenCalledTimes(1);
        expect(LnurlPayStore.keep.mock.calls[0][0]).toBe(SERVICE_PAYMENT_HASH);
    });

    it('ignores the error of an invoice another caller loaded', async () => {
        await confirmWhileStoreIsReplaced();

        expect(Alert.alert).not.toHaveBeenCalled();
    });
});

describe('LnurlPay callback transport', () => {
    afterEach(() => {
        delete (settingsStore as any).enableTor;
    });

    it('sends the callback over Tor when Tor is enabled', async () => {
        (settingsStore as any).enableTor = true;
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });

        await confirmedMsat();

        expect(mockNetworkFetch).toHaveBeenCalledTimes(1);
        const [{ method, enableTor }] = mockNetworkFetch.mock.calls[0];
        expect(method).toBe('get');
        expect(enableTor).toBe(true);
    });

    it('sends the callback directly when Tor is disabled', async () => {
        await renderView({ lnurlParams: lnurlParams(FIXED_SATS, FIXED_SATS) });

        await confirmedMsat();

        expect(mockNetworkFetch).toHaveBeenCalledWith(
            expect.objectContaining({ enableTor: undefined })
        );
    });
});
