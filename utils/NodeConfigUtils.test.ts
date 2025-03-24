import RNFS from 'react-native-fs';

import {
    saveNodeConfigs,
    createExportFileContent,
    saveNodeConfigExportFile,
    decryptExportData
} from './NodeConfigUtils';
import SettingsStore, { Settings } from '../stores/SettingsStore';

// Mock for RNFS
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/test/document/path',
    DownloadDirectoryPath: '/test/download/path',
    writeFile: jest.fn().mockResolvedValue(true)
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

    describe('saveNodeConfigExportFile', () => {
        it('should save file successfully and return the path', async () => {
            const mockWriteFile = jest.spyOn(RNFS, 'writeFile');
            const fileName = 'test-export.backup';
            const data = 'test-data';

            const path = await saveNodeConfigExportFile(fileName, data);

            expect(mockWriteFile).toHaveBeenCalledWith(
                expect.stringContaining(fileName), // exact path doesn't matter, just needs filename
                data,
                'utf8'
            );

            // Check that a path was returned
            expect(path).toBeTruthy();
            expect(path).toContain(fileName);
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
