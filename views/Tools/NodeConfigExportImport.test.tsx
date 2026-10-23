jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000',
    isLightTheme: () => false
}));
jest.mock('../../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../../utils/BackgroundLockUtils', () => ({
    suppressBackgroundLockDuring: jest.fn()
}));
jest.mock('../../utils/NodeConfigUtils', () => ({
    saveNodeConfigs: jest.fn(),
    exportNodeConfigs: jest.fn(),
    decryptExportData: jest.fn(),
    decryptExportDataV2: jest.fn(),
    isValidExportPassword: jest.fn(),
    EXPORT_FORMAT_VERSION: 2,
    MIN_EXPORT_PASSWORD_LENGTH: 8
}));
jest.mock('../../utils/KeychainRecoveryUtils', () => ({
    __esModule: true,
    default: {
        scanForRecoverableData: jest.fn(() =>
            Promise.resolve({ settingsFound: [] })
        )
    }
}));
jest.mock('../../stores/SettingsStore', () => ({
    __esModule: true,
    default: {},
    INTERFACE_KEYS: []
}));
jest.mock('@react-native-documents/picker', () => ({
    pick: jest.fn(),
    types: {},
    isErrorWithCode: jest.fn(),
    errorCodes: {}
}));
jest.mock('@rneui/themed', () => ({ CheckBox: 'CheckBox', Icon: 'Icon' }));
jest.mock('@react-native-vector-icons/feather', () => 'Feather');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/NodeIdenticon', () => ({
    __esModule: true,
    default: 'NodeIdenticon',
    NodeTitle: () => ''
}));
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');

import * as React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import KeychainRecoveryUtils from '../../utils/KeychainRecoveryUtils';
import NodeConfigExportImport from './NodeConfigExportImport';

const renderView = (settings: any) =>
    render(
        <NodeConfigExportImport
            {...({
                navigation: { navigate: jest.fn() },
                SettingsStore: { settings }
            } as any)}
        />
    );

const EXPORT = 'views.Tools.nodeConfigExportImport.exportConfigs';
const IMPORT = 'views.Tools.nodeConfigExportImport.importConfigs';
const RESTORE_LEGACY =
    'views.Tools.nodeConfigExportImport.recovery.restoreLegacy';

describe('NodeConfigExportImport', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
        Platform.OS = 'ios';
        jest.clearAllMocks();
    });

    afterAll(() => {
        Platform.OS = originalOS;
    });

    it('hides export but keeps import and recovery with no wallets', async () => {
        await renderView({ nodes: [] });

        expect(screen.queryByText(EXPORT)).toBeNull();
        expect(screen.getByText(IMPORT)).toBeTruthy();
        expect(screen.getByText(RESTORE_LEGACY)).toBeTruthy();
    });

    it('shows export once a wallet exists', async () => {
        await renderView({ nodes: [{ implementation: 'embedded-lnd' }] });

        expect(screen.getByText(EXPORT)).toBeTruthy();
    });

    it('runs the lost configuration scan with no wallets', async () => {
        await renderView({ nodes: [] });

        await fireEvent.press(screen.getByText(RESTORE_LEGACY));

        expect(
            KeychainRecoveryUtils.scanForRecoverableData
        ).toHaveBeenCalledTimes(1);
    });

    it('only offers the legacy scan on iOS', async () => {
        Platform.OS = 'android';
        await renderView({ nodes: [] });

        expect(screen.queryByText(RESTORE_LEGACY)).toBeNull();
        expect(screen.getByText(IMPORT)).toBeTruthy();
    });
});
