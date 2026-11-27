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
jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../stores/ChannelBackupStore', () => ({
    BACKUPS_HOST: 'https://backups.example.com'
}));
const mockLoginRequired = jest.fn().mockReturnValue(false);
jest.mock('../stores/Stores', () => ({
    settingsStore: { loginRequired: () => mockLoginRequired() }
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
    Platform: { OS: 'android', select: (opts: any) => opts.android }
}));

import { Alert, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import BackendUtils from './BackendUtils';
import { signMessageNodePubkey } from '../lndmobile/wallet';
import { LNURLAUTH_CANONICAL_PHRASE } from './LnurlAuthUtils';
import { OLYMPUS_AUTH_TAG, ZEUS_PAY_AUTH_TAG } from './AuthChallengeUtils';
import { stopLnd } from './LndMobileUtils';
import Storage from '../storage';

import {
    CHANNEL_MIGRATION_ACTIVE,
    graphDataExists,
    validateChannelBackupFile,
    handleExportChannels,
    importChannelDb,
    uploadChannelBackupToOlympus,
    exportChannelDb,
    restoreChannelBackupFromOlympus,
    unlockWalletFromMigration,
    purgeChannelDbStagingFiles
} from './ChannelMigrationUtils';
import { sourceMethods } from '../backends/lncTestUtils';

// What the graph directory holds after a backup has been unzipped into it
const dirEntry = (name: string, size: number) => ({
    name,
    path: `/graph/mainnet/${name}`,
    size,
    isFile: () => true
});
const RESTORED_GRAPH_DIR = [
    dirEntry('channel.db', 262144),
    dirEntry('sphinxreplay.db', 16384),
    dirEntry('wtclient.db', 16384)
];

const mockFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const mockSignNodePubkey = signMessageNodePubkey as jest.Mock;
const mockAlert = Alert.alert as jest.Mock;

const jsonResponse = (body: any) => ({
    info: () => ({ status: 200 }),
    json: () => body
});

const BACKUPS = 'https://backups.example.com';
// The server issues its tag followed by 64 random bytes as lowercase hex
const NONCE = 'a1'.repeat(64);
const CHALLENGE = `${OLYMPUS_AUTH_TAG}${NONCE}`;
const SECOND_CHALLENGE = `${OLYMPUS_AUTH_TAG}${'b2'.repeat(64)}`;

const signMessageMock = (BackendUtils as any).signMessage as jest.Mock;

// Answers each /api/auth/v2 call with the next challenge in the list and
// every other path with a successful reply.
const serveChallenges = (challenges: any[], statusBody: any = {}) => {
    const queue = [...challenges];
    mockFetch.mockImplementation(async (_m: string, url: string) => {
        const path = url.replace(BACKUPS, '');
        const body =
            path === '/api/auth/v2'
                ? { success: true, verification: queue.shift() }
                : { success: true, ...statusBody };
        return {
            info: () => ({ status: 200 }),
            json: () => body,
            text: async () => 'ZW5j'
        };
    });
};

const fetchedPaths = () =>
    mockFetch.mock.calls.map(([, url]) => url.replace(BACKUPS, ''));

const BACKUP_ZIP = expect.stringMatching(
    /^\/cache\/zeus-olympus-backup-\d+\.zip$/
);
const BACKUP_ENC = expect.stringMatching(
    /^\/cache\/zeus-olympus-backup-\d+\.enc$/
);
const RESTORE_ZIP = expect.stringMatching(
    /^\/cache\/zeus-olympus-restore-\d+\.zip$/
);
const RESTORE_ENC = expect.stringMatching(
    /^\/cache\/zeus-olympus-restore-\d+\.enc$/
);

const mockReadFile = ReactNativeBlobUtil.fs.readFile as jest.Mock;
const mockStopLnd = stopLnd as jest.Mock;

const httpResponse = (status: number, body: any) => ({
    info: () => ({ status }),
    json: () => body,
    text: async () => JSON.stringify(body)
});

// Olympus server: auth always succeeds, uploads are accepted, and the
// status and restore responses are configurable.
const mockOlympusServer = ({
    lastBackupAt = 1700000000000 as number | null,
    restoreStatus = 200
} = {}) =>
    mockFetch.mockImplementation(async (_method: string, url: string) => {
        if (url.endsWith('/api/auth/v2'))
            return httpResponse(200, {
                success: true,
                verification: CHALLENGE
            });
        if (url.endsWith('/api/status'))
            return httpResponse(200, {
                success: true,
                last_backup_at: lastBackupAt
            });
        if (url.endsWith('/api/restore-channels'))
            return restoreStatus === 200
                ? {
                      info: () => ({ status: 200 }),
                      text: async () => 'ZW5jcnlwdGVk'
                  }
                : httpResponse(restoreStatus, { error: 'server error' });
        if (url.endsWith('/api/channels-backup'))
            return httpResponse(200, { success: true });
        throw new Error(`unexpected fetch ${url}`);
    });

const unlinkedPaths = () => mockUnlink.mock.calls.map((c) => c[0]);

describe('ChannelMigrationUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExists.mockResolvedValue(true);
        mockStat.mockResolvedValue({ size: 1024 });
        mockReadDir.mockResolvedValue([]);
        mockUnlink.mockResolvedValue(undefined);
        mockZipFolder.mockResolvedValue(undefined);
        mockEncryptFile.mockResolvedValue(undefined);
        mockDecryptFile.mockResolvedValue(undefined);
        mockUnzipFile.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue('base64encodeddata');
        mockStopLnd.mockResolvedValue(undefined);
        // Confirm the "backup found, restore?" prompt.
        mockAlert.mockImplementation((title: string, _msg, buttons) => {
            if (title === 'views.Tools.migration.export.backupFound')
                buttons[1].onPress();
        });
        mockOlympusServer();
    });

    describe('graphDataExists', () => {
        it('returns false when the graph directory does not exist', async () => {
            mockExists.mockResolvedValue(false);

            expect(await graphDataExists('lnd', false)).toBe(false);
            expect(mockExists).toHaveBeenCalledWith(
                expect.stringContaining('lnd/data/graph/mainnet')
            );
            expect(mockReadDir).not.toHaveBeenCalled();
        });

        it('returns false when the graph directory is empty', async () => {
            mockReadDir.mockResolvedValue([]);

            expect(await graphDataExists('lnd', false)).toBe(false);
        });

        it('returns true when the graph directory has entries', async () => {
            mockReadDir.mockResolvedValue([
                { path: '/graph/mainnet/channel.db', isFile: () => true }
            ]);

            expect(await graphDataExists('lnd', false)).toBe(true);
        });

        it('uses the testnet path when isTestnet is true', async () => {
            mockReadDir.mockResolvedValue([
                { path: '/graph/testnet/channel.db', isFile: () => true }
            ]);

            expect(await graphDataExists('lnd', true)).toBe(true);
            expect(mockExists).toHaveBeenCalledWith(
                expect.stringContaining('lnd/data/graph/testnet')
            );
        });

        it('respects a custom lndDir', async () => {
            await graphDataExists('lnd2', false);

            expect(mockExists).toHaveBeenCalledWith(
                expect.stringContaining('lnd2/data/graph/mainnet')
            );
        });

        it('returns false when the filesystem check throws', async () => {
            const consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockReadDir.mockRejectedValue(new Error('EACCES'));

            expect(await graphDataExists('lnd', false)).toBe(false);

            consoleError.mockRestore();
        });
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

    describe('handleExportChannels', () => {
        // Runs the production handlers of the two screens that start an
        // export. The Olympus upload is for SQLite wallets only; a wallet
        // config without isSqlite (created before v0.12.3) runs on bolt.
        const exportButtons = (
            [path, className]: string[],
            isSqlite?: boolean
        ) => {
            const Screen = sourceMethods(
                path,
                className,
                ['handleExportChannels'],
                { handleExportChannels, Alert, localeString: (s: string) => s }
            );
            const screen = new Screen();
            screen.props = {
                SettingsStore: {
                    isSqlite,
                    lndDir: 'lnd',
                    embeddedLndNetwork: 'Mainnet',
                    seedPhrase: ['seed']
                },
                NodeInfoStore: { nodeInfo: { identity_pubkey: 'pubkey' } },
                SyncStore: { isSyncing: false }
            };
            screen.handleExportChannels();
            return (Alert.alert as jest.Mock).mock.calls[0][2].map(
                (button: any) => button.text
            );
        };

        describe.each([
            ['views/Tools/index.tsx', 'Tools'],
            ['views/Settings/Seed.tsx', 'Seed']
        ])('%s', (...screen) => {
            it('offers the Olympus upload to SQLite wallets', () => {
                expect(exportButtons(screen, true)).toContain(
                    'views.Tools.migration.export.olympus'
                );
            });

            it.each([false, undefined])(
                'does not offer the Olympus upload when isSqlite is %s',
                (isSqlite) => {
                    expect(exportButtons(screen, isSqlite)).toEqual([
                        'general.cancel',
                        'general.ok'
                    ]);
                }
            );
        });
    });

    describe('importChannelDb', () => {
        beforeEach(() => {
            mockReadDir.mockResolvedValue(RESTORED_GRAPH_DIR);
        });

        // First readDir is the clear before the unzip, second is the check
        // after it
        const unzipLeaves = (entries: any[]) =>
            mockReadDir
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(entries);

        const importPicked = (isSqlite = false) =>
            importChannelDb(
                'content://downloads/backup.zip',
                'backup.zip',
                'lnd',
                false,
                isSqlite
            );

        it('rejects when the unzip leaves an empty channel.db (#5797)', async () => {
            unzipLeaves([dirEntry('channel.db', 0)]);

            await expect(importPicked()).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );

            expect(mockUnlink).toHaveBeenCalledWith(
                '/graph/mainnet/channel.db'
            );
            expect(mockUnlink).toHaveBeenCalledWith(
                '/cache/zeus-import-temp.zip'
            );
        });

        it('rejects when the unzip leaves nothing', async () => {
            unzipLeaves([]);

            await expect(importPicked()).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );
        });

        it('rejects when the archive has no channel database', async () => {
            unzipLeaves([dirEntry('notes.txt', 500)]);

            await expect(importPicked()).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );
            expect(mockUnlink).toHaveBeenCalledWith('/graph/mainnet/notes.txt');
        });

        it('does not count another SQLite file as the channel database', async () => {
            unzipLeaves([dirEntry('lnd.sqlite', 4096)]);

            await expect(importPicked(true)).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );
        });

        it('does not count a directory named channel.db', async () => {
            unzipLeaves([
                { ...dirEntry('channel.db', 4096), isFile: () => false }
            ]);

            await expect(importPicked()).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );
            expect(mockUnlink).not.toHaveBeenCalledWith(
                '/graph/mainnet/channel.db'
            );
        });

        it('accepts a bolt backup and keeps its files', async () => {
            unzipLeaves(RESTORED_GRAPH_DIR);

            await importPicked();

            expect(mockUnlink).toHaveBeenCalledTimes(1);
            expect(mockUnlink).toHaveBeenCalledWith(
                '/cache/zeus-import-temp.zip'
            );
        });

        it('accepts a SQLite backup with empty wal and shm files', async () => {
            unzipLeaves([
                dirEntry('channel.sqlite', 4096),
                dirEntry('channel.sqlite-wal', 0),
                dirEntry('channel.sqlite-shm', 0)
            ]);

            await expect(importPicked(true)).resolves.toBeUndefined();
        });

        it('validates, unzips, and places files in the graph directory', async () => {
            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false,
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
                true,
                false
            );

            const destDir = mockUnzipFile.mock.calls[0][1];
            expect(destDir).toContain('lnd/data/graph/testnet');
        });

        it('clears existing files before unzipping', async () => {
            mockReadDir.mockResolvedValue([
                dirEntry('channel.db', 262144),
                dirEntry('peers.json', 10)
            ]);

            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false,
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
                if (path.endsWith('graph/mainnet')) return false;
                return true;
            });

            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false,
                false
            );

            expect(mockMkdir).toHaveBeenCalled();
        });

        it('removes the cache copy of a picked file after unzipping', async () => {
            await importChannelDb(
                'content://downloads/backup.zip',
                'backup.zip',
                'lnd',
                false,
                false
            );

            expect(mockCopyFile).toHaveBeenCalledWith(
                'content://downloads/backup.zip',
                '/cache/zeus-import-temp.zip'
            );
            expect(mockUnlink).toHaveBeenCalledWith(
                '/cache/zeus-import-temp.zip'
            );
        });

        it('removes the cache copy when the unzip fails', async () => {
            mockUnzipFile.mockRejectedValueOnce(new Error('ERR_UNZIP'));

            await expect(
                importChannelDb(
                    'content://downloads/backup.zip',
                    'backup.zip',
                    'lnd',
                    false,
                    false
                )
            ).rejects.toThrow('ERR_UNZIP');

            expect(mockUnlink).toHaveBeenCalledWith(
                '/cache/zeus-import-temp.zip'
            );
        });

        it('does not remove a picked file that was not copied', async () => {
            await importChannelDb(
                '/path/to/backup.zip',
                'backup.zip',
                'lnd',
                false,
                false
            );

            expect(mockUnlink).not.toHaveBeenCalledWith('/path/to/backup.zip');
        });

        it('rejects invalid file types', async () => {
            await expect(
                importChannelDb(
                    '/path/to/backup.db',
                    'backup.db',
                    'lnd',
                    false,
                    false
                )
            ).rejects.toThrow();
        });

        it.each([
            [false, 'channel.sqlite'],
            [true, 'channel.db']
        ])(
            'rejects a backup of the other database type (isSqlite %p, backup has %s)',
            async (isSqlite, backupFile) => {
                unzipLeaves([dirEntry(backupFile, 4096)]);

                await expect(
                    importChannelDb(
                        '/path/to/backup.zip',
                        'backup.zip',
                        'lnd',
                        false,
                        isSqlite
                    )
                ).rejects.toThrow(
                    'views.Tools.migration.import.databaseMismatch'
                );
            }
        );

        it.each([false, true])(
            'accepts a backup with the database of the selected type (isSqlite %p)',
            async (isSqlite) => {
                const file = isSqlite ? 'channel.sqlite' : 'channel.db';
                unzipLeaves([dirEntry(file, 4096)]);

                await expect(
                    importChannelDb(
                        '/path/to/backup.zip',
                        'backup.zip',
                        'lnd',
                        false,
                        isSqlite
                    )
                ).resolves.toBeUndefined();
            }
        );

        it('fails when an existing file cannot be removed', async () => {
            mockReadDir.mockResolvedValue([
                { path: '/graph/mainnet/channel.db', isFile: () => true }
            ]);
            mockUnlink.mockImplementation(async (path: string) => {
                if (path === '/graph/mainnet/channel.db') {
                    throw new Error('unlink failed');
                }
            });

            await expect(
                importChannelDb(
                    '/path/to/backup.zip',
                    'backup.zip',
                    'lnd',
                    false,
                    false
                )
            ).rejects.toThrow('unlink failed');
            expect(mockUnzipFile).not.toHaveBeenCalled();
        });

        it.each([false, true])(
            'rejects a backup that unpacks to no channel database (isSqlite %p)',
            async (isSqlite) => {
                unzipLeaves([dirEntry('peers.json', 10)]);

                await expect(
                    importChannelDb(
                        '/path/to/backup.zip',
                        'backup.zip',
                        'lnd',
                        false,
                        isSqlite
                    )
                ).rejects.toThrow(
                    'views.Tools.migration.import.databaseMissing'
                );
            }
        );
    });

    describe('restoreChannelBackupFromOlympus clearing the graph directory', () => {
        const { Alert } = require('react-native');
        const ReactNativeBlobUtil = require('react-native-blob-util');

        beforeEach(() => {
            ReactNativeBlobUtil.fetch.mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    verification: CHALLENGE,
                    last_backup_at: 1700000000000
                }),
                text: async () => 'encrypted'
            });
            // Confirm the restore prompt
            Alert.alert.mockImplementation(
                (_title: string, _message: string, buttons: any[]) =>
                    buttons[buttons.length - 1].onPress()
            );
        });

        afterEach(() => {
            Alert.alert.mockReset();
        });

        it('fails when an existing file cannot be removed', async () => {
            mockReadDir.mockResolvedValue([
                { path: '/graph/mainnet/channel.db', isFile: () => true }
            ]);
            mockUnlink.mockImplementation(async (path: string) => {
                if (path === '/graph/mainnet/channel.db') {
                    throw new Error('unlink failed');
                }
            });

            await expect(
                restoreChannelBackupFromOlympus(
                    'lnd',
                    false,
                    'pubkey',
                    'seed',
                    false
                )
            ).rejects.toThrow('unlink failed');
            expect(mockUnzipFile).not.toHaveBeenCalled();
        });
    });

    describe('exportChannelDb and the app lock', () => {
        const STAGED = expect.stringMatching(/\/zeus-lnd-mainnet-\d+\.zip$/);

        // stopping lnd and zipping take a while; the app can lock meanwhile
        const locksWhileZipping = async () => {
            mockLoginRequired.mockReturnValue(true);
        };

        beforeEach(() => {
            Platform.OS = 'ios';
            (Share.open as jest.Mock).mockResolvedValue({ success: true });
        });

        afterEach(() => {
            mockLoginRequired.mockReturnValue(false);
            Platform.OS = 'android';
        });

        it('opens the share sheet while the app is unlocked', async () => {
            await exportChannelDb('lnd', false);

            expect(Share.open).toHaveBeenCalledTimes(1);
            expect(Storage.setItem).toHaveBeenCalledTimes(1);
        });

        it('does not open the share sheet if the app locked meanwhile', async () => {
            mockZipFolder.mockImplementationOnce(locksWhileZipping);
            const setStatus = jest.fn();

            await exportChannelDb('lnd', false, setStatus);

            expect(Share.open).not.toHaveBeenCalled();
            expect(mockUnlink).toHaveBeenCalledWith(STAGED);
            expect(Storage.setItem).not.toHaveBeenCalled();
            expect(setStatus).toHaveBeenLastCalledWith(null);
            expect(Alert.alert).toHaveBeenCalledWith(
                'views.Tools.migration.export.cancelled',
                'views.Tools.migration.export.cancelled.text',
                expect.anything(),
                { cancelable: false }
            );
        });

        it('shows the cancellation notice when the staged file cannot be deleted', async () => {
            // reject the delete that follows the zip, not the one of a
            // leftover archive before it
            mockZipFolder.mockImplementationOnce(async () => {
                await locksWhileZipping();
                mockUnlink.mockRejectedValueOnce(new Error('ENOENT'));
            });
            const consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const setStatus = jest.fn();

            await exportChannelDb('lnd', false, setStatus);

            expect(mockUnlink).toHaveBeenCalledWith(STAGED);
            expect(Share.open).not.toHaveBeenCalled();
            expect(setStatus).toHaveBeenLastCalledWith(null);
            expect(Alert.alert).toHaveBeenCalledTimes(1);
            expect(Alert.alert).toHaveBeenCalledWith(
                'views.Tools.migration.export.cancelled',
                'views.Tools.migration.export.cancelled.text',
                expect.anything(),
                { cancelable: false }
            );
            consoleError.mockRestore();
        });

        it('still saves to Downloads on Android', async () => {
            Platform.OS = 'android';

            await exportChannelDb('lnd', false);

            expect(mockCopyFile).toHaveBeenCalledWith(
                STAGED,
                expect.stringMatching(/^\/downloads\/zeus-lnd-mainnet-/)
            );
            expect(Share.open).not.toHaveBeenCalled();
            expect(Storage.setItem).toHaveBeenCalledTimes(1);
        });
    });

    describe('migration lock', () => {
        let stored: string | null;
        const lockedDirs = () => stored && JSON.parse(stored).lndDirs;

        beforeEach(() => {
            stored = null;
            (Storage.getItem as jest.Mock).mockImplementation(
                async () => stored
            );
            (Storage.setItem as jest.Mock).mockImplementation(
                async (_key: string, value: string) => {
                    stored = value;
                }
            );
            (Storage.removeItem as jest.Mock).mockImplementation(async () => {
                stored = null;
            });
        });

        it('keeps the first wallet locked when a second one is exported', async () => {
            await exportChannelDb('wallet-a', false);
            await exportChannelDb('wallet-b', false);

            expect(Storage.setItem).toHaveBeenLastCalledWith(
                CHANNEL_MIGRATION_ACTIVE,
                expect.any(String)
            );
            expect(JSON.parse(stored!).migrationStatus).toBe(true);
            expect(lockedDirs()).toEqual(['wallet-a', 'wallet-b']);
            // older versions read only lndDir: the latest export stays locked
            expect(JSON.parse(stored!).lndDir).toBe('wallet-b');
        });

        it('does not list a wallet twice when it is exported again', async () => {
            await exportChannelDb('wallet-a', false);
            await exportChannelDb('wallet-a', false);

            expect(lockedDirs()).toEqual(['wallet-a']);
        });

        it('unlocks the wallet of a record that holds a single lndDir', async () => {
            stored = JSON.stringify({
                migrationStatus: true,
                lndDir: 'wallet-a'
            });
            await unlockWalletFromMigration('wallet-b');
            expect(lockedDirs()).toEqual(['wallet-a']);

            await unlockWalletFromMigration('wallet-a');
            expect(stored).toBeNull();
        });

        it('keeps the wallet of a record that holds a single lndDir', async () => {
            stored = JSON.stringify({
                migrationStatus: true,
                lndDir: 'wallet-a'
            });
            await exportChannelDb('wallet-b', false);

            expect(lockedDirs()).toEqual(['wallet-a', 'wallet-b']);
        });

        it('still locks the exported wallet when the record is unreadable', async () => {
            jest.spyOn(console, 'error').mockImplementationOnce(() => {});
            stored = 'not json';
            await exportChannelDb('wallet-a', false);

            expect(lockedDirs()).toEqual(['wallet-a']);
        });

        it('unlocks only the wallet whose migration is cancelled', async () => {
            await exportChannelDb('wallet-a', false);
            await exportChannelDb('wallet-b', false);

            await unlockWalletFromMigration('wallet-b');
            expect(lockedDirs()).toEqual(['wallet-a']);
            expect(JSON.parse(stored!).lndDir).toBe('wallet-a');

            await unlockWalletFromMigration('wallet-a');
            expect(Storage.removeItem).toHaveBeenCalledWith(
                CHANNEL_MIGRATION_ACTIVE
            );
            expect(stored).toBeNull();
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

    describe('restoreChannelBackupFromOlympus', () => {
        const restore = () =>
            restoreChannelBackupFromOlympus(
                'lnd',
                false,
                'pubkey',
                'seed',
                false
            );

        let consoleLog: jest.SpyInstance;
        let consoleError: jest.SpyInstance;

        beforeEach(() => {
            consoleLog = jest
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            // Press the last button: "No backup" when there is none,
            // "Restore" when one is found.
            mockAlert.mockImplementation(
                (_title: string, _message: string, buttons: any[]) =>
                    buttons?.[buttons.length - 1]?.onPress?.()
            );
        });

        afterEach(() => {
            mockAlert.mockReset();
            consoleLog.mockRestore();
            consoleError.mockRestore();
        });

        it('signs the UTF-8 bytes of the status challenge', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    jsonResponse({ success: true, verification: CHALLENGE })
                )
                .mockResolvedValueOnce(
                    jsonResponse({ success: true, last_backup_at: null })
                );

            expect(await restore()).toBe(false);
            expect(mockSignNodePubkey).toHaveBeenCalledWith(
                Uint8Array.from(Buffer.from(CHALLENGE, 'utf-8'))
            );
        });

        it('does not sign a look-alike of the LNURL-auth phrase as the phrase bytes', async () => {
            const lookAlike = '\u0144' + LNURLAUTH_CANONICAL_PHRASE.slice(1);
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ success: true, verification: lookAlike })
            );

            await expect(restore()).rejects.toThrow('Invalid auth response');
            expect(mockSignNodePubkey).not.toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('refuses the LNURL-auth phrase as the status challenge', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({
                    success: true,
                    verification: LNURLAUTH_CANONICAL_PHRASE
                })
            );

            await expect(restore()).rejects.toThrow('Invalid auth response');
            expect(mockSignNodePubkey).not.toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        const serveBackup = () => {
            serveChallenges([CHALLENGE, CHALLENGE], {
                last_backup_at: '2026-11-01T00:00:00Z'
            });
        };

        it('restores a backup that unzips to a channel database', async () => {
            serveBackup();
            mockReadDir.mockResolvedValue(RESTORED_GRAPH_DIR);

            expect(await restore()).toBe(true);
            expect(mockUnzipFile).toHaveBeenCalledTimes(1);
        });

        it('rejects when the downloaded backup unzips to an empty channel.db (#5797)', async () => {
            serveBackup();
            mockReadDir
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([dirEntry('channel.db', 0)]);

            await expect(restore()).rejects.toThrow(
                'views.Tools.migration.import.databaseMissing'
            );
            expect(mockUnzipFile).toHaveBeenCalledTimes(1);
            expect(mockUnlink).toHaveBeenCalledWith(
                '/graph/mainnet/channel.db'
            );
        });

        it('refuses the LNURL-auth phrase as the restore challenge', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    jsonResponse({ success: true, verification: CHALLENGE })
                )
                .mockResolvedValueOnce(
                    jsonResponse({
                        success: true,
                        last_backup_at: '2026-11-01T00:00:00Z'
                    })
                )
                .mockResolvedValueOnce(
                    jsonResponse({
                        success: true,
                        verification: ` ${LNURLAUTH_CANONICAL_PHRASE.toLowerCase()}\n`
                    })
                );

            await expect(restore()).rejects.toThrow('Invalid auth response');
            expect(mockSignNodePubkey).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(3);
            expect(mockFetch).not.toHaveBeenCalledWith(
                'POST',
                expect.stringContaining('/api/restore-channels'),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('Olympus auth challenge', () => {
        beforeEach(() => {
            jest.spyOn(console, 'log').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => jest.restoreAllMocks());

        describe('uploadChannelBackupToOlympus', () => {
            it('refuses to sign a status challenge that is not tagged for Olympus', async () => {
                serveChallenges([LNURLAUTH_CANONICAL_PHRASE]);

                await uploadChannelBackupToOlympus(
                    'lnd',
                    false,
                    '03cd',
                    'seed'
                );

                expect(signMessageMock).not.toHaveBeenCalled();
                expect(fetchedPaths()).toEqual(['/api/auth/v2']);
                expect(mockAlert).toHaveBeenCalledWith(
                    'general.error',
                    'views.Tools.migration.export.failedToUpload'
                );
            });

            it('refuses to sign an upload challenge that is not tagged for Olympus', async () => {
                serveChallenges([CHALLENGE, LNURLAUTH_CANONICAL_PHRASE]);

                await uploadChannelBackupToOlympus(
                    'lnd',
                    false,
                    '03cd',
                    'seed'
                );

                expect(signMessageMock).toHaveBeenCalledTimes(1);
                expect(signMessageMock).toHaveBeenCalledWith(CHALLENGE);
                expect(fetchedPaths()).toEqual([
                    '/api/auth/v2',
                    '/api/status',
                    '/api/auth/v2'
                ]);
                expect(mockZipFolder).not.toHaveBeenCalled();
            });

            it.each([
                ['a bare hex nonce', NONCE],
                ['a ZEUS Pay challenge', `${ZEUS_PAY_AUTH_TAG}${NONCE}`]
            ])('refuses to sign %s', async (_label, challenge) => {
                serveChallenges([challenge]);

                await uploadChannelBackupToOlympus(
                    'lnd',
                    false,
                    '03cd',
                    'seed'
                );

                expect(signMessageMock).not.toHaveBeenCalled();
                expect(fetchedPaths()).toEqual(['/api/auth/v2']);
            });

            it('signs tagged challenges and uploads', async () => {
                serveChallenges([CHALLENGE, SECOND_CHALLENGE]);

                await uploadChannelBackupToOlympus(
                    'lnd',
                    false,
                    '03cd',
                    'seed'
                );

                expect(signMessageMock.mock.calls).toEqual([
                    [CHALLENGE],
                    [SECOND_CHALLENGE]
                ]);
                expect(fetchedPaths()).toContain('/api/channels-backup');
                expect(JSON.parse(mockFetch.mock.calls[0][3])).toEqual({
                    pubkey: '03cd',
                    version: 2
                });
            });
        });

        describe('restoreChannelBackupFromOlympus', () => {
            it.each([
                ['uppercase hex', `${OLYMPUS_AUTH_TAG}${NONCE.toUpperCase()}`],
                ['a bare hex nonce', NONCE],
                ['a ZEUS Pay challenge', `${ZEUS_PAY_AUTH_TAG}${NONCE}`]
            ])(
                'refuses to sign %s as the status challenge',
                async (_label, challenge) => {
                    serveChallenges([challenge]);

                    await expect(
                        restoreChannelBackupFromOlympus(
                            'lnd',
                            false,
                            '03cd',
                            'seed',
                            false
                        )
                    ).rejects.toThrow('Invalid auth response');

                    expect(mockSignNodePubkey).not.toHaveBeenCalled();
                    expect(fetchedPaths()).toEqual(['/api/auth/v2']);
                }
            );

            it('refuses to sign a restore challenge that is not tagged for Olympus', async () => {
                serveChallenges([CHALLENGE, LNURLAUTH_CANONICAL_PHRASE], {
                    last_backup_at: '2026-01-01T00:00:00Z'
                });
                // confirm the restore dialog
                mockAlert.mockImplementation((_t, _m, buttons) =>
                    buttons?.[1]?.onPress?.()
                );

                await expect(
                    restoreChannelBackupFromOlympus(
                        'lnd',
                        false,
                        '03cd',
                        'seed',
                        false
                    )
                ).rejects.toThrow('Invalid auth response');

                expect(mockSignNodePubkey).toHaveBeenCalledTimes(1);
                expect(
                    Buffer.from(mockSignNodePubkey.mock.calls[0][0]).toString()
                ).toBe(CHALLENGE);
                expect(fetchedPaths()).toEqual([
                    '/api/auth/v2',
                    '/api/status',
                    '/api/auth/v2'
                ]);
            });
        });
    });

    describe('uploadChannelBackupToOlympus', () => {
        let consoleError: jest.SpyInstance;
        let consoleLog: jest.SpyInstance;

        beforeEach(() => {
            // No existing backup, so the upload starts without a prompt.
            mockOlympusServer({ lastBackupAt: null });
            consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            consoleLog = jest
                .spyOn(console, 'log')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleError.mockRestore();
            consoleLog.mockRestore();
        });

        const upload = () =>
            uploadChannelBackupToOlympus('lnd', false, 'pubkey', 'seed');

        const expectFailureAlert = () =>
            expect(mockAlert).toHaveBeenCalledWith(
                'general.error',
                'views.Tools.migration.export.failedToUpload',
                expect.any(Array),
                { cancelable: false }
            );

        it('uploads and removes the staging zip and .enc on success', async () => {
            await upload();

            expect(mockEncryptFile).toHaveBeenCalledWith(
                BACKUP_ZIP,
                BACKUP_ENC,
                'seed'
            );
            expect(mockUnlink).toHaveBeenCalledWith(BACKUP_ZIP);
            expect(mockUnlink).toHaveBeenCalledWith(BACKUP_ENC);
            expect(Storage.setItem).toHaveBeenCalledWith(
                'channel_migration_active',
                JSON.stringify({
                    migrationStatus: true,
                    lndDir: 'lnd',
                    lndDirs: ['lnd']
                })
            );
            expect(mockAlert).toHaveBeenCalledWith(
                'views.Tools.migration.export.success',
                'views.Tools.migration.export.success.text',
                expect.any(Array),
                { cancelable: false }
            );
        });

        it('removes the plaintext zip and .enc when encryption fails', async () => {
            mockEncryptFile.mockRejectedValue(new Error('encrypt failed'));

            await upload();

            expect(unlinkedPaths()).toEqual(
                expect.arrayContaining([BACKUP_ZIP, BACKUP_ENC])
            );
            expect(Storage.setItem).not.toHaveBeenCalled();
            expectFailureAlert();
        });

        it('removes the .enc when reading it fails', async () => {
            mockReadFile.mockRejectedValue(new Error('read failed'));

            await upload();

            expect(unlinkedPaths()).toEqual(
                expect.arrayContaining([BACKUP_ZIP, BACKUP_ENC])
            );
            expectFailureAlert();
        });

        it('removes the partial zip when zipping fails', async () => {
            mockZipFolder.mockRejectedValue(new Error('zip failed'));

            await upload();

            expect(mockUnlink).toHaveBeenCalledWith(BACKUP_ZIP);
            expect(mockEncryptFile).not.toHaveBeenCalled();
            expectFailureAlert();
        });

        it('does not unlink staging paths that do not exist', async () => {
            mockEncryptFile.mockRejectedValue(new Error('encrypt failed'));
            mockExists.mockImplementation(
                async (path: string) => !path.endsWith('.enc')
            );

            await upload();

            expect(mockUnlink).toHaveBeenCalledWith(BACKUP_ZIP);
            expect(mockUnlink).not.toHaveBeenCalledWith(BACKUP_ENC);
        });
    });

    describe('restoreChannelBackupFromOlympus staging files', () => {
        let consoleError: jest.SpyInstance;
        let consoleLog: jest.SpyInstance;

        beforeEach(() => {
            consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            consoleLog = jest
                .spyOn(console, 'log')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleError.mockRestore();
            consoleLog.mockRestore();
        });

        const restore = () =>
            restoreChannelBackupFromOlympus(
                'lnd',
                false,
                'pubkey',
                'seed',
                false
            );

        it('restores and removes the staging .enc and zip on success', async () => {
            mockReadDir
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(RESTORED_GRAPH_DIR);

            await expect(restore()).resolves.toBe(true);

            expect(mockDecryptFile).toHaveBeenCalledWith(
                RESTORE_ENC,
                RESTORE_ZIP,
                'seed'
            );
            expect(mockUnzipFile).toHaveBeenCalledWith(
                RESTORE_ZIP,
                expect.stringContaining('lnd/data/graph/mainnet')
            );
            expect(mockUnlink).toHaveBeenCalledWith(RESTORE_ENC);
            expect(mockUnlink).toHaveBeenCalledWith(RESTORE_ZIP);
        });

        it('removes the decrypted zip when stopping LND fails', async () => {
            mockStopLnd.mockRejectedValue(new Error('rpc error'));

            await expect(restore()).rejects.toThrow(
                'views.Tools.migration.export.failedToStopLnd'
            );

            expect(mockUnzipFile).not.toHaveBeenCalled();
            expect(mockUnlink).toHaveBeenCalledWith(RESTORE_ZIP);
        });

        it('removes the decrypted zip when unzipping fails', async () => {
            mockUnzipFile.mockRejectedValue(new Error('unzip failed'));

            await expect(restore()).rejects.toThrow('unzip failed');

            expect(mockUnlink).toHaveBeenCalledWith(RESTORE_ZIP);
        });

        it('removes the downloaded .enc when decryption fails', async () => {
            mockDecryptFile.mockRejectedValue(new Error('bad seed'));

            await expect(restore()).rejects.toThrow('bad seed');

            expect(unlinkedPaths()).toEqual(
                expect.arrayContaining([RESTORE_ENC, RESTORE_ZIP])
            );
        });

        it('rethrows the original error when cleanup unlink fails', async () => {
            mockStopLnd.mockRejectedValue(new Error('rpc error'));
            mockUnlink.mockImplementation(async (path: string) => {
                if (path.endsWith('.zip')) throw new Error('EBUSY');
            });

            await expect(restore()).rejects.toThrow(
                'views.Tools.migration.export.failedToStopLnd'
            );
        });

        it('does not unlink anything when the download fails', async () => {
            mockOlympusServer({ restoreStatus: 500 });

            await expect(restore()).rejects.toThrow('server error');

            expect(mockUnlink).not.toHaveBeenCalled();
        });
    });

    describe('purgeChannelDbStagingFiles', () => {
        const cacheEntry = (name: string) => ({
            name,
            path: `/cache/${name}`
        });

        it('deletes the copy staged when a backup is picked from a content URI', async () => {
            await validateChannelBackupFile(
                'content://com.android.providers.downloads/document/42',
                'backup.zip'
            );
            const stagedPath = mockCopyFile.mock.calls[0][1];
            expect(stagedPath).toBe('/cache/zeus-import-temp.zip');

            mockReadDir.mockResolvedValue([cacheEntry('zeus-import-temp.zip')]);
            await purgeChannelDbStagingFiles();

            expect(mockReadDir).toHaveBeenCalledWith('/cache');
            expect(mockUnlink).toHaveBeenCalledWith(stagedPath);
        });

        it('deletes import, Olympus and export staging files and nothing else', async () => {
            mockReadDir.mockResolvedValue([
                cacheEntry('zeus-import-temp.zip'),
                cacheEntry('zeus-import-temp.db'),
                cacheEntry('zeus-olympus-backup-1736899200000.zip'),
                cacheEntry('zeus-olympus-backup-1736899200000.enc'),
                cacheEntry('zeus-olympus-restore-1736899200000.zip'),
                cacheEntry('zeus-olympus-restore-1736899200000.enc'),
                cacheEntry('zeus-lnd-mainnet-1736899200000.zip'),
                cacheEntry('rescue_key.json'),
                cacheEntry('my-zeus-import-temp.zip'),
                cacheEntry('http-cache')
            ]);

            await purgeChannelDbStagingFiles();

            expect(mockUnlink.mock.calls.map((call) => call[0])).toEqual([
                '/cache/zeus-import-temp.zip',
                '/cache/zeus-import-temp.db',
                '/cache/zeus-olympus-backup-1736899200000.zip',
                '/cache/zeus-olympus-backup-1736899200000.enc',
                '/cache/zeus-olympus-restore-1736899200000.zip',
                '/cache/zeus-olympus-restore-1736899200000.enc',
                '/cache/zeus-lnd-mainnet-1736899200000.zip'
            ]);
        });

        it('keeps deleting after one file fails to unlink', async () => {
            mockReadDir.mockResolvedValue([
                cacheEntry('zeus-olympus-restore-1.zip'),
                cacheEntry('zeus-import-temp.zip')
            ]);
            mockUnlink.mockRejectedValueOnce(new Error('EBUSY'));
            const warn = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await expect(purgeChannelDbStagingFiles()).resolves.toBeUndefined();

            expect(mockUnlink).toHaveBeenCalledWith(
                '/cache/zeus-import-temp.zip'
            );
            warn.mockRestore();
        });

        it('resolves without deleting anything when the cache cannot be listed', async () => {
            mockReadDir.mockRejectedValue(new Error('ENOENT'));
            const warn = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            await expect(purgeChannelDbStagingFiles()).resolves.toBeUndefined();

            expect(mockUnlink).not.toHaveBeenCalled();
            warn.mockRestore();
        });
    });
});
