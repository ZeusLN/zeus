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
        mockListeners.clear();
        store = new ConnectivityStore({ settings: {} } as any);
    });

    afterEach(() => {
        store.stop();
        global.fetch = originalFetch;
        jest.useRealTimers();
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

    it('probes again after a restart while the old probe is pending', () => {
        const { fetchMock } = mockPendingProbes();
        store.start();
        emit(UNREACHABLE);
        const probesBefore = fetchMock.mock.calls.length;

        store.stop();
        store.start();
        emit(UNREACHABLE);

        expect(fetchMock.mock.calls.length).toBeGreaterThan(probesBefore);
    });
});
