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

describe('AmountInput units changed outside of the input', () => {
    // A parent that, like PaymentRequest, feeds the reported amount back in
    // and keeps the reported sats to pay with
    const renderWithParent = async (amount: string) => {
        const parent = { amount, satAmount: '' as string | number };
        const onAmountChange = jest.fn(
            (newAmount: string, satAmount: string | number) => {
                parent.amount = newAmount;
                parent.satAmount = satAmount;
            }
        );
        const element = () => (
            <AmountInput
                {...({
                    amount: parent.amount,
                    onAmountChange,
                    FiatStore: fiatStore,
                    SettingsStore: settingsStore,
                    UnitsStore: unitsStore
                } as any)}
            />
        );
        const view = await render(element());
        const rerender = () => view.rerender(element());
        // observer() is mocked, so re-render as a store write would, then
        // again with whatever the parent now holds
        const storeChanged = async (change: () => void) => {
            change();
            await rerender();
            await rerender();
        };
        return { parent, onAmountChange, storeChanged };
    };

    it('converts the amount when the unit is switched in the keypad and the keypad is left without confirming', async () => {
        unitsStore.units = 'fiat';
        const { parent, storeChanged } = await renderWithParent('25');
        expect(parent.satAmount).toBe('50000');

        await storeChanged(() => (unitsStore.units = 'sats'));

        expect(parent).toEqual({ amount: '50000', satAmount: 50000 });
        expect(screen.getByText('50,000 sats')).toBeOnTheScreen();
    });

    it('converts the amount when a toggleable Amount changes the unit', async () => {
        const { parent, storeChanged } = await renderWithParent('150000');

        await storeChanged(() => (unitsStore.units = 'BTC'));

        expect(parent).toEqual({ amount: '0.0015', satAmount: 150000 });
        expect(screen.getByText('₿0.00 15')).toBeOnTheScreen();
    });

    it('converts the amount when the fiat currency changes', async () => {
        unitsStore.units = 'fiat';
        fiatStore.fiatRates = [
            { code: 'USD', rate: 50_000 },
            { code: 'EUR', rate: 40_000 }
        ];
        const { parent, storeChanged } = await renderWithParent('25');

        await storeChanged(() => (settingsStore.settings.fiat = 'EUR'));

        expect(parent).toEqual({ amount: '20.00', satAmount: 50000 });
    });

    it('keeps the digits and reports their sats when there is no fiat rate', async () => {
        const { parent, storeChanged } = await renderWithParent('1000');

        await storeChanged(() => {
            fiatStore.fiatRates = [];
            unitsStore.units = 'fiat';
        });

        expect(parent).toEqual({ amount: '1000', satAmount: 0 });
    });

    it('does nothing on a re-render without a unit change', async () => {
        const { onAmountChange, storeChanged } = await renderWithParent('1000');
        onAmountChange.mockClear();

        await storeChanged(() => undefined);

        expect(onAmountChange).not.toHaveBeenCalled();
    });

    it('ignores the store unit when a unit is forced', async () => {
        const onAmountChange = jest.fn();
        const view = await render(
            <AmountInput
                {...({
                    amount: '1000',
                    forceUnit: 'sats',
                    onAmountChange,
                    FiatStore: fiatStore,
                    SettingsStore: settingsStore,
                    UnitsStore: unitsStore
                } as any)}
            />
        );
        onAmountChange.mockClear();
        unitsStore.units = 'BTC';
        await view.rerender(
            <AmountInput
                {...({
                    amount: '1000',
                    forceUnit: 'sats',
                    onAmountChange,
                    FiatStore: fiatStore,
                    SettingsStore: settingsStore,
                    UnitsStore: unitsStore
                } as any)}
            />
        );

        expect(onAmountChange).not.toHaveBeenCalled();
        expect(screen.getByText('1,000 sats')).toBeOnTheScreen();
    });
});
