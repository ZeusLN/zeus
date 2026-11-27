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
    isOnDeviceWalletPresent: (...args: any[]) =>
        jest
            .requireActual('../../utils/NodeConfigUtils')
            .isOnDeviceWalletPresent(...args),
    isValidExportPassword: jest.fn(),
    EXPORT_FORMAT_VERSION: 2,
    MIN_EXPORT_PASSWORD_LENGTH: 8
}));
jest.mock('../../utils/KeychainRecoveryUtils', () => ({
    __esModule: true,
    default: {
        scanForRecoverableData: jest.fn(() =>
            Promise.resolve({ settingsFound: [] })
        ),
        getSourceDisplayName: jest.fn(() => 'iCloud Keychain'),
        parseSettingsPreview: jest.fn(() => null)
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
jest.mock('@rneui/themed', () => {
    const { View } = require('react-native');
    return {
        // Keeps checked / disabled on the host view for the tests to read
        CheckBox: ({ title, ...props }: any) => (
            <View testID="checkbox" {...props}>
                {typeof title === 'string' ? null : title}
            </View>
        ),
        Icon: 'Icon'
    };
});
jest.mock('@react-native-vector-icons/feather', () => 'Feather');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => {
    const { Text } = require('react-native');
    return ({ title, onPress }: any) => <Text onPress={onPress}>{title}</Text>;
});
jest.mock('../../components/TextInput', () => 'TextInput');
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Modal', () => require('react-native').Modal);
jest.mock('../../components/NodeIdenticon', () => ({
    __esModule: true,
    default: 'NodeIdenticon',
    NodeTitle: () => ''
}));
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');

import * as React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import KeychainRecoveryUtils from '../../utils/KeychainRecoveryUtils';
import { saveNodeConfigs } from '../../utils/NodeConfigUtils';
import NodeConfigExportImport from './NodeConfigExportImport';

const renderView = (settings: any, navigation = { navigate: jest.fn() }) =>
    render(
        <NodeConfigExportImport
            {...({
                navigation,
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

    it('hides export when every wallet is on-device', async () => {
        await renderView({
            nodes: [
                { implementation: 'embedded-lnd' },
                { implementation: 'ldk-node' }
            ]
        });

        expect(screen.queryByText(EXPORT)).toBeNull();
        expect(screen.getByText(IMPORT)).toBeTruthy();
    });

    it('shows export once an exportable wallet exists', async () => {
        await renderView({
            nodes: [
                { implementation: 'embedded-lnd' },
                { implementation: 'lnd' }
            ]
        });

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

    it('restores the scanned wallets with no wallets present', async () => {
        const cloudNodes = [
            { implementation: 'lnd', host: 'node.example' },
            { implementation: 'embedded-lnd', nickname: 'Phone' }
        ];
        (
            KeychainRecoveryUtils.scanForRecoverableData as jest.Mock
        ).mockResolvedValueOnce({
            settingsFound: [
                {
                    key: 'zeus-settings-v2',
                    source: 'prefixed-cloud',
                    data: JSON.stringify({ nodes: cloudNodes }),
                    description: 'Wallet Configurations'
                }
            ],
            otherDataFound: [],
            hasCurrentSettings: true
        });
        const alert = jest.spyOn(Alert, 'alert').mockImplementation();
        const navigation = { navigate: jest.fn() };
        await renderView({ nodes: [] }, navigation);

        await fireEvent.press(screen.getByText(RESTORE_LEGACY));
        await fireEvent.press(
            await screen.findByText(
                'views.Tools.nodeConfigExportImport.recovery.tapToRestore'
            )
        );
        await fireEvent.press(
            screen.getByText(
                'views.Tools.nodeConfigExportImport.recovery.restoreSelected'
            )
        );

        expect(saveNodeConfigs).toHaveBeenCalledWith(cloudNodes, {
            settings: { nodes: [] }
        });
        const buttons = alert.mock.calls[0][2] as any[];
        buttons[0].onPress();
        expect(navigation.navigate).toHaveBeenCalledWith('Wallets');

        alert.mockRestore();
    });

    describe('restoring a snapshot that lists wallets still on this device', () => {
        const PRESENT = { implementation: 'embedded-lnd', lndDir: 'a1' };
        const MISSING = { implementation: 'embedded-lnd', lndDir: 'b2' };
        const REMOTE = { implementation: 'lnd', host: 'node.example' };
        const ALREADY_ON_DEVICE =
            'views.Tools.nodeConfigExportImport.recovery.alreadyOnDevice';

        // Opens the node selection for a snapshot of PRESENT, MISSING and
        // REMOTE on a device that has PRESENT
        const openSnapshot = async (
            nodes: any[] = [
                { ...PRESENT, nickname: 'old name' },
                MISSING,
                REMOTE
            ]
        ) => {
            (
                KeychainRecoveryUtils.scanForRecoverableData as jest.Mock
            ).mockResolvedValueOnce({
                settingsFound: [
                    {
                        key: 'zeus-settings-v2',
                        source: 'unprefixed-local',
                        data: JSON.stringify({ nodes }),
                        description: 'Wallet Configurations'
                    }
                ],
                otherDataFound: [],
                hasCurrentSettings: true
            });
            await renderView({ nodes: [PRESENT] });
            await fireEvent.press(screen.getByText(RESTORE_LEGACY));
            await fireEvent.press(
                await screen.findByText(
                    'views.Tools.nodeConfigExportImport.recovery.tapToRestore'
                )
            );
        };

        const restoreSelected = () =>
            fireEvent.press(
                screen.getByText(
                    'views.Tools.nodeConfigExportImport.recovery.restoreSelected'
                )
            );

        // The select-all box comes first, then one per snapshot node
        const checkBoxes = () => screen.getAllByTestId('checkbox');

        beforeEach(() => {
            jest.spyOn(Alert, 'alert').mockImplementation();
        });

        afterEach(() => {
            (Alert.alert as jest.Mock).mockRestore();
        });

        it('marks the wallet already on this device and leaves it unselected', async () => {
            await openSnapshot();

            expect(screen.getAllByText(ALREADY_ON_DEVICE)).toHaveLength(1);
            const [, present, missing, remote] = checkBoxes();
            expect(present.props.disabled).toBe(true);
            expect(present.props.checked).toBe(false);
            expect(missing.props.checked).toBe(true);
            expect(remote.props.checked).toBe(true);

            await restoreSelected();

            expect(saveNodeConfigs).toHaveBeenCalledWith([MISSING, REMOTE], {
                settings: { nodes: [PRESENT] }
            });
        });

        it('does not select the wallet already on this device when pressed', async () => {
            await openSnapshot();

            await fireEvent.press(checkBoxes()[1]);
            await restoreSelected();

            expect(saveNodeConfigs).toHaveBeenCalledWith(
                [MISSING, REMOTE],
                expect.anything()
            );
        });

        it('leaves the wallet already on this device out of select all', async () => {
            await openSnapshot();

            // Everything selectable starts selected, so the first press
            // clears the selection and the second selects all again
            expect(checkBoxes()[0].props.checked).toBe(true);
            await fireEvent.press(checkBoxes()[0]);
            expect(checkBoxes()[0].props.checked).toBe(false);
            await fireEvent.press(checkBoxes()[0]);
            await restoreSelected();

            expect(saveNodeConfigs).toHaveBeenCalledWith(
                [MISSING, REMOTE],
                expect.anything()
            );
        });

        it('hides select all when one wallet is left to restore', async () => {
            await openSnapshot([PRESENT, MISSING]);

            // One box per snapshot node, no select-all box
            expect(checkBoxes()).toHaveLength(2);
        });
    });
});
