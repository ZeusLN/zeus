import { observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import LightningAddressStore from './LightningAddressStore';
import BackendUtils from '../utils/BackendUtils';
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

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

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
