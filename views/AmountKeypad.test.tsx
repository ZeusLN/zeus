jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
// the keypad's font size reads the decimal places from these
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: { fiat: 'USD' } },
    fiatStore: { symbolLookup: () => ({ decimalPlaces: 2 }) }
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/PinPad', () => 'PinPad');
jest.mock('../components/UnitToggle', () => 'UnitToggle');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/KeypadAmountDisplay', () => {
    const { Text, View } = require('react-native');
    return ({ amount, children }: any) => (
        <View>
            <Text testID="amount">{amount}</Text>
            {children}
        </View>
    );
});
jest.mock('../components/CurrencySelectorModal', () => {
    const React = require('react');
    return class CurrencySelectorModal extends React.Component {
        open() {}
        render() {
            return React.createElement('CurrencySelectorModal', this.props);
        }
    };
});
jest.mock('../assets/images/SVG/Clipboard.svg', () => 'ClipboardSVG');
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import AmountKeypad from './AmountKeypad';

const host = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0];

const renderKeypad = async () => {
    const onConfirm = jest.fn();
    const onUnitsChange = jest.fn();
    const UnitsStore: any = { units: 'fiat' };
    const SettingsStore: any = { settings: { fiat: 'USD' } };
    await render(
        <AmountKeypad
            {...({
                navigation: { goBack: jest.fn() },
                route: {
                    params: { initialAmount: '25', onConfirm, onUnitsChange }
                },
                FiatStore: {},
                SettingsStore,
                UnitsStore
            } as any)}
        />
    );
    expect(screen.getByTestId('amount')).toHaveTextContent('25');
    return { onConfirm, onUnitsChange, UnitsStore, SettingsStore };
};

// CurrencyList stores the selection, then closes the modal
const pickInModal = async (select: () => void) => {
    await act(() => host('UnitToggle').props.onOpenModal());
    select();
    await act(() => host('CurrencySelectorModal').props.onClose());
};

describe('AmountKeypad unit changes', () => {
    it('clears the digits and tells the caller when the unit is toggled', async () => {
        const { onConfirm, onUnitsChange } = await renderKeypad();

        await act(() => host('UnitToggle').props.onToggle());

        expect(screen.getByTestId('amount')).toHaveTextContent('0');
        expect(onUnitsChange).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('tells the caller when another unit is picked in the currency modal', async () => {
        const { onUnitsChange, UnitsStore } = await renderKeypad();

        await pickInModal(() => (UnitsStore.units = 'sats'));

        expect(screen.getByTestId('amount')).toHaveTextContent('0');
        expect(onUnitsChange).toHaveBeenCalledTimes(1);
    });

    it('tells the caller when another fiat currency is picked in the currency modal', async () => {
        const { onUnitsChange, SettingsStore } = await renderKeypad();

        await pickInModal(() => (SettingsStore.settings.fiat = 'EUR'));

        expect(onUnitsChange).toHaveBeenCalledTimes(1);
    });

    it('does not tell the caller when the currency modal closes without a change', async () => {
        const { onUnitsChange } = await renderKeypad();

        await pickInModal(() => undefined);

        expect(onUnitsChange).not.toHaveBeenCalled();
    });
});
