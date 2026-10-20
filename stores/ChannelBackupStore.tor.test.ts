// Every request to the Olympus backup server must go through Tor when it is
// enabled. Uses the real NetworkUtils so the transport actually chosen is
// what gets checked.
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: {
        channel: {
            decodeChannelEvent: jest.fn(),
            subscribeChannelEvents: jest.fn()
        }
    }
}));
jest.mock('../lndmobile/channel', () => ({
    exportAllChannelBackups: jest.fn(),
    restoreChannelBackups: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { signMessage: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: { addListener: jest.fn() }
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => String(e?.message ?? e)
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

import * as CryptoJS from 'crypto-js';
import ReactNativeBlobUtil from 'react-native-blob-util';

import ChannelBackupStore, { BACKUPS_HOST } from './ChannelBackupStore';
import BackendUtils from '../utils/BackendUtils';
import { doTorRequestRaw } from '../utils/TorUtils';
import {
    exportAllChannelBackups,
    restoreChannelBackups
} from '../lndmobile/channel';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const SEED = 'abandon abandon about';
const PUBKEY = `02${'11'.repeat(32)}`;

// Answers for each server endpoint, keyed by path
const responses: { [path: string]: any } = {
    '/api/auth': { success: true, verification: 'challenge' },
    '/api/backup': { success: true },
    '/api/recover': {
        success: true,
        backup: CryptoJS.AES.encrypt('multi', SEED).toString(),
        created_at: '2026-10-20'
    },
    '/api/recoverAdvanced': { backups: [{ created_at: '2026-10-20' }] }
};
const bodyFor = (url: string) =>
    JSON.stringify(responses[url.replace(BACKUPS_HOST, '')]);

const newStore = (enableTor: boolean) =>
    new ChannelBackupStore(
        { nodeInfo: { identity_pubkey: PUBKEY } } as any,
        { enableTor, seedPhrase: SEED } as any
    );

const cases: Array<[string, (store: ChannelBackupStore) => Promise<any>]> = [
    ['backupChannels', (store) => store.backupChannels()],
    [
        'recoverStaticChannelBackup',
        (store) => store.recoverStaticChannelBackup()
    ],
    ['advancedRecoveryList', (store) => store.advancedRecoveryList()]
];

const expectedPaths: { [name: string]: string[] } = {
    backupChannels: ['/api/auth', '/api/backup'],
    recoverStaticChannelBackup: ['/api/auth', '/api/recover'],
    advancedRecoveryList: ['/api/auth', '/api/recoverAdvanced']
};

beforeEach(() => {
    jest.clearAllMocks();
    (exportAllChannelBackups as jest.Mock).mockResolvedValue({
        multi_chan_backup: { multi_chan_backup: new Uint8Array([1, 2, 3]) }
    });
    (restoreChannelBackups as jest.Mock).mockResolvedValue(undefined);
    (BackendUtils.signMessage as jest.Mock).mockResolvedValue({
        signature: 'sig'
    });
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

describe('ChannelBackupStore Tor routing', () => {
    it.each(cases)(
        '%s sends every request over Tor when Tor is enabled',
        async (name, run) => {
            await run(newStore(true));

            expect(blobFetch).not.toHaveBeenCalled();
            expect(torFetch.mock.calls.map(([url]) => url)).toEqual(
                expectedPaths[name].map((path) => `${BACKUPS_HOST}${path}`)
            );
            for (const [, method, body] of torFetch.mock.calls) {
                expect(method).toBe('POST');
                expect(JSON.parse(body).pubkey).toBe(PUBKEY);
            }
        }
    );

    it.each(cases)(
        '%s sends every request directly when Tor is off',
        async (name, run) => {
            await run(newStore(false));

            expect(torFetch).not.toHaveBeenCalled();
            expect(
                blobFetch.mock.calls.map(([method, url]) => [method, url])
            ).toEqual(
                expectedPaths[name].map((path) => [
                    'POST',
                    `${BACKUPS_HOST}${path}`
                ])
            );
        }
    );
});
