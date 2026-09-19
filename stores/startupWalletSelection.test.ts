// Regression cover for #4016. With Display > Select wallet on startup
// enabled, nothing may reach a node until the user picks one, and the
// window that is easiest to lose is the switch itself: updateSettings
// assigns this.settings three times, twice in getSettings and once in
// setSettings, before updateNodeProperties loads the newly selected
// wallet's credentials. Every reaction on settings in that window sees the
// previously used wallet's credentials.

jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-blob-util', () => ({
    fs: {
        dirs: { LibraryDir: '/lib', DocumentDir: '/docs' }
    }
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        clearCachedCalls: jest.fn(),
        getBlockchainBalance: jest.fn(),
        getLightningBalance: jest.fn(),
        supportsOnchainBalance: jest.fn(() => true)
    }
}));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainDesyncMigration: jest.fn().mockResolvedValue(undefined),
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    purgeRescueKeyFiles: jest.fn().mockResolvedValue(undefined),
    // getSettings adopts the return value as the settings, so the stub
    // must hand the settings back rather than resolve undefined
    runSettingsMigrations: jest
        .fn()
        .mockImplementation(async (settings: any) => settings),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));
jest.mock('../storage', () => {
    const backing: Record<string, string> = {};
    return {
        _backing: backing,
        getItem: jest.fn(async (key: string) => backing[key] ?? false),
        setItem: jest.fn(async (key: string, value: any) => {
            backing[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            return true;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete backing[key];
            return true;
        }),
        KEY_PREFIX: 'zeus:',
        getRawItem: jest.fn(async () => null)
    };
});

import { reaction } from 'mobx';

import SettingsStore, { STORAGE_KEY } from './SettingsStore';
import BalanceStore from './BalanceStore';
import BackendUtils from '../utils/BackendUtils';

const StorageMock: any = jest.requireMock('../storage');

const previousWallet = { implementation: 'lnd', macaroonHex: 'aaaa' };
const pickedWallet = { implementation: 'lnd', macaroonHex: 'bbbb' };
const nodes = [previousWallet, pickedWallet];

const seedStartupSettings = () => {
    StorageMock._backing[STORAGE_KEY] = JSON.stringify({
        selectNodeOnStartup: true,
        selectedNode: 0,
        nodes
    });
};

// What Wallets.tsx does when the user picks the second wallet. Startup has
// ended by the time the switch commits: Wallet.tsx ends it before it opens
// the list, and onWalletPress ends it when Lockscreen opened the list
const commitSwitch = (store: SettingsStore) => {
    store.setInitialStart(false);
    return store.updateSettings({ nodes, selectedNode: 1 } as any);
};

let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
    for (const key of Object.keys(StorageMock._backing)) {
        delete StorageMock._backing[key];
    }
    jest.clearAllMocks();
    (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
        total_balance: '0',
        confirmed_balance: '0',
        unconfirmed_balance: '0'
    });
    (BackendUtils.getLightningBalance as jest.Mock).mockResolvedValue({
        balance: '0',
        pending_open_balance: '0'
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    // getSettings swallows load failures (console.error, then falls
    // through with defaults). A stale MigrationUtils mock has let tests in
    // this suite pass without the load ever completing, so fail loudly
    expect(
        errorSpy.mock.calls.filter(
            ([message]) => message === 'Could not load settings'
        )
    ).toEqual([]);
    errorSpy.mockRestore();
    logSpy.mockRestore();
});

describe('startup wallet selection', () => {
    it('raises the latch while loading the previously used credentials', async () => {
        seedStartupSettings();
        const settingsStore = new SettingsStore();

        await settingsStore.getSettings();

        expect(settingsStore.macaroonHex).toEqual('aaaa');
        expect(settingsStore.walletSelectionPending).toBe(true);
    });

    it('exposes the previous wallet to settings reactions while a switch commits', async () => {
        seedStartupSettings();
        const settingsStore = new SettingsStore();
        await settingsStore.getSettings();

        const credentialsSeen: (string | undefined)[] = [];
        const dispose = reaction(
            () => settingsStore.settings,
            () => credentialsSeen.push(settingsStore.macaroonHex)
        );

        await commitSwitch(settingsStore);
        dispose();

        // Every write during the switch lands before the new wallet's
        // credentials do, which is why the latch has to stay up until the
        // switch is confirmed. On an emulator this showed up as three
        // balance pairs going to the previously used wallet.
        expect(credentialsSeen.length).toBeGreaterThan(0);
        expect(credentialsSeen.every((macaroon) => macaroon === 'aaaa')).toBe(
            true
        );
        expect(settingsStore.macaroonHex).toEqual('bbbb');
    });

    it('does not fetch balances from the previous wallet while a switch commits', async () => {
        seedStartupSettings();
        const settingsStore = new SettingsStore();
        new BalanceStore(settingsStore);
        await settingsStore.getSettings();

        await commitSwitch(settingsStore);

        expect(BackendUtils.getBlockchainBalance).not.toHaveBeenCalled();
        expect(BackendUtils.getLightningBalance).not.toHaveBeenCalled();
    });

    it('fetches again once the switch is confirmed', async () => {
        seedStartupSettings();
        const settingsStore = new SettingsStore();
        new BalanceStore(settingsStore);
        await settingsStore.getSettings();
        await commitSwitch(settingsStore);

        // What the wallet list calls when it activates the picked wallet
        settingsStore.setConnectingStatus(true);
        await settingsStore.updateSettings({ nodes, selectedNode: 1 } as any);

        expect(BackendUtils.getBlockchainBalance).toHaveBeenCalled();
        expect(BackendUtils.getLightningBalance).toHaveBeenCalled();
    });

    it('leaves the latch down when the setting is disabled', async () => {
        StorageMock._backing[STORAGE_KEY] = JSON.stringify({
            selectNodeOnStartup: false,
            selectedNode: 0,
            nodes
        });
        const settingsStore = new SettingsStore();
        new BalanceStore(settingsStore);
        await settingsStore.getSettings();

        await commitSwitch(settingsStore);

        expect(settingsStore.walletSelectionPending).toBe(false);
        expect(BackendUtils.getLightningBalance).toHaveBeenCalled();
    });
});
