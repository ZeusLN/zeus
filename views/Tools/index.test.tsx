jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
// Every capability off, as on the intro screen with no wallet selected
jest.mock('../../utils/BackendUtils', () => ({
    __esModule: true,
    default: new Proxy({}, { get: () => () => false })
}));
jest.mock('../../utils/DataClearUtils', () => ({
    blockNavigationDuringWipe: jest.fn(),
    clearAllData: jest.fn()
}));
jest.mock('../../utils/RestartUtils', () => ({ restartApp: jest.fn() }));
jest.mock('../../utils/ChannelMigrationUtils', () => ({
    graphDataExists: jest.fn(() => Promise.resolve(false)),
    handleExportChannels: jest.fn()
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock(
    '../../components/Modals/ChannelBackupLoadingModal',
    () => 'ChannelBackupLoadingModal'
);
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('@react-native-vector-icons/feather', () => 'Feather');
jest.mock('../../assets/images/SVG/Account.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Ecash.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Bitcoin.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Caret Right-3.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Pen.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Speedometer.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Sweep.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/RebalanceIcon.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/ExportImport.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Watchtower.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/nwc-logo.svg', () => 'Svg');
jest.mock('../../assets/images/SVG/Nostrich.svg', () => 'Svg');

import * as React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Tools from './index';

const renderTools = async (settings: any) => {
    const navigation = {
        addListener: jest.fn(() => jest.fn()),
        navigate: jest.fn()
    };
    await render(
        <Tools
            {...({
                navigation,
                route: { params: {} },
                SettingsStore: { settings, getSettings: jest.fn() },
                NodeInfoStore: { nodeInfo: {} },
                SyncStore: {},
                ChannelsStore: {
                    channels: [],
                    pendingChannels: [],
                    closedChannels: []
                }
            } as any)}
        />
    );
    return navigation;
};

describe('Tools', () => {
    it('offers wallet config export/import when no wallet exists', async () => {
        const navigation = await renderTools({ nodes: [] });

        await fireEvent.press(
            screen.getByText('views.Tools.nodeConfigExportImport.title')
        );

        expect(navigation.navigate).toHaveBeenCalledWith(
            'NodeConfigExportImport'
        );
    });

    it('offers wallet config export/import with a wallet selected', async () => {
        await renderTools({
            nodes: [{ implementation: 'embedded-lnd' }],
            selectedNode: 0
        });

        expect(
            screen.getByText('views.Tools.nodeConfigExportImport.title')
        ).toBeTruthy();
    });

    it.each([
        ['android', 'views.Tools.keychainCleanup.title.android'],
        ['ios', 'views.Tools.keychainCleanup.title']
    ] as const)('names the keychain cleanup tool for %s', async (os, title) => {
        const platform = jest.replaceProperty(Platform, 'OS', os);
        try {
            await renderTools({ nodes: [] });

            expect(screen.getByText(title)).toBeTruthy();
        } finally {
            platform.restore();
        }
    });
});
