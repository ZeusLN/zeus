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
        unlink: jest.fn().mockResolvedValue(undefined),
        ls: jest.fn().mockResolvedValue([])
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

import hashjs from 'hash.js';
import ReactNativeBlobUtil from 'react-native-blob-util';

import Storage from '../storage';
import {
    clearAllData,
    clearNodeKeychainData,
    clearCDKDatabase,
    clearCDKDatabaseForNode,
    deleteNodeDataDirectoryWithRetry
} from './DataClearUtils';
import { deleteLndWallet } from './LndMobileUtils';
import { deleteLdkNodeWallet, stopLdkNode } from './LdkNodeUtils';
import { sleep } from './SleepUtils';

const mockedDeleteLndWallet = deleteLndWallet as jest.Mock;
const mockedDeleteLdkNodeWallet = deleteLdkNodeWallet as jest.Mock;
const mockedStopLdkNode = stopLdkNode as jest.Mock;
const mockedStorageGetItem = Storage.getItem as jest.Mock;
const mockedSleep = sleep as jest.Mock;
const mockedStorageRemoveItem = Storage.removeItem as jest.Mock;

const lncHash = (value: string) => hashjs.sha256().update(value).digest('hex');

// clearKey() clears each key via Storage.removeItem(rawKey); asserting on it is
// the cleanest way to prove a namespaced key was targeted by a wipe.
const removedKeys = () =>
    mockedStorageRemoveItem.mock.calls.map((call) => call[0]);

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

describe('clearAllData orphaned key material (KEY-006 regression)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedDeleteLndWallet.mockResolvedValue(true);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
    });

    it('clears the LDK-node-namespaced Cashu seed phrase (== wallet mnemonic)', async () => {
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                { implementation: 'ldk-node', ldkNodeDir: 'ldk-node-xyz' }
            ]).getItem
        );

        await clearAllData();

        // Previously only lndDir was iterated, so this key survived a full wipe
        expect(removedKeys()).toContain('ldk-node-xyz-cashu-seed-phrase');
    });

    it('clears the default "ldk" node dir Cashu data', async () => {
        mockedStorageGetItem.mockImplementation(settingsWithNodes([]).getItem);

        await clearAllData();

        expect(removedKeys()).toContain('ldk-cashu-seed-phrase');
    });

    it('clears the hashed LNC pairing credentials for an LNC node', async () => {
        const pairingPhrase = 'cherry truth mask employ box silver mass bunker';
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                {
                    implementation: 'lightning-node-connect',
                    pairingPhrase
                }
            ]).getItem
        );

        await clearAllData();

        const baseKey = `lnc-rn:${lncHash(pairingPhrase)}`;
        expect(removedKeys()).toContain(baseKey);
        expect(removedKeys()).toContain(`${baseKey}:host`);
    });
});

describe('clearNodeKeychainData (single-wallet deletion helper)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
    });

    it('clears Cashu data for an embedded-lnd node dir', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(removedKeys()).toContain('lnd-abc-cashu-seed-phrase');
    });

    it('clears Cashu data for an ldk-node dir', async () => {
        await clearNodeKeychainData({
            implementation: 'ldk-node',
            ldkNodeDir: 'ldk-2'
        });

        expect(removedKeys()).toContain('ldk-2-cashu-seed-phrase');
    });

    it('falls back to the "lnd" namespace for a legacy embedded-lnd node without lndDir', async () => {
        await clearNodeKeychainData({ implementation: 'embedded-lnd' });

        expect(removedKeys()).toContain('lnd-cashu-seed-phrase');
    });

    it('falls back to the "ldk" namespace for a legacy ldk-node without ldkNodeDir', async () => {
        await clearNodeKeychainData({ implementation: 'ldk-node' });

        expect(removedKeys()).toContain('ldk-cashu-seed-phrase');
    });

    it('never clears the default namespaces for a remote node without dirs', async () => {
        await clearNodeKeychainData({ implementation: 'lnd' });

        expect(removedKeys()).not.toContain('lnd-cashu-seed-phrase');
        expect(removedKeys()).not.toContain('ldk-cashu-seed-phrase');
    });

    it('clears hashed LNC credentials from the pairing phrase', async () => {
        const pairingPhrase = 'over hover clever trigger';
        await clearNodeKeychainData({
            implementation: 'lightning-node-connect',
            pairingPhrase
        });

        const baseKey = `lnc-rn:${lncHash(pairingPhrase)}`;
        expect(removedKeys()).toContain(baseKey);
        expect(removedKeys()).toContain(`${baseKey}:host`);
    });

    it('is a no-op for a null node', async () => {
        await expect(clearNodeKeychainData(null)).resolves.toBeUndefined();
        expect(mockedStorageRemoveItem).not.toHaveBeenCalled();
    });
});

describe('deleteNodeDataDirectoryWithRetry (single-wallet deletion path)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSleep.mockResolvedValue(undefined);
    });

    it('retries a failed embedded-lnd directory deletion and reports success', async () => {
        mockedDeleteLndWallet
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const result = await deleteNodeDataDirectoryWithRetry({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(result).toBe(true);
        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(3);
        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-abc');
    });

    it('gives up after the attempt limit and reports failure', async () => {
        mockedDeleteLndWallet.mockResolvedValue(false);

        const result = await deleteNodeDataDirectoryWithRetry({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(result).toBe(false);
        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(3);
    });

    it('stops the LDK node before deleting its directory', async () => {
        mockedStopLdkNode.mockResolvedValue(undefined);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);

        const result = await deleteNodeDataDirectoryWithRetry({
            implementation: 'ldk-node',
            ldkNodeDir: 'ldk-2'
        });

        expect(result).toBe(true);
        expect(mockedStopLdkNode).toHaveBeenCalled();
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-2');
    });
});

describe('CDK database deletion', () => {
    const mockedLs = ReactNativeBlobUtil.fs.ls as jest.Mock;
    const mockedExists = ReactNativeBlobUtil.fs.exists as jest.Mock;
    const mockedUnlink = ReactNativeBlobUtil.fs.unlink as jest.Mock;
    const unlinkedPaths = () => mockedUnlink.mock.calls.map((call) => call[0]);

    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedLs.mockResolvedValue([]);
        mockedExists.mockResolvedValue(false);
        mockedUnlink.mockResolvedValue(undefined);
    });

    describe('clearCDKDatabase (full-wipe sweep)', () => {
        it('sweeps legacy, per-wallet, and WAL/SHM sidecar files', async () => {
            mockedLs.mockResolvedValue([
                'cashu_wallet.db',
                'cashu_wallet_0123456789abcdef.db',
                'cashu_wallet_0123456789abcdef.db-wal',
                'cashu_wallet_0123456789abcdef.db-shm',
                'unrelated.db'
            ]);

            await clearCDKDatabase();

            const paths = unlinkedPaths();
            expect(paths).toHaveLength(4);
            expect(paths.every((p) => p.includes('cashu_wallet'))).toBe(true);
            expect(paths.some((p) => p.includes('unrelated'))).toBe(false);
        });

        it('keeps sweeping when one unlink fails', async () => {
            mockedLs.mockResolvedValue([
                'cashu_wallet_a.db',
                'cashu_wallet_b.db'
            ]);
            mockedUnlink
                .mockRejectedValueOnce(new Error('EBUSY'))
                .mockResolvedValue(undefined);

            await clearCDKDatabase();

            expect(mockedUnlink).toHaveBeenCalledTimes(2);
        });
    });

    describe('clearCDKDatabaseForNode (single-wallet deletion)', () => {
        // Must match the native modules (CashuDevKitModule.kt/.swift):
        // first 8 bytes of sha256(space-joined mnemonic) as hex
        const walletDbHash = (mnemonic: string) =>
            hashjs.sha256().update(mnemonic).digest('hex').slice(0, 16);

        it('deletes the db and sidecars derived from the stored cashu seed', async () => {
            const words = ['abandon', 'ability', 'able', 'about'];
            mockedStorageGetItem.mockImplementation((key: string) =>
                key === 'lnd-abc-cashu-seed-phrase'
                    ? Promise.resolve(JSON.stringify(words))
                    : Promise.resolve(null)
            );
            mockedExists.mockResolvedValue(true);

            await clearCDKDatabaseForNode({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-abc'
            });

            const expected = `cashu_wallet_${walletDbHash(words.join(' '))}.db`;
            const paths = unlinkedPaths();
            expect(paths.some((p) => p.endsWith(expected))).toBe(true);
            expect(paths.some((p) => p.endsWith(`${expected}-wal`))).toBe(true);
            expect(paths.some((p) => p.endsWith(`${expected}-shm`))).toBe(true);
        });

        it('uses the ldk default namespace for a legacy ldk-node config', async () => {
            mockedStorageGetItem.mockImplementation((key: string) =>
                key === 'ldk-cashu-seed-phrase'
                    ? Promise.resolve(JSON.stringify(['some', 'words']))
                    : Promise.resolve(null)
            );
            mockedExists.mockResolvedValue(true);

            await clearCDKDatabaseForNode({ implementation: 'ldk-node' });

            expect(mockedUnlink).toHaveBeenCalled();
            expect(mockedStorageGetItem).toHaveBeenCalledWith(
                'ldk-cashu-seed-phrase'
            );
        });

        it('never deletes databases for a remote node (shared default namespace)', async () => {
            mockedStorageGetItem.mockResolvedValue(
                JSON.stringify(['some', 'words'])
            );
            mockedExists.mockResolvedValue(true);

            await clearCDKDatabaseForNode({ implementation: 'lnd' });

            expect(mockedUnlink).not.toHaveBeenCalled();
        });

        it('is a no-op when no cashu seed is stored', async () => {
            await clearCDKDatabaseForNode({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-abc'
            });

            expect(mockedUnlink).not.toHaveBeenCalled();
        });
    });
});
