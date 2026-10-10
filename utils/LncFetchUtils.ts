import BackendUtils from './BackendUtils';

interface LncFetchStores {
    SettingsStore: {
        error: boolean;
        connect: () => Promise<string | undefined>;
        clearConnectError: () => void;
    };
    NodeInfoStore: { getNodeInfo: () => Promise<any> };
    UTXOsStore: { listAccounts: () => Promise<any> };
    BalanceStore: { getCombinedBalance: () => Promise<any> };
    ChannelsStore: { getChannels: () => Promise<any> };
}

// The LNC branch of the Wallet's fetchDataCore. Resolves false when
// connect() reported an error or the node calls failed, so the caller
// stops there. The connect error is already on SettingsStore for the error
// screen; running the rest of the fetch without node info would send the
// ZEUS Pay calls an undefined pubkey.
export const fetchLncData = async (
    connecting: boolean,
    stores: LncFetchStores
): Promise<boolean> => {
    const {
        SettingsStore,
        NodeInfoStore,
        UTXOsStore,
        BalanceStore,
        ChannelsStore
    } = stores;

    let error;
    // An LNC session can die while the app is suspended or offline.
    // isConnected checks the mailbox session, not only that a
    // connection was once established, so a dead session goes
    // through connect(), which prompts the native client's own
    // redial (or starts a dial if there is none) and reports an
    // error after its budget instead of every call below timing out.
    const reconnectNeeded = connecting || !(await BackendUtils.isConnected());
    if (reconnectNeeded) {
        try {
            error = await SettingsStore.connect();
        } catch (connectError: any) {
            console.log('LNC connect failed:', connectError);
            error = connectError?.message ?? String(connectError);
        }
    }
    if (error) return false;

    try {
        await BackendUtils.checkPerms();
        await NodeInfoStore.getNodeInfo();
        if (BackendUtils.supportsAccounts()) await UTXOsStore.listAccounts();
        await BalanceStore.getCombinedBalance();
        if (BackendUtils.supportsChannelManagement())
            await ChannelsStore.getChannels();
        // The session may have come up in the background after an
        // earlier connect() timed out and left its error set
        if (SettingsStore.error) {
            SettingsStore.clearConnectError();
        }
    } catch (connectionError) {
        console.log('LNC connection failed:', connectionError);
        return false;
    }
    return true;
};
