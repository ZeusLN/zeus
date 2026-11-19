jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// getDecimalPlaceholder reads the module stores; the component reads the
// same objects through its props
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {},
    unitsStore: {}
}));
// real colors, since the text color is interpolated toward red on a shake
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) =>
        key === 'secondaryText' ? '#888888' : '#ffffff'
}));
jest.mock('./AnimatedDigit', () => 'AnimatedDigit');
jest.mock('./Conversion', () => 'Conversion');

import * as React from 'react';
import { Animated, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';

import KeypadAmountDisplay from './KeypadAmountDisplay';
import * as Stores from '../stores/Stores';

// the mocked stores, typed loosely so tests can set partial state
const { fiatStore, settingsStore, unitsStore } = Stores as any;

const USD = {
    symbol: '$',
    space: false,
    rtl: false,
    separatorSwap: false,
    decimalPlaces: 2
};
const EUR = { symbol: '€', space: true, rtl: true, separatorSwap: true };

let symbol: any;

beforeEach(() => {
    symbol = USD;
    Object.assign(settingsStore, { settings: { fiat: 'USD', display: {} } });
    Object.assign(fiatStore, {
        getSymbol: () => symbol,
        symbolLookup: () => symbol
    });
    Object.assign(unitsStore, { units: 'sats' });
});

const renderDisplay = async (props: Record<string, any> = {}) => {
    const element = (extra: Record<string, any> = {}) => (
        <KeypadAmountDisplay
            {...({
                amount: '0',
                shakeAnimation: new Animated.Value(0),
                textAnimation: new Animated.Value(0),
                fontSize: 80,
                FiatStore: fiatStore,
                UnitsStore: unitsStore,
                ...props,
                ...extra
            } as any)}
        />
    );
    const view = await render(element());
    return {
        rerender: (extra: Record<string, any>) => view.rerender(element(extra))
    };
};

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

const exitingDigits = () =>
    hosts('AnimatedDigit').filter((n) => n.props.variant === 'exit');

// The amount as the user sees it: prefix, digits, separators, the decimal
// placeholder and the unit suffix, leaving out a digit on its way out
const shown = () =>
    screen.container
        .queryAll(
            (n) =>
                (n.type === 'Text' && typeof n.props.children === 'string') ||
                (n.type === 'AnimatedDigit' && n.props.variant !== 'exit')
        )
        .map((n) =>
            n.type === 'AnimatedDigit' ? n.props.value : n.props.children
        )
        .join('');

describe('KeypadAmountDisplay formatting', () => {
    it.each([
        ['sats', '1234', '1,234 sats'],
        ['sats', '1', '1 sat'],
        ['sats', '0', '0 sats'],
        ['BTC', '0.0001', '₿0.00 010 000'],
        ['fiat', '1234.5', '$1,234.50']
    ])('shows %s %p as %p', async (units, amount, text) => {
        unitsStore.units = units;
        await renderDisplay({ amount });

        expect(shown()).toBe(text);
    });

    it('puts the symbol after the amount for a right-to-left currency', async () => {
        symbol = EUR;
        // the amount keeps a dot; separatorSwap only changes how it is shown
        await renderDisplay({ amount: '1234.56', forceUnit: 'fiat' });

        expect(shown()).toBe('1.234,56 €');
    });

    it('shows the forced unit over the active one', async () => {
        unitsStore.units = 'BTC';
        await renderDisplay({ amount: '21', forceUnit: 'sats' });

        expect(shown()).toBe('21 sats');
    });

    it('animates typed digits but not the placeholder zero', async () => {
        const { rerender } = await renderDisplay({ amount: '0' });
        expect(hosts('AnimatedDigit')).toHaveLength(0);

        await rerender({ amount: '5' });
        expect(hosts('AnimatedDigit')).toHaveLength(1);
    });

    it('greys out a zero amount', async () => {
        await renderDisplay({ amount: '0' });

        expect(screen.getByText(' sats')).toHaveStyle({
            color: '#888888'
        });
    });
});

describe('KeypadAmountDisplay decimal placeholder', () => {
    it.each([
        ['fiat', '12.', '$12.00'],
        ['fiat', '12.3', '$12.30'],
        ['sats', '5.', '5.000 sats'],
        ['BTC', '0.1', '₿0.10 000 000'],
        ['BTC', '0.123', '₿0.12 300 000']
    ])('fills %s %p out to %p', async (units, amount, text) => {
        unitsStore.units = units;
        await renderDisplay({ amount });

        expect(shown()).toBe(text);
    });

    it('fills BTC without spaces when decimal spaces are removed', async () => {
        unitsStore.units = 'BTC';
        settingsStore.settings.display = { removeDecimalSpaces: true };
        await renderDisplay({ amount: '0.1' });

        expect(shown()).toBe('₿0.10000000');
    });

    it('shows no placeholder for a whole amount', async () => {
        unitsStore.units = 'fiat';
        await renderDisplay({ amount: '12' });

        expect(shown()).toBe('$12');
    });
});

describe('KeypadAmountDisplay deleting a digit', () => {
    it('animates the deleted digit out', async () => {
        const { rerender } = await renderDisplay({ amount: '123' });

        await rerender({ amount: '12' });

        expect(exitingDigits().map((n) => n.props.value)).toEqual(['3']);
        expect(shown()).toBe('12 sats');
    });

    it('keeps the decimal placeholder until the digit has gone', async () => {
        unitsStore.units = 'fiat';
        const { rerender } = await renderDisplay({ amount: '1.23' });

        await rerender({ amount: '1.2' });
        // the placeholder still matches the old amount while the 3 leaves
        expect(shown()).toBe('$1.2');

        await act(() => exitingDigits()[0].props.onExitComplete());

        expect(exitingDigits()).toHaveLength(0);
        expect(shown()).toBe('$1.20');
    });

    it('does not animate a digit out when one is typed', async () => {
        const { rerender } = await renderDisplay({ amount: '12' });

        await rerender({ amount: '123' });

        expect(exitingDigits()).toHaveLength(0);
    });

    it('drops a leaving digit when the amount is replaced', async () => {
        const { rerender } = await renderDisplay({ amount: '123' });
        await rerender({ amount: '12' });

        await rerender({ amount: '9' });

        expect(exitingDigits()).toHaveLength(0);
        expect(shown()).toBe('9 sats');
    });

    it('gives each deletion its own animation', async () => {
        const { rerender } = await renderDisplay({ amount: '123' });
        await rerender({ amount: '12' });
        const first = exitingDigits()[0];

        await rerender({ amount: '1' });

        const second = exitingDigits()[0];
        expect(second.props.value).toBe('2');
        expect(second).not.toBe(first);
    });
});

describe('KeypadAmountDisplay sizing', () => {
    const digitFontSize = () => hosts('AnimatedDigit')[0].props.style.fontSize;

    it('keeps the full font size for a short amount', async () => {
        await renderDisplay({ amount: '21' });

        expect(digitFontSize()).toBe(80);
    });

    it('shrinks the font for a long amount', async () => {
        await renderDisplay({ amount: '123456789' });

        // 11 characters plus a quarter weight for the 5-character suffix
        expect(digitFontSize()).toBe(Math.floor(350 / (12.25 * 0.47)));
    });

    it('never shrinks below 20', async () => {
        unitsStore.units = 'BTC';
        await renderDisplay({ amount: '12345678901234567890.12345678' });

        expect(digitFontSize()).toBe(20);
    });
});

describe('KeypadAmountDisplay conversion', () => {
    it('shows the conversion for the amount in the forced unit', async () => {
        await renderDisplay({ amount: '21', forceUnit: 'sats' });

        expect(hosts('Conversion')[0].props).toMatchObject({
            amount: '21',
            forceUnit: 'sats'
        });
    });

    it('hides the conversion when asked to', async () => {
        await renderDisplay({ showConversion: false });

        expect(hosts('Conversion')).toHaveLength(0);
    });

    it.each([
        [false, ['Conversion', 'child']],
        [true, ['child', 'Conversion']]
    ])(
        'places children with childrenBeforeConversion %p',
        async (before, order) => {
            await renderDisplay({
                childrenBeforeConversion: before,
                children: <Text>child</Text>
            });

            expect(
                screen.container
                    .queryAll(
                        (n) =>
                            n.type === 'Conversion' ||
                            n.props.children === 'child'
                    )
                    .map((n) =>
                        n.type === 'Conversion' ? 'Conversion' : 'child'
                    )
            ).toEqual(order);
        }
    );
});
