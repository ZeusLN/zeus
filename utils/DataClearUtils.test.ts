// Regression coverage for the duress / failed-attempts wipe gap (KEY-005):
// clearAllData() must stop and delete the on-disk LND/LDK node data
// directories, not only the keychain/Cashu/settings entries. Lockscreen's
// duress (`deleteNodes`) and lockout (`authenticationFailure`) handlers both
// route through clearAllData(), so this guards that the seed-bearing node
// directories are actually removed by a wipe.

jest.mock('react-native-keychain', () => ({
    resetInternetCredentials: jest.fn().mockResolvedValue(true)
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    clear: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('react-native-encrypted-storage', () => ({
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('react-native-blob-util', () => ({
    fs: {
        dirs: { LibraryDir: '/lib', DocumentDir: '/docs' },
        exists: jest.fn().mockResolvedValue(false),
        unlink: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('../storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true),
    setItem: jest.fn().mockResolvedValue(true)
}));

// The functions under regression - assert clearAllData delegates to them.
jest.mock('./LndMobileUtils', () => ({
    deleteLndWallet: jest.fn().mockResolvedValue(true)
}));
jest.mock('./LdkNodeUtils', () => ({
    deleteLdkNodeWallet: jest.fn().mockResolvedValue(undefined),
    stopLdkNode: jest.fn().mockResolvedValue(undefined)
}));

// Retry backoff - keep the suite from actually waiting on it
jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));

// Store modules are imported only for their storage-key constants; mock them
// so the real (native-dependency-heavy) store modules are never loaded.
jest.mock('../stores/SettingsStore', () => ({
    STORAGE_KEY: 'zeus-settings-v2',
    CURRENCY_CODES_KEY: 'zeus-currency-codes',
    LEGACY_CURRENCY_CODES_KEY: 'currency-codes',
    FAVORITE_CURRENCIES_KEY: 'favorite-currencies'
}));
jest.mock('../stores/NotesStore', () => ({
    NOTES_KEY: 'notes-keys',
    LEGACY_NOTES_KEY: 'noteKeys'
}));
jest.mock('../stores/ContactStore', () => ({
    CONTACTS_KEY: 'zeus-contacts',
    LEGACY_CONTACTS_KEY: 'contacts'
}));
jest.mock('../stores/ChannelBackupStore', () => ({
    LAST_CHANNEL_BACKUP_STATUS: 'last-channel-backup-status',
    LAST_CHANNEL_BACKUP_TIME: 'last-channel-backup-time',
    LEGACY_LAST_CHANNEL_BACKUP_STATUS: 'lastChannelBackupStatus',
    LEGACY_LAST_CHANNEL_BACKUP_TIME: 'lastChannelBackupTime'
}));
jest.mock('../stores/LightningAddressStore', () => ({
    ADDRESS_ACTIVATED_STRING: 'address-activated',
    HASHES_STORAGE_STRING: 'hashes',
    LEGACY_ADDRESS_ACTIVATED_STRING: 'addressActivated',
    LEGACY_HASHES_STORAGE_STRING: 'hashesStorage'
}));
jest.mock('../stores/PosStore', () => ({
    POS_HIDDEN_KEY: 'pos-hidden',
    POS_STANDALONE_KEY: 'pos-standalone',
    LEGACY_POS_HIDDEN_KEY: 'posHidden',
    LEGACY_POS_STANDALONE_KEY: 'posStandalone'
}));
jest.mock('../stores/InventoryStore', () => ({
    CATEGORY_KEY: 'category',
    PRODUCT_KEY: 'product',
    LEGACY_CATEGORY_KEY: 'categoryLegacy',
    LEGACY_PRODUCT_KEY: 'productLegacy'
}));
jest.mock('../stores/UnitsStore', () => ({
    UNIT_KEY: 'unit',
    LEGACY_UNIT_KEY: 'unitLegacy'
}));
jest.mock('../stores/UTXOsStore', () => ({
    HIDDEN_ACCOUNTS_KEY: 'hidden-accounts',
    LEGACY_HIDDEN_ACCOUNTS_KEY: 'hiddenAccounts'
}));
jest.mock('../stores/LSPStore', () => ({
    LSPS_ORDERS_KEY: 'lsps-orders',
    LEGACY_LSPS1_ORDERS_KEY: 'lsps1Orders'
}));
jest.mock('../stores/ActivityStore', () => ({
    ACTIVITY_FILTERS_KEY: 'activity-filters',
    LEGACY_ACTIVITY_FILTERS_KEY: 'activityFilters'
}));
jest.mock('../utils/MigrationUtils', () => ({
    IS_BACKED_UP_KEY: 'is-backed-up'
}));
jest.mock('../utils/SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps',
    SWAPS_RESCUE_KEY: 'swaps-rescue-key',
    SWAPS_LAST_USED_KEY: 'swaps-last-used-key'
}));

import Storage from '../storage';
import { clearAllData } from './DataClearUtils';
import { deleteLndWallet } from './LndMobileUtils';
import { deleteLdkNodeWallet, stopLdkNode } from './LdkNodeUtils';
import { sleep } from './SleepUtils';

const mockedDeleteLndWallet = deleteLndWallet as jest.Mock;
const mockedDeleteLdkNodeWallet = deleteLdkNodeWallet as jest.Mock;
const mockedStopLdkNode = stopLdkNode as jest.Mock;
const mockedStorageGetItem = Storage.getItem as jest.Mock;
const mockedSleep = sleep as jest.Mock;

// Keep test output clean
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

const settingsWithNodes = (nodes: any[]) => ({
    getItem: (key: string) =>
        key === 'zeus-settings-v2'
            ? Promise.resolve(JSON.stringify({ nodes }))
            : Promise.resolve(null)
});

describe('clearAllData node data directory wipe (KEY-005 regression)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedDeleteLndWallet.mockResolvedValue(true);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
    });

    it('stops and deletes the data directory for an embedded-lnd node', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-abc' }
            ]).getItem
        );

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-abc');
    });

    it('defaults the embedded-lnd directory to "lnd" when lndDir is absent', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([{ implementation: 'embedded-lnd' }]).getItem
        );

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd');
    });

    it('stops the LDK node before deleting its data directory', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'ldk-node', ldkNodeDir: 'ldk-node-xyz' }
            ]).getItem
        );

        await clearAllData();

        expect(mockedStopLdkNode).toHaveBeenCalled();
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-node-xyz');
        // stop must be ordered before the unlink
        expect(mockedStopLdkNode.mock.invocationCallOrder[0]).toBeLessThan(
            mockedDeleteLdkNodeWallet.mock.invocationCallOrder[0]
        );
    });

    it('wipes every configured node directory in a multi-node wallet', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-1' },
                { implementation: 'ldk-node', ldkNodeDir: 'ldk-2' }
            ]).getItem
        );

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-1');
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-2');
    });

    it('does not delete an ldk-node directory when ldkNodeDir is missing', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([{ implementation: 'ldk-node' }]).getItem
        );

        await clearAllData();

        expect(mockedDeleteLdkNodeWallet).not.toHaveBeenCalled();
    });

    it('is a no-op for node deletion when there are no configured nodes', async () => {
        mockedStorageGetItem.mockImplementation(settingsWithNodes([]).getItem);

        await clearAllData();

        expect(mockedDeleteLndWallet).not.toHaveBeenCalled();
        expect(mockedDeleteLdkNodeWallet).not.toHaveBeenCalled();
        expect(mockedStopLdkNode).not.toHaveBeenCalled();
    });

    it('tolerates a missing / unreadable settings blob without throwing', async () => {
        mockedStorageGetItem.mockResolvedValue(null);

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(mockedDeleteLndWallet).not.toHaveBeenCalled();
        expect(mockedDeleteLdkNodeWallet).not.toHaveBeenCalled();
    });
});

// The wipe runs on the duress path, so a failed directory deletion must be
// retried rather than surfaced: halting would leave the keychain and settings
// blob unwiped, and an error in the UI would disclose the duress mechanism.
describe('clearAllData node data directory retry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedDeleteLndWallet.mockResolvedValue(true);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
    });

    it('retries an embedded-lnd deletion that reports failure', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-abc' }
            ]).getItem
        );
        mockedDeleteLndWallet
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(2);
        expect(mockedSleep).toHaveBeenCalledTimes(1);
    });

    it('retries an LDK deletion that throws', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'ldk-node', ldkNodeDir: 'ldk-xyz' }
            ]).getItem
        );
        mockedDeleteLdkNodeWallet
            .mockRejectedValueOnce(new Error('EBUSY'))
            .mockResolvedValueOnce(undefined);

        await clearAllData();

        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledTimes(2);
    });

    it('does not retry a deletion that succeeded first time', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-abc' }
            ]).getItem
        );

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(1);
        expect(mockedSleep).not.toHaveBeenCalled();
    });

    it('gives up after 3 attempts and still completes the wipe', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-abc' }
            ]).getItem
        );
        mockedDeleteLndWallet.mockResolvedValue(false);

        // never rejects - the caller must be free to restart
        await expect(clearAllData()).resolves.toBeUndefined();

        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(3);
    });

    it('still wipes later nodes after an earlier node exhausts its retries', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'embedded-lnd', lndDir: 'lnd-1' },
                { implementation: 'ldk-node', ldkNodeDir: 'ldk-2' }
            ]).getItem
        );
        mockedDeleteLndWallet.mockResolvedValue(false);

        await clearAllData();

        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(3);
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-2');
    });
});
