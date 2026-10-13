// A refresh that outlives a wallet switch must stop without touching the
// newly selected wallet's state, on every backend (#2713, #4948). Runs the
// production Wallet/Settings methods and the real WalletRefreshRunner; node
// calls and stores are controlled.
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));

import WalletRefreshRunner from '../../utils/WalletRefreshRunner';
import {
    LndErrorCode,
    isLndError,
    isTransientRpcError,
    matchesLndErrorCode,
    retryOnTransientError
} from '../../utils/LndMobileErrors';
import { sourceMethods } from '../../backends/lncTestUtils';

const deferred = <T = void>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: any) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const nodes = [
    { implementation: 'ldk-node', ldkMnemonic: 'm', ldkNodeDir: 'a' },
    { implementation: 'lnd', host: 'b' },
    { implementation: 'embedded-lnd', lndDir: 'c' },
    { implementation: 'cln-rest', host: 'd' }
];

function setup(selectedNode: number) {
    const BackendUtils = {
        supportsAccounts: () => false,
        supportsLightningAddress: () => false,
        supportsCashuWallet: () => false,
        supportsFlowLSP: () => false,
        supportsNostrWalletConnectService: () => false,
        clearCachedCalls: () => {}
    };
    const ldk = {
        stopLdkNode: jest.fn(async () => {}),
        startLdkNodeWallet: jest.fn(),
        waitForLdkNodeReady: jest.fn(async () => {})
    };
    const lnd = {
        stopLnd: jest.fn(async () => {}),
        initializeLnd: jest.fn(async () => {}),
        startLnd: jest.fn(),
        waitForRpcReady: jest.fn(async () => {})
    };
    const Settings = sourceMethods(
        'stores/SettingsStore.ts',
        'SettingsStore',
        [
            'getConnectionGuard',
            'setConnectingStatus',
            'acquireFetchLock',
            'releaseFetchLock',
            'setInitialStart'
        ],
        { BackendUtils }
    );
    const settings = new Settings();
    Object.assign(settings, {
        settings: {
            nodes,
            selectedNode,
            lightningAddress: { enabled: false },
            ecash: { enableCashu: false }
        },
        implementation: nodes[selectedNode].implementation,
        connecting: true,
        fetchLock: false,
        fetchLockSeq: 0,
        connectionSeq: 0,
        triggerSettingsRefresh: false,
        // read from the store, not the node entry
        ldkMnemonic: 'm',
        ldkNodeDir: 'a',
        error: false,
        errorMsg: ''
    });
    settings.getSettings = jest.fn(async () => settings.settings);
    settings.setChannelMigrating = jest.fn();
    settings.loginRequired = () => false;
    settings.setLoginStatus = jest.fn();
    settings.updateSettings = jest.fn(async () => {});
    jest.spyOn(settings, 'setConnectingStatus');

    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        [
            'getSettingsAndNavigate',
            'fetchData',
            'fetchDataCore',
            'retryConnection'
        ],
        {
            BackendUtils,
            ...ldk,
            ...lnd,
            getLspConfigForNetwork: () => ({}),
            DEFAULT_SCORER_URL: 'scorer',
            DEFAULT_VSS_SERVER: 'vss',
            localeString: (s: string) => s,
            isBatterySaverEnabled: async () => false,
            expressGraphSync: async () => ({ resetFailed: false }),
            LndErrorCode,
            isLndError,
            isTransientRpcError,
            matchesLndErrorCode,
            retryOnTransientError,
            restartNeeded: jest.fn(),
            LinkingUtils: { processPendingDeepLink: jest.fn() },
            Storage: { getItem: async () => false },
            CHANNEL_MIGRATION_ACTIVE: 'test-migration-flag',
            processSharedQRImageFast: async () => null,
            Platform: { OS: 'ios' },
            SystemNavigationBar: {
                setNavigationColor: jest.fn(),
                setNavigationBarDividerColor: jest.fn()
            },
            themeColor: () => '#000',
            isLightTheme: () => false,
            autoPurgeLegacyKeychain: jest.fn()
        }
    );
    const view = new Wallet();
    view.props = { SettingsStore: settings };
    for (const name of [
        'AlertStore',
        'NodeInfoStore',
        'BalanceStore',
        'CashuStore',
        'ChannelsStore',
        'TransactionsStore',
        'UTXOsStore',
        'ContactStore',
        'PosStore',
        'FiatStore',
        'LSPStore',
        'ChannelBackupStore',
        'SyncStore',
        'LightningAddressStore',
        'LnurlPayStore',
        'NotesStore',
        'SwapStore',
        'NostrWalletConnectStore',
        'UnitsStore'
    ])
        view.props[name] = { reset: jest.fn() };
    const { AlertStore, NodeInfoStore, BalanceStore, ChannelsStore } =
        view.props;
    AlertStore.setRgsError = jest.fn();
    AlertStore.checkNeutrinoPeers = jest.fn();
    NodeInfoStore.getNodeInfo = jest.fn(async () => {});
    NodeInfoStore.getNetworkInfo = jest.fn();
    NodeInfoStore.handleGetNodeInfoError = jest.fn();
    BalanceStore.getCombinedBalance = jest.fn(async () => {});
    ChannelsStore.getChannels = jest.fn(async () => {});
    ChannelsStore.getChannelsWithPolling = jest.fn(async () => {});
    view.props.UTXOsStore.listAccounts = jest.fn(async () => {});
    view.props.SyncStore.checkRecoveryStatus = jest.fn();
    view.props.SyncStore.isSyncing = false;
    view.props.ContactStore.loadContacts = jest.fn();
    view.props.NotesStore.loadNoteKeys = jest.fn();
    view.props.UnitsStore.getUnits = jest.fn();
    view.props.SwapStore.fetchAndUpdateSwaps = jest.fn();
    view.state = { initialLoad: false, unlocked: true };
    view.setState = (patch: any) => Object.assign(view.state, patch);
    view.processPendingShareIntent = jest.fn();
    view.processPendingGraphSyncPayment = jest.fn();
    const refresh = () => view.getSettingsAndNavigate();
    const runner = new WalletRefreshRunner(settings, () => true, refresh);
    return { settings, view, runner, refresh, ldk, lnd };
}

// What Wallets does on selection, once its settings write has committed
const select = (settings: any, index: number) => {
    settings.settings = { ...settings.settings, selectedNode: index };
    settings.implementation = nodes[index].implementation;
    settings.setConnectingStatus(true);
    settings.triggerSettingsRefresh = true;
};

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const flush = () => new Promise((resolve) => setImmediate(resolve));

it('control: a refresh with no switch connects and clears connecting', async () => {
    const { settings, view, runner, refresh } = setup(1);
    await runner.run(refresh);
    expect(view.props.NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(1);
    expect(view.props.ChannelsStore.getChannels).toHaveBeenCalledTimes(1);
    expect(settings.connecting).toBe(false);
});

it('switching away from a loading LDK Node leaves its alerts and connect to the next wallet', async () => {
    const { settings, view, runner, refresh, ldk } = setup(0);
    const ldkStart = deferred<any>();
    ldk.startLdkNodeWallet.mockReturnValue(ldkStart.promise);
    const initial = runner.run(refresh);
    await flush();
    expect(ldk.startLdkNodeWallet).toHaveBeenCalledTimes(1);

    select(settings, 1);
    // dropped: the LDK refresh is still in flight
    expect(runner.run(refresh)).toBeUndefined();
    ldkStart.resolve({ rgsError: 'rgs unreachable' });
    await initial;

    const { AlertStore, NodeInfoStore, ChannelsStore } = view.props;
    expect(AlertStore.setRgsError).not.toHaveBeenCalled();
    expect(ldk.waitForLdkNodeReady).not.toHaveBeenCalled();
    // only B's follow-up clears connecting, after its own reset and connect
    expect(settings.setConnectingStatus.mock.calls).toEqual([[true], [false]]);
    expect(AlertStore.reset).toHaveBeenCalledTimes(2);
    expect(view.props.CashuStore.reset).toHaveBeenCalledTimes(2);
    expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(1);
    expect(ChannelsStore.getChannels).toHaveBeenCalledTimes(1);
    expect(settings.connecting).toBe(false);
});

it("a remote node's late failure does not end the next wallet's connect", async () => {
    const { settings, view, runner, refresh } = setup(1);
    const { NodeInfoStore } = view.props;
    const nodeInfo = deferred();
    NodeInfoStore.getNodeInfo
        .mockReturnValueOnce(nodeInfo.promise)
        .mockResolvedValue(undefined);
    const initial = runner.run(refresh);
    await flush();

    select(settings, 3);
    nodeInfo.reject(new Error('request timed out'));
    await initial;

    expect(NodeInfoStore.handleGetNodeInfoError).not.toHaveBeenCalled();
    expect(settings.setConnectingStatus.mock.calls).toEqual([[true], [false]]);
    expect(view.props.AlertStore.reset).toHaveBeenCalledTimes(2);
    expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(2);
    expect(view.props.ChannelsStore.getChannels).toHaveBeenCalledTimes(1);
    expect(settings.connecting).toBe(false);
});

it('a transient embedded LND retry stops once another wallet is selected', async () => {
    jest.useFakeTimers();
    try {
        const { settings, view, runner, refresh, lnd } = setup(2);
        lnd.startLnd.mockRejectedValueOnce(
            new Error('RPC server is in the process of starting up')
        );
        const initial = runner.run(refresh);
        await jest.advanceTimersByTimeAsync(0);
        expect(lnd.startLnd).toHaveBeenCalledTimes(1);
        // the retry left connecting mode and is sleeping before it redials
        expect(settings.connecting).toBe(false);

        select(settings, 1);
        await jest.advanceTimersByTimeAsync(2000);
        await initial;

        // no redial of the old wallet; B's follow-up connected instead
        expect(lnd.startLnd).toHaveBeenCalledTimes(1);
        expect(settings.setConnectingStatus.mock.calls).toEqual([
            [false],
            [true],
            [false]
        ]);
        expect(view.props.AlertStore.reset).toHaveBeenCalledTimes(2);
        expect(view.props.ChannelsStore.getChannels).toHaveBeenCalledTimes(1);
        expect(settings.connecting).toBe(false);
    } finally {
        jest.useRealTimers();
    }
});

it('Retry during a transient embedded LND retry connects only once', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        const { settings, view, runner, refresh, lnd } = setup(2);
        const { NodeInfoStore } = view.props;
        NodeInfoStore.getNodeInfo
            .mockRejectedValueOnce(
                new Error('RPC server is in the process of starting up')
            )
            .mockResolvedValue(undefined);
        const initial = runner.run(refresh);
        await jest.advanceTimersByTimeAsync(0);
        expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(1);
        // the retry left connecting mode, so the error screen and its
        // Retry show while it sleeps before redialing
        expect(settings.connecting).toBe(false);

        await view.retryConnection();

        // Retry connected right away, without waiting out the backoff
        expect(lnd.startLnd).toHaveBeenCalledTimes(2);
        expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(2);
        expect(settings.connecting).toBe(false);

        await jest.advanceTimersByTimeAsync(2000);
        await initial;

        // the queued retry stopped instead of restarting LND again
        expect(lnd.startLnd).toHaveBeenCalledTimes(2);
        expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(2);
        expect(settings.setConnectingStatus.mock.calls).toEqual([
            [false],
            [true],
            [false]
        ]);
        expect(view.props.AlertStore.reset).toHaveBeenCalledTimes(2);
        expect(settings.connecting).toBe(false);
    } finally {
        jest.useRealTimers();
    }
});
