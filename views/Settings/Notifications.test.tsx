jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({
    NOTIFICATIONS_PREF_KEYS: []
}));
jest.mock('../../stores/LightningAddressStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});

import * as React from 'react';
import { act, render } from '@testing-library/react-native';
import Notifications from './Notifications';

const setup = async (
    lightningAddress: any,
    update: jest.Mock = jest.fn(async () => true)
) => {
    const SettingsStore = {
        settings: { lightningAddress },
        settingsUpdateInProgress: false,
        updateSettingsGroup: jest.fn(async () => true)
    };
    const LightningAddressStore = {
        loading: false,
        error_msg: '',
        update,
        updatePushCredentials: jest.fn(async () => undefined)
    };
    const view = await render(
        <Notifications
            navigation={{} as any}
            SettingsStore={SettingsStore as any}
            LightningAddressStore={LightningAddressStore as any}
        />
    );
    const dropdown = () =>
        view.container.queryAll((n) => n.type === 'DropdownSetting')[0].props;
    return { SettingsStore, LightningAddressStore, dropdown };
};

describe('Notifications settings', () => {
    it('defaults to 1 when no preference is stored', async () => {
        const { dropdown } = await setup(undefined);
        expect(dropdown().selectedValue).toBe(1);
    });

    it('shows the stored preference', async () => {
        const { dropdown } = await setup({ notifications: 0 });
        expect(dropdown().selectedValue).toBe(0);
    });

    it('saves a new preference to the server and settings', async () => {
        const { SettingsStore, LightningAddressStore, dropdown } = await setup({
            notifications: 1
        });

        await act(async () => {
            await dropdown().onValueChange(0);
        });

        expect(LightningAddressStore.update).toHaveBeenCalledWith({
            notifications: 0
        });
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'lightningAddress',
            { notifications: 0 }
        );
        expect(
            LightningAddressStore.updatePushCredentials
        ).not.toHaveBeenCalled();
        expect(dropdown().selectedValue).toBe(0);
    });

    it('refreshes push credentials when notifications are turned on', async () => {
        const { LightningAddressStore, dropdown } = await setup({
            notifications: 0
        });

        await act(async () => {
            await dropdown().onValueChange(1);
        });

        expect(LightningAddressStore.updatePushCredentials).toHaveBeenCalled();
    });

    it('reverts the dropdown when the server update fails', async () => {
        const { SettingsStore, dropdown } = await setup(
            { notifications: 1 },
            jest.fn(async () => {
                throw new Error('server error');
            })
        );

        await act(async () => {
            await dropdown().onValueChange(0);
        });

        expect(SettingsStore.updateSettingsGroup).not.toHaveBeenCalled();
        expect(dropdown().selectedValue).toBe(1);
    });
});
