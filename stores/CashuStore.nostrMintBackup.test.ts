jest.mock('./Stores', () => ({
    connectivityStore: {
        isOffline: false,
        start: jest.fn(),
        stop: jest.fn(),
        onReconnect: jest.fn()
    }
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one', 'wss://relay.two']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({
    deriveMintBackupKeypair: jest.fn(() => ({
        privateKeyHex: 'priv',
        publicKeyHex: 'pub'
    })),
    backupMintsToNostr: jest.fn(),
    restoreMintsFromNostr: jest.fn()
}));
jest.mock('../utils/MigrationUtils', () => ({
    migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
    migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    getMintUrls: jest.fn().mockResolvedValue([]),
    getBalances: jest.fn().mockResolvedValue({}),
    getTotalBalance: jest.fn().mockResolvedValue(0),
    listTransactions: jest.fn().mockResolvedValue([])
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getRawItem: jest.fn().mockResolvedValue(null),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import Storage from '../storage';
import {
    backupMintsToNostr,
    restoreMintsFromNostr
} from '../utils/NostrMintBackup';

// BIP-39 test vectors, never real wallets.
const daily = {
    ldkNodeDir: 'daily',
    ldkMnemonic: `${'abandon '.repeat(11)}about`
};
const savings = {
    ldkNodeDir: 'savings',
    ldkMnemonic:
        'legal winner thank year wave sausage worth useful legal winner thank yellow'
};
const TIMESTAMP_KEY = 'cashu-nostrMintBackupTimestamp';

describe('CashuStore Nostr mint backup timestamp', () => {
    let stored: Map<string, string>;
    let settingsStore: any;
    let store: CashuStore;

    // What Wallet.tsx does when it connects to the selected wallet
    const openWallet = async (wallet: typeof daily) => {
        Object.assign(settingsStore, wallet);
        store.reset();
        await store.initializeWallets();
    };

    beforeEach(() => {
        jest.clearAllMocks();
        stored = new Map();
        (Storage.getItem as jest.Mock).mockImplementation(
            async (key: string) => stored.get(key) ?? false
        );
        (Storage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: any) => {
                stored.set(
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value)
                );
            }
        );
        (Storage.removeItem as jest.Mock).mockImplementation(
            async (key: string) => {
                stored.delete(key);
            }
        );
        (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        settingsStore = { implementation: 'ldk-node', settings: {} };
        store = new CashuStore(
            settingsStore,
            {} as any,
            { channels: [] } as any,
            {} as any
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it('does not use the previous wallet as the restore floor of the next', async () => {
        stored.set(`daily-${TIMESTAMP_KEY}`, '1768435200');
        stored.set('daily-cashu-mintUrls', '[]');
        await openWallet(daily);
        expect(store.nostrMintBackupTimestamp).toBe(1768435200);

        await openWallet(savings);

        expect(restoreMintsFromNostr).toHaveBeenCalledTimes(1);
        expect(restoreMintsFromNostr).toHaveBeenCalledWith(
            'priv',
            'pub',
            ['wss://relay.one', 'wss://relay.two'],
            0
        );
        expect(store.nostrMintBackupTimestamp).toBeUndefined();
    });

    it('overwrites the timestamp on init even without a reset', async () => {
        store.nostrMintBackupTimestamp = 1768435200;
        Object.assign(settingsStore, savings);

        await store.initializeWallets();

        expect(store.nostrMintBackupTimestamp).toBeUndefined();
    });

    it('clears the timestamp on reset', () => {
        store.nostrMintBackupTimestamp = 1768435200;
        store.reset();
        expect(store.nostrMintBackupTimestamp).toBeUndefined();
    });

    it('still records the timestamp of the open wallet', async () => {
        await openWallet(daily);
        (backupMintsToNostr as jest.Mock).mockResolvedValue(1768435200);

        await store.nostrBackupMints();

        expect(store.nostrMintBackupTimestamp).toBe(1768435200);
        expect(stored.get(`daily-${TIMESTAMP_KEY}`)).toBe('1768435200');
    });
});
