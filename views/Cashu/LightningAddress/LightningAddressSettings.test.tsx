jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const ListItem: any = View;
    return {
        Icon: 'Icon',
        ListItem: Object.assign((props: any) => <ListItem {...props} />, {
            Content: View,
            Title: Text
        })
    };
});
jest.mock('../../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../../utils/RestartUtils', () => ({ restartNeeded: jest.fn() }));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../../components/Button', () => 'Button');
jest.mock('../../../components/DropdownSetting', () => 'DropdownSetting');
jest.mock('../../../components/Header', () => 'Header');
jest.mock('../../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../../components/Screen', () => 'Screen');
jest.mock('../../../components/Switch', () => 'Switch');
jest.mock('../../../components/Text', () => 'Text');
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock(
    '../../../views/LightningAddress/ZeusPayPlusSettings',
    () => 'ZeusPayPlusSettings'
);
jest.mock('../../../stores/CashuStore', () => ({}));
jest.mock('../../../stores/LightningAddressStore', () => ({}));
jest.mock('../../../stores/SettingsStore', () => ({
    NOTIFICATIONS_PREF_KEYS: []
}));

import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import CashuLightningAddressSettings from './LightningAddressSettings';

const OLD_MINT = 'https://old.mint.test';
const NEW_MINT = 'https://new.mint.test';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const renderSettings = async (
    setMintUrl = jest.fn().mockResolvedValue({ success: true })
) => {
    const LightningAddressStore = {
        loading: false,
        error_msg: '',
        update: jest.fn(),
        setMintUrl
    };
    const SettingsStore = {
        settings: { lightningAddress: { mintUrl: OLD_MINT } },
        updateSettingsGroup: jest.fn()
    };
    const CashuStore = {
        selectedMintUrl: NEW_MINT,
        mintUrls: [OLD_MINT, NEW_MINT],
        mintInfos: {
            [OLD_MINT]: { name: 'Old Mint' },
            [NEW_MINT]: { name: 'New Mint' }
        }
    };
    await render(
        <CashuLightningAddressSettings
            {...({
                navigation: { navigate: jest.fn(), goBack: jest.fn() },
                LightningAddressStore,
                SettingsStore,
                CashuStore
            } as any)}
        />
    );
    return { LightningAddressStore, SettingsStore };
};

const mintDropdown = () =>
    screen.root!.queryAll(
        (node: any) =>
            node.type === 'DropdownSetting' &&
            node.props.title === 'views.Cashu.LightningAddress.receivingMint'
    )[0];

const explainer = () =>
    screen.root!.queryAll(
        (node: any) =>
            node.type === 'Text' &&
            node.props.children ===
                'views.Cashu.LightningAddress.receivingMintExplainer'
    );

describe('CashuLightningAddressSettings mint', () => {
    it('labels the dropdown as the Lightning address mint and explains it', async () => {
        await renderSettings();

        expect(mintDropdown()).toBeTruthy();
        expect(mintDropdown().props.selectedValue).toBe('Old Mint');
        expect(explainer()).toHaveLength(1);
    });

    it('moves the address with setMintUrl', async () => {
        const { LightningAddressStore, SettingsStore } = await renderSettings();

        await act(async () => {
            await mintDropdown().props.onValueChange(NEW_MINT);
            await flush();
        });

        expect(LightningAddressStore.setMintUrl).toHaveBeenCalledWith(NEW_MINT);
        expect(LightningAddressStore.update).not.toHaveBeenCalled();
        expect(SettingsStore.updateSettingsGroup).not.toHaveBeenCalled();
        expect(mintDropdown().props.selectedValue).toBe('New Mint');
    });

    it('shows the previous mint again when ZEUS Pay rejects', async () => {
        await renderSettings(jest.fn().mockRejectedValue('mint not supported'));

        await act(async () => {
            await mintDropdown().props.onValueChange(NEW_MINT);
            await flush();
        });

        expect(mintDropdown().props.selectedValue).toBe('Old Mint');
    });
});
