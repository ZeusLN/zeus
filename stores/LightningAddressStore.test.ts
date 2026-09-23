import { observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import LightningAddressStore, {
    HASHES_STORAGE_STRING
} from './LightningAddressStore';
import BackendUtils from '../utils/BackendUtils';
import Storage from '../storage';
import { doTorRequestRaw } from '../utils/TorUtils';

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

jest.mock('react-native-notifications', () => ({
    Notifications: {}
}));

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

jest.mock('../utils/TorUtils', () => ({
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));

jest.mock('./CashuStore', () => ({
    __esModule: true,
    default: class CashuStore {}
}));

jest.mock('./LSPStore', () => ({
    __esModule: true,
    default: class LSPStore {}
}));

jest.mock('./ChannelsStore', () => ({
    __esModule: true,
    default: class ChannelsStore {}
}));

jest.mock('./NodeInfoStore', () => ({
    __esModule: true,
    default: class NodeInfoStore {}
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        signMessage: jest.fn(async () => ({ signature: 'sig' })),
        supportsFlowLSP: jest.fn(() => true),
        supportsMessageSigning: jest.fn(() => true)
    }
}));

jest.mock('../utils/LocaleUtils');

jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async () => false),
        setItem: jest.fn(async () => {}),
        removeItem: jest.fn(async () => {})
    }
}));

const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const torMock = doTorRequestRaw as jest.Mock;

const NODE_PUBKEY = `02${'b'.repeat(64)}`;
const LSP_PUBKEY =
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581';

const response = (status: number, body: any) => ({
    info: () => ({ status }),
    json: () => body
});

const setup = ({
    settings = { lspPushNotifications: true },
    enableTor = false,
    isMainNet = true,
    isOlympus = true,
    channels = [{ remotePubkey: LSP_PUBKEY }]
}: {
    settings?: any;
    enableTor?: boolean;
    isMainNet?: boolean;
    isOlympus?: boolean;
    channels?: Array<{ remotePubkey: string }>;
} = {}) => {
    const channelsStore: any = observable({ channels: [] });
    const store = new LightningAddressStore(
        {} as any,
        {
            nodeInfo: { identity_pubkey: NODE_PUBKEY, isMainNet }
        } as any,
        { settings, enableTor } as any,
        channelsStore,
        {
            isOlympus: () => isOlympus,
            getLSPSPubkey: () => LSP_PUBKEY
        } as any
    );
    return {
        store,
        loadChannels: () =>
            runInAction(() => {
                channelsStore.channels = channels;
            })
    };
};

// /auth, then /push
const mockAuthAndPush = (pushResponse = response(200, { success: true })) => {
    fetchMock
        .mockResolvedValueOnce(
            response(200, { success: true, verification: 'nonce' })
        )
        .mockResolvedValueOnce(pushResponse);
};

const pushCalls = () =>
    fetchMock.mock.calls.filter(([, url]) => url.endsWith('/api/lnurl/push'));

const flush = () => new Promise((resolve) => setImmediate(resolve));

const newStore = (settings: any = {}) =>
    new LightningAddressStore(
        {
            cashuWallets: { 'https://mint.test': { pubkey: '02ab' } }
        } as any,
        { nodeInfo: { identity_pubkey: '03cd' } } as any,
        {
            settings,
            updateSettings: jest.fn().mockResolvedValue(undefined)
        } as any,
        observable({ channels: [] }) as any,
        {} as any
    );

describe('LightningAddressStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('status', () => {
        const mockStatusResponse = (data: any) =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    handle: 'satoshi',
                    domain: 'zeuspay.com',
                    minimumSats: 1,
                    ...data
                })
            });

        const statusStore = () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            return store;
        };

        it('keeps open payments for a Cashu address', async () => {
            const store = statusStore();
            const paid = [
                {
                    quote_id: 'q1',
                    mint_url: 'https://mint.test',
                    amount_msat: 1000
                }
            ];
            mockStatusResponse({ addressType: 'cashu', paid });

            await store.status();

            expect(store.paid).toEqual(paid);
            expect(store.lightningAddressType).toBe('cashu');
            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
            expect(store.minimumSats).toBe(1);
            expect(store.loading).toBe(false);
        });

        it('drops held payments for a retired Zaplocker address and submits no hashes', async () => {
            const store = statusStore();
            mockStatusResponse({
                addressType: 'zaplocker',
                results: 0,
                paid: [{ hash: 'h1', amount_msat: 1000, hodl: 'lnbc1' }]
            });

            await store.status();

            expect(store.paid).toEqual([]);
            expect(store.lightningAddressType).toBe('zaplocker');
            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
            expect(
                (ReactNativeBlobUtil.fetch as jest.Mock).mock.calls[0][1]
            ).toBe('https://zeuspay.com/api/lnurl/status');
        });

        it('sets no open payments for an NWC address without a paid list', async () => {
            const store = statusStore();
            mockStatusResponse({ addressType: 'nwc' });

            await store.status();

            expect(store.paid).toEqual([]);
            expect(store.lightningAddressType).toBe('nwc');
        });

        it('records the error and rethrows when the server rejects the call', async () => {
            const store = statusStore();
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 400 }),
                json: () => ({ success: false, error: 'invalid signature' })
            });

            await expect(store.status()).rejects.toBe('invalid signature');

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('invalid signature');
            expect(store.loading).toBe(false);
        });
    });

    describe('redeemAllOpenPaymentsCashu', () => {
        it('redeems oldest first and only checks the mint on the last payment', async () => {
            const store = newStore();
            store.paid = [
                {
                    quote_id: 'q3',
                    mint_url: 'https://mint.test',
                    amount_msat: 3000
                },
                {
                    quote_id: 'q2',
                    mint_url: 'https://mint.test',
                    amount_msat: 2000
                },
                {
                    quote_id: 'q1',
                    mint_url: 'https://mint.test',
                    amount_msat: 1000
                }
            ];
            const redeem = jest
                .spyOn(store, 'redeemCashu')
                .mockResolvedValue(true);
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsCashu(true);

            expect(redeem.mock.calls).toEqual([
                ['q1', 'https://mint.test', 1000, true, true, true],
                ['q2', 'https://mint.test', 2000, true, true, true],
                ['q3', 'https://mint.test', 3000, true, true, false]
            ]);
            expect(status).toHaveBeenCalledWith(true);
            expect(store.redeemingAll).toBe(false);
        });
    });

    describe('update', () => {
        const updateStore = () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            return store;
        };

        const mockUpdateResponse = (status: number, data: any) =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status }),
                json: () => data
            });

        it('clears local hashes after switching address type', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true });

            await expect(
                store.update({ address_type: 'cashu' })
            ).resolves.toEqual({ success: true });

            expect(Storage.setItem).toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                ''
            );
        });

        it('still resolves if clearing local hashes fails', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true });
            (Storage.setItem as jest.Mock).mockRejectedValueOnce(
                new Error('keychain error')
            );

            await expect(
                store.update({ address_type: 'nwc' })
            ).resolves.toEqual({ success: true });
            expect(store.error).toBe(false);
        });

        it('keeps local hashes when the address type is unchanged', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true, handle: 'satoshi' });

            await store.update({ handle: 'satoshi' });

            expect(Storage.setItem).not.toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                expect.anything()
            );
        });

        it('keeps local hashes when the server rejects the switch', async () => {
            const store = updateStore();
            mockUpdateResponse(400, { success: false, error: 'rejected' });

            await expect(
                store.update({ address_type: 'cashu' })
            ).rejects.toEqual('rejected');

            expect(Storage.setItem).not.toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                expect.anything()
            );
            expect(store.error).toBe(true);
        });
    });

    describe('createCashu', () => {
        const mockCreateResponse = () =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    handle: 'satoshi',
                    domain: 'zeuspay.com'
                })
            });

        it('resolves and handles a failed push credential update', async () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            mockCreateResponse();
            jest.spyOn(store, 'updatePushCredentials').mockRejectedValue(
                new Error('update failed')
            );

            await expect(
                store.createCashu('https://mint.test')
            ).resolves.toEqual({ success: true });
            await flush();

            expect(store.loading).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Failed to update push credentials',
                expect.any(Error)
            );
        });
    });
});

describe('LightningAddressStore LSP push registration', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        torMock.mockReset();
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(true);
    });

    it('registers the token when channels load with an Olympus channel', async () => {
        const { store, loadChannels } = setup();
        store.setDeviceToken('device-token');
        mockAuthAndPush();

        loadChannels();
        await flush();

        const calls = pushCalls();
        expect(calls).toHaveLength(1);
        expect(JSON.parse(calls[0][3])).toEqual({
            pubkey: NODE_PUBKEY,
            message: 'nonce',
            signature: 'sig',
            enabled: true,
            device_token: 'device-token',
            device_platform: 'ios'
        });
    });

    it('waits for the device token if it has not arrived', async () => {
        const { store, loadChannels } = setup();

        loadChannels();
        await flush();
        expect(pushCalls()).toHaveLength(0);

        mockAuthAndPush();
        store.setDeviceToken('late-token');
        await flush();

        expect(pushCalls()).toHaveLength(1);
        expect(JSON.parse(pushCalls()[0][3]).device_token).toBe('late-token');
    });

    it('registers once per pubkey and token', async () => {
        const { store, loadChannels } = setup();
        store.setDeviceToken('device-token');
        mockAuthAndPush();

        loadChannels();
        await flush();
        await store.maybeRegisterLspPush();
        await store.maybeRegisterLspPush();

        expect(pushCalls()).toHaveLength(1);
    });

    it.each([
        ['the user has not opted in', { settings: {} }],
        ['the setting is off', { settings: { lspPushNotifications: false } }],
        ['the node is not on mainnet', { isMainNet: false }],
        ['the LSP is not Olympus', { isOlympus: false }],
        ['there is no Olympus channel', { channels: [{ remotePubkey: '03' }] }]
    ])('does nothing when %s', async (_label, options) => {
        const { store, loadChannels } = setup(options as any);
        store.setDeviceToken('device-token');

        loadChannels();
        await flush();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does nothing when a ZEUS Pay address is loaded', async () => {
        const { store, loadChannels } = setup();
        store.setDeviceToken('device-token');
        store.lightningAddress = 'satoshi@zeuspay.com';

        loadChannels();
        await flush();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does nothing on a backend without the Flow LSP settings screen', async () => {
        (BackendUtils.supportsFlowLSP as jest.Mock).mockReturnValue(false);
        const { store, loadChannels } = setup();
        store.setDeviceToken('device-token');

        loadChannels();
        await flush();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends /auth and /push over Tor when Tor is enabled', async () => {
        const { store, loadChannels } = setup({ enableTor: true });
        store.setDeviceToken('device-token');
        torMock
            .mockResolvedValueOnce({
                status: 200,
                body: JSON.stringify({ success: true, verification: 'nonce' })
            })
            .mockResolvedValueOnce({
                status: 200,
                body: JSON.stringify({ success: true })
            });

        loadChannels();
        await flush();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(torMock.mock.calls.map(([url]) => url)).toEqual([
            'https://zeuspay.com/api/lnurl/auth',
            'https://zeuspay.com/api/lnurl/push'
        ]);
        expect(JSON.parse(torMock.mock.calls[1][2]).device_token).toBe(
            'device-token'
        );
    });

    it('sends enabled: false without a token to unregister', async () => {
        const { store } = setup();
        store.setDeviceToken('device-token');
        mockAuthAndPush();

        await store.registerLspPush(false);

        expect(JSON.parse(pushCalls()[0][3])).toEqual({
            pubkey: NODE_PUBKEY,
            message: 'nonce',
            signature: 'sig',
            enabled: false
        });
    });

    it('registers again after a server error', async () => {
        const { store, loadChannels } = setup();
        store.setDeviceToken('device-token');

        mockAuthAndPush(response(400, { success: false, error: 'nope' }));
        loadChannels();
        await flush();
        expect(pushCalls()).toHaveLength(1);

        // the cached auth is reused, so only /push is fetched
        fetchMock.mockResolvedValueOnce(response(200, { success: true }));
        await store.maybeRegisterLspPush();

        expect(pushCalls()).toHaveLength(2);
    });
});
