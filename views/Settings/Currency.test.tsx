jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { View } = require('react-native');
    const ListItem: any = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => {
        const { Text } = require('react-native');
        return <Text>{children}</Text>;
    };
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    return { Icon: 'Icon', ListItem };
});
jest.mock('../../stores/SettingsStore', () => ({
    CURRENCY_KEYS: [],
    DEFAULT_FIAT: 'USD',
    DEFAULT_FIAT_RATES_SOURCE: 'Zeus',
    FIAT_RATES_SOURCE_KEYS: []
}));
jest.mock('../../stores/UnitsStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Currency from './Currency';

const toggleFiat = async (units: string) => {
    const SettingsStore = {
        settings: { fiatEnabled: true, fiat: 'USD', fiatRatesSource: 'Zeus' },
        updateSettings: jest.fn(async () => {})
    };
    const UnitsStore = {
        units,
        setUnits: jest.fn(async () => {}),
        resetUnits: jest.fn()
    };
    await render(
        <Currency
            {...({
                navigation: { navigate: jest.fn() },
                SettingsStore,
                UnitsStore
            } as any)}
        />
    );
    const fiatSwitch = screen.container.queryAll((n) => n.type === 'Switch')[0];
    await fireEvent(fiatSwitch, 'valueChange');
    return { SettingsStore, UnitsStore };
};

describe('Currency fiat switch', () => {
    it('stores sats as the unit when fiat is turned off while it is the unit', async () => {
        const { SettingsStore, UnitsStore } = await toggleFiat('fiat');

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            fiatEnabled: false
        });
        expect(UnitsStore.setUnits).toHaveBeenCalledWith('sats');
    });

    it('leaves another unit alone when fiat is turned off', async () => {
        const { UnitsStore } = await toggleFiat('BTC');

        expect(UnitsStore.setUnits).not.toHaveBeenCalled();
        expect(UnitsStore.resetUnits).not.toHaveBeenCalled();
    });
});
