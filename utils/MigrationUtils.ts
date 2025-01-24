import stores from '../stores/Stores';
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
    DEFAULT_SPEEDLOADER,
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

import { LEGACY_LSPS1_ORDERS_KEY, LSPS1_ORDERS_KEY } from '../stores/LSPStore';

import { LNC_STORAGE_KEY, hash } from '../backends/LNC/credentialStore';

import {
    LEGACY_ACTIVITY_FILTERS_KEY,
    ACTIVITY_FILTERS_KEY
} from '../stores/ActivityStore';

const LEGACY_IS_BACKED_UP_KEY = 'backup-complete';
export const IS_BACKED_UP_KEY = 'backup-complete-v2';

import EncryptedStorage from 'react-native-encrypted-storage';
import Storage from '../storage';

class MigrationsUtils {
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
                nostrPrivateKey: '',
                nostrRelays: DEFAULT_NOSTR_RELAYS,
                notifications: 0
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
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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

            if (!newSettings?.lsps1ShowPurchaseButton) {
                newSettings.lsps1ShowPurchaseButton = true;
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY5, 'true');
        }

        const MOD_KEY6 = 'egs-host';
        const mod6 = await EncryptedStorage.getItem(MOD_KEY6);
        if (!mod6) {
            if (!newSettings?.speedloader) {
                newSettings.speedloader = DEFAULT_SPEEDLOADER;
                newSettings.customSpeedloader = '';
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
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

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY8, 'true');
        }

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

        return newSettings;
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
                        LSPS1_ORDERS_KEY,
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
        return results.every((result) => result === true);
    }
}

const migrationsUtils = new MigrationsUtils();
export default migrationsUtils;
