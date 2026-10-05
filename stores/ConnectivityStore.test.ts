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

const flushPromises = () =>
    new Promise<void>((resolve) => setImmediate(resolve));

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

    it('ignores network events after monitoring stops', () => {
        store.start();
        store.stop();

        emit({ isConnected: false });

        expect(store.isOffline).toBe(false);
    });

    it('ignores a probe result that arrives after monitoring stops', async () => {
        let failProbes!: () => void;
        const pendingProbes = new Promise((_resolve, reject) => {
            failProbes = () => reject(new Error('offline'));
        });
        global.fetch = jest.fn(() => pendingProbes) as any;

        store.start();
        // Connected without internet: the store falls back to its own
        // reachability probes, which wait on the pending fetch above
        emit({ isConnected: true, isInternetReachable: false });
        store.stop();
        failProbes();
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
});
