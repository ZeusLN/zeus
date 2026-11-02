jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { channel: { subscribeChannelEvents: jest.fn() } }
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
    BACKUPS_HOST,
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME
} from './ChannelBackupStore';
import BackendUtils from '../utils/BackendUtils';
import { exportAllChannelBackups } from '../lndmobile/channel';
import Storage from '../storage';

const PUBKEY = '02'.padEnd(66, 'a');
// Olympus issues 64 random bytes as lowercase hex
const CHALLENGE = 'a1'.repeat(64);
const CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

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
            jsonResponse(200, { success: true, verification: CHALLENGE })
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
                message: CHALLENGE,
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

const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const signMessage = BackendUtils.signMessage as jest.Mock;

// Answers /api/auth with the given challenge and every other path with a
// successful empty-ish reply.
const serveChallenge = (verification: any) =>
    fetchMock.mockImplementation(async (_m: string, url: string) => {
        const path = url.replace(BACKUPS_HOST, '');
        const body =
            path === '/api/auth'
                ? { success: true, verification }
                : { success: true, backup: 'b', backups: [] };
        return { info: () => ({ status: 200 }), json: () => body };
    });

const paths = () =>
    fetchMock.mock.calls.map(([, url]) => url.replace(BACKUPS_HOST, ''));

describe('ChannelBackupStore auth challenge', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        signMessage.mockResolvedValue({ zbase: 'zsig' });
        (exportAllChannelBackups as jest.Mock).mockResolvedValue({
            multi_chan_backup: { multi_chan_backup: new Uint8Array([1]) }
        });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    describe('backupChannels', () => {
        it('signs a hex challenge and uploads the backup', async () => {
            serveChallenge(CHALLENGE);

            await expect(createStore().backupChannels()).resolves.toBe(true);

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/backup']);
        });

        it.each([
            ['the LNURL-auth canonical phrase', CANONICAL_PHRASE],
            ['uppercase hex', CHALLENGE.toUpperCase()],
            ['short hex', 'a1'.repeat(32)],
            ['a missing challenge', undefined]
        ])('refuses to sign %s', async (_label, verification) => {
            serveChallenge(verification);

            await expect(createStore().backupChannels()).rejects.toThrow();

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
        });
    });

    describe('recoverStaticChannelBackup', () => {
        it('refuses to sign the LNURL-auth canonical phrase', async () => {
            serveChallenge(CANONICAL_PHRASE);

            await expect(
                createStore().recoverStaticChannelBackup()
            ).rejects.toThrow('Invalid auth challenge');

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
        });

        it('signs a hex challenge', async () => {
            serveChallenge(CHALLENGE);
            const store = createStore();
            jest.spyOn(store, 'triggerRecovery').mockResolvedValue();

            await store.recoverStaticChannelBackup();

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/recover']);
        });
    });

    describe('advancedRecoveryList', () => {
        it('refuses to sign the LNURL-auth canonical phrase', async () => {
            serveChallenge(CANONICAL_PHRASE);
            const store = createStore();

            await expect(store.advancedRecoveryList()).resolves.toBeUndefined();

            expect(signMessage).not.toHaveBeenCalled();
            expect(paths()).toEqual(['/api/auth']);
            expect(store.error).toBe(true);
            expect(store.loading).toBe(false);
        });

        it('signs a hex challenge', async () => {
            serveChallenge(CHALLENGE);

            await createStore().advancedRecoveryList();

            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(paths()).toEqual(['/api/auth', '/api/recoverAdvanced']);
        });
    });
});
