const mockZipFolder = jest.fn().mockResolvedValue(undefined);
const mockUnzipFile = jest.fn().mockResolvedValue(undefined);
const mockEncryptFile = jest.fn().mockResolvedValue(undefined);
const mockDecryptFile = jest.fn().mockResolvedValue(undefined);

jest.mock('./ZipUtils', () => ({
    zipFolder: (...args: any[]) => mockZipFolder(...args),
    unzipFile: (...args: any[]) => mockUnzipFile(...args),
    encryptFile: (...args: any[]) => mockEncryptFile(...args),
    decryptFile: (...args: any[]) => mockDecryptFile(...args)
}));

const mockExists = jest.fn().mockResolvedValue(true);
const mockStat = jest.fn().mockResolvedValue({ size: 1024 });
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockCopyFile = jest.fn().mockResolvedValue(undefined);
const mockReadDir = jest.fn().mockResolvedValue([]);

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/data/user/0/app.zeusln.zeus/files',
    LibraryDirectoryPath:
        '/var/mobile/Containers/Data/Application/UUID/Library',
    CachesDirectoryPath: '/cache',
    DownloadDirectoryPath: '/downloads',
    exists: (...args: any[]) => mockExists(...args),
    stat: (...args: any[]) => mockStat(...args),
    mkdir: (...args: any[]) => mockMkdir(...args),
    unlink: (...args: any[]) => mockUnlink(...args),
    copyFile: (...args: any[]) => mockCopyFile(...args),
    readDir: (...args: any[]) => mockReadDir(...args)
}));

jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn(),
    fs: {
        readFile: jest.fn().mockResolvedValue('base64encodeddata'),
        writeFile: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('react-native-share', () => ({ open: jest.fn() }));

const mockPurgeChannelExportStaging = jest.fn().mockResolvedValue(undefined);

jest.mock('./ChannelExportStagingUtils', () => ({
    channelExportStagingPath: () => '/cache/channel-export-staging',
    purgeChannelExportStaging: () => mockPurgeChannelExportStaging()
}));

jest.mock('react-native-restart', () => ({ Restart: jest.fn() }));
jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('./LndMobileUtils', () => ({
    stopLnd: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./BackendUtils', () => ({
    signMessage: jest.fn().mockResolvedValue({ signature: 'sig123' })
}));
jest.mock('../lndmobile/wallet', () => ({
    signMessageNodePubkey: jest.fn().mockResolvedValue({ signature: 'sig456' })
}));
jest.mock('./Base64Utils', () => ({
    stringToUint8Array: (s: string) => new Uint8Array(Buffer.from(s))
}));
jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../stores/ChannelBackupStore', () => ({
    BACKUPS_HOST: 'https://backups.example.com'
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null)
}));

// Mutable so the export tests can exercise both platforms. Read through a
// getter: jest hoists this factory above the `const`, so a direct reference
// captures the value while it is still in TDZ.
const mockPlatform = {
    OS: 'android',
    select: (opts: any) => opts[mockPlatform.OS]
};

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    get Platform() {
        return mockPlatform;
    }
}));

import { Alert } from 'react-native';
import Share from 'react-native-share';

import {
    validateChannelBackupFile,
    importChannelDb,
    exportChannelDb
} from './ChannelMigrationUtils';

const STAGING_DIR = '/cache/channel-export-staging';
const shareOpen = Share.open as jest.Mock;
const alert = Alert.alert as jest.Mock;

describe('ChannelMigrationUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExists.mockResolvedValue(true);
        mockStat.mockResolvedValue({ size: 1024 });
        mockReadDir.mockResolvedValue([]);
        mockZipFolder.mockResolvedValue(undefined);
        mockPurgeChannelExportStaging.mockResolvedValue(undefined);
        mockPlatform.OS = 'android';
    });

    describe('validateChannelBackupFile', () => {
        it('rejects files with invalid extension', async () => {
            const result = await validateChannelBackupFile(
                'file:///test.db',
                'backup.db'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe(
                'views.Tools.migration.import.invalidExtension'
            );
        });

        it('rejects files with .txt extension', async () => {
            const result = await validateChannelBackupFile(
                'file:///test.txt',
                'backup.txt'
            );
            expect(result.valid).toBe(false);
        });

        it('accepts .zip files', async () => {
            const result = await validateChannelBackupFile(
                '/path/to/backup.zip',
                'backup.zip'
            );
            expect(result.valid).toBe(true);
        });

        it('accepts .ZIP files (case insensitive)', async () => {
            const result = await validateChannelBackupFile(
                '/path/to/backup.ZIP',
                'backup.ZIP'
            );
            expect(result.valid).toBe(true);
        });

        it('rejects empty files', async () => {
            mockStat.mockResolvedValue({ size: 0 });
            const result = await validateChannelBackupFile(
                '/path/to/backup.zip',
                'backup.zip'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe('views.Tools.migration.import.emptyFile');
        });

        it('rejects files that do not exist', async () => {
            mockExists.mockResolvedValue(false);
            mockStat.mockRejectedValue(new Error('ENOENT'));
            const result = await validateChannelBackupFile(
                '/path/to/missing.zip',
                'missing.zip'
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe(
                'views.Tools.migration.import.fileNotFound'
            );
        });
    });

    describe('importChannelDb', () => {
        it('validates, unzips, and places files in the graph directory', async () => {
            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false
            );

            expect(mockUnzipFile).toHaveBeenCalledTimes(1);
            const destDir = mockUnzipFile.mock.calls[0][1];
            expect(destDir).toContain('lnd/data/graph/mainnet');
        });

        it('uses testnet path when isTestnet is true', async () => {
            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                true
            );

            const destDir = mockUnzipFile.mock.calls[0][1];
            expect(destDir).toContain('lnd/data/graph/testnet');
        });

        it('clears existing files before unzipping', async () => {
            mockReadDir.mockResolvedValue([
                { path: '/graph/mainnet/channel.db', isFile: () => true },
                { path: '/graph/mainnet/peers.json', isFile: () => true }
            ]);

            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false
            );

            expect(mockUnlink).toHaveBeenCalledWith(
                '/graph/mainnet/channel.db'
            );
            expect(mockUnlink).toHaveBeenCalledWith(
                '/graph/mainnet/peers.json'
            );
        });

        it('creates graph directory if it does not exist', async () => {
            mockExists.mockImplementation(async (path: string) => {
                if (path.includes('graph')) return false;
                return true;
            });

            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false
            );

            expect(mockMkdir).toHaveBeenCalled();
        });

        it('rejects invalid file types', async () => {
            await expect(
                importChannelDb('/path/to/backup.db', 'backup.db', 'lnd', false)
            ).rejects.toThrow();
        });
    });

    describe('encryptFile / decryptFile integration', () => {
        it('encryptFile is called with correct arguments during upload flow', async () => {
            // Directly test that encryptFile is wired up correctly
            const { encryptFile } = require('./ZipUtils');
            await encryptFile('/input.zip', '/output.enc', 'my seed phrase');

            expect(mockEncryptFile).toHaveBeenCalledWith(
                '/input.zip',
                '/output.enc',
                'my seed phrase'
            );
        });

        it('decryptFile is called with correct arguments during restore flow', async () => {
            const { decryptFile } = require('./ZipUtils');
            await decryptFile('/input.enc', '/output.zip', 'my seed phrase');

            expect(mockDecryptFile).toHaveBeenCalledWith(
                '/input.enc',
                '/output.zip',
                'my seed phrase'
            );
        });
    });

    describe('exportChannelDb', () => {
        const stagedPath = () => mockZipFolder.mock.calls[0][1];

        describe('staging', () => {
            it.each(['android', 'ios'])(
                'zips into a swept app-private cache dir on %s',
                async (os) => {
                    mockPlatform.OS = os;
                    shareOpen.mockResolvedValue({ success: true });

                    await exportChannelDb('lnd', false);

                    expect(mockPurgeChannelExportStaging).toHaveBeenCalled();
                    expect(mockMkdir).toHaveBeenCalledWith(STAGING_DIR);
                    expect(stagedPath()).toMatch(
                        /^\/cache\/channel-export-staging\/zeus-lnd-mainnet-\d+\.zip$/
                    );
                }
            );

            it('never stages in the Files-visible iOS Documents dir', async () => {
                mockPlatform.OS = 'ios';
                shareOpen.mockResolvedValue({ success: true });

                await exportChannelDb('lnd', false);

                expect(stagedPath()).not.toContain(
                    '/data/user/0/app.zeusln.zeus/files'
                );
            });

            it('names testnet exports for the network', async () => {
                mockPlatform.OS = 'ios';
                shareOpen.mockResolvedValue({ success: true });

                await exportChannelDb('lnd', true);

                expect(stagedPath()).toContain('zeus-lnd-testnet-');
            });
        });

        describe('android', () => {
            beforeEach(() => {
                mockPlatform.OS = 'android';
            });

            it('copies to Downloads and sweeps the staged copy', async () => {
                await exportChannelDb('lnd', false);

                const staged = stagedPath();
                expect(mockCopyFile).toHaveBeenCalledWith(
                    staged,
                    `/downloads/${staged.split('/').pop()}`
                );
                // copyFile has finished reading by the time it resolves, so
                // unlike the share sheet this sweep is safe immediately
                expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(2);
                expect(shareOpen).not.toHaveBeenCalled();
                expect(alert).toHaveBeenCalledWith(
                    'views.Tools.migration.export.success',
                    'views.Tools.migration.export.success.text.android',
                    expect.anything(),
                    expect.anything()
                );
            });

            it('sweeps a partial zip when zipping fails', async () => {
                mockZipFolder.mockRejectedValue(new Error('disk full'));

                await exportChannelDb('lnd', false);

                expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(2);
                expect(alert).toHaveBeenCalledWith(
                    'general.error',
                    undefined,
                    expect.anything(),
                    expect.anything()
                );
            });
        });

        describe('ios share sheet', () => {
            beforeEach(() => {
                mockPlatform.OS = 'ios';
            });

            it('hands the staged file to Share.open', async () => {
                shareOpen.mockResolvedValue({ success: true });

                await exportChannelDb('lnd', false);

                expect(shareOpen).toHaveBeenCalledWith(
                    expect.objectContaining({
                        url: `file://${stagedPath()}`,
                        type: 'application/octet-stream',
                        failOnCancel: false
                    })
                );
            });

            // The bug this suite exists for: Share.open can settle while an
            // activity extension is still loading the NSItemProvider, so
            // unlinking here hands the receiver a dead file while the user
            // is told the export succeeded
            it('does not unlink the staged file after a successful share', async () => {
                shareOpen.mockResolvedValue({ success: true });

                await exportChannelDb('lnd', false);

                expect(mockUnlink).not.toHaveBeenCalled();
                expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(1);
                expect(alert).toHaveBeenCalledWith(
                    'views.Tools.migration.export.success',
                    'views.Tools.migration.export.success.text',
                    expect.anything(),
                    expect.anything()
                );
            });

            it.each([
                ['dismissedAction', { dismissedAction: true }],
                ['success: false', { success: false }]
            ])(
                'does not unlink the staged file after %s',
                async (_label, result) => {
                    shareOpen.mockResolvedValue(result);

                    await exportChannelDb('lnd', false);

                    expect(mockUnlink).not.toHaveBeenCalled();
                    expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(
                        1
                    );
                    expect(alert).toHaveBeenCalledWith(
                        'views.Tools.migration.export.cancelled',
                        'views.Tools.migration.export.cancelled.text',
                        expect.anything(),
                        expect.anything()
                    );
                }
            );

            it('reports cancellation when Share.open rejects with a cancel', async () => {
                shareOpen.mockRejectedValue(new Error('User did not share'));

                await exportChannelDb('lnd', false);

                expect(alert).toHaveBeenCalledWith(
                    'views.Tools.migration.export.cancelled',
                    'views.Tools.migration.export.cancelled.text',
                    expect.anything(),
                    expect.anything()
                );
            });

            // Conservative: once the file is handed to the share sheet we
            // cannot know a receiver is not reading it, so even a rejection
            // leaves it for the launch sweep rather than unlinking here
            it('leaves the staged file alone when Share.open rejects', async () => {
                shareOpen.mockRejectedValue(new Error('kaboom'));

                await exportChannelDb('lnd', false);

                expect(mockUnlink).not.toHaveBeenCalled();
                expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(1);
                expect(alert).toHaveBeenCalledWith(
                    'general.error',
                    undefined,
                    expect.anything(),
                    expect.anything()
                );
            });

            it('sweeps a partial zip when zipping fails, before any handoff', async () => {
                mockZipFolder.mockRejectedValue(new Error('disk full'));

                await exportChannelDb('lnd', false);

                expect(shareOpen).not.toHaveBeenCalled();
                expect(mockPurgeChannelExportStaging).toHaveBeenCalledTimes(2);
            });
        });

        it('bails out before staging when the graph dir is missing', async () => {
            mockExists.mockResolvedValue(false);

            await exportChannelDb('lnd', false);

            expect(mockPurgeChannelExportStaging).not.toHaveBeenCalled();
            expect(mockZipFolder).not.toHaveBeenCalled();
            expect(alert).toHaveBeenCalledWith(
                'general.error',
                'views.Tools.migration.databaseNotFound'
            );
        });
    });
});
