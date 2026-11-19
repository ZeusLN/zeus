jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
// AmountUtils and PrivacyUtils read these module stores; the component reads
// the same objects through its props
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {},
    unitsStore: {}
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('./LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../assets/images/SVG/Clock.svg', () => 'ClockIcon');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Amount from './Amount';
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

beforeEach(() => {
    Object.assign(settingsStore, {
        settings: { fiat: 'USD', display: {}, privacy: {} },
        lurkerExposed: false,
        toggleLurker: jest.fn()
    });
    Object.assign(fiatStore, {
        fiatRates: [{ code: 'USD', rate: 50_000 }],
        loading: false,
        getSymbol: () => USD
    });
    Object.assign(unitsStore, { units: 'sats', changeUnits: jest.fn() });
});

const renderAmount = (props: Record<string, any> = {}) =>
    render(
        <Amount
            {...({
                FiatStore: fiatStore,
                UnitsStore: unitsStore,
                SettingsStore: settingsStore,
                ...props
            } as any)}
        />
    );

const hosts = (type: string) =>
    screen.container.queryAll((n) => n.type === type);

// the text nodes in render order, joined, as the user reads them
const shownText = () =>
    screen.container
        .queryAll((n) => n.type === 'Text')
        .map((n) => [n.props.children].flat().join(''))
        .join('');

describe('Amount in sats', () => {
    it('groups the digits and pluralizes the unit', async () => {
        await renderAmount({ sats: 1234567 });

        expect(screen.getByText('1,234,567')).toBeOnTheScreen();
        expect(screen.getByText('sats')).toBeOnTheScreen();
    });

    it('uses the singular unit for one sat', async () => {
        await renderAmount({ sats: 1 });

        expect(screen.getByText('1')).toBeOnTheScreen();
        expect(screen.getByText('sat')).toBeOnTheScreen();
    });

    // the sign comes from the negative prop; callers show direction with
    // credit and debit colors
    it('drops the sign of negative sats', async () => {
        await renderAmount({ sats: -500 });

        expect(screen.getByText('500')).toBeOnTheScreen();
    });

    it('prefixes a minus sign when asked to', async () => {
        await renderAmount({ sats: 500, negative: true });

        expect(screen.getByText('-500')).toBeOnTheScreen();
    });

    it.each([
        ['debit', 'theme:warning'],
        ['credit', 'theme:success']
    ])('colors a %s amount', async (prop, color) => {
        await renderAmount({ sats: 500, [prop]: true });

        expect(screen.getByText('500')).toHaveStyle({ color });
    });

    it('labels a fee', async () => {
        await renderAmount({ sats: 21, fee: true });

        expect(screen.getByText('sats views.Payment.fee')).toBeOnTheScreen();
    });

    it('shows millisatoshis when the setting is on', async () => {
        settingsStore.settings.display = { showMillisatoshiAmounts: true };
        await renderAmount({ sats: '1000.5', roundAmount: true });

        expect(screen.getByText('1,000.5')).toBeOnTheScreen();
        expect(screen.queryByText('~')).not.toBeOnTheScreen();
    });

    it('rounds millisatoshis away when the setting is off', async () => {
        settingsStore.settings.display = { showMillisatoshiAmounts: false };
        await renderAmount({ sats: '1000.5' });

        expect(screen.getByText('1,001')).toBeOnTheScreen();
        expect(screen.queryByText('~')).not.toBeOnTheScreen();
    });

    it('marks a rounded amount when asked to', async () => {
        settingsStore.settings.display = { showMillisatoshiAmounts: false };
        await renderAmount({ sats: '1000.5', roundAmount: true });

        expect(screen.getByText('~')).toBeOnTheScreen();
        expect(screen.getByText('1,001')).toBeOnTheScreen();
    });

    it('keeps millisatoshis on a fee even when the setting is off', async () => {
        settingsStore.settings.display = { showMillisatoshiAmounts: false };
        await renderAmount({ sats: '0.5', fee: true });

        expect(screen.getByText('0.5')).toBeOnTheScreen();
    });

    it('keeps millisatoshis when forced even when the setting is off', async () => {
        settingsStore.settings.display = { showMillisatoshiAmounts: false };
        await renderAmount({ sats: '0.5', forceMsats: true });

        expect(screen.getByText('0.5')).toBeOnTheScreen();
    });
});

describe('Amount in BTC', () => {
    it('shows the bitcoin symbol and the amount in BTC', async () => {
        await renderAmount({ sats: 12345, fixedUnits: 'BTC' });

        expect(screen.getByText('₿')).toBeOnTheScreen();
        expect(screen.getByText('0.00 012 345')).toBeOnTheScreen();
    });

    it('follows the active unit when no unit is fixed', async () => {
        unitsStore.units = 'BTC';
        await renderAmount({ sats: 100_000_000 });

        expect(screen.getByText('₿')).toBeOnTheScreen();
        expect(screen.getByText('1')).toBeOnTheScreen();
    });
});

describe('Amount in fiat', () => {
    it('converts at the selected currency rate and marks it approximate', async () => {
        await renderAmount({ sats: 12345, fixedUnits: 'fiat' });

        expect(screen.getByText('$')).toBeOnTheScreen();
        expect(screen.getByText('≈')).toBeOnTheScreen();
        expect(screen.getByText('6.17')).toBeOnTheScreen();
    });

    it('puts the symbol after the amount for a right-to-left currency', async () => {
        settingsStore.settings.fiat = 'EUR';
        fiatStore.fiatRates = [{ code: 'EUR', rate: 50_000 }];
        fiatStore.getSymbol = () => ({
            symbol: '€',
            space: true,
            rtl: true,
            separatorSwap: true,
            decimalPlaces: 2
        });
        await renderAmount({ sats: 12_345_678, fixedUnits: 'fiat' });

        expect(shownText()).toBe('≈6.172,84 €');
    });

    it('shows N/A with no symbol when the currency has no rate', async () => {
        fiatStore.fiatRates = [{ code: 'EUR', rate: 45_000 }];
        await renderAmount({ sats: 12345, fixedUnits: 'fiat' });

        expect(screen.getByText('N/A')).toBeOnTheScreen();
        expect(screen.queryByText('$')).not.toBeOnTheScreen();
    });

    it('explains a missing rate under a large amount', async () => {
        fiatStore.fiatRates = [{ code: 'EUR', rate: 45_000 }];
        await renderAmount({
            sats: 12345,
            fixedUnits: 'fiat',
            jumboText: true
        });

        expect(
            screen.getByText('general.fiatRateNotAvailable')
        ).toBeOnTheScreen();
    });

    it('does not repeat the reason under a pending amount', async () => {
        fiatStore.fiatRates = [{ code: 'EUR', rate: 45_000 }];
        await renderAmount({
            sats: 12345,
            fixedUnits: 'fiat',
            jumboText: true,
            pending: true
        });

        expect(
            screen.queryByText('general.fiatRateNotAvailable')
        ).not.toBeOnTheScreen();
    });

    it('shows a spinner instead of N/A while rates are loading', async () => {
        fiatStore.fiatRates = undefined;
        fiatStore.loading = true;
        await renderAmount({
            sats: 12345,
            fixedUnits: 'fiat',
            jumboText: true
        });

        expect(hosts('LoadingIndicator')).toHaveLength(1);
        expect(screen.queryByText('N/A')).not.toBeOnTheScreen();
        expect(
            screen.queryByText('general.errorFetchingFiatRates')
        ).not.toBeOnTheScreen();
    });

    it('says the rates could not be fetched once loading stops', async () => {
        fiatStore.fiatRates = undefined;
        await renderAmount({
            sats: 12345,
            fixedUnits: 'fiat',
            jumboText: true
        });

        expect(screen.getByText('N/A')).toBeOnTheScreen();
        expect(
            screen.getByText('general.errorFetchingFiatRates')
        ).toBeOnTheScreen();
    });
});

describe('Amount privacy', () => {
    it('masks a sensitive amount in lurker mode', async () => {
        settingsStore.settings.privacy = { lurkerMode: true };
        await renderAmount({ sats: 1234567, sensitive: true });

        expect(screen.queryByText('1,234,567')).not.toBeOnTheScreen();
    });

    it('shows a sensitive amount when lurker mode is off', async () => {
        await renderAmount({ sats: 1234567, sensitive: true });

        expect(screen.getByText('1,234,567')).toBeOnTheScreen();
    });
});

describe('Amount toggling', () => {
    // the pressable that wraps the amount
    const pressAmount = () => fireEvent.press(screen.getByText('1,000'));
    const longPressAmount = () =>
        fireEvent(screen.getByText('1,000'), 'longPress');

    it('switches units on press', async () => {
        await renderAmount({ sats: 1000, toggleable: true });

        await pressAmount();

        expect(unitsStore.changeUnits).toHaveBeenCalledTimes(1);
        expect(settingsStore.toggleLurker).not.toHaveBeenCalled();
    });

    it('does not switch units in lurker mode until revealed', async () => {
        settingsStore.settings.privacy = { lurkerMode: true };
        await renderAmount({ sats: 1000, toggleable: true });

        await pressAmount();
        expect(unitsStore.changeUnits).not.toHaveBeenCalled();

        await longPressAmount();
        expect(settingsStore.toggleLurker).toHaveBeenCalledTimes(1);
    });

    it('switches units and hides again when pressed while revealed', async () => {
        settingsStore.settings.privacy = { lurkerMode: true };
        settingsStore.lurkerExposed = true;
        await renderAmount({ sats: 1000, toggleable: true });

        await pressAmount();

        expect(unitsStore.changeUnits).toHaveBeenCalledTimes(1);
        expect(settingsStore.toggleLurker).toHaveBeenCalledTimes(1);
    });

    it('does not reveal on long press when already revealed', async () => {
        settingsStore.settings.privacy = { lurkerMode: true };
        settingsStore.lurkerExposed = true;
        await renderAmount({ sats: 1000, toggleable: true });

        await longPressAmount();

        expect(settingsStore.toggleLurker).not.toHaveBeenCalled();
    });

    it('switches units from an amount whose rate is missing', async () => {
        fiatStore.fiatRates = [];
        unitsStore.units = 'fiat';
        await renderAmount({ sats: 1000, toggleable: true });

        await fireEvent.press(screen.getByText('N/A'));

        expect(unitsStore.changeUnits).toHaveBeenCalledTimes(1);
    });
});

describe('Amount pending', () => {
    it('opens the pending details from the clock icon', async () => {
        const onPendingPress = jest.fn();
        await renderAmount({ sats: 1000, pending: true, onPendingPress });

        await fireEvent.press(
            screen.getByLabelText('views.Wallet.Wallet.pending')
        );

        expect(onPendingPress).toHaveBeenCalledTimes(1);
    });

    it('shows the clock without a button when nothing handles the press', async () => {
        await renderAmount({ sats: 1000, pending: true });

        expect(hosts('ClockIcon')).toHaveLength(1);
        expect(
            screen.queryByLabelText('views.Wallet.Wallet.pending')
        ).not.toBeOnTheScreen();
    });
});
