jest.mock('./BackendUtils', () => ({
    isConnected: jest.fn(),
    checkPerms: jest.fn(),
    supportsAccounts: jest.fn(),
    supportsChannelManagement: jest.fn()
}));

import BackendUtils from './BackendUtils';
import { fetchLncData } from './LncFetchUtils';

const backend = jest.mocked(BackendUtils);

const makeStores = () => {
    const SettingsStore = {
        error: false,
        errorMsg: '',
        connect: jest.fn(async (): Promise<string | undefined> => undefined),
        clearConnectError: jest.fn(() => {
            SettingsStore.error = false;
            SettingsStore.errorMsg = '';
        })
    };
    return {
        SettingsStore,
        NodeInfoStore: { getNodeInfo: jest.fn(async () => ({})) },
        UTXOsStore: { listAccounts: jest.fn(async () => []) },
        BalanceStore: { getCombinedBalance: jest.fn(async () => ({})) },
        ChannelsStore: { getChannels: jest.fn(async () => []) }
    };
};

describe('fetchLncData', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        backend.isConnected.mockResolvedValue(true);
        backend.checkPerms.mockResolvedValue(undefined);
        backend.supportsAccounts.mockReturnValue(true);
        backend.supportsChannelManagement.mockReturnValue(true);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('clears a stale connect error once a session that came up in the background serves the RPCs', async () => {
        const stores = makeStores();
        stores.SettingsStore.error = true;
        stores.SettingsStore.errorMsg = 'stores.SettingsStore.lncConnectError';

        expect(await fetchLncData(false, stores)).toBe(true);

        expect(stores.SettingsStore.connect).not.toHaveBeenCalled();
        expect(stores.NodeInfoStore.getNodeInfo).toHaveBeenCalled();
        expect(stores.SettingsStore.clearConnectError).toHaveBeenCalled();
        expect(stores.SettingsStore.error).toBe(false);
        expect(stores.SettingsStore.errorMsg).toBe('');
    });

    it('keeps the connect error when the RPCs fail', async () => {
        const stores = makeStores();
        stores.SettingsStore.error = true;
        stores.NodeInfoStore.getNodeInfo.mockRejectedValue(
            new Error('Session Not Found')
        );

        expect(await fetchLncData(false, stores)).toBe(false);

        expect(stores.SettingsStore.clearConnectError).not.toHaveBeenCalled();
        expect(stores.SettingsStore.error).toBe(true);
    });

    it('does not touch the store when there is no error', async () => {
        const stores = makeStores();

        expect(await fetchLncData(false, stores)).toBe(true);

        expect(stores.SettingsStore.clearConnectError).not.toHaveBeenCalled();
    });

    it('connects and skips the RPCs when connect() reports an error', async () => {
        const stores = makeStores();
        backend.isConnected.mockResolvedValue(false);
        stores.SettingsStore.connect.mockResolvedValue(
            'stores.SettingsStore.lncConnectError'
        );

        expect(await fetchLncData(false, stores)).toBe(true);

        expect(stores.SettingsStore.connect).toHaveBeenCalledTimes(1);
        expect(stores.NodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
    });

    it('treats a connect() throw as a connect error', async () => {
        const stores = makeStores();
        backend.isConnected.mockResolvedValue(false);
        stores.SettingsStore.connect.mockRejectedValue(
            new Error('keychain read failed')
        );

        expect(await fetchLncData(false, stores)).toBe(true);

        expect(stores.NodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
    });

    it('connects on a wallet switch even when a session is live', async () => {
        const stores = makeStores();

        expect(await fetchLncData(true, stores)).toBe(true);

        expect(stores.SettingsStore.connect).toHaveBeenCalledTimes(1);
        expect(backend.isConnected).not.toHaveBeenCalled();
        expect(stores.NodeInfoStore.getNodeInfo).toHaveBeenCalled();
    });

    it.each([undefined, 'old timeout'])(
        'stops a stale connection before fetching node data (result: %s)',
        async (result) => {
            const stores = makeStores();
            let current = true;
            stores.SettingsStore.connect.mockImplementation(async () => {
                current = false;
                return result;
            });
            expect(await fetchLncData(true, stores, () => current)).toBe(false);
            expect(backend.checkPerms).not.toHaveBeenCalled();
            expect(stores.NodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
            expect(
                stores.SettingsStore.clearConnectError
            ).not.toHaveBeenCalled();
        }
    );

    it('does not start a connect after a stale connection probe', async () => {
        const stores = makeStores();
        let current = true;
        backend.isConnected.mockImplementationOnce(async () => {
            current = false;
            return false;
        });
        expect(await fetchLncData(false, stores, () => current)).toBe(false);
        expect(stores.SettingsStore.connect).not.toHaveBeenCalled();
    });

    it('stops the remaining refresh after a wallet switch during node info', async () => {
        const stores = makeStores();
        let current = true;
        stores.NodeInfoStore.getNodeInfo.mockImplementation(async () => {
            current = false;
            return {};
        });
        expect(await fetchLncData(false, stores, () => current)).toBe(false);
        expect(stores.UTXOsStore.listAccounts).not.toHaveBeenCalled();
        expect(stores.BalanceStore.getCombinedBalance).not.toHaveBeenCalled();
        expect(stores.SettingsStore.clearConnectError).not.toHaveBeenCalled();
    });

    it('skips accounts and channels when the backend does not support them', async () => {
        const stores = makeStores();
        backend.supportsAccounts.mockReturnValue(false);
        backend.supportsChannelManagement.mockReturnValue(false);

        expect(await fetchLncData(false, stores)).toBe(true);

        expect(stores.UTXOsStore.listAccounts).not.toHaveBeenCalled();
        expect(stores.ChannelsStore.getChannels).not.toHaveBeenCalled();
        expect(stores.BalanceStore.getCombinedBalance).toHaveBeenCalled();
    });
});
