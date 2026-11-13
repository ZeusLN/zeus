jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/Stores');
jest.mock('../../stores/SettingsStore', () => ({ INTERFACE_KEYS: [] }));
jest.mock('@react-native-vector-icons/feather', () => 'Feather');
jest.mock('@rneui/themed', () => ({ CheckBox: 'CheckBox', Icon: 'Icon' }));
const mockFile: { content: string } = { content: '' };
jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/cache',
    readFile: jest.fn(async () => mockFile.content)
}));
jest.mock('@react-native-documents/picker', () => ({
    pick: jest.fn(async () => [{ uri: 'file:///backup' }]),
    saveDocuments: jest.fn(),
    types: { allFiles: '*/*' },
    isErrorWithCode: () => false,
    errorCodes: {}
}));
jest.mock('../../utils/BackgroundLockUtils', () => ({
    suppressBackgroundLockDuring: (_store: any, fn: () => any) => fn()
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000',
    isLightTheme: () => false
}));
jest.mock('../../utils/PhotoUtils', () => ({ getPhoto: () => '' }));
jest.mock('../../utils/KeychainRecoveryUtils', () => ({}));
jest.mock('../../utils/ZipUtils', () => ({
    encryptFile: jest.fn(),
    decryptFile: jest.fn()
}));
const mockSaveNodeConfigs = jest.fn(async () => {});
const mockDecryptExportDataV2 = jest.fn();
jest.mock('../../utils/NodeConfigUtils', () => ({
    ...jest.requireActual('../../utils/NodeConfigUtils'),
    saveNodeConfigs: (...args: any[]) => (mockSaveNodeConfigs as any)(...args),
    decryptExportDataV2: (...args: any[]) => mockDecryptExportDataV2(...args)
}));
jest.mock('../../components/Button', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ title, onPress }: any) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress}>
            <Text>{title}</Text>
        </TouchableOpacity>
    );
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/NodeIdenticon', () => ({
    __esModule: true,
    default: 'NodeIdenticon',
    NodeTitle: () => 'node'
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/ShowHideToggle', () => 'ShowHideToggle');
jest.mock('../../components/Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput testID="password" {...props} />;
});

import * as React from 'react';
import { Alert } from 'react-native';
import * as CryptoJS from 'crypto-js';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NodeConfigExportImport from './NodeConfigExportImport';

const PASSWORD = 'correct horse battery';
const NODES = [{ implementation: 'lndhub', lndhubUrl: 'https://hub' }];
const SUCCESS = 'views.Tools.nodeConfigExportImport.importSuccess';
const LEGACY = 'views.Tools.nodeConfigExportImport.legacyImportWarning';

// Picks the file, enters the password when asked, imports every wallet
// and returns the message of the success alert
const importFile = async (envelope: any) => {
    mockFile.content = JSON.stringify(envelope);
    await render(
        <NodeConfigExportImport
            navigation={{ navigate: jest.fn() } as any}
            SettingsStore={{ settings: { nodes: [] } } as any}
        />
    );
    await fireEvent.press(
        screen.getByText('views.Tools.nodeConfigExportImport.importConfigs')
    );
    if (envelope.encrypted) {
        await fireEvent.changeText(screen.getByTestId('password'), PASSWORD);
        await fireEvent.press(screen.getByText('general.proceed'));
    }
    await fireEvent.press(
        screen.getByText('views.Tools.nodeConfigExportImport.importSelected')
    );
    await act(async () => {});
    expect(mockSaveNodeConfigs).toHaveBeenCalledWith(NODES, expect.anything());
    const successAlert = (Alert.alert as jest.Mock).mock.calls.find(
        (call) => call[0] === 'general.success'
    );
    return successAlert[1];
};

describe('NodeConfigExportImport import', () => {
    beforeEach(() => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSaveNodeConfigs.mockClear();
        mockDecryptExportDataV2.mockReset();
    });

    afterEach(() => jest.restoreAllMocks());

    it('tells the user to export again after importing a v1 file', async () => {
        const message = await importFile({
            version: 1,
            encrypted: true,
            data: CryptoJS.AES.encrypt(
                JSON.stringify({ nodes: NODES }),
                PASSWORD
            ).toString()
        });

        expect(message).toBe(`${SUCCESS}\n\n${LEGACY}`);
    });

    it('tells the user to export again after importing an unencrypted file', async () => {
        const message = await importFile({
            version: 1,
            encrypted: false,
            data: { nodes: NODES }
        });

        expect(message).toBe(`${SUCCESS}\n\n${LEGACY}`);
    });

    it('only reports success for a v2 file', async () => {
        mockDecryptExportDataV2.mockResolvedValue(NODES);

        const message = await importFile({
            version: 2,
            encrypted: true,
            data: 'base64-blob'
        });

        expect(mockDecryptExportDataV2).toHaveBeenCalledWith(
            'base64-blob',
            PASSWORD
        );
        expect(message).toBe(SUCCESS);
    });
});
