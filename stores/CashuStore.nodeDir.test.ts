jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() },
    connectivityStore: { isOffline: true },
    settingsStore: {}
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one', 'wss://relay.two']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('./ChannelBackupStore', () => ({}));
jest.mock('./LightningAddressStore', () => ({}));
jest.mock('./LSPStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => false)
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn(),
    removeItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import Storage from '../storage';

// Every Cashu key suffix the store has used. Values stand in for another
// wallet's data in the shared 'lnd' namespace (remote wallets and embedded
// LND wallets without an lndDir).
const SUFFIXES = [
    'mintUrls',
    'selectedMintUrl',
    'selectedMintUrls',
    'multiMintSelectedUrls',
    'invoices',
    'payments',
    'received-tokens',
    'sent-tokens',
    'offline-pending-tokens',
    'offline-spent-tokens',
    'pending-melts',
    'seed-version',
    'seed-phrase',
    'seed',
    'randomizeMintSelection',
    'nostrMintBackupTimestamp'
];

const lndValues: Record<string, string> = {
    'lnd-cashu-mintUrls': JSON.stringify(['https://mint.other']),
    'lnd-cashu-selectedMintUrl': 'https://mint.other',
    'lnd-cashu-selectedMintUrls': JSON.stringify(['https://mint.other']),
    'lnd-cashu-multiMintSelectedUrls': JSON.stringify(['https://mint.other']),
    'lnd-cashu-invoices': '[]',
    'lnd-cashu-payments': '[]',
    'lnd-cashu-received-tokens': '[]',
    'lnd-cashu-sent-tokens': '[]',
    'lnd-cashu-offline-pending-tokens': '[]',
    'lnd-cashu-offline-spent-tokens': '[]',
    'lnd-cashu-pending-melts': '[]',
    'lnd-cashu-seed-version': 'v2-bip39',
    'lnd-cashu-seed-phrase': JSON.stringify(['other']),
    'lnd-cashu-seed': 'b3RoZXI=',
    'lnd-cashu-randomizeMintSelection': 'true',
    'lnd-cashu-nostrMintBackupTimestamp': '1'
};

const keysTouched = () =>
    [Storage.getItem, Storage.setItem, Storage.removeItem].flatMap((fn) =>
        (fn as jest.Mock).mock.calls.map(([key]) => key as string)
    );

describe('CashuStore.initializeWallets on an LDK node', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    // Storage.getItem returns false on a miss; null covers a caller that
    // treats a miss as null.
    it.each([false, null])(
        'never reads or writes lnd-cashu-* keys (miss value %p)',
        async (miss) => {
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) =>
                    key in lndValues ? lndValues[key] : miss
            );
            const store = new CashuStore(
                {
                    implementation: 'ldk-node',
                    ldkNodeDir: 'ldk-uuid',
                    lndDir: 'lnd',
                    settings: {}
                } as any,
                {} as any,
                {} as any,
                {} as any
            );
            jest.spyOn(store, 'startConnectivityMonitoring').mockReturnValue(
                undefined
            );

            await store.initializeWallets();

            const touched = keysTouched();
            expect(touched.filter((key) => key.startsWith('lnd-'))).toEqual([]);
            expect(Storage.getItem).toHaveBeenCalledWith(
                'ldk-uuid-cashu-offline-pending-tokens'
            );
            for (const suffix of SUFFIXES) {
                expect(Storage.setItem).not.toHaveBeenCalledWith(
                    `ldk-uuid-cashu-${suffix}`,
                    lndValues[`lnd-cashu-${suffix}`]
                );
            }
            expect(store.mintUrls).toEqual([]);
            expect(store.selectedMintUrl).toBe('');
            expect(store.offlinePendingTokens).toEqual([]);
        }
    );
});
