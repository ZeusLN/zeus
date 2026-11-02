// Every request to the Olympus channel migration server must go through Tor
// when it is enabled. Uses the real NetworkUtils so the transport actually
// chosen is what gets checked.
jest.mock('./ZipUtils', () => ({
    zipFolder: jest.fn().mockResolvedValue(undefined),
    unzipFile: jest.fn().mockResolvedValue(undefined),
    encryptFile: jest.fn().mockResolvedValue(undefined),
    decryptFile: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/data/user/0/app.zeusln.zeus/files',
    LibraryDirectoryPath:
        '/var/mobile/Containers/Data/Application/UUID/Library',
    CachesDirectoryPath: '/cache',
    exists: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readDir: jest.fn().mockResolvedValue([])
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(),
        fs: {
            readFile: jest.fn().mockResolvedValue('ZW5jcnlwdGVk'),
            writeFile: jest.fn().mockResolvedValue(undefined)
        }
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
const mockSettingsStore = { enableTor: false };
jest.mock('../stores/Stores', () => ({
    get settingsStore() {
        return mockSettingsStore;
    }
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null)
}));
jest.mock('./TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
// Confirms the restore prompt by pressing its last button
jest.mock('react-native', () => ({
    Alert: {
        alert: jest.fn((_title: string, _msg: string, buttons?: any[]) =>
            buttons?.[buttons.length - 1]?.onPress?.()
        )
    },
    Platform: { OS: 'android', select: (opts: any) => opts.android }
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import {
    restoreChannelBackupFromOlympus,
    uploadChannelBackupToOlympus
} from './ChannelMigrationUtils';
import { doTorRequestRaw } from './TorUtils';

const HOST = 'https://backups.example.com';
const PUBKEY = `02${'11'.repeat(32)}`;

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

// Answers for each server endpoint, keyed by path. The upload status has no
// earlier backup so the upload goes ahead without a prompt; the restore
// status has one so the restore prompt is shown and confirmed.
let lastBackupAt: string | null = null;
const bodyFor = (url: string) => {
    switch (url.replace(HOST, '')) {
        case '/api/auth':
            return JSON.stringify({ success: true, verification: 'chal' });
        case '/api/status':
            return JSON.stringify({
                success: true,
                last_backup_at: lastBackupAt
            });
        case '/api/channels-backup':
            return JSON.stringify({ success: true });
        case '/api/restore-channels':
            return 'ZW5jcnlwdGVk';
        default:
            throw new Error(`unexpected request to ${url}`);
    }
};

const flows: Array<[string, string | null, () => Promise<any>, string[]]> = [
    [
        'uploadChannelBackupToOlympus',
        null,
        () => uploadChannelBackupToOlympus('lnd', false, PUBKEY, 'seed words'),
        ['/api/auth', '/api/status', '/api/auth', '/api/channels-backup']
    ],
    [
        'restoreChannelBackupFromOlympus',
        '2026-10-01T00:00:00Z',
        () =>
            restoreChannelBackupFromOlympus('lnd', false, PUBKEY, 'seed words'),
        ['/api/auth', '/api/status', '/api/auth', '/api/restore-channels']
    ]
];

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    torFetch.mockImplementation(async (url: string) => ({
        status: 200,
        body: bodyFor(url)
    }));
    blobFetch.mockImplementation(async (_method: string, url: string) => ({
        info: () => ({ status: 200 }),
        json: () => JSON.parse(bodyFor(url)),
        text: () => bodyFor(url)
    }));
});

describe('ChannelMigrationUtils Tor routing', () => {
    it.each(flows)(
        '%s sends every request over Tor when Tor is enabled',
        async (_name, backupAt, run, paths) => {
            mockSettingsStore.enableTor = true;
            lastBackupAt = backupAt;

            await run();

            expect(blobFetch).not.toHaveBeenCalled();
            expect(torFetch.mock.calls.map(([url]) => url)).toEqual(
                paths.map((path) => `${HOST}${path}`)
            );
            for (const [, method, body] of torFetch.mock.calls) {
                expect(method).toBe('POST');
                expect(JSON.parse(body).pubkey).toBe(PUBKEY);
            }
        }
    );

    it.each(flows)(
        '%s sends every request directly when Tor is off',
        async (_name, backupAt, run, paths) => {
            mockSettingsStore.enableTor = false;
            lastBackupAt = backupAt;

            await run();

            expect(torFetch).not.toHaveBeenCalled();
            expect(
                blobFetch.mock.calls.map(([method, url]) => [method, url])
            ).toEqual(paths.map((path) => ['post', `${HOST}${path}`]));
        }
    );
});
