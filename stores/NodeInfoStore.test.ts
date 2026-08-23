import NodeInfoStore from './NodeInfoStore';
import BackendUtils from '../utils/BackendUtils';

jest.mock('./ChannelsStore', () => ({
    __esModule: true,
    default: class ChannelsStore {}
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {}
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getMyNodeInfo: jest.fn(),
        supportsOffers: jest.fn(() => false),
        supportsListingOffers: jest.fn(() => false)
    }
}));

jest.mock('../utils/ErrorUtils', () => ({
    __esModule: true,
    errorToUserFriendly: (error: string) => error
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async () => false),
        setItem: jest.fn(async () => {}),
        removeItem: jest.fn(async () => {})
    }
}));

const getMyNodeInfoMock = BackendUtils.getMyNodeInfo as jest.Mock;

// Resolves to { settled: true } if the promise settles within `ms`,
// { settled: false } otherwise. Used to detect orphaned promises
// without hanging the test.
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
        getMyNodeInfoMock.mockReset();
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

        resolveBackend({ identity_pubkey: 'pk1', version: '0.18.0-beta' });

        const currentResult = await settlesWithin(current, 200);
        expect(currentResult.settled).toBe(true);
        expect((currentResult as any).value.nodeId).toEqual('pk1');

        // Regression: before the fix, the success handler of a
        // superseded call bailed out without resolving, leaving this
        // promise pending forever (and, in the app, wedging Wallet's
        // fetchData on the connecting overlay).
        const supersededResult = await settlesWithin(superseded, 200);
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

        rejectBackend(new Error('connection refused'));

        const supersededResult = await settlesWithin(superseded, 200);
        expect(supersededResult.settled).toBe(true);

        const currentResult = await settlesWithin(current, 200);
        expect(currentResult.settled).toBe(true);
        expect((currentResult as any).error).toBeDefined();
    });
});
