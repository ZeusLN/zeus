jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/UrlUtils', () => ({ getMempoolApiUrl: jest.fn() }));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../stores/Stores', () => ({
    alertStore: {
        setMempoolErrorFromUrl: jest.fn(),
        clearMempoolError: jest.fn()
    }
}));
// SyncStore imports BackendUtils, which pulls in LND → TorUtils →
// react-native-nitro-tor (ESM). Mock BackendUtils so Jest never loads it.
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getMyNodeInfo: jest.fn(),
        getRecoveryInfo: jest.fn()
    }
}));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));
jest.mock('./ConnectivityStore', () => ({
    __esModule: true,
    default: class ConnectivityStore {}
}));
// Silence the NativeEventEmitter warnings from EventListenerUtils.
jest.mock('../utils/EventListenerUtils', () => ({
    LndMobileEventEmitter: { addListener: jest.fn() },
    LndMobileToolsEventEmitter: { addListener: jest.fn() },
    LdkNodeEventEmitter: { addListener: jest.fn() }
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import UrlUtils from '../utils/UrlUtils';
import BackendUtils from '../utils/BackendUtils';
import { alertStore } from './Stores';
import SyncStore from './SyncStore';

const mockedFetch = jest.mocked(ReactNativeBlobUtil.fetch);
const mockedUrl = jest.mocked(UrlUtils.getMempoolApiUrl);
const mockedAlert = alertStore as jest.Mocked<typeof alertStore>;

const makeStore = (network: 'Mainnet' | 'Testnet' = 'Mainnet') => {
    const stub = {
        onReconnect: jest.fn(),
        embeddedLndNetwork: network,
        implementation: 'embedded-lnd'
    };
    return new SyncStore(
        stub as any,
        { ...stub, onReconnect: jest.fn() } as any
    );
};

describe('SyncStore.getBestBlockHeight', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUrl.mockReturnValue('https://mempool.space/api');
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('clears the alert on a 200 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => '800000'
        } as any);
        const store = makeStore();

        await (store as any).getBestBlockHeight();

        expect(store.bestBlockHeight).toBe(800000);
        expect(store.error).toBe(false);
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('sets the alert on a non-200 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => '0'
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(store.error).toBe(true);
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'HTTP 500'
        );
    });

    it('sets the alert on a thrown network error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(store.error).toBe(true);
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Network error'
        );
    });

    it('names the Testnet host on the alert', async () => {
        mockedUrl.mockImplementation((info: any) =>
            info.isTestNet
                ? 'https://mempool.space/testnet/api'
                : 'https://mempool.space/api'
        );
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => '0'
        } as any);
        const store = makeStore('Testnet');

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/testnet/api/blocks/tip/height',
            'HTTP 500'
        );
    });

    it('raises the alert on a 404 response with an HTML body', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 404 }),
            json: () => {
                throw new SyntaxError('Unexpected token <');
            }
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'HTTP 404'
        );
    });

    it('raises the alert on a 500 response with a JSON body', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => ({ error: 'internal' })
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'HTTP 500'
        );
    });

    it('raises the alert with "Invalid response" on a non-numeric body', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => 'Not a number'
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Invalid response'
        );
    });

    it('raises "Invalid response" when json() throws', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => {
                throw new SyntaxError('Unexpected token <');
            }
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Invalid response'
        );
    });
});

const getMyNodeInfoMock = BackendUtils.getMyNodeInfo as jest.Mock;
const getRecoveryInfoMock = BackendUtils.getRecoveryInfo as jest.Mock;

const makeLoopStore = () => {
    let reconnect: (() => void) | undefined;
    const settingsStore: any = {
        implementation: 'embedded-lnd',
        embeddedLndNetwork: 'Mainnet'
    };
    const connectivityStore: any = {
        onReconnect: (cb: () => void) => (reconnect = cb)
    };
    const store = new SyncStore(settingsStore, connectivityStore);
    return { store, reconnect: () => reconnect?.() };
};

// Lets pending promise chains settle without moving the fake clock
const flush = () => jest.advanceTimersByTimeAsync(0);

const UNSYNCED_INFO = { block_height: 800000, synced_to_chain: false };
const RECOVERING_INFO = {
    recovery_mode: true,
    recovery_finished: false,
    progress: 0.5
};

describe('SyncStore sync loop', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getMyNodeInfoMock.mockReset();
        getRecoveryInfoMock.mockReset();
        mockedUrl.mockReturnValue('https://mempool.space/api');
        mockedFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => 900000
        } as any);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('polls once every 2s while syncing', async () => {
        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        const { store } = makeLoopStore();

        store.startSyncing();
        await flush();
        expect(store.isSyncing).toBe(true);

        getMyNodeInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getMyNodeInfoMock).toHaveBeenCalledTimes(5);

        store.reset();
    });

    it('leaves one loop when startSyncing follows reset within the sleep', async () => {
        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        const { store } = makeLoopStore();

        store.startSyncing();
        await flush();

        // The first loop is now inside its 2s sleep
        await jest.advanceTimersByTimeAsync(500);
        store.reset();
        store.startSyncing();
        await flush();

        getMyNodeInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getMyNodeInfoMock).toHaveBeenCalledTimes(5);

        store.reset();
    });

    it('stops polling after reset', async () => {
        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        const { store } = makeLoopStore();

        store.startSyncing();
        await flush();
        await jest.advanceTimersByTimeAsync(500);
        store.reset();

        getMyNodeInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getMyNodeInfoMock).not.toHaveBeenCalled();
    });

    it('clears isSyncing when the initial getNodeInfo rejects', async () => {
        getMyNodeInfoMock.mockRejectedValue(new Error('rpc not ready'));
        const { store } = makeLoopStore();

        await store.startSyncing().catch(() => {});
        expect(store.isSyncing).toBe(false);
    });

    it('resumes on reconnect after the initial getNodeInfo rejected', async () => {
        getMyNodeInfoMock.mockRejectedValueOnce(new Error('rpc not ready'));
        const { store, reconnect } = makeLoopStore();

        await store.startSyncing().catch(() => {});

        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        reconnect();
        await flush();
        expect(store.isSyncing).toBe(true);
        expect(getMyNodeInfoMock).toHaveBeenCalledTimes(2);

        store.reset();
    });

    it('ends the loop when the node reports synced_to_chain', async () => {
        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        const { store } = makeLoopStore();

        store.startSyncing();
        await flush();

        getMyNodeInfoMock.mockResolvedValue({
            ...UNSYNCED_INFO,
            block_height: 800001,
            synced_to_chain: true
        });
        await jest.advanceTimersByTimeAsync(2000);
        expect(store.isSyncing).toBe(false);

        getMyNodeInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getMyNodeInfoMock).not.toHaveBeenCalled();
    });
});

describe('SyncStore recovery loop', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getMyNodeInfoMock.mockReset();
        getRecoveryInfoMock.mockReset();
        mockedUrl.mockReturnValue('https://mempool.space/api');
        mockedFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => 900000
        } as any);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('polls with one loop after two checkRecoveryStatus calls', async () => {
        getRecoveryInfoMock.mockResolvedValue(RECOVERING_INFO);
        const { store } = makeLoopStore();

        store.checkRecoveryStatus();
        await flush();
        store.checkRecoveryStatus();
        await flush();
        expect(store.isRecovering).toBe(true);

        getRecoveryInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getRecoveryInfoMock).toHaveBeenCalledTimes(5);
        expect(store.recoveryProgress).toBe(0.5);

        store.reset();
    });

    it('stops the recovery loop on reset', async () => {
        getRecoveryInfoMock.mockResolvedValue(RECOVERING_INFO);
        const { store } = makeLoopStore();

        store.checkRecoveryStatus();
        await flush();
        await jest.advanceTimersByTimeAsync(500);
        store.reset();

        getRecoveryInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getRecoveryInfoMock).not.toHaveBeenCalled();
        expect(store.isRecovering).toBe(false);
    });

    it('leaves one loop when recovery restarts after reset within the sleep', async () => {
        getRecoveryInfoMock.mockResolvedValue(RECOVERING_INFO);
        const { store } = makeLoopStore();

        store.checkRecoveryStatus();
        await flush();
        await jest.advanceTimersByTimeAsync(500);
        store.reset();
        store.checkRecoveryStatus();
        await flush();

        getRecoveryInfoMock.mockClear();
        await jest.advanceTimersByTimeAsync(10000);
        expect(getRecoveryInfoMock).toHaveBeenCalledTimes(5);

        store.reset();
    });

    it('clears isRecovering when a poll rejects, so a later check can settle it', async () => {
        getRecoveryInfoMock
            .mockResolvedValueOnce(RECOVERING_INFO)
            .mockRejectedValueOnce(new Error('rpc unavailable'))
            .mockResolvedValue({
                recovery_mode: true,
                recovery_finished: true,
                progress: 1
            });
        const { store } = makeLoopStore();

        store.checkRecoveryStatus();
        await flush();
        expect(store.isRecovering).toBe(true);

        await jest.advanceTimersByTimeAsync(2000);

        // Recovery finished while the loop was down
        store.checkRecoveryStatus();
        await flush();
        expect(store.isRecovering).toBe(false);
    });
});
