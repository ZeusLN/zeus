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
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../stores/UnitsStore', () => ({}));
jest.mock('../../stores/FiatStore', () => ({}));
jest.mock('../../stores/InventoryStore', () => ({
    CATEGORY_KEY: 'categories',
    PRODUCT_KEY: 'products'
}));
jest.mock('../../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn() }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Switch', () => 'Switch');
jest.mock('../../components/Text', () => 'Text');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import WebPortalPOS from './WebPortalPOS';

// The same switch as in views/Settings/Currency.tsx, shown once the web
// portal POS is on
const toggleFiat = async (
    units: string,
    fiatEnabled: boolean = true,
    saveFails: boolean = false
) => {
    let saved = false;
    const SettingsStore = {
        settings: {
            fiatEnabled,
            fiat: 'USD',
            lightningAddress: { posEnabled: true },
            pos: {}
        },
        updateSettings: jest.fn(async () => {
            await Promise.resolve();
            if (saveFails) throw new Error('save failed');
            saved = true;
        }),
        updateSettingsGroup: jest.fn(async () => {}),
        updateSettingsGroupDebounced: jest.fn(),
        flushPendingSettings: jest.fn(),
        settingsUpdateInProgress: false
    };
    const UnitsStore = {
        units,
        setUnits: jest.fn(async () => {}),
        resetUnits: jest.fn()
    };
    // The load comes after the save, so a failed save makes no request.
    // Record for each call whether the save had finished
    const fetchesAfterSave: boolean[] = [];
    const FiatStore = {
        getFiatRates: jest.fn(async () => {
            fetchesAfterSave.push(saved);
        })
    };
    await render(
        <WebPortalPOS
            {...({
                navigation: { navigate: jest.fn() },
                SettingsStore,
                LightningAddressStore: { update: jest.fn(), loading: false },
                UnitsStore,
                FiatStore
            } as any)}
        />
    );
    // the first switch turns the web portal POS on, the second is fiat
    const fiatSwitch = screen.container.queryAll((n) => n.type === 'Switch')[1];
    if (saveFails) {
        // fireEvent does not hand back the handler's promise
        await act(async () => {
            await expect(
                fiatSwitch.props.onValueChange(!fiatEnabled)
            ).rejects.toThrow('save failed');
        });
    } else {
        await fireEvent(fiatSwitch, 'valueChange', !fiatEnabled);
    }
    return { SettingsStore, UnitsStore, FiatStore, fetchesAfterSave };
};

describe('WebPortalPOS fiat switch', () => {
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

    // Since #5151 only the wallet refresh loads rates, and only with fiat
    // on, so turning fiat on here loaded nothing until that refresh
    it('loads the rates once fiat is turned on and stored', async () => {
        const { SettingsStore, fetchesAfterSave } = await toggleFiat(
            'sats',
            false
        );

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            fiatEnabled: true
        });
        expect(fetchesAfterSave).toEqual([true]);
    });

    it('does not load rates when fiat is turned off', async () => {
        const { FiatStore } = await toggleFiat('sats');

        expect(FiatStore.getFiatRates).not.toHaveBeenCalled();
    });

    it('does not load rates when saving fiat on fails', async () => {
        const { SettingsStore, FiatStore } = await toggleFiat(
            'sats',
            false,
            true
        );

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith({
            fiatEnabled: true
        });
        expect(FiatStore.getFiatRates).not.toHaveBeenCalled();
    });
});
