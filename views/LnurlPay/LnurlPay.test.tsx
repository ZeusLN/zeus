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
const mockFetchLnurlUrl = jest.fn((..._args: any[]) => new Promise(() => {}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../utils/LnurlFetchUtils', () => ({
    fetchLnurlUrl: (...args: any[]) => mockFetchLnurlUrl(...args)
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
import { unitsStore } from '../../stores/Stores';

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
    mockFetchLnurlUrl.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: CONFIRM }));
    const [url] = mockFetchLnurlUrl.mock.calls[0];
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
