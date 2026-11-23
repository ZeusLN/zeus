import NodeInfoStore from './NodeInfoStore';
import BackendUtils from '../utils/BackendUtils';
import Storage from '../storage';

jest.mock('./ChannelsStore', () => ({
    __esModule: true,
    default: class ChannelsStore {}
}));

const mockLspConfig = { flowHost: 'https://flow.test' };
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    getLspConfigForNetwork: jest.fn(() => mockLspConfig)
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getMyNodeInfo: jest.fn(),
        getNetworkInfo: jest.fn(),
        supportsOffers: jest.fn(() => false),
        supportsListingOffers: jest.fn(() => false),
        isLocalWallet: jest.fn(() => false)
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

const getMyNodeInfoMock = BackendUtils.getMyNodeInfo as jest.Mock;
const getNetworkInfoMock = BackendUtils.getNetworkInfo as jest.Mock;

// Resolves to { settled: true } if the promise settles within `ms`,
// { settled: false } otherwise. Used to detect orphaned promises
// without hanging the test. The tests run under fake timers and call
// jest.advanceTimersByTimeAsync, which flushes pending microtasks before
// the timeout fires, so the result does not depend on wall-clock timing.
const settlesWithin = (promise: Promise<any>, ms: number) =>
    Promise.race([
        promise.then(
            (value) => ({ settled: true, value }),
            (error) => ({ settled: true, error })
        ),
        new Promise<{ settled: false }>((resolve) =>
            setTimeout(() => resolve({ settled: false }), ms)
        )
    ]);

describe('NodeInfoStore.getNodeInfo', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        getMyNodeInfoMock.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('settles a superseded call when the shared request succeeds', async () => {
        // Both calls share one in-flight request, mirroring the
        // request-dedup cache in backends/LND.ts which keys
        // /v1/getinfo by bare URL.
        let resolveBackend: (data: any) => void = () => {};
        const backendPromise = new Promise((resolve) => {
            resolveBackend = resolve;
        });
        getMyNodeInfoMock.mockReturnValue(backendPromise);

        const store = new NodeInfoStore({} as any, {} as any);

        const superseded = store.getNodeInfo();
        const current = store.getNodeInfo();

        const currentSettled = settlesWithin(current, 200);
        const supersededSettled = settlesWithin(superseded, 200);

        resolveBackend({ identity_pubkey: 'pk1', version: '0.18.0-beta' });
        await jest.advanceTimersByTimeAsync(200);

        const currentResult = await currentSettled;
        expect(currentResult.settled).toBe(true);
        expect((currentResult as any).value.nodeId).toEqual('pk1');

        // Regression: before the fix, the success handler of a
        // superseded call bailed out without resolving, leaving this
        // promise pending forever (and, in the app, wedging Wallet's
        // fetchData on the connecting overlay).
        const supersededResult = await supersededSettled;
        expect(supersededResult.settled).toBe(true);
    });

    it('settles a superseded call when the shared request fails', async () => {
        let rejectBackend: (error: any) => void = () => {};
        const backendPromise = new Promise((_resolve, reject) => {
            rejectBackend = reject;
        });
        getMyNodeInfoMock.mockReturnValue(backendPromise);

        const store = new NodeInfoStore({} as any, {} as any);

        const superseded = store.getNodeInfo();
        const current = store.getNodeInfo();

        const supersededSettled = settlesWithin(superseded, 200);
        const currentSettled = settlesWithin(current, 200);

        rejectBackend(new Error('SOCKS: Connection refused'));
        await jest.advanceTimersByTimeAsync(200);

        const supersededResult = await supersededSettled;
        expect(supersededResult.settled).toBe(true);

        const currentResult = await currentSettled;
        expect(currentResult.settled).toBe(true);
        expect((currentResult as any).error).toBeDefined();
        expect(store.errorMsg).toBe('error.connectionRefused');
    });

    it('purges the legacy xprv cache on connect, with and without a pubkey', async () => {
        getMyNodeInfoMock.mockResolvedValue({
            identity_pubkey: 'pk1',
            version: '0.18.0-beta'
        });

        await new NodeInfoStore({} as any, {} as any).getNodeInfo();

        expect(Storage.removeItem).toHaveBeenCalledWith(
            'pk1-extended-private-keys'
        );
        // Older builds exporting before node info had loaded wrote this one
        expect(Storage.removeItem).toHaveBeenCalledWith(
            'undefined-extended-private-keys'
        );
    });
});

describe('NodeInfoStore.getNetworkInfo', () => {
    beforeEach(() => {
        getNetworkInfoMock.mockReset();
    });

    it('maps the error and resets state when the request fails', async () => {
        getNetworkInfoMock.mockRejectedValue(
            new Error('SOCKS: Host unreachable')
        );

        const store = new NodeInfoStore({} as any, {} as any);
        // Seed stale data so the assertion below proves the reset runs.
        store.networkInfo = { num_nodes: 1 };

        await expect(store.getNetworkInfo()).resolves.toBeUndefined();
        expect(store.errorMsg).toBe('error.hostUnreachable');
        expect(store.error).toBe(true);
        expect(store.loading).toBe(false);
        expect(store.networkInfo).toEqual({});
    });
});

describe('NodeInfoStore.flowLspNotConfigured', () => {
    const isLocalWallet = (BackendUtils as any).isLocalWallet as jest.Mock;
    const makeStore = (settingsStore: any, features: any = {}) => {
        const store = new NodeInfoStore({} as any, settingsStore);
        store.nodeInfo = { features, isRegTest: true };
        return store;
    };
    const flowReady = { '47': {}, '51': {} };

    beforeEach(() => {
        mockLspConfig.flowHost = 'https://flow.test';
        isLocalWallet.mockReturnValue(false);
    });

    it('reads the Flow host for the wallet settings and the node network', () => {
        const settingsStore = { implementation: 'lnd', settings: { a: 1 } };
        const store = makeStore(settingsStore);

        store.flowLspNotConfigured();

        expect(
            jest.requireMock('./SettingsStore').getLspConfigForNetwork
        ).toHaveBeenLastCalledWith(settingsStore.settings, store.nodeInfo);
    });

    it('is configured for an on-device wallet with a Flow host', () => {
        isLocalWallet.mockReturnValue(true);
        const store = makeStore({ implementation: 'ldk-node', settings: {} });

        expect(store.flowLspNotConfigured()).toMatchObject({
            flowLspNotConfigured: false,
            nodeNotConfigured: false
        });
    });

    it('is not configured for an on-device wallet on a network with no Flow host (#5681)', () => {
        mockLspConfig.flowHost = '';
        isLocalWallet.mockReturnValue(true);
        const store = makeStore({ implementation: 'ldk-node', settings: {} });

        // the node itself is ready; only the host is missing
        expect(store.flowLspNotConfigured()).toMatchObject({
            flowLspNotConfigured: true,
            nodeNotConfigured: false
        });
    });

    it('is not configured for a Flow-ready remote LND on a network with no Flow host (#5681)', () => {
        mockLspConfig.flowHost = '';
        const store = makeStore(
            { implementation: 'lnd', certVerification: true, settings: {} },
            flowReady
        );

        expect(store.flowLspNotConfigured()).toMatchObject({
            flowLspNotConfigured: true,
            nodeNotConfigured: false
        });
    });

    it('is configured for a Flow-ready remote LND with a Flow host', () => {
        const store = makeStore(
            { implementation: 'lnd', certVerification: true, settings: {} },
            flowReady
        );

        expect(store.flowLspNotConfigured().flowLspNotConfigured).toBe(false);
    });

    it('is not configured for a remote LND without zero-conf, whatever the host', () => {
        const store = makeStore(
            { implementation: 'lnd', certVerification: true, settings: {} },
            { '47': {} }
        );

        expect(store.flowLspNotConfigured()).toMatchObject({
            flowLspNotConfigured: true,
            nodeNotConfigured: true
        });
    });
});
