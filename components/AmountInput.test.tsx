jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// AmountUtils and the component's own conversion read these module stores;
// the component reads the same objects through its props
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {},
    unitsStore: {}
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../NavigationService', () => ({ navigate: jest.fn() }));
jest.mock('./Amount', () => 'Amount');
jest.mock('../assets/images/SVG/ExchangeBitcoin.svg', () => 'ExchangeBitcoin');
jest.mock('../assets/images/SVG/ExchangeFiat.svg', () => 'ExchangeFiat');

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AmountInput from './AmountInput';
import NavigationService from '../NavigationService';
import * as Stores from '../stores/Stores';

// the mocked stores, typed loosely so tests can set partial state
const { fiatStore, settingsStore, unitsStore } = Stores as any;

const NEXT_UNIT: Record<string, string> = {
    sats: 'BTC',
    BTC: 'fiat',
    fiat: 'sats'
};

beforeEach(() => {
    (NavigationService.navigate as jest.Mock).mockClear();
    Object.assign(settingsStore, {
        settings: { fiat: 'USD', fiatEnabled: true }
    });
    Object.assign(fiatStore, {
        fiatRates: [{ code: 'USD', rate: 50_000 }],
        getSymbol: () => ({ symbol: '$', decimalPlaces: 2 }),
        getRate: (sats: boolean) => (sats ? '$50.00 per 1k sats' : '$50,000'),
        formatAmountForDisplay: (amount: string) => `$${amount}`
    });
    Object.assign(unitsStore, {
        units: 'sats',
        getNextUnit: () => NEXT_UNIT[unitsStore.units],
        changeUnits: jest.fn(() => {
            unitsStore.units = NEXT_UNIT[unitsStore.units];
        })
    });
});

const renderInput = (props: Record<string, any> = {}) => {
    const onAmountChange = jest.fn();
    const element = (extra: Record<string, any> = {}) => (
        <AmountInput
            {...({
                onAmountChange,
                FiatStore: fiatStore,
                SettingsStore: settingsStore,
                UnitsStore: unitsStore,
                ...props,
                ...extra
            } as any)}
        />
    );
    return render(element()).then((view) => ({
        onAmountChange,
        rerender: (extra: Record<string, any>) => view.rerender(element(extra))
    }));
};

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

// the sats each conversion row under the input is given, by unit
const conversions = () =>
    Object.fromEntries(
        hosts('Amount').map((n) => [n.props.fixedUnits, n.props.sats])
    );

const openKeypad = (shown: string) => fireEvent.press(screen.getByText(shown));

const keypadParams = () => {
    const calls = (NavigationService.navigate as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('AmountKeypad');
    return calls[0][1];
};

describe('AmountInput display', () => {
    it.each([
        ['sats', '1234', '1,234 sats'],
        ['sats', '1', '1 sat'],
        ['sats', '', '0 sats'],
        ['BTC', '0.5', '₿0.5'],
        ['fiat', '12.5', '$12.5']
    ])('shows a %s amount of %p as %p', async (units, amount, shown) => {
        unitsStore.units = units;
        await renderInput({ amount });

        expect(screen.getByText(shown)).toBeOnTheScreen();
    });

    it('converts a sats prop into the active unit when no amount is given', async () => {
        unitsStore.units = 'BTC';
        await renderInput({ sats: '100000' });

        expect(screen.getByText('₿0.00 1')).toBeOnTheScreen();
    });

    it('converts a sats prop into fiat at the selected rate', async () => {
        await renderInput({ sats: '100000', forceUnit: 'fiat' });

        expect(screen.getByText('$50.00')).toBeOnTheScreen();
    });

    it('shows the forced unit over the active one', async () => {
        unitsStore.units = 'BTC';
        await renderInput({ amount: '2100', forceUnit: 'sats' });

        expect(screen.getByText('2,100 sats')).toBeOnTheScreen();
    });

    it('greys out a zero amount', async () => {
        await renderInput({ amount: '0' });

        expect(screen.getByText('0 sats')).toHaveStyle({
            color: 'theme:secondaryText'
        });
    });

    it('outlines the input on error', async () => {
        await renderInput({ amount: '1', error: true });

        expect(screen.getByText('1 sat').parent).toHaveStyle({
            borderWidth: 1,
            borderColor: 'theme:error'
        });
    });

    it('fills the input with the secondary color by default', async () => {
        await renderInput({ amount: '1' });

        expect(screen.getByText('1 sat').parent).toHaveStyle({
            backgroundColor: 'theme:secondary'
        });
    });

    it('fills the input with the given background color', async () => {
        await renderInput({
            amount: '1',
            inputBackgroundColor: 'theme:background'
        });

        expect(screen.getByText('1 sat').parent).toHaveStyle({
            backgroundColor: 'theme:background'
        });
    });
});

describe('AmountInput conversions', () => {
    it('reports the starting amount in sats', async () => {
        unitsStore.units = 'BTC';
        const { onAmountChange } = await renderInput({ amount: '0.001' });

        expect(onAmountChange).toHaveBeenCalledWith('0.001', '100000');
        expect(conversions()).toEqual({ fiat: '100000', sats: '100000' });
    });

    it('reports zero sats when there is no starting amount', async () => {
        const { onAmountChange } = await renderInput();

        expect(onAmountChange).toHaveBeenCalledWith(undefined, '0');
    });

    it('converts a fiat amount at the selected rate', async () => {
        unitsStore.units = 'fiat';
        await renderInput({ amount: '25' });

        expect(conversions()).toEqual({ BTC: '50000', sats: '50000' });
    });

    it('shows the rate and the other two units under the input', async () => {
        await renderInput({ amount: '1000' });

        expect(screen.getByText('$50.00 per 1k sats')).toBeOnTheScreen();
        expect(conversions()).toEqual({ fiat: '1000', BTC: '1000' });
    });

    it('leaves out fiat when it is disabled', async () => {
        settingsStore.settings.fiatEnabled = false;
        await renderInput({ amount: '1000' });

        expect(screen.queryByText('$50.00 per 1k sats')).not.toBeOnTheScreen();
        expect(conversions()).toEqual({ BTC: '1000' });
    });

    it('shows why fiat is unavailable in place of the rate', async () => {
        await renderInput({ amount: '1000', fiatError: 'No rate for USD' });

        expect(screen.getByText('No rate for USD')).toBeOnTheScreen();
        expect(screen.queryByText('$50.00 per 1k sats')).not.toBeOnTheScreen();
        expect(conversions()).toEqual({ BTC: '1000' });
    });

    it('hides the conversions when asked to', async () => {
        await renderInput({ amount: '1000', hideConversion: true });

        expect(hosts('Amount')).toHaveLength(0);
    });

    it('follows a new amount from the parent', async () => {
        const { rerender } = await renderInput({ amount: '1000' });

        await rerender({ amount: '2500' });

        expect(screen.getByText('2,500 sats')).toBeOnTheScreen();
        expect(conversions()).toEqual({ fiat: 2500, BTC: 2500 });
    });

    it('reports the amount in sats when the parent forces sats', async () => {
        unitsStore.units = 'BTC';
        const { onAmountChange, rerender } = await renderInput({
            amount: '0.001'
        });
        onAmountChange.mockClear();

        // as when a fiat conversion fails and the amount falls back to sats
        await rerender({ amount: '100000', forceUnit: 'sats' });

        expect(onAmountChange).toHaveBeenCalledWith('100000', 100000);
        expect(screen.getByText('100,000 sats')).toBeOnTheScreen();
    });
});

describe('AmountInput keypad', () => {
    it('opens the keypad with the shown amount and its options', async () => {
        await renderInput({
            amount: '21',
            forceUnit: 'sats',
            hideUnitChangeButton: true
        });

        await openKeypad('21 sats');

        expect(keypadParams()).toMatchObject({
            initialAmount: '21',
            forceUnit: 'sats',
            hideUnitChangeButton: true
        });
    });

    it.each([
        ['0.00', '0'],
        ['50.20', '50.2'],
        ['50.25', '50.25']
    ])(
        'strips trailing zeros from %p so the keypad starts at %p',
        async (amount, initialAmount) => {
            unitsStore.units = 'fiat';
            await renderInput({ amount });

            await openKeypad(`$${amount}`);

            expect(keypadParams().initialAmount).toBe(initialAmount);
        }
    );

    it('reports the confirmed amount in sats', async () => {
        unitsStore.units = 'BTC';
        const { onAmountChange } = await renderInput({ amount: '0' });
        await openKeypad('₿0');
        onAmountChange.mockClear();

        await act(() => keypadParams().onConfirm('0.0005'));

        expect(onAmountChange).toHaveBeenCalledWith('0.0005', 50000);
        expect(conversions()).toEqual({ fiat: 50000, sats: 50000 });
    });

    it('does not open when locked', async () => {
        await renderInput({ amount: '21', locked: true });

        await openKeypad('21 sats');

        expect(NavigationService.navigate).not.toHaveBeenCalled();
    });
});

describe('AmountInput unit button', () => {
    const unitButton = () =>
        hosts('ExchangeBitcoin')[0] || hosts('ExchangeFiat')[0];

    it('shows the icon for the next unit', async () => {
        await renderInput({ amount: '1' });
        expect(hosts('ExchangeBitcoin')).toHaveLength(1);

        unitsStore.units = 'BTC';
        await renderInput({ amount: '1' });
        expect(hosts('ExchangeFiat')).toHaveLength(1);
    });

    it('reads the typed digits in the next unit', async () => {
        const { onAmountChange } = await renderInput({ amount: '1' });
        onAmountChange.mockClear();

        await fireEvent.press(unitButton());

        expect(unitsStore.changeUnits).toHaveBeenCalledTimes(1);
        expect(onAmountChange).toHaveBeenCalledWith('1', 100_000_000);
        expect(conversions()).toEqual({ fiat: 100_000_000, sats: 100_000_000 });
    });

    it.each([
        ['locked', { locked: true }],
        ['hidden', { hideUnitChangeButton: true }]
    ])('is not shown when %s', async (_label, props) => {
        await renderInput({ amount: '1', ...props });

        expect(unitButton()).toBeUndefined();
    });
});
