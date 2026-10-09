// FU5: real backend, credential store, vendored client and refresh runner.
// Only the native bridge, storage and unrelated services are controlled.
jest.mock('../stores/Stores', () => ({
    settingsStore: {},
    nodeInfoStore: { nodeInfo: {} }
}));
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
// The generated package index has an unresolved type re-export under Jest.
jest.mock('../zeus_modules/@lightninglabs/lnc-rn', () =>
    jest.requireActual(
        '../zeus_modules/@lightninglabs/lnc-rn/dist/commonjs/lnc'
    )
);
jest.mock('../storage', () => {
    const values = new Map<string, any>();
    return {
        __esModule: true,
        default: {
            getItem: async (key: string) => values.get(key) || false,
            setItem: async (key: string, value: any) => {
                values.set(key, value);
                return true;
            },
            values
        }
    };
});
jest.mock('react-native', () => ({
    NativeModules: {
        LncModule: {
            initLNC: jest.fn(),
            isConnected: jest.fn(),
            status: jest.fn(),
            connectServer: jest.fn(),
            disconnect: jest.fn(),
            invokeRPC: jest.fn(),
            registerLocalPrivCreateCallback: jest.fn(),
            registerRemoteKeyReceiveCallback: jest.fn(),
            registerAuthDataCallback: jest.fn()
        }
    },
    NativeEventEmitter: class {
        addListener() {
            return { remove() {} };
        }
    }
}));

import { NativeModules } from 'react-native';
import LightningNodeConnect from './LightningNodeConnect';
import { hash } from './LNC/credentialStore';
import BackendUtils from '../utils/BackendUtils';
import { fetchLncData } from '../utils/LncFetchUtils';
import WalletRefreshRunner from '../utils/WalletRefreshRunner';
import Storage from '../storage';
import { sourceMethods } from './lncTestUtils';

const native = NativeModules.LncModule;
const connected = new Map<string, boolean>();
const rpcCalls: Array<{ namespace: string; method: string }> = [];
const A = hash('phrase-a');
const B = hash('phrase-b');

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    connected.clear();
    (Storage as any).values.clear();
    rpcCalls.length = 0;
    native.initLNC.mockImplementation(async (ns: string) =>
        connected.set(ns, false)
    );
    native.connectServer.mockResolvedValue('');
    native.isConnected.mockImplementation(
        async (ns: string) => connected.get(ns) || false
    );
    native.status.mockImplementation(async (ns: string) =>
        connected.get(ns) ? 'Connected' : 'Connecting'
    );
    native.disconnect.mockImplementation(async (ns: string) =>
        connected.set(ns, false)
    );
    native.invokeRPC.mockImplementation(
        (namespace: string, method: string, _request: any, callback: any) => {
            rpcCalls.push({ namespace, method });
            if (!connected.get(namespace))
                throw new Error('Fixture: disconnected RPC');
            callback(
                JSON.stringify({
                    identity_pubkey: namespace,
                    txid: `simulated-${namespace}`
                })
            );
        }
    );
});
afterEach(() => jest.useRealTimers());

function setup() {
    const backend = new LightningNodeConnect();
    Object.assign(BackendUtils, {
        initLNC: backend.initLNC,
        connect: backend.connect,
        isConnected: backend.isConnected,
        checkPerms: backend.checkPerms,
        supportsAccounts: () => false,
        supportsChannelManagement: () => false,
        supportsFlowLSP: () => false,
        supportsNostrWalletConnectService: () => false,
        clearCachedCalls: () => {}
    });
    const Settings = sourceMethods(
        'stores/SettingsStore.ts',
        'SettingsStore',
        [
            'connect',
            'getLncConnectionGuard',
            'waitForLncConnection',
            'clearConnectError',
            'setConnectingStatus',
            'acquireFetchLock',
            'releaseFetchLock',
            'setInitialStart'
        ],
        {
            BackendUtils,
            localeString: (s: string) => s,
            LNC_CONNECT_POLL_INTERVAL_MS: 500,
            LNC_CONNECT_MAX_POLLS: 120
        }
    );
    const settings = new Settings();
    Object.assign(settings, {
        settings: {
            nodes: [
                { pairingPhrase: 'phrase-a' },
                { pairingPhrase: 'phrase-b' }
            ],
            selectedNode: 0,
            lightningAddress: { enabled: false },
            ecash: { enableCashu: false }
        },
        implementation: 'lightning-node-connect',
        pairingPhrase: 'phrase-a',
        mailboxServer: 'mailbox.invalid:443',
        customMailboxServer: '',
        connecting: true,
        fetchLock: false,
        fetchLockSeq: 0,
        connectionSeq: 0,
        triggerSettingsRefresh: false
    });
    // Model the selection after its settings write has committed.
    settings.getSettings = jest.fn(async () => settings.settings);
    settings.setChannelMigrating = jest.fn();
    settings.loginRequired = () => false;
    settings.setLoginStatus = jest.fn();
    jest.requireMock('../stores/Stores').settingsStore = settings;
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['getSettingsAndNavigate', 'fetchData', 'fetchDataCore'],
        {
            BackendUtils,
            fetchLncData,
            LinkingUtils: { processPendingDeepLink: jest.fn() },
            Storage,
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
    const info = view.props.NodeInfoStore;
    info.getNodeInfo = jest.fn(async () => {
        info.nodeInfo = await backend.getMyNodeInfo();
    });
    view.props.BalanceStore.getCombinedBalance = jest.fn(async () => {});
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
    return { backend, settings, view, info, refresh, runner };
}

const selectB = (settings: any) => {
    settings.settings = { ...settings.settings, selectedNode: 1 };
    settings.pairingPhrase = 'phrase-b';
    settings.setConnectingStatus(true);
    settings.triggerSettingsRefresh = true;
};

it.each([true, false])(
    'switch during A dial dispatches through B (A connects: %s)',
    async (aConnects) => {
        const { backend, settings, view, info, refresh, runner } = setup();
        const initial = runner.run(refresh);
        await jest.advanceTimersByTimeAsync(0);
        expect(native.connectServer).toHaveBeenCalledTimes(1);
        await backend.disconnect();
        expect(native.disconnect).not.toHaveBeenCalled();
        selectB(settings);
        expect(runner.run(refresh)).toBeUndefined();
        await expect(
            backend.sendCoins({ addr: 'offline-fixture', amount: 1000 })
        ).rejects.toThrow('stores.SettingsStore.lncConnectError');
        connected.set(A, aConnects);
        await jest.advanceTimersByTimeAsync(500);
        expect(settings.connecting).toBe(true);
        expect(info.getNodeInfo).not.toHaveBeenCalled();
        expect(native.initLNC).toHaveBeenCalledWith(B);
        connected.set(B, true);
        await jest.advanceTimersByTimeAsync(500);
        await initial;
        expect(settings.settings.selectedNode).toBe(1);
        expect(settings.connecting).toBe(false);
        expect(native.initLNC).toHaveBeenCalledTimes(2);
        expect(info.getNodeInfo).toHaveBeenCalledTimes(1);
        expect(view.props.BalanceStore.reset).toHaveBeenCalledTimes(2);
        expect(info.nodeInfo.identity_pubkey).toBe(B);
        await backend.sendCoins({ addr: 'offline-fixture', amount: 1000 });
        expect(rpcCalls[rpcCalls.length - 1]).toEqual({
            namespace: B,
            method: 'lnrpc.Lightning.SendCoins'
        });
        expect(rpcCalls.every((call) => call.namespace === B)).toBe(true);
    }
);

it('control: switching after A finishes initializes and sends through B', async () => {
    const { backend, settings, refresh, runner } = setup();
    const initial = runner.run(refresh);
    await jest.advanceTimersByTimeAsync(0);
    connected.set(A, true);
    await jest.advanceTimersByTimeAsync(500);
    await initial;
    await backend.disconnect();
    selectB(settings);
    const switched = runner.run(refresh);
    await jest.advanceTimersByTimeAsync(0);
    expect(native.initLNC).toHaveBeenCalledWith(B);
    connected.set(B, true);
    await jest.advanceTimersByTimeAsync(500);
    await switched;
    await backend.sendCoins({ addr: 'offline-fixture', amount: 1000 });
    expect(rpcCalls[rpcCalls.length - 1].namespace).toBe(B);
});

it('late LNC completion leaves a selected non-LNC wallet connecting', async () => {
    const { backend, settings, info, refresh, runner } = setup();
    const initial = runner.run(refresh);
    await jest.advanceTimersByTimeAsync(0);
    await backend.disconnect();
    settings.implementation = 'lnd';
    settings.settings = { ...settings.settings, selectedNode: 1 };
    settings.setConnectingStatus(true);
    connected.set(A, true);
    await jest.advanceTimersByTimeAsync(61000);
    await initial;
    expect(settings.connecting).toBe(true);
    expect(settings.error).toBe(false);
    expect(info.getNodeInfo).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([]);
    await expect(
        backend.sendCoins({ addr: 'offline-fixture', amount: 1000 })
    ).rejects.toThrow('stores.SettingsStore.lncConnectError');
});
