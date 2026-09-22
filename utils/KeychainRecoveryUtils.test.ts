import type { RecoveryResult } from './KeychainRecoveryUtils';

/**
 * KeychainRecoveryUtils pulls a dozen store modules in purely for their key
 * constants, and those drag native modules in behind them. Stubbing them with
 * the constants themselves keeps this a unit test of the recovery logic.
 */
jest.mock('../stores/SettingsStore', () => ({
    STORAGE_KEY: 'zeus-node-config',
    CURRENCY_CODES_KEY: 'currency-codes'
}));
jest.mock('../stores/ContactStore', () => ({ CONTACTS_KEY: 'contacts' }));
jest.mock('../stores/NotesStore', () => ({ NOTES_KEY: 'notes' }));
jest.mock('../stores/ChannelBackupStore', () => ({
    LAST_CHANNEL_BACKUP_STATUS: 'backup-status',
    LAST_CHANNEL_BACKUP_TIME: 'backup-time'
}));
jest.mock('../stores/LightningAddressStore', () => ({
    ADDRESS_ACTIVATED_STRING: 'address-activated',
    HASHES_STORAGE_STRING: 'address-hashes'
}));
jest.mock('../stores/PosStore', () => ({
    POS_HIDDEN_KEY: 'pos-hidden',
    POS_STANDALONE_KEY: 'pos-standalone'
}));
jest.mock('../stores/InventoryStore', () => ({
    CATEGORY_KEY: 'categories',
    PRODUCT_KEY: 'products'
}));
jest.mock('../stores/UnitsStore', () => ({ UNIT_KEY: 'units' }));
jest.mock('../stores/UTXOsStore', () => ({
    HIDDEN_ACCOUNTS_KEY: 'hidden-accounts'
}));
jest.mock('../stores/ActivityStore', () => ({
    ACTIVITY_FILTERS_KEY: 'activity-filters'
}));
jest.mock('../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps-orders' }));
jest.mock('../utils/MigrationUtils', () => ({ IS_BACKED_UP_KEY: 'backed-up' }));
jest.mock('../utils/SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps',
    SWAPS_RESCUE_KEY: 'swaps-rescue',
    SWAPS_LAST_USED_KEY: 'swaps-last-used'
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('react-native-keychain', () => ({
    getInternetCredentials: jest.fn(),
    setInternetCredentials: jest.fn(),
    resetInternetCredentials: jest.fn()
}));

jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() },
    KEY_PREFIX: 'zeus:',
    getRawItem: jest.fn()
}));

import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';
import Storage, { getRawItem } from '../storage';
import { STORAGE_KEY } from '../stores/SettingsStore';
import utils from './KeychainRecoveryUtils';

const keychain = Keychain as jest.Mocked<typeof Keychain>;
// EncryptedStorage's methods are overloaded (promise and callback forms), so
// jest.Mocked<> resolves mockResolvedValue's parameter to never. The stub above
// is what these actually are.
const encrypted = EncryptedStorage as unknown as {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
};
const storage = Storage as jest.Mocked<typeof Storage>;
const rawItem = getRawItem as jest.MockedFunction<typeof getRawItem>;

const SETTINGS = JSON.stringify({
    // The first node carries both a nickname and a host so the
    // nickname-before-host fallback order is actually observable.
    nodes: [{ nickname: 'alice', host: '10.0.0.1' }, { host: '10.0.0.2' }, {}],
    selectedNode: 1
});

/** Storage.getItem resolves `false`, not null, when a key is unset. */
const storageMiss = () => storage.getItem.mockResolvedValue(false as any);

/** react-native-keychain resolves `false` when nothing is stored. */
const keychainMiss = () =>
    keychain.getInternetCredentials.mockResolvedValue(false as any);

const setPlatform = (os: string) => {
    (Platform as any).OS = os;
};

describe('KeychainRecoveryUtils', () => {
    let logs: jest.SpyInstance[];

    beforeEach(() => {
        jest.clearAllMocks();
        setPlatform('ios');
        storageMiss();
        keychainMiss();
        rawItem.mockResolvedValue(null as any);
        encrypted.getItem.mockResolvedValue(null as any);
        logs = [
            jest.spyOn(console, 'log').mockImplementation(() => {}),
            jest.spyOn(console, 'warn').mockImplementation(() => {}),
            jest.spyOn(console, 'error').mockImplementation(() => {})
        ];
    });

    afterEach(() => logs.forEach((l) => l.mockRestore()));

    describe('scanForRecoverableData', () => {
        it('reports settings held only in current storage', async () => {
            storage.getItem.mockImplementation(async (key: string) =>
                key === STORAGE_KEY ? SETTINGS : (false as any)
            );

            const result = await utils.scanForRecoverableData();

            expect(result.hasCurrentSettings).toBe(true);
            expect(result.error).toBeUndefined();
            expect(
                result.settingsFound.filter((r) => r.key === STORAGE_KEY)
            ).toEqual([
                expect.objectContaining({ source: 'current', data: SETTINGS })
            ]);
        });

        // The prefixed-cloud copy is the stale one once the desync migration
        // has run. Offering it alongside a live local copy invites restoring
        // over good data, so scanKey must suppress it -- this is the whole
        // safety property of that branch.
        it('hides the prefixed-cloud copy when current storage has the key', async () => {
            storage.getItem.mockImplementation(async (key: string) =>
                key === STORAGE_KEY ? SETTINGS : (false as any)
            );
            rawItem.mockResolvedValue('{"nodes":[]}' as any);

            const result = await utils.scanForRecoverableData();
            const sources = result.settingsFound
                .filter((r) => r.key === STORAGE_KEY)
                .map((r) => r.source);

            expect(sources).not.toContain('prefixed-cloud');
            expect(rawItem).not.toHaveBeenCalledWith(
                `zeus:${STORAGE_KEY}`,
                true
            );
        });

        it('offers the prefixed-cloud copy when current storage misses', async () => {
            rawItem.mockImplementation(async (key: string) =>
                key === `zeus:${STORAGE_KEY}` ? SETTINGS : (null as any)
            );

            const result = await utils.scanForRecoverableData();

            expect(result.hasCurrentSettings).toBe(false);
            expect(result.settingsFound).toContainEqual(
                expect.objectContaining({
                    key: STORAGE_KEY,
                    source: 'prefixed-cloud',
                    data: SETTINGS
                })
            );
        });

        it('keeps scanning when one source throws', async () => {
            storage.getItem.mockRejectedValue(new Error('keychain locked'));
            encrypted.getItem.mockImplementation(async (key: string) =>
                key === STORAGE_KEY ? SETTINGS : (null as any)
            );

            const result = await utils.scanForRecoverableData();

            expect(result.error).toBeUndefined();
            expect(result.settingsFound).toContainEqual(
                expect.objectContaining({
                    source: 'encrypted-storage',
                    data: SETTINGS
                })
            );
        });

        // otherDataFound drives a "recover orphaned data" list. Anything the
        // app can already read is not orphaned, so including it would offer a
        // pointless restore of a key over itself.
        it('lists only orphaned copies of non-settings keys', async () => {
            storage.getItem.mockResolvedValue('live' as any);
            encrypted.getItem.mockResolvedValue('stale' as any);

            const result = await utils.scanForRecoverableData();

            expect(result.otherDataFound.length).toBeGreaterThan(0);
            expect(
                result.otherDataFound.every((r) => r.source !== 'current')
            ).toBe(true);
        });

        it('does not set hasCurrentSettings from the legacy key alone', async () => {
            storage.getItem.mockImplementation(async (key: string) =>
                key === 'zeus-settings' ? SETTINGS : (false as any)
            );

            const result = await utils.scanForRecoverableData();

            expect(result.hasCurrentSettings).toBe(false);
        });
    });

    describe('iOS-only sources', () => {
        it.each(['android', 'macos'])(
            'never reads the cloud partitions on %s',
            async (os) => {
                setPlatform(os);

                await utils.scanForRecoverableData();

                expect(rawItem).not.toHaveBeenCalled();
                for (const call of keychain.getInternetCredentials.mock.calls) {
                    expect(call[1]).not.toEqual(
                        expect.objectContaining({ cloudSync: true })
                    );
                }
            }
        );
    });

    describe('restoreSettings', () => {
        const recovered = (data: string): RecoveryResult => ({
            key: STORAGE_KEY,
            source: 'unprefixed-cloud',
            data,
            description: 'Wallet Configurations'
        });

        it('writes the recovered payload verbatim and counts the nodes', async () => {
            storage.setItem.mockResolvedValue(true as any);
            storage.getItem.mockResolvedValue(SETTINGS as any);

            const result = await utils.restoreSettings(recovered(SETTINGS));

            expect(result).toEqual({ success: true, nodesRestored: 3 });
            expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, SETTINGS);
        });

        it.each([
            ['malformed JSON', 'not json at all'],
            ['a JSON null', 'null'],
            ['a bare number', '42']
        ])('refuses %s without writing', async (_label, data) => {
            const result = await utils.restoreSettings(recovered(data));

            expect(result.success).toBe(false);
            expect(storage.setItem).not.toHaveBeenCalled();
        });

        it('reports failure when the write is rejected', async () => {
            storage.setItem.mockResolvedValue(false as any);

            const result = await utils.restoreSettings(recovered(SETTINGS));

            expect(result).toEqual({
                success: false,
                error: 'Failed to write to storage'
            });
        });

        // Storage.setItem can resolve truthy while the value is not actually
        // readable back; reporting success there would tell someone their
        // wallet configs are safe when they are not.
        it('reports failure when the value cannot be read back', async () => {
            storage.setItem.mockResolvedValue(true as any);
            storageMiss();

            const result = await utils.restoreSettings(recovered(SETTINGS));

            expect(result).toEqual({
                success: false,
                error: 'Verification failed after write'
            });
        });

        // The dangerous case is not an empty read-back but a plausible one.
        // A key still holding an older copy reads as truthy, so a check that
        // only asks "is something there" reports the restore succeeded while
        // the wallet configs on disk are still the ones being replaced.
        it('reports failure when the read-back is a stale value', async () => {
            const stale = JSON.stringify({ nodes: [{ nickname: 'old' }] });
            storage.setItem.mockResolvedValue(true as any);
            storage.getItem.mockResolvedValue(stale as any);

            const result = await utils.restoreSettings(recovered(SETTINGS));

            expect(result).toEqual({
                success: false,
                error: 'Verification failed after write'
            });
        });
    });

    describe('restoreDataKey', () => {
        const recovered = (data: string): RecoveryResult => ({
            key: 'contacts',
            source: 'encrypted-storage',
            data,
            description: 'Contacts'
        });

        it('writes the payload under the recovered key', async () => {
            storage.setItem.mockResolvedValue(true as any);
            storage.getItem.mockResolvedValue('["alice"]' as any);

            const result = await utils.restoreDataKey(recovered('["alice"]'));

            expect(result).toEqual({ success: true });
            expect(storage.setItem).toHaveBeenCalledWith(
                'contacts',
                '["alice"]'
            );
        });

        it('reports failure when the write is rejected', async () => {
            storage.setItem.mockResolvedValue(false as any);

            const result = await utils.restoreDataKey(recovered('["alice"]'));

            expect(result).toEqual({
                success: false,
                error: 'Failed to write to storage'
            });
        });

        it('reports failure when the read-back is a stale value', async () => {
            storage.setItem.mockResolvedValue(true as any);
            storage.getItem.mockResolvedValue('["bob"]' as any);

            const result = await utils.restoreDataKey(recovered('["alice"]'));

            expect(result).toEqual({
                success: false,
                error: 'Verification failed after write'
            });
        });

        it('reports failure when the key cannot be read back at all', async () => {
            storage.setItem.mockResolvedValue(true as any);
            storageMiss();

            const result = await utils.restoreDataKey(recovered('["alice"]'));

            expect(result).toEqual({
                success: false,
                error: 'Verification failed after write'
            });
        });
    });

    describe('parseSettingsPreview', () => {
        it('names nodes by nickname, then host, then position', () => {
            expect(utils.parseSettingsPreview(SETTINGS)).toEqual({
                nodeCount: 3,
                nodeNames: ['alice', '10.0.0.2', 'Node 3'],
                selectedNode: 1
            });
        });

        it('treats settings with no nodes as an empty wallet list', () => {
            expect(utils.parseSettingsPreview('{}')).toEqual({
                nodeCount: 0,
                nodeNames: [],
                selectedNode: 0
            });
        });

        it.each(['', 'not json', 'null'])(
            'returns null rather than throwing on %p',
            (data) => {
                expect(utils.parseSettingsPreview(data)).toBeNull();
            }
        );
    });

    describe('getSourceDisplayName', () => {
        it('names every source the scanner can emit', () => {
            const sources: RecoveryResult['source'][] = [
                'current',
                'prefixed-cloud',
                'unprefixed-local',
                'unprefixed-cloud',
                'encrypted-storage'
            ];

            for (const source of sources) {
                expect(utils.getSourceDisplayName(source)).not.toBe('Unknown');
            }
            expect(utils.getSourceDisplayName('nope' as any)).toBe('Unknown');
        });
    });

    // Both helpers write or destroy the legacy keychain entries that the
    // recovery screen exists to find. Outside a dev build neither should be
    // reachable, whatever the UI does.
    describe('dev-only helpers', () => {
        const withDev = async (value: boolean, fn: () => Promise<any>) => {
            const original = (global as any).__DEV__;
            (global as any).__DEV__ = value;
            try {
                return await fn();
            } finally {
                (global as any).__DEV__ = original;
            }
        };

        it('copyToLegacyLocations refuses to run outside a dev build', async () => {
            // Seed current settings so the guard is the only thing standing
            // between this call and the keychain. Without it the unguarded
            // body would bail at "No current settings found to copy", and the
            // assertions below would hold whether the guard existed or not.
            storage.getItem.mockResolvedValue(SETTINGS as any);

            const result = await withDev(false, () =>
                utils.copyToLegacyLocations()
            );

            expect(result.success).toBe(false);
            expect(keychain.setInternetCredentials).not.toHaveBeenCalled();
            expect(encrypted.setItem).not.toHaveBeenCalled();
        });

        it('copyToLegacyLocations writes every legacy location in a dev build', async () => {
            storage.getItem.mockResolvedValue(SETTINGS as any);
            keychain.setInternetCredentials.mockResolvedValue(undefined as any);
            encrypted.setItem.mockResolvedValue(undefined as any);

            const result = await withDev(true, () =>
                utils.copyToLegacyLocations()
            );

            expect(result.locations).toEqual([
                'unprefixed-local',
                'unprefixed-cloud',
                'encrypted-storage'
            ]);
            expect(keychain.setInternetCredentials).toHaveBeenCalledWith(
                STORAGE_KEY,
                STORAGE_KEY,
                SETTINGS
            );
            expect(keychain.setInternetCredentials).toHaveBeenCalledWith(
                STORAGE_KEY,
                STORAGE_KEY,
                SETTINGS,
                { cloudSync: true }
            );
            expect(encrypted.setItem).toHaveBeenCalledWith(
                STORAGE_KEY,
                SETTINGS
            );
        });

        it('clearLegacyLocations refuses to run outside a dev build', async () => {
            const result = await withDev(false, () =>
                utils.clearLegacyLocations()
            );

            expect(result.success).toBe(false);
            expect(keychain.resetInternetCredentials).not.toHaveBeenCalled();
            expect(encrypted.removeItem).not.toHaveBeenCalled();
        });

        it('clearLegacyLocations puts current settings back if they vanish', async () => {
            storage.getItem
                .mockResolvedValueOnce(SETTINGS as any) // backup read
                .mockResolvedValueOnce(false as any) // verify: gone
                .mockResolvedValueOnce(SETTINGS as any); // after restore
            storage.setItem.mockResolvedValue(true as any);
            keychain.resetInternetCredentials.mockResolvedValue(
                undefined as any
            );
            encrypted.removeItem.mockResolvedValue(undefined as any);

            const result = await withDev(true, () =>
                utils.clearLegacyLocations()
            );

            expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, SETTINGS);
            // Positive assertions so the "did not call" checks in the guard
            // tests above mean something: a gutted clear would satisfy those
            // while failing these.
            expect(keychain.resetInternetCredentials).toHaveBeenCalledWith({
                server: STORAGE_KEY
            });
            expect(keychain.resetInternetCredentials).toHaveBeenCalledWith({
                server: STORAGE_KEY,
                cloudSync: true
            });
            expect(encrypted.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
            expect(result.cleared).toEqual([
                'unprefixed-local',
                'unprefixed-cloud',
                'encrypted-storage'
            ]);
            expect(result.success).toBe(true);
        });

        it('clearLegacyLocations reports failure when the restore does not take', async () => {
            storage.getItem
                .mockResolvedValueOnce(SETTINGS as any) // backup read
                .mockResolvedValueOnce(false as any) // verify: gone
                .mockResolvedValueOnce(false as any); // restore failed too
            storage.setItem.mockResolvedValue(true as any);
            keychain.resetInternetCredentials.mockResolvedValue(
                undefined as any
            );
            encrypted.removeItem.mockResolvedValue(undefined as any);

            const result = await withDev(true, () =>
                utils.clearLegacyLocations()
            );

            expect(result).toEqual({
                success: false,
                cleared: expect.any(Array),
                error: 'Current settings were lost and could not be restored'
            });
        });
    });
});
