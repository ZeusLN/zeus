import NetInfo from '@react-native-community/netinfo';

import ConnectivityStore from './ConnectivityStore';

const mockListeners = new Set<(state: any) => void>();

jest.mock('@react-native-community/netinfo', () => ({
    configure: jest.fn(),
    addEventListener: jest.fn((listener: (state: any) => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
    }),
    fetch: jest.fn(() => new Promise(() => {}))
}));

const emit = (state: any) =>
    mockListeners.forEach((listener) => listener(state));

// Connected without internet: the store falls back to its own reachability
// probes (global fetch)
const UNREACHABLE = { isConnected: true, isInternetReachable: false };

const flushPromises = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

// Makes every probe wait until settle() is called
const mockPendingProbes = () => {
    let settle!: (reachable: boolean) => void;
    const response = new Promise((resolve, reject) => {
        settle = (reachable) =>
            reachable ? resolve({}) : reject(new Error('offline'));
    });
    const fetchMock = jest.fn(() => response);
    global.fetch = fetchMock as any;
    return { fetchMock, settle };
};

describe('ConnectivityStore', () => {
    const originalFetch = global.fetch;
    let store: ConnectivityStore;

    beforeEach(() => {
        jest.clearAllMocks();
        mockListeners.clear();
        store = new ConnectivityStore({ settings: {} } as any);
    });

    afterEach(() => {
        store.stop();
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('clears the offline state when monitoring stops', () => {
        store.start();
        emit({ isConnected: false });
        expect(store.isOffline).toBe(true);

        store.stop();

        expect(store.isOffline).toBe(false);
    });

    it('does not fire onReconnect for a probe that succeeds after monitoring stops', async () => {
        const { settle } = mockPendingProbes();
        const onReconnect = jest.fn();
        store.onReconnect(onReconnect);
        store.start();
        emit({ isConnected: false });
        emit(UNREACHABLE);

        store.stop();
        settle(true);
        await flushPromises();

        expect(onReconnect).not.toHaveBeenCalled();
    });

    it('ignores a probe result that arrives after monitoring stops', async () => {
        const { settle } = mockPendingProbes();
        store.start();
        emit(UNREACHABLE);

        store.stop();
        settle(false);
        await flushPromises();

        expect(store.isOffline).toBe(false);
    });

    it('ignores a poll result that arrives after monitoring stops', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate'] });
        let resolvePoll!: (state: any) => void;
        (NetInfo.fetch as jest.Mock).mockReturnValueOnce(
            new Promise((resolve) => {
                resolvePoll = resolve;
            })
        );

        store.start();
        jest.advanceTimersByTime(15000);
        store.stop();
        resolvePoll({ isConnected: false });
        await flushPromises();

        expect(store.isOffline).toBe(false);
    });

    it('ignores a probe result from before a restart', async () => {
        const { settle } = mockPendingProbes();
        store.start();
        emit(UNREACHABLE);

        store.stop();
        store.start();
        emit({ isConnected: true, isInternetReachable: true });
        settle(false);
        await flushPromises();

        expect(store.isOffline).toBe(false);
    });

    it('probes again after a restart while the old probe is pending', async () => {
        const { fetchMock, settle } = mockPendingProbes();
        store.start();
        emit(UNREACHABLE);
        const probesBefore = fetchMock.mock.calls.length;

        store.stop();
        store.start();
        emit(UNREACHABLE);

        expect(fetchMock.mock.calls.length).toBeGreaterThan(probesBefore);

        // Settle both probes so their abort timers are cleared
        settle(false);
        await flushPromises();
    });

    it('fires onReconnect when NetInfo reports the internet reachable again', () => {
        const onReconnect = jest.fn();
        store.onReconnect(onReconnect);
        store.start();
        emit({ isConnected: false });

        emit({ isConnected: true, isInternetReachable: true });

        expect(store.isOffline).toBe(false);
        expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    it('fires onReconnect when a probe succeeds after being offline', async () => {
        const { settle } = mockPendingProbes();
        const onReconnect = jest.fn();
        store.onReconnect(onReconnect);
        store.start();
        emit({ isConnected: false });
        emit(UNREACHABLE);

        settle(true);
        await flushPromises();

        expect(store.isOffline).toBe(false);
        expect(onReconnect).toHaveBeenCalledTimes(1);
    });

    it('runs the remaining reconnect callbacks when one throws', () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const failing = jest.fn(() => {
            throw new Error('callback failed');
        });
        const next = jest.fn();
        store.onReconnect(failing);
        store.onReconnect(next);
        store.start();
        emit({ isConnected: false });

        emit({ isConnected: true, isInternetReachable: true });

        expect(failing).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(1);
        expect(store.isOffline).toBe(false);
    });

    it('runs the remaining reconnect callbacks when one throws after a probe', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const { settle } = mockPendingProbes();
        const failing = jest.fn(() => {
            throw new Error('callback failed');
        });
        const next = jest.fn();
        store.onReconnect(failing);
        store.onReconnect(next);
        store.start();
        emit({ isConnected: false });
        emit(UNREACHABLE);

        settle(true);
        await flushPromises();

        expect(next).toHaveBeenCalledTimes(1);
        expect(store.isOffline).toBe(false);
    });

    it('does not fire onReconnect when already online', () => {
        const onReconnect = jest.fn();
        store.onReconnect(onReconnect);
        store.start();

        emit({ isConnected: true, isInternetReachable: true });

        expect(onReconnect).not.toHaveBeenCalled();
    });

    it('does not start monitoring when the offline check is disabled', () => {
        jest.useFakeTimers();
        store = new ConnectivityStore({
            settings: { networking: { disableOfflineCheck: true } }
        } as any);

        store.start();
        jest.advanceTimersByTime(15000);

        expect(NetInfo.addEventListener).not.toHaveBeenCalled();
        expect(NetInfo.fetch).not.toHaveBeenCalled();
    });

    it('does not add a second listener or poll when started twice', () => {
        jest.useFakeTimers();

        store.start();
        store.start();
        jest.advanceTimersByTime(15000);

        expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
        expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
    });

    describe('checkNow', () => {
        // Probes that only settle when their abort signal fires
        const mockHangingProbes = () => {
            const fetchMock = jest.fn(
                (_url: string, { signal }: { signal: any }) =>
                    new Promise((_resolve, reject) =>
                        signal.addEventListener('abort', () =>
                            reject(new Error('aborted'))
                        )
                    )
            );
            global.fetch = fetchMock as any;
            return fetchMock;
        };

        it('marks offline when every probe fails', async () => {
            global.fetch = jest.fn(() =>
                Promise.reject(new Error('offline'))
            ) as any;

            await expect(store.checkNow()).resolves.toBe(false);

            expect(store.isOffline).toBe(true);
        });

        it('marks online and fires onReconnect when a probe succeeds after being offline', async () => {
            const onReconnect = jest.fn();
            store.onReconnect(onReconnect);
            store.start();
            emit({ isConnected: false });
            global.fetch = jest.fn(() => Promise.resolve({})) as any;

            await expect(store.checkNow()).resolves.toBe(true);

            expect(store.isOffline).toBe(false);
            expect(onReconnect).toHaveBeenCalledTimes(1);
        });

        it('gives up on probes after 1.5s and marks offline', async () => {
            jest.useFakeTimers();
            mockHangingProbes();

            const result = store.checkNow();
            jest.advanceTimersByTime(1499);
            expect(store.isOffline).toBe(false);
            jest.advanceTimersByTime(1);

            await expect(result).resolves.toBe(false);
            expect(store.isOffline).toBe(true);
        });

        it('does not probe when the offline check is disabled', async () => {
            const fetchMock = jest.fn();
            global.fetch = fetchMock as any;
            store = new ConnectivityStore({
                settings: { networking: { disableOfflineCheck: true } }
            } as any);

            await expect(store.checkNow()).resolves.toBe(true);

            expect(fetchMock).not.toHaveBeenCalled();
            expect(store.isOffline).toBe(false);
        });

        it('keeps a NetInfo-triggered check from probing while it runs', async () => {
            const { fetchMock, settle } = mockPendingProbes();
            store.start();

            const result = store.checkNow();
            emit(UNREACHABLE);
            settle(false);
            await result;

            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('ignores its result after monitoring stops', async () => {
            const { settle } = mockPendingProbes();
            store.start();

            const result = store.checkNow();
            store.stop();
            settle(false);

            await expect(result).resolves.toBe(false);
            expect(store.isOffline).toBe(false);
        });
    });

    it.each([
        ['the default host', {}, 'https://mempool.space/api/blocks/tip/height'],
        [
            'the selected block explorer',
            { defaultBlockExplorer: 'blockstream.info' },
            'https://blockstream.info/api/blocks/tip/height'
        ],
        [
            'a custom host without a scheme',
            {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'explorer.example.com'
            },
            'https://explorer.example.com/api/blocks/tip/height'
        ],
        [
            'a custom URL with a scheme and a fragment',
            {
                defaultBlockExplorer: 'Custom',
                customBlockExplorer: 'http://10.0.0.5:3006#mainnet'
            },
            'http://10.0.0.5:3006/api/blocks/tip/height'
        ]
    ])('checks reachability against %s', (_name, privacy, url) => {
        store = new ConnectivityStore({ settings: { privacy } } as any);

        store.start();

        expect(NetInfo.configure).toHaveBeenCalledWith(
            expect.objectContaining({ reachabilityUrl: url })
        );
    });
});
