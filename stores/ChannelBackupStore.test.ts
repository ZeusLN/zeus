jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
// backupChannels encrypts natively; ChannelBackupStore.encryption.test.ts
// covers the wire format
jest.mock('../utils/ZipUtils', () => ({
    encryptString: jest.fn().mockResolvedValue('encrypted'),
    decryptString: jest.fn()
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { channel: { subscribeChannelEvents: jest.fn() } }
}));
jest.mock('../lndmobile/channel', () => ({
    exportAllChannelBackups: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { signMessage: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({
    LndMobileEventEmitter: {
        addListener: jest.fn(() => ({ remove: jest.fn() }))
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import ChannelBackupStore, {
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME
} from './ChannelBackupStore';
import BackendUtils from '../utils/BackendUtils';
import { exportAllChannelBackups } from '../lndmobile/channel';
import Storage from '../storage';

const PUBKEY = '02'.padEnd(66, 'a');

const jsonResponse = (status: number, body: any) => ({
    info: () => ({ status }),
    json: () => body
});

// e.g. a 502 page from the proxy in front of the backups server
const htmlResponse = (status: number) => ({
    info: () => ({ status }),
    json: () => {
        throw new SyntaxError("JSON Parse error: Unrecognized token '<'");
    }
});

// The first request is /api/auth, the second is the route under test
const mockServer = (response: any) => {
    (ReactNativeBlobUtil.fetch as jest.Mock)
        .mockResolvedValueOnce(
            jsonResponse(200, { success: true, verification: 'nonce' })
        )
        .mockResolvedValueOnce(response);
};

const authFailures: Array<[string, any, string]> = [
    [
        'a 200 with success false',
        jsonResponse(200, {
            success: false,
            error: 'Error authenticating. Try again in a few minutes.'
        }),
        'Error authenticating. Try again in a few minutes.'
    ],
    [
        'a 200 without a verification',
        jsonResponse(200, { success: true }),
        'Auth response has no verification'
    ],
    ['a non-JSON 502', htmlResponse(502), 'Auth response status code: 502']
];

const createStore = () =>
    new ChannelBackupStore(
        { nodeInfo: { identity_pubkey: PUBKEY } } as any,
        { seedPhrase: ['seed'] } as any
    );

describe('ChannelBackupStore', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (BackendUtils.signMessage as jest.Mock).mockResolvedValue({
            zbase: 'signature'
        });
        consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    describe('recoverStaticChannelBackup', () => {
        it('triggers recovery with the returned backup', async () => {
            mockServer(
                jsonResponse(200, {
                    success: true,
                    backup: 'encrypted',
                    created_at: '2026-10-25T00:00:00.000Z'
                })
            );
            const store = createStore();
            const triggerRecovery = jest
                .spyOn(store, 'triggerRecovery')
                .mockResolvedValue();

            await expect(store.recoverStaticChannelBackup()).resolves.toEqual({
                backup: 'encrypted',
                created_at: '2026-10-25T00:00:00.000Z'
            });
            expect(triggerRecovery).toHaveBeenCalledWith('encrypted');
        });

        it.each([
            [
                'a 200 with success false',
                jsonResponse(200, {
                    success: false,
                    error: 'Wrong message signed'
                }),
                'Wrong message signed'
            ],
            [
                'a JSON 500',
                jsonResponse(500, {
                    success: false,
                    error: 'Internal server error'
                }),
                'Internal server error'
            ],
            [
                'a non-JSON 502',
                htmlResponse(502),
                'Recover response status code: 502'
            ],
            [
                'a 200 without a backup',
                jsonResponse(200, { success: true }),
                'Recover response has no backup'
            ]
        ])('throws the server error for %s', async (_, response, message) => {
            mockServer(response);
            const store = createStore();
            const triggerRecovery = jest.spyOn(store, 'triggerRecovery');

            await expect(store.recoverStaticChannelBackup()).rejects.toThrow(
                message
            );
            expect(triggerRecovery).not.toHaveBeenCalled();
        });

        it.each(authFailures)(
            'throws without signing when auth returns %s',
            async (_, response, message) => {
                (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValueOnce(
                    response
                );
                const store = createStore();

                await expect(
                    store.recoverStaticChannelBackup()
                ).rejects.toThrow(message);
                expect(BackendUtils.signMessage).not.toHaveBeenCalled();
                expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('advancedRecoveryList', () => {
        // The server returns [] when the pubkey has no backups
        it.each([
            ['the returned backups', [{ id: '1', backup: 'encrypted' }]],
            ['an empty backups list', []]
        ])('stores %s', async (_, backups) => {
            mockServer(jsonResponse(200, { success: true, backups }));
            const store = createStore();

            await expect(store.advancedRecoveryList()).resolves.toEqual(
                backups
            );
            expect(store.backups).toEqual(backups);
            expect(store.error).toBe(false);
            expect(store.loading).toBe(false);
        });

        it.each([
            [
                'a 200 with success false',
                jsonResponse(200, {
                    success: false,
                    error: 'Wrong message signed'
                })
            ],
            [
                'a JSON 500',
                jsonResponse(500, {
                    success: false,
                    error: 'Internal server error'
                })
            ],
            ['a non-JSON 502', htmlResponse(502)],
            ['a 200 without backups', jsonResponse(200, { success: true })]
        ])(
            'sets the error flag without rejecting for %s',
            async (_, response) => {
                mockServer(response);
                const store = createStore();

                await expect(
                    store.advancedRecoveryList()
                ).resolves.toBeUndefined();
                expect(store.backups).toEqual([]);
                expect(store.error).toBe(true);
                expect(store.loading).toBe(false);
            }
        );

        it.each(authFailures)(
            'sets the error flag without signing when auth returns %s',
            async (_, response) => {
                (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValueOnce(
                    response
                );
                const store = createStore();

                await expect(
                    store.advancedRecoveryList()
                ).resolves.toBeUndefined();
                expect(store.error).toBe(true);
                expect(BackendUtils.signMessage).not.toHaveBeenCalled();
                expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('backupChannels', () => {
        beforeEach(() => {
            (exportAllChannelBackups as jest.Mock).mockResolvedValue({
                multi_chan_backup: {
                    multi_chan_backup: new Uint8Array([1, 2, 3])
                }
            });
        });

        it('uploads the encrypted backup and logs SUCCESS', async () => {
            mockServer(jsonResponse(200, { success: true }));
            const store = createStore();

            await expect(store.backupChannels()).resolves.toBe(true);
            const [, url, , body] = (ReactNativeBlobUtil.fetch as jest.Mock)
                .mock.calls[1];
            expect(url).toBe('https://backups.lnolymp.us/api/backup');
            expect(JSON.parse(body)).toMatchObject({
                pubkey: PUBKEY,
                message: 'nonce',
                signature: 'signature'
            });
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'SUCCESS'
            );
        });

        it.each([
            [
                'a 200 with success false',
                jsonResponse(200, {
                    success: false,
                    error: 'Wrong message signed'
                })
            ],
            [
                'a JSON 500',
                jsonResponse(500, {
                    success: false,
                    error: 'Internal server error'
                })
            ],
            ['a non-JSON 502', htmlResponse(502)]
        ])('logs ERROR and throws for %s', async (_, response) => {
            mockServer(response);
            const store = createStore();

            await expect(store.backupChannels()).rejects.toThrow();
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'ERROR'
            );
            expect(Storage.setItem).not.toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'SUCCESS'
            );
        });

        it('logs ERROR and throws when auth fails', async () => {
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValueOnce(
                htmlResponse(502)
            );
            const store = createStore();

            await expect(store.backupChannels()).rejects.toThrow();
            expect(Storage.setItem).toHaveBeenCalledWith(
                LAST_CHANNEL_BACKUP_STATUS,
                'ERROR'
            );
            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('initSubscribeChannelEvents', () => {
        const DAY = 24 * 60 * 60 * 1000;

        it.each([
            ['backs up when the last backup failed', 'ERROR', new Date(), true],
            [
                'backs up when the last backup is over three days old',
                'SUCCESS',
                new Date(Date.now() - 4 * DAY),
                true
            ],
            ['backs up when nothing is stored', null, null, true],
            [
                'skips the backup when the last one succeeded a day ago',
                'SUCCESS',
                new Date(Date.now() - DAY),
                false
            ]
        ])('%s', async (_, status, time, expected) => {
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) =>
                    key === LAST_CHANNEL_BACKUP_STATUS
                        ? status
                        : key === LAST_CHANNEL_BACKUP_TIME && time
                        ? `${time}`
                        : null
            );
            const store = createStore();
            const backupChannels = jest
                .spyOn(store, 'backupChannels')
                .mockResolvedValue(true);

            await store.initSubscribeChannelEvents();

            expect(backupChannels).toHaveBeenCalledTimes(expected ? 1 : 0);
        });
    });
});
