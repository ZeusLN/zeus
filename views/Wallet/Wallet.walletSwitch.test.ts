// A refresh that outlives a wallet switch must stop without touching the
// newly selected wallet's state, on every backend (#2713, #4948). Runs the
// production Wallet/Settings methods and the real WalletRefreshRunner; node
// calls and stores are controlled.
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/LockKdf');

import WalletRefreshRunner from '../../utils/WalletRefreshRunner';
import {
    LndErrorCode,
    isLndError,
    isTransientRpcError,
    matchesLndErrorCode,
    retryOnTransientError
} from '../../utils/LndMobileErrors';
import { sourceMethods } from '../../backends/lncTestUtils';
import { deriveVerifier, hasVerifier } from '../../utils/LockVerifierUtils';
import * as WalletRecoveryUtils from '../../utils/WalletRecoveryUtils';

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
    { implementation: 'cln-rest', host: 'd' },
    { implementation: 'ldk-node', ldkMnemonic: 'm2', ldkNodeDir: 'e' }
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
        // loginMethodConfigured checks the stored verifiers with hasVerifier
        { BackendUtils, hasVerifier }
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
    const processPendingNwcActivityLink = jest.fn();
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        [
            'getSettingsAndNavigate',
            'fetchData',
            'fetchDataCore',
            'retryConnection',
            'handleFocus'
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
            LinkingUtils,
            processPendingNwcActivityLink,
            Storage: { getItem: async () => false, setItem: async () => {} },
            CHANNEL_MIGRATION_ACTIVE: 'test-migration-flag',
            IS_BACKED_UP_KEY: 'backup-complete-v2',
            processSharedQRImageFast: async () => null,
            Platform: { OS: 'ios' },
            applySystemNavigationBarTheme: jest.fn(),
            themeColor: () => '#000',
            isLightTheme: () => false,
            autoPurgeLegacyKeychain: jest.fn(),
            PosEnabled: { Disabled: 'disabled', Standalone: 'standalone' },
            repairMissingChannelEdges,
            isWipePending,
            BackHandler: { addEventListener: () => ({ remove: () => {} }) },
            ...WalletRecoveryUtils
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
        BackendUtils,
        settings,
        view,
        runner,
        refresh,
        ldk,
        lnd,
        repairMissingChannelEdges,
        LinkingUtils,
        isWipePending,
        processPendingNwcActivityLink
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

it('hands a wipe that did not finish to the Lockscreen before connecting', async () => {
    const { settings, view, refresh, isWipePending } = setup(1);
    isWipePending.mockResolvedValue(true);
    view.props.navigation = { navigate: jest.fn() };
    await refresh();
    expect(view.props.navigation.navigate).toHaveBeenCalledWith('Lockscreen');
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(view.props.NodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
});

it('a second launch refresh does not connect once the Lockscreen is running the wipe', async () => {
    const { settings, view, refresh, isWipePending } = setup(1);
    // the second check runs while clearAllData() is in progress, which
    // isWipePending() does not report
    isWipePending.mockResolvedValueOnce(true).mockResolvedValue(false);
    view.props.navigation = { navigate: jest.fn() };
    await refresh();
    await refresh();
    expect(view.props.navigation.navigate.mock.calls).toEqual([
        ['Lockscreen'],
        ['Lockscreen']
    ]);
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
        const {
            view,
            runner,
            refresh,
            LinkingUtils,
            processPendingNwcActivityLink
        } = setup(1);
        const { LSPStore } = view.props;
        // fails the refresh if fetchDataCore awaits it again
        LSPStore.getLSPInfo = jest.fn(() => Promise.reject());
        view.state.initialLoad = true;
        await runner.run(refresh);

        expect(LSPStore.initFlowLSP).toHaveBeenCalledTimes(1);
        expect(view.state.initialLoad).toBe(false);
        expect(LinkingUtils.handleInitialUrl).toHaveBeenCalledTimes(1);
        expect(LinkingUtils.processPendingDeepLink).toHaveBeenCalledTimes(1);
        expect(processPendingNwcActivityLink).toHaveBeenCalledTimes(1);
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
        settings.settings = {
            ...settings.settings,
            // a fixed salt: the test env has no native randombytes
            pinVerifier: await deriveVerifier('1234', Buffer.alloc(16, 1))
        };

        await runner.run(refresh);

        expect(settings.loggedIn).toBe(false);
        expect(settings.sessionStarted()).toBe(false);
        expect(view.props.navigation.navigate).toHaveBeenCalledWith(
            'Lockscreen',
            { shareIntentData: undefined }
        );
    });
});

// The error screen's Retry (retryConnection) reconnects in place, so it has
// to redo the full connect: reset the stores, restart an on-device node and
// clear the connect error
describe('error-screen Retry', () => {
    it('reconnects a remote node after a failed connect', async () => {
        const { settings, view, runner, refresh } = setup(1);
        const { NodeInfoStore } = view.props;
        NodeInfoStore.getNodeInfo
            .mockRejectedValueOnce(new Error('request timed out'))
            .mockResolvedValue(undefined);
        await runner.run(refresh);
        expect(NodeInfoStore.handleGetNodeInfoError).toHaveBeenCalledTimes(1);
        expect(settings.connecting).toBe(false);

        await view.retryConnection();

        expect(NodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(2);
        expect(NodeInfoStore.reset).toHaveBeenCalledTimes(2);
        expect(settings.setConnectingStatus.mock.calls).toEqual([
            [false],
            [true],
            [false]
        ]);
        expect(settings.connecting).toBe(false);
    });

    it('restarts LDK Node and clears the error after a VSS failure', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { settings, view, runner, refresh, ldk } = setup(0);
        ldk.startLdkNodeWallet
            .mockRejectedValueOnce(
                Object.assign(new Error('VSS unreachable'), {
                    code: 'vss_error'
                })
            )
            .mockResolvedValue({});
        await runner.run(refresh);
        expect(settings.error).toBe(true);
        expect(settings.connecting).toBe(false);

        await view.retryConnection();

        expect(settings.error).toBe(false);
        expect(ldk.stopLdkNode).toHaveBeenCalledTimes(2);
        expect(ldk.startLdkNodeWallet).toHaveBeenCalledTimes(2);
        expect(ldk.waitForLdkNodeReady).toHaveBeenCalledTimes(1);
        expect(settings.connecting).toBe(false);
    });

    it('connects only once during a transient embedded LND retry', async () => {
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
});

// Wallet.handleFocus syncs CDK balances and checks pending ecash items. After
// a wallet switch the focus from popTo('Wallet') arrives before the connect
// runs CashuStore.reset(), while cdkInitialized is still true from the
// outgoing wallet and native CDK still holds that wallet's handles. Uses the
// production CashuStore methods with native CDK controlled.
describe('Cashu work on focus', () => {
    const MINT_A = 'https://mint.a';

    const cashuSetup = (selectedNode: number) => {
        const ctx = setup(selectedNode);
        ctx.BackendUtils.supportsCashuWallet = () => true;
        ctx.settings.settings = {
            ...ctx.settings.settings,
            ecash: { enableCashu: true }
        };
        const CashuDevKit = {
            getBalances: jest.fn(async () => ({ [MINT_A]: 500 })),
            getTotalBalance: jest.fn(async () => 500)
        };
        const Cashu = sourceMethods(
            'stores/CashuStore.ts',
            'CashuStore',
            [
                'normalizeMintUrl',
                'syncCDKBalances',
                'checkPendingItems',
                'reset'
            ],
            {
                CashuDevKit,
                runWhenIdle: (fn: () => unknown) => fn(),
                activityStore: { getSortedActivity: jest.fn() }
            }
        );
        const cashu = new Cashu();
        // the selected wallet's CDK is initialized and has a pending invoice
        Object.assign(cashu, {
            cdkInitialized: true,
            mintUrls: [MINT_A],
            invoices: [
                {
                    quote: 'quote-a',
                    mintUrl: MINT_A,
                    isPaid: false,
                    isExpired: false
                }
            ],
            sentTokens: [],
            addedMintsCache: new Map(),
            mintInfoCache: new Map(),
            sagaRecoveryDone: new Set(),
            sagaRecoveryAttempts: new Map(),
            sagaRecoveryLastAttempt: new Map(),
            walletSession: 0,
            // each of these reaches native CDK
            checkInvoicePaid: jest.fn(async () => {}),
            checkTokenSpent: jest.fn(async () => false),
            reconcilePendingMelts: jest.fn(async () => {}),
            recoverIncompleteSagas: jest.fn(async () => {}),
            clearInvoice: jest.fn(),
            clearPayReq: jest.fn(),
            stopConnectivityMonitoring: jest.fn(),
            initializeWallets: jest.fn(async () => {
                cashu.cdkInitialized = true;
            }),
            checkAndSweepMints: jest.fn(),
            checkAndShowUpgradeModal: jest.fn()
        });
        jest.spyOn(cashu, 'reset');
        Object.assign(ctx.view, {
            refreshRunner: ctx.runner,
            handleBackButton: () => false,
            tabNavigationRef: { current: null }
        });
        ctx.view.props.CashuStore = cashu;
        // the selected wallet finished connecting
        ctx.settings.connecting = false;
        const run = jest.spyOn(ctx.runner, 'run');
        return { ...ctx, cashu, CashuDevKit, run };
    };

    it("does not touch the outgoing wallet's CDK when focus follows a switch", async () => {
        const { settings, view, cashu, CashuDevKit, run } = cashuSetup(0);
        select(settings, 4);
        Object.assign(settings, { ldkMnemonic: 'm2', ldkNodeDir: 'e' });

        view.handleFocus();
        // the focus started the connect to the selected wallet
        expect(run).toHaveBeenCalledTimes(1);
        await run.mock.results[0].value;
        await flush();

        expect(CashuDevKit.getBalances).not.toHaveBeenCalled();
        expect(CashuDevKit.getTotalBalance).not.toHaveBeenCalled();
        expect(cashu.checkInvoicePaid).not.toHaveBeenCalled();
        expect(cashu.checkTokenSpent).not.toHaveBeenCalled();
        expect(cashu.reconcilePendingMelts).not.toHaveBeenCalled();
        expect(cashu.recoverIncompleteSagas).not.toHaveBeenCalled();
        // the connect reset CashuStore and initialized the selected wallet
        expect(cashu.reset).toHaveBeenCalledTimes(1);
        expect(cashu.initializeWallets).toHaveBeenCalledTimes(1);
        expect(cashu.mintBalances).toEqual({});
        expect(cashu.cdkInitialized).toBe(true);
        expect(settings.connecting).toBe(false);
    });

    it('syncs balances and checks pending items on a focus with no switch', async () => {
        const { view, cashu, CashuDevKit, run } = cashuSetup(0);

        view.handleFocus();
        await flush();

        expect(run).not.toHaveBeenCalled();
        expect(CashuDevKit.getBalances).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.getTotalBalance).toHaveBeenCalledTimes(1);
        expect(cashu.mintBalances).toEqual({ [MINT_A]: 500 });
        expect(cashu.checkInvoicePaid).toHaveBeenCalledWith('quote-a', MINT_A);
        expect(cashu.reconcilePendingMelts).toHaveBeenCalledTimes(1);
        expect(cashu.recoverIncompleteSagas).toHaveBeenCalledTimes(1);
        expect(cashu.reset).not.toHaveBeenCalled();
    });

    it('syncs on a settings refresh that does not reconnect', async () => {
        const { settings, view, CashuDevKit, cashu, run } = cashuSetup(0);
        settings.triggerSettingsRefresh = true;

        view.handleFocus();
        await run.mock.results[0].value;
        await flush();

        expect(CashuDevKit.getBalances).toHaveBeenCalledTimes(1);
        expect(cashu.checkInvoicePaid).toHaveBeenCalledWith('quote-a', MINT_A);
        expect(cashu.reset).not.toHaveBeenCalled();
    });
});

// A restored wallet's pending recovery (fetching its channel backup) must
// survive other wallets connecting in between, or the restored wallet later
// starts as an ordinary wallet without its channels
describe('recovery after a restore from seed', () => {
    const run = async (
        selectedNode: number,
        recoverySettings: Record<string, any>,
        recoverError?: Error,
        storeState: Record<string, any> = {},
        // Settings another write puts in place just before the first
        // update of this connect runs
        landsFirst?: Record<string, any>
    ) => {
        const ctx = setup(selectedNode);
        Object.assign(ctx.settings, {
            lndDir: 'c',
            ldkNodeDir: 'a',
            ...storeState
        });
        ctx.view.props.SyncStore.startSyncing = jest.fn();
        if (nodes[selectedNode].implementation === 'ldk-node') {
            ctx.settings.lndDir = undefined;
        }
        ctx.settings.settings = {
            ...ctx.settings.settings,
            ...recoverySettings
        };
        ctx.settings.updateSettings = jest.fn(async (patch: any) => {
            if (landsFirst) {
                ctx.settings.settings = {
                    ...ctx.settings.settings,
                    ...landsFirst
                };
                landsFirst = undefined;
            }
            const update =
                typeof patch === 'function'
                    ? patch(ctx.settings.settings)
                    : patch;
            ctx.settings.settings = { ...ctx.settings.settings, ...update };
            return ctx.settings.settings;
        });
        const { ChannelBackupStore } = ctx.view.props;
        ChannelBackupStore.recoverStaticChannelBackup = jest.fn(async () => {
            if (recoverError) throw recoverError;
        });
        ChannelBackupStore.initSubscribeChannelEvents = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        await ctx.runner.run(ctx.refresh);
        await flush();
        const { recovery, recoveryWalletDirs } = ctx.settings.settings;
        return { ...ctx, recovery, recoveryWalletDirs, ChannelBackupStore };
    };

    it('an LDK Node wallet leaves the pending recovery of another wallet', async () => {
        const { recovery, recoveryWalletDirs } = await run(0, {
            recovery: true,
            recoveryWalletDirs: ['c']
        });
        expect(recovery).toBe(true);
        expect(recoveryWalletDirs).toEqual(['c']);
    });

    it('a restored LDK Node wallet clears only its own entry', async () => {
        const { recovery, recoveryWalletDirs } = await run(0, {
            recovery: true,
            recoveryWalletDirs: ['c', 'a']
        });
        expect(recovery).toBe(true);
        expect(recoveryWalletDirs).toEqual(['c']);
    });

    it('a restored embedded LND wallet recovers and clears only its own entry', async () => {
        const { lnd, ChannelBackupStore, recovery, recoveryWalletDirs } =
            await run(2, { recovery: true, recoveryWalletDirs: ['c', 'x'] });
        expect(lnd.startLnd).toHaveBeenCalledWith(
            expect.objectContaining({ isRecovery: true })
        );
        expect(
            ChannelBackupStore.recoverStaticChannelBackup
        ).toHaveBeenCalledTimes(1);
        expect(recovery).toBe(true);
        expect(recoveryWalletDirs).toEqual(['x']);
    });

    it('an embedded LND wallet that was not restored starts normally', async () => {
        const { lnd, ChannelBackupStore, recovery, recoveryWalletDirs } =
            await run(2, { recovery: true, recoveryWalletDirs: ['x'] });
        expect(lnd.startLnd).toHaveBeenCalledWith(
            expect.objectContaining({ isRecovery: false })
        );
        expect(
            ChannelBackupStore.recoverStaticChannelBackup
        ).not.toHaveBeenCalled();
        expect(recovery).toBe(true);
        expect(recoveryWalletDirs).toEqual(['x']);
    });

    it('keeps a failed recovery pending for the restored wallet', async () => {
        const { recovery, recoveryWalletDirs } = await run(
            2,
            { recovery: true, recoveryWalletDirs: ['c'] },
            new Error('No backup server reachable')
        );
        expect(recovery).toBe(true);
        expect(recoveryWalletDirs).toEqual(['c']);
    });

    it("stops another wallet's running daemon before starting a restored wallet", async () => {
        const { lnd, ChannelBackupStore, recoveryWalletDirs } = await run(
            2,
            { recovery: true, recoveryWalletDirs: ['c'] },
            undefined,
            { embeddedLndStarted: true, justCreatedNodeDir: undefined }
        );
        expect(lnd.stopLnd).toHaveBeenCalledTimes(1);
        expect(lnd.stopLnd.mock.invocationCallOrder[0]).toBeLessThan(
            lnd.startLnd.mock.invocationCallOrder[0]
        );
        expect(lnd.startLnd).toHaveBeenCalledWith(
            expect.objectContaining({ lndDir: 'c', isRecovery: true })
        );
        expect(
            ChannelBackupStore.recoverStaticChannelBackup
        ).toHaveBeenCalledTimes(1);
        expect(recoveryWalletDirs).toBeUndefined();
    });

    it('keeps the daemon a restore just started and still recovers', async () => {
        const { lnd, ChannelBackupStore, settings, recoveryWalletDirs } =
            await run(
                2,
                { recovery: true, recoveryWalletDirs: ['c'] },
                undefined,
                {
                    embeddedLndStarted: true,
                    justCreatedNodeDir: 'c'
                }
            );
        expect(lnd.stopLnd).not.toHaveBeenCalled();
        expect(lnd.startLnd).not.toHaveBeenCalled();
        expect(settings.justCreatedNodeDir).toBeUndefined();
        expect(
            ChannelBackupStore.recoverStaticChannelBackup
        ).toHaveBeenCalledTimes(1);
        expect(recoveryWalletDirs).toBeUndefined();
    });

    describe('flag written by a version without the wallet list', () => {
        it('is bound to the embedded LND wallet that connects first', async () => {
            const { ChannelBackupStore, recovery, recoveryWalletDirs } =
                await run(
                    2,
                    { recovery: true },
                    new Error('No backup server reachable')
                );
            expect(
                ChannelBackupStore.recoverStaticChannelBackup
            ).toHaveBeenCalledTimes(1);
            expect(recovery).toBe(true);
            expect(recoveryWalletDirs).toEqual(['c']);
        });

        it('is bound to and cleared by an LDK Node wallet that connects first', async () => {
            const { recovery, recoveryWalletDirs } = await run(0, {
                recovery: true
            });
            expect(recovery).toBe(false);
            expect(recoveryWalletDirs).toBeUndefined();
        });

        it("is not taken when another wallet's binding lands first", async () => {
            const {
                lnd,
                ChannelBackupStore,
                settings,
                recovery,
                recoveryWalletDirs
            } = await run(
                2,
                { recovery: true },
                undefined,
                {},
                {
                    recoveryWalletDirs: ['other']
                }
            );
            expect(lnd.startLnd).toHaveBeenCalledWith(
                expect.objectContaining({ lndDir: 'c', isRecovery: false })
            );
            expect(
                ChannelBackupStore.recoverStaticChannelBackup
            ).not.toHaveBeenCalled();
            expect(settings.updateSettings).toHaveBeenCalledTimes(1);
            expect(recovery).toBe(true);
            expect(recoveryWalletDirs).toEqual(['other']);
        });

        it('is left alone by a remote wallet', async () => {
            const { recovery, recoveryWalletDirs } = await run(1, {
                recovery: true
            });
            expect(recovery).toBe(true);
            expect(recoveryWalletDirs).toBeUndefined();
        });
    });
});

describe('a node left running by a wallet creation or restore', () => {
    const connect = async (
        selectedNode: number,
        justCreatedNodeDir: string
    ) => {
        const { settings, view, runner, refresh, ldk, lnd } =
            setup(selectedNode);
        Object.assign(settings, {
            lndDir: 'c',
            embeddedLndStarted: true,
            justCreatedNodeDir
        });
        view.props.SyncStore.startSyncing = jest.fn();
        await runner.run(refresh);
        expect(settings.justCreatedNodeDir).toBeUndefined();
        expect(settings.connecting).toBe(false);
        return { ldk, lnd };
    };

    it('is reused for its own LDK Node wallet', async () => {
        const { ldk } = await connect(0, 'a');
        expect(ldk.stopLdkNode).not.toHaveBeenCalled();
        expect(ldk.startLdkNodeWallet).toHaveBeenCalledWith(
            expect.objectContaining({ nodeDir: 'a', skipInit: true })
        );
    });

    it.each(['created', 'c'])(
        'is replaced for another LDK Node wallet (left by %s)',
        async (justCreatedNodeDir) => {
            const { ldk } = await connect(0, justCreatedNodeDir);
            expect(ldk.stopLdkNode).toHaveBeenCalledTimes(1);
            expect(ldk.startLdkNodeWallet).toHaveBeenCalledWith(
                expect.objectContaining({ nodeDir: 'a', skipInit: false })
            );
        }
    );

    it('is reused for its own embedded LND wallet', async () => {
        const { lnd } = await connect(2, 'c');
        expect(lnd.stopLnd).not.toHaveBeenCalled();
        expect(lnd.initializeLnd).not.toHaveBeenCalled();
        expect(lnd.startLnd).not.toHaveBeenCalled();
    });

    it.each(['created', 'a'])(
        'is replaced for another embedded LND wallet (left by %s)',
        async (justCreatedNodeDir) => {
            const { lnd } = await connect(2, justCreatedNodeDir);
            expect(lnd.stopLnd).toHaveBeenCalledTimes(1);
            expect(lnd.initializeLnd).toHaveBeenCalledWith(
                expect.objectContaining({ lndDir: 'c' })
            );
            expect(lnd.startLnd).toHaveBeenCalledWith(
                expect.objectContaining({ lndDir: 'c' })
            );
        }
    );
});
