import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

import { sleep } from './SleepUtils';
import { settingsStore } from '../stores/Stores';
import {
    Settings,
    DEFAULT_FIAT_RATES_SOURCE,
    DEFAULT_FIAT,
    DEFAULT_LSP_MAINNET,
    DEFAULT_LSP_TESTNET,
    DEFAULT_NOSTR_RELAYS,
    localeMigrationMapping,
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET,
    DEFAULT_LSPS1_HOST_MAINNET,
    DEFAULT_LSPS1_HOST_TESTNET,
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_LSPS1_PUBKEY_TESTNET,
    DEFAULT_LSPS1_REST_MAINNET,
    DEFAULT_LSPS1_REST_TESTNET,
    DEFAULT_LSP_MUTINYNET,
    DEFAULT_LSPS1_REST_MUTINYNET,
    DEFAULT_SPEEDLOADER,
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET,
    LEGACY_ZEUS_SWAP_HOST_MAINNET,
    LEGACY_ZEUS_SWAP_HOST_TESTNET,
    RETIRED_SWAP_HOSTS_MAINNET,
    DEFAULT_NOSTR_RELAYS_2023,
    PosEnabled,
    DEFAULT_SLIDE_TO_PAY_THRESHOLD,
    STORAGE_KEY,
    LEGACY_CURRENCY_CODES_KEY,
    CURRENCY_CODES_KEY
} from '../stores/SettingsStore';

import { LEGACY_NOTES_KEY, NOTES_KEY } from '../stores/NotesStore';
import { LEGACY_CONTACTS_KEY, CONTACTS_KEY } from '../stores/ContactStore';
import {
    LEGACY_LAST_CHANNEL_BACKUP_STATUS,
    LEGACY_LAST_CHANNEL_BACKUP_TIME,
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME
} from '../stores/ChannelBackupStore';
import {
    LEGACY_ADDRESS_ACTIVATED_STRING,
    LEGACY_HASHES_STORAGE_STRING,
    ADDRESS_ACTIVATED_STRING,
    HASHES_STORAGE_STRING
} from '../stores/LightningAddressStore';
import {
    LEGACY_POS_HIDDEN_KEY,
    LEGACY_POS_STANDALONE_KEY,
    POS_HIDDEN_KEY,
    POS_STANDALONE_KEY
} from '../stores/PosStore';
import {
    LEGACY_CATEGORY_KEY,
    LEGACY_PRODUCT_KEY,
    CATEGORY_KEY,
    PRODUCT_KEY
} from '../stores/InventoryStore';
import { LEGACY_UNIT_KEY, UNIT_KEY } from '../stores/UnitsStore';
import {
    LEGACY_HIDDEN_ACCOUNTS_KEY,
    HIDDEN_ACCOUNTS_KEY
} from '../stores/UTXOsStore';

import { LEGACY_LSPS1_ORDERS_KEY, LSPS_ORDERS_KEY } from '../stores/LSPStore';

import { LNC_STORAGE_KEY, hash } from '../backends/LNC/credentialStore';

import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY,
    purgeLegacyRescueKeyFiles,
    unlinkRescueKeyStagingFile
} from '../utils/SwapUtils';

import {
    TimePeriod,
    displayFromExpirySeconds,
    expirySecondsFromInput
} from '../utils/ExpiryUtils';

import {
    LEGACY_ACTIVITY_FILTERS_KEY,
    ACTIVITY_FILTERS_KEY
} from '../stores/ActivityStore';

const LEGACY_IS_BACKED_UP_KEY = 'backup-complete';
export const IS_BACKED_UP_KEY = 'backup-complete-v2';

const KEYCHAIN_MIGRATION_KEY = 'ios-keychain-cloud-sync-migration-v1';
const CASHU_MIGRATION_KEY = 'ios-keychain-cashu-fix-v1';

import EncryptedStorage from 'react-native-encrypted-storage';
import Storage from '../storage';

class MigrationsUtils {
    /**
     * Migrates a key from old keychain (cloud or local) to new Storage namespace.
     * Safe order: read → write → verify → delete
     *
     * Since Storage now uses a "zeus:" prefix, old and new keys are in different
     * namespaces, so deleting old keys won't affect newly written data.
     */
    private async migrateKey(key: string): Promise<string | null> {
        try {
            // 1. Check if already migrated to new Storage namespace
            const existingData = await Storage.getItem(key);
            if (existingData) return existingData;

            // 2. Read from old keychain (local first, then cloud)
            const credentials = await this.readFromOldKeychain(key);
            if (!credentials) return null;

            console.log(`[Migration] Moving ${key} to Local Storage...`);

            // iOS: Add delay after read to allow iCloud sync
            if (Platform.OS === 'ios') {
                await sleep(500);
            }

            // 3. Write to new Storage namespace (zeus:key)
            const writeSuccess = await Storage.setItem(
                key,
                credentials.password
            );

            if (!writeSuccess) {
                throw new Error(
                    `Write failed for ${key}. Storage.setItem returned false.`
                );
            }

            // 4. Verify write succeeded by reading back
            const verifyData = await Storage.getItem(key);
            if (!verifyData) {
                throw new Error(
                    `Verification failed for ${key}. Data not found after write.`
                );
            }

            // iOS: Add delay before delete to allow iCloud sync
            if (Platform.OS === 'ios') {
                await sleep(500);
            }

            // 5. Only delete old keychain entries after successful write + verify
            await this.deleteFromOldKeychain(key);

            console.log(`[Migration] Successfully migrated ${key}`);
            return credentials.password;
        } catch (error) {
            console.error(`[Migration] Failed to migrate ${key}:`, error);
            throw error;
        }
    }

    /**
     * Reads from old keychain (without zeus: prefix).
     * Tries local keychain first, then cloud keychain as fallback.
     */
    private async readFromOldKeychain(key: string) {
        try {
            // Try local keychain first
            const localCreds = await Keychain.getInternetCredentials(key);
            if (localCreds) return localCreds;

            // Fallback to cloud keychain
            return await Keychain.getInternetCredentials(key, {
                cloudSync: true
            });
        } catch (e) {
            console.warn(`[Migration] Read error for ${key}`, e);
            return null;
        }
    }

    /**
     * Deletes from old keychain entries (without zeus: prefix).
     *
     * DISABLED: To prevent potential data loss during migration.
     * Old keychain entries will remain but are harmless (orphaned data).
     * The new Storage uses a "zeus:" prefix, so old and new keys don't conflict.
     */
    private async deleteFromOldKeychain(key: string) {
        // Safety measure: skip deletion to prevent any potential data loss
        console.log(`[Migration] Skipping delete for ${key} (safety measure)`);
        return;

        // Original delete code - commented out for safety:
        // try {
        //     await Keychain.resetInternetCredentials({
        //         server: key,
        //         cloudSync: true
        //     });
        // } catch (e) {
        //     console.warn(
        //         `[Migration] Error deleting from cloud keychain: ${key}`,
        //         e
        //     );
        // }
        // try {
        //     await Keychain.resetInternetCredentials({ server: key });
        // } catch (e) {
        //     console.warn(
        //         `[Migration] Error deleting from local keychain: ${key}`,
        //         e
        //     );
        // }
    }

    private async migrateCashuForNode(lndDir: string) {
        console.log(`Migrating Cashu data for node: ${lndDir}`);

        const cashuKeys = [
            `${lndDir}-cashu-mintUrls`,
            `${lndDir}-cashu-selectedMintUrl`,
            `${lndDir}-cashu-totalBalanceSats`,
            `${lndDir}-cashu-invoices`,
            `${lndDir}-cashu-payments`,
            `${lndDir}-cashu-received-tokens`,
            `${lndDir}-cashu-sent-tokens`,
            `${lndDir}-cashu-seed-version`,
            `${lndDir}-cashu-seed-phrase`,
            `${lndDir}-cashu-seed`
        ];

        for (const key of cashuKeys) {
            await this.migrateKey(key);
        }

        const mintUrlsJson = await this.migrateKey(`${lndDir}-cashu-mintUrls`);

        if (mintUrlsJson) {
            try {
                const mintUrls = JSON.parse(mintUrlsJson);
                if (Array.isArray(mintUrls)) {
                    for (const mintUrl of mintUrls) {
                        const walletId = `${lndDir}==${mintUrl}`;
                        const walletKeys = [
                            `${walletId}-mintInfo`,
                            `${walletId}-counter`,
                            `${walletId}-proofs`,
                            `${walletId}-balance`,
                            `${walletId}-pubkey`
                        ];
                        for (const wKey of walletKeys) {
                            await this.migrateKey(wKey);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to parse mintUrls for ${lndDir}`, e);
            }
        }
    }

    public async legacySettingsMigrations(settings: string) {
        const newSettings = JSON.parse(settings) as Settings;
        if (!newSettings.fiatRatesSource) {
            newSettings.fiatRatesSource = DEFAULT_FIAT_RATES_SOURCE;
        }

        // migrate fiat settings from older versions
        if (!newSettings.fiat || newSettings.fiat === 'Disabled') {
            newSettings.fiat = DEFAULT_FIAT;
            newSettings.fiatEnabled = false;
        } else if (newSettings.fiatEnabled == null) {
            newSettings.fiatEnabled = true;
        }

        // set default LSPs if not defined
        if (newSettings.enableLSP === undefined) {
            newSettings.enableLSP = true;
        }
        if (!newSettings.lspMainnet) {
            newSettings.lspMainnet = DEFAULT_LSP_MAINNET;
        }
        if (!newSettings.lspTestnet) {
            newSettings.lspTestnet = DEFAULT_LSP_TESTNET;
        }

        // default Lightning Address settings
        if (!newSettings.lightningAddress) {
            newSettings.lightningAddress = {
                enabled: false,
                automaticallyAccept: true,
                automaticallyAcceptAttestationLevel: 2,
                automaticallyRequestOlympusChannels: false, // deprecated
                routeHints: false,
                allowComments: true,
                zapReceiptsEnabled: true,
                nostrPrivateKey: '',
                nostrRelays: DEFAULT_NOSTR_RELAYS,
                notifications: 0,
                mintUrl: '' // Cashu
            };
        }

        // migrate locale to ISO 639-1
        if (
            newSettings.locale != null &&
            localeMigrationMapping[newSettings.locale]
        ) {
            newSettings.locale = localeMigrationMapping[newSettings.locale];
        }

        const MOD_KEY = 'lsp-taproot-mod';
        const mod = await EncryptedStorage.getItem(MOD_KEY);
        if (!mod) {
            newSettings.requestSimpleTaproot = true;
            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY, 'true');
        }

        const MOD_KEY2 = 'lsp-preview-mod';
        const mod2 = await EncryptedStorage.getItem(MOD_KEY2);
        if (!mod2) {
            if (newSettings?.lspMainnet === 'https://lsp-preview.lnolymp.us') {
                newSettings.lspMainnet = DEFAULT_LSP_MAINNET;
            }
            if (newSettings?.lspTestnet === 'https://testnet-lsp.lnolymp.us') {
                newSettings.lspTestnet = DEFAULT_LSP_TESTNET;
            }
            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY2, 'true');
        }

        const MOD_KEY3 = 'neutrino-peers-mod1';
        const mod3 = await EncryptedStorage.getItem(MOD_KEY3);
        if (!mod3) {
            const neutrinoPeersMainnetOld = [
                'btcd1.lnolymp.us',
                'btcd2.lnolymp.us',
                'btcd-mainnet.lightning.computer',
                'node.eldamar.icu',
                'noad.sathoarder.com'
            ];
            if (
                JSON.stringify(newSettings?.neutrinoPeersMainnet) ===
                JSON.stringify(neutrinoPeersMainnetOld)
            ) {
                newSettings.neutrinoPeersMainnet =
                    DEFAULT_NEUTRINO_PEERS_MAINNET;
            }
            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY3, 'true');
        }

        const MOD_KEY4 = 'lsps1-hosts1';
        const mod4 = await EncryptedStorage.getItem(MOD_KEY4);
        if (!mod4) {
            if (!newSettings?.lsps1HostMainnet) {
                newSettings.lsps1HostMainnet = DEFAULT_LSPS1_HOST_MAINNET;
            }
            if (!newSettings?.lsps1HostTestnet) {
                newSettings.lsps1HostTestnet = DEFAULT_LSPS1_HOST_TESTNET;
            }
            if (!newSettings?.lsps1PubkeyMainnet) {
                newSettings.lsps1PubkeyMainnet = DEFAULT_LSPS1_PUBKEY_MAINNET;
            }
            if (!newSettings?.lsps1PubkeyTestnet) {
                newSettings.lsps1PubkeyTestnet = DEFAULT_LSPS1_PUBKEY_TESTNET;
            }
            if (!newSettings?.lsps1RestMainnet) {
                newSettings.lsps1RestMainnet = DEFAULT_LSPS1_REST_MAINNET;
            }
            if (!newSettings?.lsps1RestTestnet) {
                newSettings.lsps1RestTestnet = DEFAULT_LSPS1_REST_TESTNET;
            }

            if (!newSettings?.lsps1Token) {
                newSettings.lsps1Token = '';
            }

            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY4, 'true');
        }

        const MOD_KEY5 = 'millisat_amounts';
        const mod5 = await EncryptedStorage.getItem(MOD_KEY5);
        if (!mod5) {
            if (!newSettings?.display?.showMillisatoshiAmounts) {
                if (!newSettings.display) {
                    newSettings.display = {
                        showMillisatoshiAmounts: true
                    };
                } else {
                    newSettings.display.showMillisatoshiAmounts = true;
                }
            }

            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY5, 'true');
        }

        const MOD_KEY6 = 'egs-host';
        const mod6 = await EncryptedStorage.getItem(MOD_KEY6);
        if (!mod6) {
            if (!newSettings?.speedloader) {
                newSettings.speedloader = DEFAULT_SPEEDLOADER;
                newSettings.customSpeedloader = '';
            }

            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY6, 'true');
        }

        // switch off bimodal pathfinding while bug exists
        // https://github.com/lightningnetwork/lnd/issues/9085
        const MOD_KEY7 = 'bimodal-bug-9085';
        const mod7 = await EncryptedStorage.getItem(MOD_KEY7);
        if (!mod7) {
            if (newSettings?.bimodalPathfinding) {
                newSettings.bimodalPathfinding = false;
            }

            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY7, 'true');
        }

        const MOD_KEY8 = 'nostr-relays-2024';
        const mod8 = await EncryptedStorage.getItem(MOD_KEY8);
        if (!mod8) {
            if (
                JSON.stringify(newSettings?.lightningAddress?.nostrRelays) ===
                JSON.stringify(DEFAULT_NOSTR_RELAYS_2023)
            ) {
                newSettings.lightningAddress.nostrRelays = DEFAULT_NOSTR_RELAYS;
            }

            await settingsStore.setSettings(newSettings);
            await EncryptedStorage.setItem(MOD_KEY8, 'true');
        }

        await this.migrateInvoiceExpiryDisplay(newSettings);

        // migrate old POS squareEnabled setting to posEnabled
        if (newSettings?.pos?.squareEnabled) {
            newSettings.pos.posEnabled = PosEnabled.Square;
            newSettings.pos.squareEnabled = false;
        }

        if (!newSettings.neutrinoPeersMainnet) {
            newSettings.neutrinoPeersMainnet = DEFAULT_NEUTRINO_PEERS_MAINNET;
        }
        if (!newSettings.neutrinoPeersTestnet) {
            newSettings.neutrinoPeersTestnet = DEFAULT_NEUTRINO_PEERS_TESTNET;
        }

        if (newSettings.payments == null) {
            newSettings.payments = {
                slideToPayThreshold: DEFAULT_SLIDE_TO_PAY_THRESHOLD
            };
        } else if (newSettings.payments.slideToPayThreshold == null) {
            newSettings.payments.slideToPayThreshold =
                DEFAULT_SLIDE_TO_PAY_THRESHOLD;
        }

        // migrate retired v1 RGS endpoints to v2 (BOLT 12 offer support)
        await this.migrateRgsDefaultsToV2(newSettings);

        // migrate old default Olympus LSP hosts to new zeuslsp.com hosts
        await this.migrateOlympusHostsToZeusLsp(newSettings);

        // migrate retired ZEUS swap server hosts to Boltz
        await this.migrateSwapHostsToBoltz(newSettings);

        // move users off swap providers that have shut down
        await this.migrateRetiredSwapHosts(newSettings);

        // normalize nodes saved without a certVerification key to the
        // explicit pre-flip default (trust-all)
        await this.migrateCertVerificationDefault(newSettings);

        return newSettings;
    }

    // Rewrite persisted v1 RGS endpoints to their v2 equivalents in a
    // single pass. RGS v1 snapshots lack node announcement data (features
    // + addresses), which LDK requires to deliver BOLT 12 invoice_requests
    // to an offer's introduction node. Only values still equal to a known
    // old default are touched; custom URLs are left alone. Unset values
    // need no migration — runtime falls back to the (updated)
    // RGS_SERVERS_MAINNET / RGS_SERVERS_TESTNET constants. Mappings are
    // scoped per network so a URL is only rewritten on nodes of the
    // network it belongs to. Supersedes migrateRgsDefaultToZeus
    // ('rgs-default-zeus'), which pinned the then-default into every
    // mainnet node; the values it wrote are matched here, so its flag is
    // no longer consulted and unset values are no longer pinned (#4470:
    // fewer keystore ops). Must run on both the legacy and modern
    // (zeus-settings-v2) paths.
    public async migrateRgsDefaultsToV2(settings: any) {
        const MOD_KEY_RGS_V2 = 'rgs-defaults-v2';
        const modRgsV2 = await EncryptedStorage.getItem(MOD_KEY_RGS_V2);
        if (modRgsV2) return settings;

        const urlMigrationsByNetwork: {
            [network: string]: { [oldUrl: string]: string };
        } = {
            mainnet: {
                'https://rgs.zeusln.com/snapshot':
                    'https://rgs.zeusln.com/snapshot/v2',
                'https://rapidsync.lightningdevkit.org/snapshot':
                    'https://rapidsync.lightningdevkit.org/snapshot/v2'
            },
            testnet: {
                'https://rapidsync.lightningdevkit.org/testnet/snapshot':
                    'https://rapidsync.lightningdevkit.org/testnet/v2/snapshot'
            }
        };

        let changed = false;
        if (settings?.nodes && Array.isArray(settings.nodes)) {
            for (const node of settings.nodes) {
                const urlMigrations =
                    urlMigrationsByNetwork[node.ldkNetwork || 'mainnet'];
                if (
                    urlMigrations &&
                    node.ldkRgsServer &&
                    urlMigrations[node.ldkRgsServer]
                ) {
                    node.ldkRgsServer = urlMigrations[node.ldkRgsServer];
                    changed = true;
                }
            }
        }

        if (changed) await settingsStore.setSettings(settings);
        await EncryptedStorage.setItem(MOD_KEY_RGS_V2, 'true');
        return settings;
    }

    // Rewrite persisted old-default Olympus LSP hosts (lnolymp.us) to the
    // new zeuslsp.com hosts. Only values still equal to an old default are
    // touched; custom hosts are left alone. Unset values need no migration —
    // runtime falls back to the (updated) DEFAULT_* constants. Must run on
    // both the legacy and modern (zeus-settings-v2) paths.
    public async migrateOlympusHostsToZeusLsp(settings: any) {
        const MOD_KEY_ZEUSLSP = 'zeuslsp-hosts-2026';
        const mod = await EncryptedStorage.getItem(MOD_KEY_ZEUSLSP);
        if (mod) return settings;

        const hostMigrations: Array<{
            settingsKey: string;
            oldHost: string;
            newHost: string;
        }> = [
            {
                settingsKey: 'lspMainnet',
                oldHost: 'https://0conf.lnolymp.us',
                newHost: DEFAULT_LSP_MAINNET
            },
            {
                settingsKey: 'lspTestnet',
                oldHost: 'https://testnet-0conf.lnolymp.us',
                newHost: DEFAULT_LSP_TESTNET
            },
            {
                settingsKey: 'lspMutinynet',
                oldHost: 'https://mutinynet-flow.lnolymp.us',
                newHost: DEFAULT_LSP_MUTINYNET
            },
            {
                settingsKey: 'lsps1RestMainnet',
                oldHost: 'https://lsps1.lnolymp.us',
                newHost: DEFAULT_LSPS1_REST_MAINNET
            },
            {
                settingsKey: 'lsps1RestTestnet',
                oldHost: 'https://testnet-lsps1.lnolymp.us',
                newHost: DEFAULT_LSPS1_REST_TESTNET
            },
            {
                settingsKey: 'lsps1RestMutinynet',
                oldHost: 'https://mutinynet-lsps1.lnolymp.us',
                newHost: DEFAULT_LSPS1_REST_MUTINYNET
            }
        ];

        let changed = false;
        for (const { settingsKey, oldHost, newHost } of hostMigrations) {
            if (settings?.[settingsKey] === oldHost) {
                settings[settingsKey] = newHost;
                changed = true;
            }
        }

        if (changed) {
            await settingsStore.setSettings(settings);
        }
        await EncryptedStorage.setItem(MOD_KEY_ZEUSLSP, 'true');
        return settings;
    }

    // migrate users pointed at the retired ZEUS swap server to Boltz.
    // Must run on both the legacy and modern (zeus-settings-v2) paths.
    public async migrateSwapHostsToBoltz(settings: any) {
        const MOD_KEY_SWAP_HOSTS = 'swap-hosts-boltz';
        const modSwapHosts = await EncryptedStorage.getItem(MOD_KEY_SWAP_HOSTS);
        if (modSwapHosts) return settings;

        let changed = false;
        if (settings?.swaps) {
            if (settings.swaps.hostMainnet === LEGACY_ZEUS_SWAP_HOST_MAINNET) {
                settings.swaps.hostMainnet = DEFAULT_SWAP_HOST_MAINNET;
                changed = true;
            }
            if (settings.swaps.hostTestnet === LEGACY_ZEUS_SWAP_HOST_TESTNET) {
                settings.swaps.hostTestnet = DEFAULT_SWAP_HOST_TESTNET;
                changed = true;
            }
        }

        if (changed) await settingsStore.setSettings(settings);
        await EncryptedStorage.setItem(MOD_KEY_SWAP_HOSTS, 'true');
        return settings;
    }

    // Move users pinned to a swap provider that has shut down back to the
    // default host. Without this their persisted host no longer matches any
    // entry in SWAP_HOST_KEYS_MAINNET, so the provider dropdown renders no
    // selection while every swap request goes to a dead endpoint. Custom
    // hosts are left alone: a retired host is only rewritten when it was
    // picked from the dropdown, not typed in as a custom host. Must run on
    // both the legacy and modern (zeus-settings-v2) paths.
    public async migrateRetiredSwapHosts(settings: any) {
        const MOD_KEY_RETIRED_SWAP_HOSTS = 'swap-hosts-retired-eldamar';
        const mod = await EncryptedStorage.getItem(MOD_KEY_RETIRED_SWAP_HOSTS);
        if (mod) return settings;

        let changed = false;
        if (
            settings?.swaps?.hostMainnet &&
            RETIRED_SWAP_HOSTS_MAINNET.includes(settings.swaps.hostMainnet)
        ) {
            settings.swaps.hostMainnet = DEFAULT_SWAP_HOST_MAINNET;
            changed = true;
        }

        if (changed) await settingsStore.setSettings(settings);
        await EncryptedStorage.setItem(MOD_KEY_RETIRED_SWAP_HOSTS, 'true');
        return settings;
    }

    // Repair invoice expiry display fields when out of sync with
    // `expirySeconds`. Older installs default `expiry: '3600'` and
    // never stored `timePeriod`/`expirySeconds`, so once Receive.tsx's
    // fallback for `timePeriod` became 'Hours' the UI rendered
    // "3600 hours" while invoices still expired in one hour. Derive a
    // canonical seconds value (stored → derived from expiry+timePeriod
    // → '3600') and rewrite all three fields from it when anything is
    // missing or inconsistent. Must run on both the legacy and modern
    // (zeus-settings-v2) paths.
    public async migrateInvoiceExpiryDisplay(settings: any) {
        const MOD_KEY_INVOICE_EXPIRY = 'invoices-expiry-display-fix-v2';
        const modInvoiceExpiry = await EncryptedStorage.getItem(
            MOD_KEY_INVOICE_EXPIRY
        );
        if (modInvoiceExpiry) return settings;

        const invoices: any = settings?.invoices;
        if (invoices) {
            const storedValid = Number(invoices.expirySeconds) > 0;
            const derivable = invoices.expiry && invoices.timePeriod;
            const canonical = storedValid
                ? invoices.expirySeconds
                : derivable
                ? expirySecondsFromInput(
                      invoices.expiry,
                      invoices.timePeriod as TimePeriod
                  )
                : '3600';

            const inconsistent =
                !invoices.expiry ||
                !invoices.timePeriod ||
                invoices.expirySeconds !== canonical ||
                expirySecondsFromInput(
                    invoices.expiry,
                    invoices.timePeriod as TimePeriod
                ) !== canonical;

            if (inconsistent) {
                const repaired = displayFromExpirySeconds(canonical);
                invoices.expiry = repaired.expiry;
                invoices.timePeriod = repaired.timePeriod;
                invoices.expirySeconds = canonical;
                await settingsStore.setSettings(settings);
            }
        }
        await EncryptedStorage.setItem(MOD_KEY_INVOICE_EXPIRY, 'true');
        return settings;
    }

    // Rescue-key export file cleanup, in two parts with different cadences.
    //
    // Staging file: the save-dialog export stages the mnemonic in app cache
    // and removes it before returning, so this unlink is belt-and-braces for
    // saves interrupted by a crash and for files staged by earlier
    // share-sheet builds of this flow. It must run at most once per process:
    // getSettings() is not a launch-only path, it also runs on every
    // transition to the background (App.tsx stealth-mode handler), and the
    // Android save dialog backgrounds the app while the staging file still
    // has to be readable - saveDocuments() only copies it once the app is
    // back in the foreground. Unlinking on every call deletes the source out
    // from under the copy and fails the export.
    //
    // Legacy shared-storage files: older builds' download wrote the mnemonic
    // as plaintext JSON into shared storage (Android public Downloads, iOS
    // Files-visible Documents), with nothing ever deleting it. One-shot
    // best-effort cleanup; the flag is set regardless of outcome because a
    // failed unlink (scoped storage, file owned by a previous install) can
    // never succeed on a later retry.
    //
    // Runs before the settings blob is even read, so it covers both the
    // legacy and modern (zeus-settings-v2) paths.
    private rescueKeyStagingPurged = false;

    public async purgeRescueKeyFiles() {
        if (!this.rescueKeyStagingPurged) {
            this.rescueKeyStagingPurged = true;
            await unlinkRescueKeyStagingFile();
        }

        const MOD_KEY_RESCUE_FILE = 'rescue-key-file-cleanup';
        const modRescueFile = await EncryptedStorage.getItem(
            MOD_KEY_RESCUE_FILE
        );
        if (modRescueFile) return;

        await purgeLegacyRescueKeyFiles();

        await EncryptedStorage.setItem(MOD_KEY_RESCUE_FILE, 'true');
    }

    // Normalize nodes saved without a `certVerification` key to an explicit
    // `false`. Those connections were established under trust-all (the old
    // default), and `JSON.stringify` drops undefined values, so QR/clipboard
    // imports of that era carry no key at all. Without this normalization
    // the new secure-by-default fallback (`?? true`) would flip them to
    // strict CA validation on upgrade and break self-signed remotes that
    // predate pinnedCerts. Trust-all for existing nodes stays an explicit
    // stored value; the strict default only governs new configs. Runs on
    // both the legacy and modern (zeus-settings-v2) load paths.
    public async migrateCertVerificationDefault(settings: any) {
        const MOD_KEY_CERT_VERIFICATION = 'cert-verification-default-v1';
        const modCertVerification = await EncryptedStorage.getItem(
            MOD_KEY_CERT_VERIFICATION
        );
        if (modCertVerification) return settings;

        if (settings?.nodes && Array.isArray(settings.nodes)) {
            for (const node of settings.nodes) {
                if (node && node.certVerification === undefined) {
                    node.certVerification = false;
                }
            }
        }
        await settingsStore.setSettings(settings);
        await EncryptedStorage.setItem(MOD_KEY_CERT_VERIFICATION, 'true');
        return settings;
    }

    public async storageMigrationV2(settings: any) {
        const migrationTasks = [];

        // Settings migration
        console.log('Attemping settings migration');
        const settingsMigration = Storage.setItem(STORAGE_KEY, settings).then(
            (writeSuccess) => {
                console.log('Settings migration status', writeSuccess);
                return writeSuccess;
            }
        );
        migrationTasks.push(settingsMigration);

        // Contacts migration
        const contactsMigration = (async () => {
            try {
                const contacts = await EncryptedStorage.getItem(
                    LEGACY_CONTACTS_KEY
                );
                if (contacts) {
                    console.log('Attemping contacts migration');
                    const writeSuccess = await Storage.setItem(
                        CONTACTS_KEY,
                        contacts
                    );
                    console.log('Contacts migration status', writeSuccess);
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading contacts from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(contactsMigration);

        // Notes migration
        const notesMigration = (async () => {
            try {
                const storedKeys = await EncryptedStorage.getItem(
                    LEGACY_NOTES_KEY
                );
                if (storedKeys) {
                    const noteKeys = JSON.parse(storedKeys);
                    console.log('Attemping notes migration');
                    const writeSuccess = await Storage.setItem(
                        NOTES_KEY,
                        noteKeys
                    );
                    console.log('Notes keys migration status', writeSuccess);

                    // Load all legacy notes
                    const notesPromises = noteKeys.map(async (key: string) => {
                        const note = await EncryptedStorage.getItem(key);
                        if (note) {
                            const writeSuccess = await Storage.setItem(
                                key,
                                note
                            );
                            console.log(
                                `Notes keys migration status: ${key}`,
                                writeSuccess
                            );
                            return writeSuccess;
                        }
                    });

                    const noteResults = await Promise.all(notesPromises);
                    return (
                        writeSuccess &&
                        noteResults.every((result) => result !== false)
                    );
                }
            } catch (error) {
                console.error(
                    'Error loading note keys from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(notesMigration);

        // Lightning address migration
        const lightningAddressMigration = (async () => {
            try {
                let activatedSuccess: any = true;
                let hashesSuccess: any = true;

                const activated = await EncryptedStorage.getItem(
                    LEGACY_ADDRESS_ACTIVATED_STRING
                );
                if (activated) {
                    console.log(
                        'Attemping lightning address activated migration'
                    );
                    activatedSuccess = await Storage.setItem(
                        ADDRESS_ACTIVATED_STRING,
                        activated
                    );
                    console.log(
                        'Lightning address activated migration status',
                        activatedSuccess
                    );
                }

                const hashes = await EncryptedStorage.getItem(
                    LEGACY_HASHES_STORAGE_STRING
                );
                if (hashes) {
                    console.log('Attemping lightning address hashes migration');
                    hashesSuccess = await Storage.setItem(
                        HASHES_STORAGE_STRING,
                        hashes
                    );
                    console.log(
                        'Lightning address hashes migration status',
                        hashesSuccess
                    );
                }

                return activatedSuccess && hashesSuccess;
            } catch (error) {
                console.error(
                    'Error loading lightning address data from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(lightningAddressMigration);

        // Backup status migration
        const backupStatusMigration = (async () => {
            try {
                let statusSuccess: any = true;
                let timeSuccess: any = true;

                const status = await EncryptedStorage.getItem(
                    LEGACY_LAST_CHANNEL_BACKUP_STATUS
                );
                if (status) {
                    console.log('Attemping backup status migration');
                    statusSuccess = await Storage.setItem(
                        LAST_CHANNEL_BACKUP_STATUS,
                        status
                    );
                    console.log(
                        'Backup status migration status',
                        statusSuccess
                    );
                }

                const time = await EncryptedStorage.getItem(
                    LEGACY_LAST_CHANNEL_BACKUP_TIME
                );
                if (time) {
                    console.log('Attemping backup time migration');
                    timeSuccess = await Storage.setItem(
                        LAST_CHANNEL_BACKUP_TIME,
                        time
                    );
                    console.log('Backup time migration status', timeSuccess);
                }

                return statusSuccess && timeSuccess;
            } catch (error) {
                console.error(
                    'Error loading backup status from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(backupStatusMigration);

        // POS migration
        const posMigration = (async () => {
            try {
                let hiddenKeySuccess: any = true;
                let standaloneKeySuccess: any = true;
                let categoriesSuccess: any = true;
                let productsSuccess: any = true;

                const posHiddenKey = await EncryptedStorage.getItem(
                    LEGACY_POS_HIDDEN_KEY
                );
                if (posHiddenKey) {
                    console.log('Attemping POS hidden key migration');
                    hiddenKeySuccess = await Storage.setItem(
                        POS_HIDDEN_KEY,
                        posHiddenKey
                    );
                    console.log(
                        'POS hidden key migration status',
                        hiddenKeySuccess
                    );
                }

                const posStandaloneKey = await EncryptedStorage.getItem(
                    LEGACY_POS_STANDALONE_KEY
                );
                if (posStandaloneKey) {
                    console.log('Attemping POS standalone key migration');
                    standaloneKeySuccess = await Storage.setItem(
                        POS_STANDALONE_KEY,
                        posStandaloneKey
                    );
                    console.log(
                        'POS standalone key migration status',
                        standaloneKeySuccess
                    );
                }

                const categories = await EncryptedStorage.getItem(
                    LEGACY_CATEGORY_KEY
                );
                if (categories) {
                    console.log('Attemping POS categories migration');
                    categoriesSuccess = await Storage.setItem(
                        CATEGORY_KEY,
                        categories
                    );
                    console.log(
                        'POS categories migration status',
                        categoriesSuccess
                    );
                }

                const products = await EncryptedStorage.getItem(
                    LEGACY_PRODUCT_KEY
                );
                if (products) {
                    console.log('Attemping POS products migration');
                    productsSuccess = await Storage.setItem(
                        PRODUCT_KEY,
                        products
                    );
                    console.log(
                        'POS products migration status',
                        productsSuccess
                    );
                }

                return (
                    hiddenKeySuccess &&
                    standaloneKeySuccess &&
                    categoriesSuccess &&
                    productsSuccess
                );
            } catch (error) {
                console.error(
                    'Error loading POS data from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(posMigration);

        // Units migration
        const unitsMigration = (async () => {
            try {
                const units = await EncryptedStorage.getItem(LEGACY_UNIT_KEY);
                if (units) {
                    console.log('Attemping units migration');
                    const writeSuccess = await Storage.setItem(UNIT_KEY, units);
                    console.log('Units migration status', writeSuccess);
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading units data from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(unitsMigration);

        // Hidden accounts migration
        const hiddenAccountsMigration = (async () => {
            try {
                const accounts = await EncryptedStorage.getItem(
                    LEGACY_HIDDEN_ACCOUNTS_KEY
                );
                if (accounts) {
                    console.log('Attemping hidden accounts migration');
                    const writeSuccess = await Storage.setItem(
                        HIDDEN_ACCOUNTS_KEY,
                        accounts
                    );
                    console.log(
                        'Hidden accounts migration status',
                        writeSuccess
                    );
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading hidden accounts from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(hiddenAccountsMigration);

        // Currency codes migration
        const currencyCodesMigration = (async () => {
            try {
                const currencyCodes = await EncryptedStorage.getItem(
                    LEGACY_CURRENCY_CODES_KEY
                );
                if (currencyCodes) {
                    console.log('Attemping currency codes migration');
                    const writeSuccess = await Storage.setItem(
                        CURRENCY_CODES_KEY,
                        currencyCodes
                    );
                    console.log(
                        'Currency codes migration status',
                        writeSuccess
                    );
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading currency codes from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(currencyCodesMigration);

        // Activity filters migration
        const activityFiltersMigration = (async () => {
            try {
                const activityFilters = await EncryptedStorage.getItem(
                    LEGACY_ACTIVITY_FILTERS_KEY
                );
                if (activityFilters) {
                    console.log('Attemping activity filters migration');
                    const writeSuccess = await Storage.setItem(
                        ACTIVITY_FILTERS_KEY,
                        activityFilters
                    );
                    console.log(
                        'Activity filters migration status',
                        writeSuccess
                    );
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading activity filters from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(activityFiltersMigration);

        // Embedded LND is backed up migration
        const embeddedLndIsBackedUpMigration = (async () => {
            try {
                const embeddedLndIsBackedUp = await EncryptedStorage.getItem(
                    LEGACY_IS_BACKED_UP_KEY
                );
                if (embeddedLndIsBackedUp) {
                    console.log(
                        'Attemping Embedded LND is backed up migration'
                    );
                    const writeSuccess = await Storage.setItem(
                        IS_BACKED_UP_KEY,
                        embeddedLndIsBackedUp
                    );
                    console.log(
                        'Embedded LND is backed up migration status',
                        writeSuccess
                    );
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading Embedded LND is backed up from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(embeddedLndIsBackedUpMigration);

        // LSPS1 orders migration
        const lsps1OrdersMigration = (async () => {
            try {
                const lsps1orders = await EncryptedStorage.getItem(
                    LEGACY_LSPS1_ORDERS_KEY
                );
                if (lsps1orders) {
                    console.log('Attemping LSPS1 orders migration');
                    const writeSuccess = await Storage.setItem(
                        LSPS_ORDERS_KEY,
                        lsps1orders
                    );
                    console.log('LSPS1 orders migration status', writeSuccess);
                    return writeSuccess;
                }
            } catch (error) {
                console.error(
                    'Error loading LSPS1 orders from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(lsps1OrdersMigration);

        // LNC migrations
        const lncMigration = (async () => {
            try {
                const migrationPromises =
                    settings?.nodes.map(async (node: any) => {
                        if (node.implementation === 'lightning-node-connect') {
                            const baseKey = `${LNC_STORAGE_KEY}:${hash(
                                node.pairingPhrase
                            )}`;
                            const hostKey = `${baseKey}:host`;

                            const baseKeyData: string =
                                (await EncryptedStorage.getItem(baseKey)) ||
                                '{}';

                            console.log(
                                'Attemping LNC base key migration',
                                baseKey
                            );
                            const writeSuccess1 = await Storage.setItem(
                                baseKey,
                                JSON.parse(baseKeyData)
                            );
                            console.log(
                                'LNC base key migration status',
                                writeSuccess1
                            );

                            const hostKeyData = await EncryptedStorage.getItem(
                                hostKey
                            );

                            console.log(
                                'Attemping LNC host key migration',
                                baseKey
                            );
                            const writeSuccess2 = await Storage.setItem(
                                hostKey,
                                hostKeyData
                            );
                            console.log(
                                'LNC host key migration status',
                                writeSuccess2
                            );

                            return writeSuccess1 && writeSuccess2;
                        }
                    }) || [];

                const results = await Promise.all(migrationPromises);
                return results.every((result) => result !== false);
            } catch (error) {
                console.error(
                    'Error loading LNC data from encrypted storage',
                    error
                );
                return false;
            }
        })();
        migrationTasks.push(lncMigration);

        const results = await Promise.all(migrationTasks);
        console.log('storageMigrationV2 completed!', results);
        return results.every((result) => result === true);
    }

    public async migrateCashuSeedVersion(cashuStore: any) {
        // cashuStore is passed as 'any' to avoid circular dependency issues
        // but it's an instance of CashuStore
        // TODO fix circular dependency
        if (
            cashuStore.settingsStore?.implementation === 'embedded-lnd' &&
            cashuStore.seedVersion === undefined
        ) {
            console.log('Migrating Cashu seed version to v1');
            cashuStore.seedVersion = 'v1';
            try {
                await Storage.setItem(
                    `${cashuStore.getNodeDir()}-cashu-seed-version`,
                    'v1'
                );
                console.log('Cashu seed version migrated and saved as v1.');
            } catch (error) {
                console.error(
                    'Error saving migrated Cashu seed version:',
                    error
                );
            }
        }
    }

    public async migrateLegacyCashuKeysToNodeDir(cashuStore: any) {
        const nodeDir = cashuStore.getNodeDir();
        const legacyLndDir = cashuStore.getLndDir();

        if (!nodeDir || !legacyLndDir || nodeDir === legacyLndDir) {
            return;
        }

        const keySuffixes = [
            'cashu-selectedMintUrl',
            'cashu-selectedMintUrls',
            'cashu-multiMintSelectedUrls',
            'cashu-payments'
        ];

        for (const suffix of keySuffixes) {
            const nodeKey = `${nodeDir}-${suffix}`;
            const legacyKey = `${legacyLndDir}-${suffix}`;

            const nodeValue = await Storage.getItem(nodeKey);
            if (nodeValue !== null && nodeValue !== undefined) {
                continue;
            }

            const legacyValue = await Storage.getItem(legacyKey);
            if (legacyValue !== null && legacyValue !== undefined) {
                await Storage.setItem(nodeKey, legacyValue);
            }
        }
    }

    public async keychainCloudSyncMigration() {
        try {
            const hasMigrated = await EncryptedStorage.getItem(
                KEYCHAIN_MIGRATION_KEY
            );

            if (hasMigrated !== 'true') {
                console.log('Attempting keychain cloud sync migration...');

                const settingsData = await this.migrateKey(STORAGE_KEY);

                if (settingsData) {
                    settingsStore.isMigrating = true;
                }

                const migrationKeys = [
                    CONTACTS_KEY,
                    LAST_CHANNEL_BACKUP_STATUS,
                    LAST_CHANNEL_BACKUP_TIME,
                    ADDRESS_ACTIVATED_STRING,
                    HASHES_STORAGE_STRING,
                    POS_HIDDEN_KEY,
                    POS_STANDALONE_KEY,
                    CATEGORY_KEY,
                    PRODUCT_KEY,
                    UNIT_KEY,
                    HIDDEN_ACCOUNTS_KEY,
                    CURRENCY_CODES_KEY,
                    ACTIVITY_FILTERS_KEY,
                    IS_BACKED_UP_KEY,
                    LSPS_ORDERS_KEY,
                    SWAPS_KEY,
                    REVERSE_SWAPS_KEY,
                    SWAPS_RESCUE_KEY,
                    SWAPS_LAST_USED_KEY
                ];

                for (const key of migrationKeys) {
                    await this.migrateKey(key);
                }

                const notesListJson = await this.migrateKey(NOTES_KEY);
                if (notesListJson) {
                    const noteKeys = JSON.parse(notesListJson);
                    if (Array.isArray(noteKeys)) {
                        for (const noteKey of noteKeys) {
                            await this.migrateKey(noteKey);
                        }
                    }
                }

                if (settingsData) {
                    const settings = JSON.parse(settingsData);
                    if (settings.nodes && Array.isArray(settings.nodes)) {
                        for (const node of settings.nodes) {
                            if (
                                node.implementation ===
                                    'lightning-node-connect' &&
                                node.pairingPhrase
                            ) {
                                const baseKey = `${LNC_STORAGE_KEY}:${hash(
                                    node.pairingPhrase
                                )}`;
                                const hostKey = `${baseKey}:host`;

                                await this.migrateKey(baseKey);
                                await this.migrateKey(hostKey);
                            }
                        }
                    }
                }

                await EncryptedStorage.setItem(KEYCHAIN_MIGRATION_KEY, 'true');
                console.log(
                    'Keychain cloud sync migration completed successfully.'
                );
            }

            const cashuMigration = await EncryptedStorage.getItem(
                CASHU_MIGRATION_KEY
            );

            if (cashuMigration !== 'true') {
                // Only run the Cashu keychain migration if the main keychain
                // migration actually ran this time (hasMigrated was not 'true'
                // when we entered). If the main migration was already done from
                // a prior launch, there can't be unmigrated Cashu data in the
                // old keychain — skip the expensive keychain reads.
                if (hasMigrated !== 'true') {
                    console.log('Running Cashu Multi-Node Migration...');

                    const settingsJson = await Storage.getItem(STORAGE_KEY);
                    if (settingsJson) {
                        settingsStore.isMigrating = true;
                        const settings = JSON.parse(settingsJson);
                        if (settings.nodes && Array.isArray(settings.nodes)) {
                            for (const node of settings.nodes) {
                                if (node.implementation === 'embedded-lnd') {
                                    const lndDir = node.lndDir || 'lnd';
                                    await this.migrateCashuForNode(lndDir);
                                }
                            }
                        }
                    }
                    console.log('Cashu Migration Completed.');
                } else {
                    console.log(
                        'Skipping Cashu migration - main keychain migration was already done.'
                    );
                }
                await EncryptedStorage.setItem(CASHU_MIGRATION_KEY, 'true');
            }
        } catch (error) {
            console.error('Error during keychain cloud sync migration:', error);
        }
    }
}

const migrationsUtils = new MigrationsUtils();
export default migrationsUtils;
