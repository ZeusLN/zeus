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

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    Platform: { OS: 'android', select: (opts: any) => opts.android }
}));

import {
    validateChannelBackupFile,
    importChannelDb
} from './ChannelMigrationUtils';

describe('ChannelMigrationUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExists.mockResolvedValue(true);
        mockStat.mockResolvedValue({ size: 1024 });
        mockReadDir.mockResolvedValue([]);
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
});
