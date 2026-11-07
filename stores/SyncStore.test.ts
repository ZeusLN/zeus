import SyncStore from './SyncStore';
import BackendUtils from '../utils/BackendUtils';

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

jest.mock('./ConnectivityStore', () => ({
    __esModule: true,
    default: class ConnectivityStore {}
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getMyNodeInfo: jest.fn(),
        getRecoveryInfo: jest.fn()
    }
}));

jest.mock('../utils/EventListenerUtils', () => ({
    LndMobileToolsEventEmitter: { addListener: jest.fn() }
}));

jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.space/api' }
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(() =>
            Promise.resolve({
                info: () => ({ status: 200 }),
                json: () => 900000
            })
        )
    }
}));

const getMyNodeInfoMock = BackendUtils.getMyNodeInfo as jest.Mock;
const getRecoveryInfoMock = BackendUtils.getRecoveryInfo as jest.Mock;

const makeStore = () => {
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
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('polls once every 2s while syncing', async () => {
        getMyNodeInfoMock.mockResolvedValue(UNSYNCED_INFO);
        const { store } = makeStore();

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
        const { store } = makeStore();

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
        const { store } = makeStore();

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
        const { store } = makeStore();

        await store.startSyncing().catch(() => {});
        expect(store.isSyncing).toBe(false);
    });

    it('resumes on reconnect after the initial getNodeInfo rejected', async () => {
        getMyNodeInfoMock.mockRejectedValueOnce(new Error('rpc not ready'));
        const { store, reconnect } = makeStore();

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
        const { store } = makeStore();

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
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('polls with one loop after two checkRecoveryStatus calls', async () => {
        getRecoveryInfoMock.mockResolvedValue(RECOVERING_INFO);
        const { store } = makeStore();

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
        const { store } = makeStore();

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
        const { store } = makeStore();

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
        const { store } = makeStore();

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
