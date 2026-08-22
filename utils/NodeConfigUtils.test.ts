import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Platform } from 'react-native';

import {
    saveNodeConfigs,
    createExportFileContent,
    shareNodeConfigExportFile,
    purgeLegacyNodeConfigExports,
    decryptExportData,
    NODE_CONFIG_EXPORT_EXT
} from './NodeConfigUtils';
import SettingsStore, { Settings } from '../stores/SettingsStore';

// Mock for RNFS
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/test/document/path',
    DownloadDirectoryPath: '/test/download/path',
    CachesDirectoryPath: '/test/caches/path',
    writeFile: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    readDir: jest.fn().mockResolvedValue([])
}));

jest.mock('react-native-share', () => ({
    __esModule: true,
    default: { open: jest.fn() }
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' }
}));

// Mock for SettingsStore
const mockUpdateSettings = jest.fn().mockResolvedValue(undefined);
const createMockSettingsStore = (nodes?: any[]): Partial<SettingsStore> => ({
    settings: { nodes } as any as Settings,
    updateSettings: mockUpdateSettings
});

describe('NodeConfigUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Platform.OS as any) = 'ios';
        (RNFS.exists as jest.Mock).mockResolvedValue(false);
        (RNFS.writeFile as jest.Mock).mockResolvedValue(true);
        (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
        (RNFS.readDir as jest.Mock).mockResolvedValue([]);
        (Share.open as jest.Mock).mockResolvedValue(undefined);
    });

    describe('saveNodeConfigs', () => {
        it('should add new nodes to existing nodes', async () => {
            const mockSettingsStore = createMockSettingsStore([
                {
                    id: 'existing-node',
                    name: 'Existing Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ]);

            const newNodes = [
                {
                    id: 'new-node',
                    name: 'New Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ];

            await saveNodeConfigs(newNodes, mockSettingsStore as SettingsStore);

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    {
                        id: 'existing-node',
                        name: 'Existing Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    },
                    {
                        id: 'new-node',
                        name: 'New Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    }
                ]
            });
        });

        it('should add new nodes when no existing nodes are present', async () => {
            const emptySettingsStore = createMockSettingsStore();

            const newNodes = [
                {
                    id: 'new-node',
                    name: 'New Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ];

            await saveNodeConfigs(
                newNodes,
                emptySettingsStore as SettingsStore
            );

            expect(mockUpdateSettings).toHaveBeenCalledWith({
                nodes: [
                    {
                        id: 'new-node',
                        name: 'New Node',
                        implementation: 'lnd',
                        dismissCustodialWarning: true
                    }
                ]
            });
        });
    });

    describe('createExportFileContent', () => {
        const testNodes = [
            {
                id: 'test-node',
                name: 'Test Node',
                implementation: 'lnd',
                dismissCustodialWarning: true
            } as any
        ];

        it('should create unencrypted export data when useEncryption is false', () => {
            const result = createExportFileContent(testNodes, false);
            const parsedResult = JSON.parse(result);

            expect(parsedResult).toEqual({
                version: 1,
                encrypted: false,
                data: {
                    nodes: testNodes
                }
            });
        });

        it('should create encrypted export data when useEncryption is true', () => {
            const result = createExportFileContent(
                testNodes,
                true,
                'test-password'
            );
            const parsedResult = JSON.parse(result);

            expect(parsedResult.version).toBe(1);
            expect(parsedResult.encrypted).toBe(true);
            expect(typeof parsedResult.data).toBe('string'); // Encrypted data is a string
        });
    });

    describe('shareNodeConfigExportFile', () => {
        it('stages the export in cache and hands it to the share sheet', async () => {
            const fileName = `20260811-120000${NODE_CONFIG_EXPORT_EXT}`;

            await shareNodeConfigExportFile(fileName, '{"version":1}');

            expect(RNFS.writeFile).toHaveBeenCalledWith(
                `/test/caches/path/${fileName}`,
                '{"version":1}',
                'utf8'
            );
            expect(Share.open).toHaveBeenCalledWith({
                url: `file:///test/caches/path/${fileName}`,
                type: 'application/json',
                filename: fileName,
                failOnCancel: false
            });
        });

        it('unlinks the staging file after a successful share', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await shareNodeConfigExportFile('a.json', '{}');

            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/test/caches/path/a.json'
            );
        });

        it('unlinks the staging file and rethrows when the share fails', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            (Share.open as jest.Mock).mockRejectedValue(
                new Error('share failed')
            );
            // staging write path is clear, then cleanup sees the file
            (RNFS.exists as jest.Mock)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

            await expect(
                shareNodeConfigExportFile('a.json', '{}')
            ).rejects.toThrow('share failed');

            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/test/caches/path/a.json'
            );
            consoleErrorSpy.mockRestore();
        });
    });

    describe('purgeLegacyNodeConfigExports', () => {
        const entry = (dir: string, name: string, isFile = true) => ({
            name,
            path: `${dir}/${name}`,
            isFile: () => isFile
        });

        it('deletes only config backups from iOS Documents', async () => {
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                entry(
                    '/test/document/path',
                    `20260811-120000${NODE_CONFIG_EXPORT_EXT}`
                ),
                entry(
                    '/test/document/path',
                    'zeus_20250212_140719_invoice.csv'
                ),
                entry('/test/document/path', 'ldk-node', false)
            ]);

            await purgeLegacyNodeConfigExports();

            expect(RNFS.readDir).toHaveBeenCalledWith('/test/document/path');
            expect(RNFS.unlink).toHaveBeenCalledTimes(1);
            expect(RNFS.unlink).toHaveBeenCalledWith(
                `/test/document/path/20260811-120000${NODE_CONFIG_EXPORT_EXT}`
            );
        });

        it('deletes config backups from Android Downloads', async () => {
            (Platform.OS as any) = 'android';
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                entry(
                    '/test/download/path',
                    `20260811-120000${NODE_CONFIG_EXPORT_EXT}`
                ),
                entry('/test/download/path', 'unrelated.txt')
            ]);

            await purgeLegacyNodeConfigExports();

            expect(RNFS.readDir).toHaveBeenCalledWith('/test/download/path');
            expect(RNFS.unlink).toHaveBeenCalledTimes(1);
            expect(RNFS.unlink).toHaveBeenCalledWith(
                `/test/download/path/20260811-120000${NODE_CONFIG_EXPORT_EXT}`
            );
        });

        it('swallows readDir and unlink errors', async () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            (RNFS.readDir as jest.Mock).mockRejectedValue(
                new Error('no access')
            );

            await expect(
                purgeLegacyNodeConfigExports()
            ).resolves.toBeUndefined();

            (RNFS.readDir as jest.Mock).mockResolvedValue([
                entry(
                    '/test/document/path',
                    `20260811-120000${NODE_CONFIG_EXPORT_EXT}`
                )
            ]);
            (RNFS.unlink as jest.Mock).mockRejectedValue(
                new Error('unlink denied')
            );

            await expect(
                purgeLegacyNodeConfigExports()
            ).resolves.toBeUndefined();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('decryptExportData', () => {
        it('should decrypt encrypted export data correctly', () => {
            const testNodes = [
                {
                    id: 'test-node',
                    name: 'Test Node',
                    implementation: 'lnd',
                    dismissCustodialWarning: true
                } as any
            ];
            const testPassword = 'test-password';
            const encryptedExport = createExportFileContent(
                testNodes,
                true,
                testPassword
            );
            const exportData = JSON.parse(encryptedExport);
            const decryptedNodes = decryptExportData(
                exportData.data,
                testPassword
            );
            expect(decryptedNodes).toEqual(testNodes);
        });
    });
});
