// A refresh that outlives a wallet switch must stop without touching the
// newly selected wallet's state, on every backend (#2713, #4948). Runs the
// production Wallet/Settings methods and the real WalletRefreshRunner; node
// calls and stores are controlled.
jest.mock('../../utils/LocaleUtils');

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

// With realLogin, the login and session methods are the production ones
// instead of stubs, so a test can read sessionStarted() after startup
function setup(selectedNode: number, { realLogin = false } = {}) {
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
            'setInitialStart',
            ...(realLogin
                ? [
                      'loginRequired',
                      'loginMethodConfigured',
                      'isBiometryConfigured',
                      'setLoginStatus',
                      'setPosStatus',
                      'sessionStarted'
                  ]
                : [])
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
        errorMsg: '',
        loggedIn: false,
        posStatus: 'unselected'
    });
    settings.getSettings = jest.fn(async () => settings.settings);
    settings.setChannelMigrating = jest.fn();
    if (!realLogin) {
        settings.loginRequired = () => false;
        settings.setLoginStatus = jest.fn();
    }
    settings.updateSettings = jest.fn(async () => {});
    jest.spyOn(settings, 'setConnectingStatus');

    const repairMissingChannelEdges = jest.fn(async () => {});
    const LinkingUtils = {
        handleInitialUrl: jest.fn(),
        processPendingDeepLink: jest.fn()
    };
    const isWipePending = jest.fn(async () => false);
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['getSettingsAndNavigate', 'fetchData', 'fetchDataCore'],
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
            LinkingUtils,
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
            autoPurgeLegacyKeychain: jest.fn(),
            PosEnabled: { Disabled: 'disabled', Standalone: 'standalone' },
            repairMissingChannelEdges,
            isWipePending
        }
    );
    const view = new Wallet();
    view.props = {
        SettingsStore: settings,
        navigation: { navigate: jest.fn(), isFocused: () => true }
    };
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
    view.props.LSPStore.initFlowLSP = jest.fn();
    view.props.PosStore.getOrders = jest.fn();
    view.state = { initialLoad: false, unlocked: true };
    view.setState = (patch: any) => Object.assign(view.state, patch);
    view.processPendingShareIntent = jest.fn();
    view.processPendingGraphSyncPayment = jest.fn();
    const refresh = () => view.getSettingsAndNavigate();
    const runner = new WalletRefreshRunner(settings, () => true, refresh);
    return {
        settings,
        view,
        runner,
        refresh,
        ldk,
        lnd,
        repairMissingChannelEdges,
        LinkingUtils,
        isWipePending
    };
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

it('hands a wipe that did not finish to the Lockscreen before loading settings', async () => {
    const { settings, view, refresh, isWipePending } = setup(1);
    isWipePending.mockResolvedValue(true);
    view.props.navigation = { navigate: jest.fn() };
    await refresh();
    expect(view.props.navigation.navigate).toHaveBeenCalledWith('Lockscreen');
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(view.props.NodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
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

// An unreachable Flow LSP used to throw out of fetchDataCore and skip
// everything after it, including the initial deep link (#4779). The Flow
// setup now runs in LSPStore.initFlowLSP without being awaited
describe('Flow LSP startup', () => {
    it('sets up Flow LSP and still handles the initial deep link', async () => {
        const { view, runner, refresh, LinkingUtils } = setup(1);
        const { LSPStore } = view.props;
        // fails the refresh if fetchDataCore awaits it again
        LSPStore.getLSPInfo = jest.fn(() => Promise.reject());
        view.state.initialLoad = true;
        await runner.run(refresh);

        expect(LSPStore.initFlowLSP).toHaveBeenCalledTimes(1);
        expect(view.state.initialLoad).toBe(false);
        expect(LinkingUtils.handleInitialUrl).toHaveBeenCalledTimes(1);
        expect(LinkingUtils.processPendingDeepLink).toHaveBeenCalledTimes(1);
        expect(view.processPendingGraphSyncPayment).toHaveBeenCalledTimes(1);
    });
});

// Resetting or rebuilding the SQLite graph drops our own channel edges, so
// an embedded LND refresh repairs them once channels load (#4814). bbolt
// graphs and remote nodes never lose them
describe('channel edge repair', () => {
    const run = async (selectedNode: number, isSqlite: boolean | undefined) => {
        const ctx = setup(selectedNode);
        Object.assign(ctx.settings, { isSqlite, lndDir: 'c' });
        await ctx.runner.run(ctx.refresh);
        await flush();
        return ctx;
    };

    it('repairs the SQLite embedded LND wallet after channels load', async () => {
        const { view, repairMissingChannelEdges, settings } = await run(
            2,
            true
        );

        expect(repairMissingChannelEdges).toHaveBeenCalledTimes(1);
        expect(repairMissingChannelEdges).toHaveBeenCalledWith('c');
        expect(
            view.props.ChannelsStore.getChannelsWithPolling.mock
                .invocationCallOrder[0]
        ).toBeLessThan(repairMissingChannelEdges.mock.invocationCallOrder[0]);
        expect(settings.connecting).toBe(false);
    });

    it("falls back to the default 'lnd' directory", async () => {
        const ctx = setup(2);
        Object.assign(ctx.settings, { isSqlite: true, lndDir: undefined });
        await ctx.runner.run(ctx.refresh);
        await flush();

        expect(ctx.repairMissingChannelEdges).toHaveBeenCalledWith('lnd');
    });

    it.each([false, undefined])(
        'skips an embedded LND wallet with isSqlite %p',
        async (isSqlite) => {
            const { view, repairMissingChannelEdges } = await run(2, isSqlite);

            expect(
                view.props.ChannelsStore.getChannelsWithPolling
            ).toHaveBeenCalledTimes(1);
            expect(repairMissingChannelEdges).not.toHaveBeenCalled();
        }
    );

    it.each([
        [0, 'ldk-node'],
        [1, 'lnd'],
        [3, 'cln-rest']
    ])(
        'never repairs on %i (%s), even with a stale isSqlite',
        async (selectedNode) => {
            const { repairMissingChannelEdges } = await run(selectedNode, true);

            expect(repairMissingChannelEdges).not.toHaveBeenCalled();
        }
    );

    it('logs a rejected repair without failing the refresh', async () => {
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const ctx = setup(2);
        Object.assign(ctx.settings, { isSqlite: true, lndDir: 'c' });
        const error = new Error('graph locked');
        ctx.repairMissingChannelEdges.mockRejectedValueOnce(error);

        await ctx.runner.run(ctx.refresh);
        await flush();

        expect(errorSpy).toHaveBeenCalledWith(
            'Channel edge repair failed',
            error
        );
        expect(ctx.view.props.NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(
            1
        );
        expect(ctx.settings.connecting).toBe(false);
    });

    it('skips the repair when the wallet switched before channels loaded', async () => {
        const ctx = setup(2);
        Object.assign(ctx.settings, { isSqlite: true, lndDir: 'c' });
        const channels = deferred();
        ctx.view.props.ChannelsStore.getChannelsWithPolling.mockReturnValueOnce(
            channels.promise
        );
        const initial = ctx.runner.run(ctx.refresh);
        await flush();
        expect(
            ctx.view.props.ChannelsStore.getChannelsWithPolling
        ).toHaveBeenCalledTimes(1);

        select(ctx.settings, 1);
        channels.resolve();
        await initial;
        await flush();

        expect(ctx.repairMissingChannelEdges).not.toHaveBeenCalled();
    });
});

// protectedNavigation and the WalletHeader controls wait for
// SettingsStore.sessionStarted(). Startup is what makes it true on a wallet
// without a PIN, so these pin that down on the production startup path.
describe('session start', () => {
    it('starts the session on a wallet with no login method', async () => {
        const { settings, runner, refresh } = setup(1, { realLogin: true });
        expect(settings.sessionStarted()).toBe(false);

        await runner.run(refresh);

        expect(settings.loggedIn).toBe(true);
        expect(settings.sessionStarted()).toBe(true);
    });

    it('starts the session on a till with no login method', async () => {
        const { settings, runner, refresh } = setup(1, { realLogin: true });
        settings.settings = {
            ...settings.settings,
            pos: { posEnabled: 'standalone' }
        };

        await runner.run(refresh);

        expect(settings.posStatus).toBe('active');
        expect(settings.sessionStarted()).toBe(true);
    });

    it('leaves the session unstarted and opens the Lockscreen when a PIN is set', async () => {
        const { settings, view, runner, refresh } = setup(1, {
            realLogin: true
        });
        settings.settings = { ...settings.settings, pin: '1234' };

        await runner.run(refresh);

        expect(settings.loggedIn).toBe(false);
        expect(settings.sessionStarted()).toBe(false);
        expect(view.props.navigation.navigate).toHaveBeenCalledWith(
            'Lockscreen',
            { shareIntentData: undefined }
        );
    });
});
