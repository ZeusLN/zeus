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
    setItem: jest.fn().mockResolvedValue(true),
    blockWrites: jest.fn()
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

// The real derivation runs scrypt (N=32768); its correctness is pinned by
// AezeedUtils.test.ts against lnd-generated golden vectors. Here only the
// wiring matters: the derived pubkey must be turned into a cleared key.
jest.mock('./AezeedUtils', () => ({
    deriveEmbeddedNodeId: jest
        .fn()
        .mockResolvedValue(
            '020b4e17f82873d40c1abff7a9140b6a56c04a845e1abe6ab71ef3269836d47abd'
        )
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
    SWAPS_LAST_USED_KEY: 'swaps-last-used-key',
    purgeLegacyRescueKeyFiles: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../stores/NostrWalletConnectStore', () => ({
    NWC_CONNECTIONS_KEY: 'zeus-nwc-connections',
    NWC_CLIENT_KEYS: 'zeus-nwc-client-keys',
    NWC_SERVICE_KEYS: 'zeus-nwc-service-keys',
    NWC_CASHU_ENABLED: 'zeus-nwc-cashu-enabled',
    NWC_LUD16_ENABLED: 'zeus-nwc-lud16-enabled',
    NWC_PERSISTENT_SERVICE_ENABLED: 'persistentNWCServicesEnabled'
}));
jest.mock('../utils/RatingUtils', () => ({
    PAYMENT_COUNT_KEY: 'successfulPaymentCount',
    RATING_DISMISSED_KEY: 'ratingDismissedPermanently'
}));

import hashjs from 'hash.js';
import { BackHandler, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import fs from 'fs';
import path from 'path';

import Storage from '../storage';
import { deriveEmbeddedNodeId } from './AezeedUtils';
import {
    blockNavigationDuringWipe,
    clearAllData,
    clearNodeKeychainData,
    clearCDKDatabase,
    clearCDKDatabaseForNode,
    deleteNodeDataDirectoryWithRetry,
    CASHU_KEY_SUFFIXES
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

// Platform.OS overrides restore through a tracked handle rather than
// jest.restoreAllMocks(): restoreAllMocks would also tear down the console
// spies above for every subsequent test, and an in-test restore leaks the
// replacement when an assertion throws before reaching it.
let replacedPlatformOS: { restore: () => void } | undefined;
const setPlatformOS = (os: typeof Platform.OS) => {
    replacedPlatformOS = jest.replaceProperty(Platform, 'OS', os);
};
afterEach(() => {
    replacedPlatformOS?.restore();
    replacedPlatformOS = undefined;
});

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

// Reviewer follow-up on KEY-006: '<pubkey>-extended-private-keys' was not
// removed by clearAllData / clearNodeKeychainData because the pubkey is not
// in the node config. It is now re-derived from the embedded wallet's aezeed
// so deletion and (iOS) full wipes can clear the entry.
describe('legacy xprv cache purge (KEY-006 follow-up)', () => {
    const mockedDerive = deriveEmbeddedNodeId as jest.Mock;
    const NODE_ID =
        '020b4e17f82873d40c1abff7a9140b6a56c04a845e1abe6ab71ef3269836d47abd';
    const XPRV_KEY = `${NODE_ID}-extended-private-keys`;
    const seedPhrase = ['absorb', 'spawn', 'orbit', 'course'];

    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedDeleteLndWallet.mockResolvedValue(true);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
        mockedDerive.mockResolvedValue(NODE_ID);
    });

    it('clears the xprv cache on single-wallet deletion (mainnet)', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc',
            seedPhrase,
            embeddedLndNetwork: 'Mainnet'
        });

        expect(mockedDerive).toHaveBeenCalledWith(seedPhrase, false);
        expect(removedKeys()).toContain(XPRV_KEY);
    });

    it('derives with coin type 1 for a Testnet wallet', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc',
            seedPhrase,
            embeddedLndNetwork: 'Testnet'
        });

        expect(mockedDerive).toHaveBeenCalledWith(seedPhrase, true);
    });

    it('derives with coin type 1 for any non-mainnet network (mutinynet)', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc',
            seedPhrase,
            embeddedLndNetwork: 'mutinynet'
        });

        expect(mockedDerive).toHaveBeenCalledWith(seedPhrase, true);
    });

    it('defaults a config without embeddedLndNetwork to mainnet (coin type 0)', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc',
            seedPhrase
        });

        expect(mockedDerive).toHaveBeenCalledWith(seedPhrase, false);
    });

    it('does not attempt derivation without a seed phrase', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(mockedDerive).not.toHaveBeenCalled();
    });

    it('does not attempt derivation for remote nodes', async () => {
        await clearNodeKeychainData({
            implementation: 'lnd',
            seedPhrase
        });

        expect(mockedDerive).not.toHaveBeenCalled();
    });

    it('still clears the other node keys when derivation fails (custom aezeed passphrase)', async () => {
        mockedDerive.mockRejectedValueOnce(
            new Error('Decryption failed. Invalid passphrase?')
        );

        await expect(
            clearNodeKeychainData({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-abc',
                seedPhrase
            })
        ).resolves.toBeUndefined();

        expect(removedKeys()).toContain('lnd-abc-cashu-seed-phrase');
        expect(removedKeys()).not.toContain(XPRV_KEY);
    });

    it('clears the xprv cache during a full wipe on iOS', async () => {
        // Platform.OS is 'ios' by default under the react-native jest preset
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                {
                    implementation: 'embedded-lnd',
                    lndDir: 'lnd-abc',
                    seedPhrase,
                    embeddedLndNetwork: 'Mainnet'
                }
            ]).getItem
        );

        await clearAllData();

        expect(removedKeys()).toContain(XPRV_KEY);
    });

    it('skips the scrypt-heavy derivation on an Android full wipe (backing store deletion covers it)', async () => {
        setPlatformOS('android');
        mockedStorageGetItem.mockImplementation(
            settingsWithNodes([
                {
                    implementation: 'embedded-lnd',
                    lndDir: 'lnd-abc',
                    seedPhrase,
                    embeddedLndNetwork: 'Mainnet'
                }
            ]).getItem
        );

        await clearAllData();

        expect(mockedDerive).not.toHaveBeenCalled();
    });
});

describe('clearAllData keychain backing store deletion (Android)', () => {
    const mockedExists = ReactNativeBlobUtil.fs.exists as jest.Mock;
    const mockedUnlink = ReactNativeBlobUtil.fs.unlink as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedExists.mockResolvedValue(true);
        mockedUnlink.mockResolvedValue(undefined);
    });

    it('deletes the DataStore file and legacy prefs as the final clearing step on Android', async () => {
        setPlatformOS('android');

        await clearAllData();

        const unlinked = mockedUnlink.mock.calls.map((call) => call[0]);
        const pbCall = unlinked.find((p: string) =>
            p.endsWith('datastore/RN_KEYCHAIN.preferences_pb')
        );
        const xmlCall = unlinked.find((p: string) =>
            p.endsWith('shared_prefs/RN_KEYCHAIN.xml')
        );
        expect(pbCall).toBeDefined();
        expect(xmlCall).toBeDefined();

        // Must be the LAST clearing action: any keychain write after this
        // would re-persist react-native-keychain's cached map, resurrecting
        // the orphans this deletion exists to kill.
        const pbCallOrder =
            mockedUnlink.mock.invocationCallOrder[unlinked.indexOf(pbCall)];
        const lastRemoveItemOrder = Math.max(
            ...mockedStorageRemoveItem.mock.invocationCallOrder
        );
        expect(pbCallOrder).toBeGreaterThan(lastRemoveItemOrder);
    });

    it('does not touch keychain files on iOS', async () => {
        // Platform.OS is 'ios' by default under the react-native jest preset
        await clearAllData();

        const unlinked = mockedUnlink.mock.calls.map((call) => call[0]);
        expect(unlinked.some((p: string) => p.includes('RN_KEYCHAIN'))).toBe(
            false
        );
    });
});

describe('clearAllData write latch (settings resurrection regression)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
        mockedDeleteLndWallet.mockResolvedValue(true);
        mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
    });

    // Found on-device after a full wipe: NWC service keys (nostr secret key
    // material) survived because NostrWalletConnectStore's keys were never in
    // the wipe list.
    it('clears NWC key material and rating state', async () => {
        await clearAllData();

        expect(removedKeys()).toContain('zeus-nwc-service-keys');
        expect(removedKeys()).toContain('zeus-nwc-client-keys');
        expect(removedKeys()).toContain('zeus-nwc-connections');
        expect(removedKeys()).toContain('successfulPaymentCount');
        expect(removedKeys()).toContain('lnurlpay:');
    });

    // Observed on-device: an async updateSettings landed ~20ms after the wipe
    // finished and re-persisted the full in-memory settings blob (every node
    // config) because getSettings falls back to memory on a storage miss.
    it('blocks Storage writes before clearing anything', async () => {
        const mockedBlockWrites = (Storage as any).blockWrites as jest.Mock;

        await clearAllData();

        expect(mockedBlockWrites).toHaveBeenCalled();
        expect(mockedBlockWrites.mock.invocationCallOrder[0]).toBeLessThan(
            mockedStorageRemoveItem.mock.invocationCallOrder[0]
        );
    });
});

describe('Cashu key clearing completeness', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedStorageGetItem.mockResolvedValue(null);
    });

    // Found on-device: '<nodeDir>-cashu-original-seed-version' survived wallet
    // deletion because CashuStore had grown keys the clear list never learned
    // about. Scan the store's source so the next new key fails this test
    // instead of surviving a wipe.
    it('CASHU_KEY_SUFFIXES covers every -cashu- key CashuStore writes', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../stores/CashuStore.ts'),
            'utf8'
        );
        const found = Array.from(
            source.matchAll(/-cashu-([A-Za-z0-9-]+)/g),
            (m) => m[1]
        );
        const missing = [...new Set(found)].filter(
            (suffix) => !CASHU_KEY_SUFFIXES.includes(suffix)
        );
        expect(missing).toEqual([]);
    });

    it('clears the keys the on-device test found surviving', async () => {
        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(removedKeys()).toContain('lnd-abc-cashu-original-seed-version');
        expect(removedKeys()).toContain('lnd-abc-cashu-offline-pending-tokens');
        expect(removedKeys()).toContain('lnd-abc-cashu-offline-spent-tokens');
    });

    it('clears legacy per-mint wallet keys using the mint list read before clearing', async () => {
        mockedStorageGetItem.mockImplementation((key: string) =>
            key === 'lnd-abc-cashu-mintUrls'
                ? Promise.resolve(JSON.stringify(['https://mint.example']))
                : Promise.resolve(null)
        );

        await clearNodeKeychainData({
            implementation: 'embedded-lnd',
            lndDir: 'lnd-abc'
        });

        expect(removedKeys()).toContain('lnd-abc==https://mint.example-proofs');
        expect(removedKeys()).toContain(
            'lnd-abc==https://mint.example-counter'
        );
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

        // Like the CASHU_KEY_SUFFIXES guard above: clearCDKDatabaseForNode
        // reconstructs filenames the native modules created, so the hashing
        // convention (first 8 bytes of sha256(mnemonic) as hex) must stay in
        // lockstep with CashuDevKitModule.kt/.swift. Scan both sources so a
        // convention change fails here instead of silently orphaning dbs.
        it('matches the Android CDK filename hashing convention', () => {
            const source = fs.readFileSync(
                path.join(
                    __dirname,
                    '../android/app/src/main/java/com/zeus/cashudevkit/CashuDevKitModule.kt'
                ),
                'utf8'
            );
            expect(source).toContain('MessageDigest.getInstance("SHA-256")');
            expect(source).toContain('hashBytes.take(8)');
            expect(source).toContain('"cashu_wallet_$hashHex.db"');
        });

        it('matches the iOS CDK filename hashing convention', () => {
            const source = fs.readFileSync(
                path.join(
                    __dirname,
                    '../ios/CashuDevKit/CashuDevKitModule.swift'
                ),
                'utf8'
            );
            expect(source).toContain('CC_SHA256(');
            expect(source).toContain('hash.prefix(8)');
            expect(source).toContain('cashu_wallet_\\(hashHex).db');
        });

        it('reconstructs the filename from a fixed vector, independent of hash.js', async () => {
            // sha256('abandon ability able about') =
            // 2364a17ff3507501df1e6385392fce14825bc0cf6e096543633d9df08c13bf8c
            mockedStorageGetItem.mockImplementation((key: string) =>
                key === 'lnd-abc-cashu-seed-phrase'
                    ? Promise.resolve(
                          JSON.stringify([
                              'abandon',
                              'ability',
                              'able',
                              'about'
                          ])
                      )
                    : Promise.resolve(null)
            );
            mockedExists.mockResolvedValue(true);

            await clearCDKDatabaseForNode({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-abc'
            });

            expect(
                unlinkedPaths().some((p) =>
                    p.endsWith('cashu_wallet_2364a17ff3507501.db')
                )
            ).toBe(true);
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

describe('blockNavigationDuringWipe (mid-wipe navigation guard)', () => {
    // Reported on-device (PR #4328): during the wipe's loading state the user
    // could still leave the screen - hardware/gesture back exits the app from
    // the lockscreen or pops the Tools screen while the wipe runs beneath it.
    const makeNavigation = () => {
        const removeBeforeRemove = jest.fn();
        const navigation = {
            setOptions: jest.fn(),
            addListener: jest.fn().mockReturnValue(removeBeforeRemove)
        };
        return { navigation, removeBeforeRemove };
    };

    let backSubscription: { remove: jest.Mock };
    let backHandlerSpy: jest.SpyInstance;

    beforeEach(() => {
        backSubscription = { remove: jest.fn() };
        backHandlerSpy = jest
            .spyOn(BackHandler, 'addEventListener')
            .mockReturnValue(backSubscription as any);
    });

    afterEach(() => {
        backHandlerSpy.mockRestore();
    });

    it('swallows hardware back presses for the duration of the wipe', () => {
        const { navigation } = makeNavigation();

        blockNavigationDuringWipe(navigation);

        expect(backHandlerSpy).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function)
        );
        // returning true stops the event before the App-level handler can
        // exit the app (lockscreen) or pop the screen (Tools)
        const handler = backHandlerSpy.mock.calls[0][1];
        expect(handler()).toBe(true);
    });

    it('blocks removal of the screen from the navigation stack', () => {
        const { navigation } = makeNavigation();

        blockNavigationDuringWipe(navigation);

        expect(navigation.addListener).toHaveBeenCalledWith(
            'beforeRemove',
            expect.any(Function)
        );
        const listener = navigation.addListener.mock.calls[0][1];
        const event = { preventDefault: jest.fn() };
        listener(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('disables the iOS back-swipe gesture', () => {
        const { navigation } = makeNavigation();

        blockNavigationDuringWipe(navigation);

        expect(navigation.setOptions).toHaveBeenCalledWith({
            gestureEnabled: false
        });
    });

    it('releases every guard through the returned function', () => {
        const { navigation, removeBeforeRemove } = makeNavigation();

        const release = blockNavigationDuringWipe(navigation);
        release();

        expect(backSubscription.remove).toHaveBeenCalled();
        expect(removeBeforeRemove).toHaveBeenCalled();
    });
});
