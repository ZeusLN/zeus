jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    __esModule: true,
    default: { channel: {} }
}));
jest.mock('../lndmobile/channel', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { signMessage: jest.fn() }
}));
jest.mock('../utils/LndMobileUtils', () => ({}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import ChannelBackupStore from './ChannelBackupStore';
import BackendUtils from '../utils/BackendUtils';

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
});
